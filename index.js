/**
 * Host half of the session-groups bundle.
 *
 * Groups are a browser-local view over Workspace and Session state. This Host
 * entry owns the approval-gated `session_groups` agent tool plus a small
 * request mailbox: the tool queues read/apply requests, the Web client polls
 * them, and the browser half remains the authority for validation, approval
 * visibility, and localStorage persistence.
 */

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, readdir, rm, stat as statPath, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, sep } from 'node:path';

export const name = 'session-groups';

/**
 * The sidebar half is browser-only and the Host bridge needs the Web carrier.
 * Wait for `webServer` instead of racing activation order: a Host row that
 * applies before webserver is mounted would otherwise return early and never
 * install its bridge or deletion endpoint.
 */
export const inject = ['webServer'];

const BRIDGE_PATH = '/dsh-session-groups-bridge';
const BRIDGE_TOKEN_HEADER = 'x-dsh-session-groups-token';
const MAX_BODY_BYTES = 512 * 1024;
const SNAPSHOT_TIMEOUT_MS = 12000;
const MAX_DATA_SESSIONS = 100;
const APPLY_TIMEOUT_MS = 20000;

function sendJson(res, status, value) {
  if (res.writableEnded) return;
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(value));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function toolText(value) {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }];
}

/**
 * Validate the structural part of an apply plan before asking the user to
 * approve it. Session membership and live coverage are checked by the browser
 * half against the current workspace.
 */
function normalizePlan(args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    throw new Error('参数必须是对象');
  }
  const workspaceId = typeof args.workspaceId === 'string' ? args.workspaceId.trim() : '';
  if (!workspaceId) throw new Error('apply 需要 workspaceId');
  if (!Array.isArray(args.groups)) throw new Error('apply 需要 groups 数组');

  const ids = new Set();
  const groups = [];
  for (const raw of args.groups) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('groups 中的每项必须是对象');
    }
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    if (!id) throw new Error('每个分组都需要非空的 id');
    if (ids.has(id)) throw new Error(`分组 id 重复：${id}`);
    ids.add(id);
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!name) throw new Error(`分组 ${id} 需要非空 name`);
    if (raw.sessionIds !== undefined && !Array.isArray(raw.sessionIds)) {
      throw new Error(`分组 ${id} 的 sessionIds 必须是数组`);
    }
    const sessionIds = raw.sessionIds === undefined ? [] : raw.sessionIds;
    const seen = new Set();
    const cleanSessionIds = [];
    for (const sessionId of sessionIds) {
      if (typeof sessionId !== 'string' || sessionId.length === 0) {
        throw new Error(`分组 ${id} 的 sessionIds 含无效会话`);
      }
      if (seen.has(sessionId)) throw new Error(`分组 ${id} 重复包含会话 ${sessionId}`);
      seen.add(sessionId);
      cleanSessionIds.push(sessionId);
    }
    const parentGroupId = typeof raw.parentGroupId === 'string' && raw.parentGroupId.trim()
      ? raw.parentGroupId.trim()
      : undefined;
    if (parentGroupId === id) throw new Error(`分组 ${id} 不能以自身为父组`);
    groups.push({
      id,
      name,
      color: typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color.trim())
        ? raw.color.trim().toLowerCase()
        : undefined,
      collapsed: raw.collapsed === true,
      parentGroupId,
      sessionIds: cleanSessionIds,
    });
  }

  const byId = new Map(groups.map((group) => [group.id, group]));
  for (const group of groups) {
    if (group.parentGroupId !== undefined && !byId.has(group.parentGroupId)) {
      throw new Error(`分组 ${group.id} 的 parentGroupId 不在计划中`);
    }
  }
  for (const group of groups) {
    let depth = 1;
    let current = group.parentGroupId;
    const seen = new Set([group.id]);
    while (current !== undefined) {
      if (seen.has(current)) throw new Error(`分组 ${group.id} 存在循环嵌套`);
      seen.add(current);
      depth += 1;
      if (depth > 3) throw new Error(`分组 ${group.id} 超过 3 层嵌套`);
      current = byId.get(current)?.parentGroupId;
    }
  }

  const rawUngrouped = args.ungroupedSessionIds === undefined ? [] : args.ungroupedSessionIds;
  if (!Array.isArray(rawUngrouped)) throw new Error('ungroupedSessionIds 必须是数组');
  const ungroupedSessionIds = [];
  const seenUngrouped = new Set();
  for (const sessionId of rawUngrouped) {
    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      throw new Error('ungroupedSessionIds 含无效会话');
    }
    if (seenUngrouped.has(sessionId)) {
      throw new Error(`ungroupedSessionIds 重复包含会话 ${sessionId}`);
    }
    seenUngrouped.add(sessionId);
    ungroupedSessionIds.push(sessionId);
  }

  const assigned = new Set();
  for (const group of groups) {
    for (const sessionId of group.sessionIds) {
      if (assigned.has(sessionId)) throw new Error(`会话 ${sessionId} 出现在多个位置`);
      assigned.add(sessionId);
    }
  }
  for (const sessionId of ungroupedSessionIds) {
    if (assigned.has(sessionId)) throw new Error(`会话 ${sessionId} 同时出现在分组和未分组中`);
    assigned.add(sessionId);
  }

  return {
    workspaceId,
    groups,
    ungroupedSessionIds,
    summary: typeof args.summary === 'string' ? args.summary.trim() : '',
  };
}

/** Human-readable approval reason for one normalized plan. */
function approvalReason(plan) {
  const sessionCount = new Set([
    ...plan.ungroupedSessionIds,
    ...plan.groups.flatMap((group) => group.sessionIds),
  ]).size;
  const counts = `${plan.groups.length} 个分组、${sessionCount} 个会话`;
  const groupNames = plan.groups
    .slice(0, 8)
    .map((group) => `${group.name}（${group.sessionIds.length}）`)
    .join('、');
  const groupsText = groupNames
    ? `分组：${groupNames}${plan.groups.length > 8 ? '…' : ''}`
    : '分组：无（全部放回未分组区）';
  const ungroupedText = plan.ungroupedSessionIds.length > 0
    ? `未分组：${plan.ungroupedSessionIds.length} 个会话`
    : '未分组：0 个会话';
  const detail = `${counts}，工作区 ${plan.workspaceId}\n${groupsText}\n${ungroupedText}`;
  return plan.summary ? `${plan.summary}\n${detail}` : `整理会话区\n${detail}`;
}



/** Encode one session-id segment exactly like the JSONL persistence backend. */
function encodeSegment(raw) {
  if (typeof raw !== 'string' || raw.length === 0) throw new Error('empty session id');
  if (raw === '.') return '~002E';
  if (raw === '..') return '~002E~002E';
  let out = '';
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) out += ch;
    else out += `~${raw.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0')}`;
  }
  return out;
}

/** Encode a project cwd exactly like the JSONL persistence backend. */
function projectKey(cwd) {
  let readable = '';
  let separatorRun = false;
  for (let i = 0; i < cwd.length; i += 1) {
    const ch = cwd[i];
    if (ch === '/' || ch === '\\' || ch === ':') {
      if (!separatorRun) readable += '-';
      separatorRun = true;
    } else if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) {
      readable += ch;
      separatorRun = false;
    } else {
      readable += `~${cwd.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0')}`;
      separatorRun = false;
    }
  }
  return `--${(readable.replace(/^-+/, '') || 'root').slice(0, 251)}--`;
}

function resolveDshHome() {
  const configured = process.env.DSH_HOME;
  if (typeof configured === 'string' && configured.trim() !== '') return configured.trim();
  return join(homedir(), '.dsh');
}

async function candidateSessionDirs(sessionsRoot, cwd, sessionId) {
  const encoded = encodeSegment(sessionId);
  if (typeof cwd === 'string' && cwd.length > 0) {
    return [join(sessionsRoot, projectKey(cwd), encoded)];
  }
  const dirs = [];
  try {
    for (const entry of await readdir(sessionsRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) dirs.push(join(sessionsRoot, entry.name, encoded));
    }
  } catch {
    /* no sessions root means no files to remove */
  }
  return dirs;
}

async function readSessionFileSize(sessionId, cwd) {
  const sessionsRoot = join(resolveDshHome(), 'sessions');
  const search = async (withCwd) => {
    let dirs;
    try {
      dirs = await candidateSessionDirs(sessionsRoot, withCwd, sessionId);
    } catch {
      return null;
    }
    for (const dir of dirs) {
      for (const name of ['session.v4.jsonl.zstd', 'session.v4.jsonl']) {
        try {
          const info = await statPath(join(dir, name));
          if (info.isFile()) return { fileBytes: info.size };
        } catch {
          /* try the next known artifact */
        }
      }
    }
    return null;
  };
  const direct = await search(cwd);
  if (direct) return direct;
  if (cwd) {
    const scanned = await search(undefined);
    if (scanned) return scanned;
  }
  return {};
}

async function removeDirWithRetry(dir, root) {
  const resolved = dir;
  if (!resolved.startsWith(`${root}${sep}`)) throw new Error(`refusing to delete outside sessions root: ${resolved}`);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      if (!existsSync(resolved)) return true;
      await rm(resolved, { recursive: true, force: true });
      return !existsSync(resolved);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === 3 || !/\b(EBUSY|EPERM|ENOTEMPTY)\b/i.test(message)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
    }
  }
  return false;
}

const DEEPSEEK_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

function emptyUsageBucket() {
  return { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
}

function addUsageBucket(target, usage) {
  if (!usage || typeof usage !== 'object') return;
  target.input += Number(usage.inputTokens ?? usage.uncachedInputTokens) || 0;
  target.cacheRead += Number(usage.cacheReadTokens) || 0;
  target.cacheWrite += Number(usage.cacheWriteTokens) || 0;
  target.output += Number(usage.outputTokens) || 0;
}

/** DeepSeek peak: weekdays 09:00-12:00 and 14:00-18:00 Asia/Shanghai. */
function deepSeekPeriodAt(time, holidays = new Set()) {
  const local = new Date((Number(time) || Date.now()) + DEEPSEEK_UTC_OFFSET_MS);
  const day = local.getUTCDay();
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const dateKey = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
  if (day === 0 || day === 6 || holidays.has(dateKey)) return 'offPeak';
  if ((minutes >= 9 * 60 && minutes < 12 * 60) || (minutes >= 14 * 60 && minutes < 18 * 60)) return 'peak';
  return 'offPeak';
}

function deletionError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

async function collectSessionHeaders(sessions, persistence) {
  const headers = new Map();
  try {
    const snapshots = await withTimeout(persistence.list(), 5000, '会话持久化列表读取超时');
    for (const snapshot of snapshots) {
      if (snapshot?.header?.id) headers.set(snapshot.header.id, snapshot.header);
    }
  } catch {
    /* persistence is optional for the live half */
  }
  try {
    for (const live of sessions.list()) {
      if (live?.header?.id) headers.set(live.header.id, { ...live.header, live: true });
    }
  } catch {
    /* live registry may not expose list on an old build */
  }
  return headers;
}

function subagentDescendants(rootId, headers) {
  const children = new Map();
  for (const header of headers.values()) {
    if (header.origin !== 'subagent' || typeof header.parentSession !== 'string') continue;
    const list = children.get(header.parentSession) ?? [];
    list.push(header.id);
    children.set(header.parentSession, list);
  }
  const result = [];
  const visiting = new Set();
  const walk = (parentId) => {
    if (visiting.has(parentId)) return;
    visiting.add(parentId);
    for (const childId of children.get(parentId) ?? []) {
      if (childId === rootId) continue;
      walk(childId);
      result.push(childId);
    }
    visiting.delete(parentId);
  };
  walk(rootId);
  return [...new Set(result)];
}

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(deletionError('timeout', message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function collectChildIds(subagents, rootId) {
  if (!subagents || typeof subagents.listChildren !== 'function') return null;
  const children = [];
  const seen = new Set();
  let failed = false;
  const walk = async (parentId) => {
    let entries;
    try {
      entries = await withTimeout(subagents.listChildren(parentId), 3000, '子代理目录读取超时');
    } catch {
      failed = true;
      return;
    }
    for (const entry of Array.isArray(entries) ? entries : []) {
      const id = typeof entry?.id === 'string' ? entry.id : '';
      if (!id || seen.has(id) || id === rootId) continue;
      seen.add(id);
      await walk(id);
      children.push(id);
    }
  };
  await walk(rootId);
  return failed ? null : children;
}

function deletionCapabilities(sessions, registry, persistence) {
  const entryDetach = (id) => {
    const entry = sessions?.store?.get?.(id);
    return Boolean(entry && typeof entry.detach === 'function');
  };
  return {
    liveStore: Boolean(sessions?.get && sessions?.list && sessions?.store?.get),
    entryDetach: typeof sessions?.store?.get === 'function',
    flush: typeof sessions?.flush === 'function',
    headerStat: typeof persistence?.stat === 'function' && typeof persistence?.list === 'function',
    workspace: Boolean(
      registry
      && typeof registry.list === 'function'
      && typeof registry.archiveSession === 'function'
      && typeof registry.unarchiveSession === 'function'
      && typeof registry.unpinSession === 'function',
    ),
    entityDetach: Boolean(registry && typeof registry.list === 'function'),
    entryDetachProbe: entryDetach,
  };
}

function deletionSafety({ sessions, registry, persistence, subagents, capabilities, header, children, running, options }) {
  const checks = [];
  const add = (key, ok) => checks.push({ key, ok: ok === true });
  add('sessions', capabilities.liveStore);
  add('persistence', capabilities.headerStat);
  add('workspace', capabilities.workspace);
  add('target', Boolean(header));
  const liveIds = [ ...children, ...(header ? [header.id ?? ''] : []), ...running ];
  const uniqueLiveIds = [...new Set(liveIds.filter((id) => typeof id === 'string' && id))];
  let entryDetach = true;
  for (const id of uniqueLiveIds) {
    if (sessions.get?.(id) === undefined) continue;
    const entry = sessions.store?.get?.(id);
    if (!entry || typeof entry.detach !== 'function') entryDetach = false;
  }
  add('entryDetach', entryDetach);
  let entityDetach = true;
  try {
    for (const entity of registry.list?.() ?? []) {
      if (entity.sessionIds?.some((id) => id === options.sessionId || children.includes(id))
        && typeof entity.detachSession !== 'function') entityDetach = false;
    }
  } catch {
    entityDetach = false;
  }
  add('entityDetach', entityDetach);
  add('subagentCatalog', Boolean(subagents?.listChildren) || capabilities.headerStat);
  add('current', !options.currentSessionId || options.currentSessionId !== options.sessionId);
  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}

async function readDeleteTarget(sessions, persistence, sessionId) {
  let header;
  const live = sessions?.get?.(sessionId);
  if (live?.header) header = { ...live.header, live: true };
  if (!header && persistence?.stat) {
    const snapshot = await persistence.stat(sessionId);
    if (snapshot?.header) header = snapshot.header;
  }
  if (!header) throw deletionError('session_not_found', `会话不存在：${sessionId}`);
  return header;
}

async function removeProjectionCache(home, sessionId, warnings) {
  const shard = join(home, 'storages', 'session_projcache', 'sessions', `${sessionId}.json`);
  try {
    if (existsSync(shard)) await rm(shard, { force: true });
  } catch (error) {
    warnings.push(`projection shard: ${error instanceof Error ? error.message : String(error)}`);
  }
  const tablePath = join(home, 'storages', 'session_projcache.json');
  try {
    if (!existsSync(tablePath)) return;
    const parsed = JSON.parse(await readFile(tablePath, 'utf8'));
    const table = parsed?.tables?.sessions;
    if (table && Object.prototype.hasOwnProperty.call(table, sessionId)) {
      delete table[sessionId];
      await writeFile(tablePath, JSON.stringify(parsed, null, 1), 'utf8');
    }
  } catch (error) {
    warnings.push(`projection table: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function deleteSessionTree({ sessions, registry, persistence, subagents }, sessionId, options = {}) {
  const capabilities = deletionCapabilities(sessions, registry, persistence);
  if (!capabilities.liveStore || !capabilities.headerStat || !capabilities.workspace || !capabilities.entryDetach) {
    throw deletionError('unsupported', '当前 DSH 版本缺少安全删除所需的内部接口');
  }
  const header = await readDeleteTarget(sessions, persistence, sessionId);
  let children = await collectChildIds(subagents, sessionId);
  const knownSubagents = Number(options.knownSubagents) || 0;
  if (children === null || (children.length === 0 && knownSubagents > 0)) {
    const allHeaders = await collectSessionHeaders(sessions, persistence);
    const fromHeaders = subagentDescendants(sessionId, allHeaders);
    if (fromHeaders.length > 0) children = fromHeaders;
  }
  if (children === null) children = [];
  const headers = new Map([[sessionId, header]]);
  for (const childId of children) {
    try {
      headers.set(childId, await readDeleteTarget(sessions, persistence, childId));
    } catch {
      /* a child header may already be gone; directory scan still handles it */
    }
  }
  const running = [sessionId, ...children].filter((id) => sessions.get(id) !== undefined);
  const safety = deletionSafety({
    sessions,
    registry,
    persistence,
    subagents,
    capabilities,
    header: { ...header, id: sessionId },
    children,
    running,
    options: { ...options, sessionId },
  });
  if (options.confirm !== true) {
    return {
      ok: true,
      confirmed: false,
      sessionId,
      title: typeof options.title === 'string' ? options.title : undefined,
      running,
      children,
      capabilities,
      safety,
    };
  }
  if (!safety.ok) {
    throw deletionError('safety_failed', '删除安全检测未通过，已取消操作', { safety });
  }
  for (const id of [sessionId, ...children]) {
    if (sessions.get(id) !== undefined) {
      const entry = sessions.store?.get?.(id);
      if (!entry || typeof entry.detach !== 'function') {
        throw deletionError('unsupported', `当前 DSH 版本无法从 Session Store 摘除 ${id}`);
      }
    }
  }
  for (const entity of registry.list()) {
    if (entity.sessionIds?.some((id) => id === sessionId || children.includes(id))
      && typeof entity.detachSession !== 'function') {
      throw deletionError('unsupported', '当前 DSH 版本缺少工作区会话摘除接口');
    }
  }
  if (children.length > 0 && options.cascadeSubagents !== true) {
    throw deletionError('children_present', '该会话包含子代理会话，需要显式确认级联删除', {
      children: children.length,
      childIds: children,
    });
  }
  if (running.length > 0 && options.stopRunning !== true) {
    throw deletionError('running', '会话或子代理仍在运行，需要显式确认停止', {
      running,
    });
  }

  const home = resolveDshHome();
  const sessionsRoot = join(home, 'sessions');
  const order = [...children, sessionId];
  const warnings = [];
  const removedDirs = [];
  const detached = [];
  const stopped = [];

  // Stop/archive and flush every target before deleting any bytes. Children go
  // first so a failing child cannot leave a deleted parent with a live child.
  for (const id of order) {
    try {
      await registry.archiveSession(id, { stopActivity: true });
      stopped.push(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/unknown session|not found/i.test(message)) warnings.push(`stop ${id}: ${message}`);
    }
    try { await registry.unarchiveSession(id); } catch { /* already unarchived */ }
    try { await registry.unpinSession(id); } catch { /* already unpinned */ }
    const live = sessions.get(id);
    if (live) {
      try { await sessions.flush?.(live); } catch (error) { warnings.push(`flush ${id}: ${error instanceof Error ? error.message : String(error)}`); }
      try {
        const entry = sessions.store.get(id);
        if (entry && typeof entry.detach === 'function') {
          entry.detach();
          detached.push(id);
        }
      } catch (error) {
        warnings.push(`detach ${id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    try {
      for (const entity of registry.list()) {
        if (Array.isArray(entity.sessionIds) && entity.sessionIds.includes(id)) {
          await entity.detachSession(id);
        }
      }
    } catch (error) {
      warnings.push(`workspace detach ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Delete child artifacts first. If a child cannot be removed, keep the parent
  // on disk rather than deleting the parent while leaving an orphan child.
  let childFailure = false;
  for (const id of children) {
    const childHeader = headers.get(id) ?? {};
    for (const dir of await candidateSessionDirs(sessionsRoot, childHeader.cwd, id)) {
      try {
        const removed = await removeDirWithRetry(dir, sessionsRoot);
        if (removed) removedDirs.push(dir);
        else { childFailure = true; warnings.push(`rm ${dir}: still present`); }
      } catch (error) {
        childFailure = true;
        warnings.push(`rm ${dir}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    await removeProjectionCache(home, id, warnings);
  }
  if (childFailure) {
    throw deletionError('child_delete_failed', '部分子代理会话未能删除，父会话已保留', { warnings, removedDirs });
  }

  const parentDirs = await candidateSessionDirs(sessionsRoot, header.cwd, sessionId);
  for (const dir of parentDirs) {
    try {
      const removed = await removeDirWithRetry(dir, sessionsRoot);
      if (removed) removedDirs.push(dir);
      else warnings.push(`rm ${dir}: still present`);
    } catch (error) {
      warnings.push(`rm ${dir}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const remaining = parentDirs.filter((dir) => existsSync(dir));
  if (remaining.length > 0) {
    throw deletionError('file_delete_failed', '会话目录仍被占用，未能完全删除', { remaining, warnings });
  }
  await removeProjectionCache(home, sessionId, warnings);

  return {
    ok: true,
    confirmed: true,
    sessionId,
    children,
    removedDirs,
    warnings,
    stopped,
    detached,
  };
}

/**
 * Read the live-session facts the browser cannot derive from projections:
 * current route, available tool schemas, and per-tool call/error counts.
 * Persisted sessions are not materialized here; the client keeps their
 * projection-only fallback.
 */
async function collectLiveSessionData(session, sessionProjections, toolsService, agents, holidays = new Set()) {
  const header = session.requestHeader();
  const context = session.requestContext();
  const toolHistory = session.toolHistory();
  const agent = agents?.get?.(session.id);
  let visibleSchemas = [];
  let toolSource = 'unknown';
  try {
    if (toolsService && agent) {
      visibleSchemas = toolsService.schemas(agent);
      toolSource = 'live';
    } else {
      visibleSchemas = header?.tools ?? toolHistory.tools ?? [];
      toolSource = visibleSchemas.length > 0 ? 'snapshot' : 'unknown';
    }
  } catch {
    visibleSchemas = header?.tools ?? toolHistory.tools ?? [];
    toolSource = visibleSchemas.length > 0 ? 'snapshot' : 'unknown';
  }
  let globalSchemas = [];
  try {
    globalSchemas = toolsService ? toolsService.schemas() : [];
  } catch {
    globalSchemas = [];
  }
  const currentTools = new Map();
  const visibleNames = new Set();
  for (const schema of visibleSchemas) {
    if (!schema || typeof schema.name !== 'string' || !schema.name) continue;
    visibleNames.add(schema.name);
    currentTools.set(schema.name, { name: schema.name, available: true, calls: 0, errors: 0 });
  }
  for (const schema of globalSchemas) {
    if (!schema || typeof schema.name !== 'string' || !schema.name) continue;
    const entry = currentTools.get(schema.name) ?? { name: schema.name, available: false, calls: 0, errors: 0 };
    if (!visibleNames.has(schema.name)) entry.available = false;
    currentTools.set(schema.name, entry);
  }
  let turnEnds = 0;
  const usageByPeriod = { peak: emptyUsageBucket(), offPeak: emptyUsageBucket() };
  const modelChanges = [];
  let firstEventTime = 0;
  let lastEventTime = 0;
  let initialModel = null;
  let lastHeaderModel = null;
  const callNames = new Map();
  try {
    let scannedEvents = 0;
    for (const event of session.ownEvents()) {
      scannedEvents += 1;
      if ((scannedEvents & 255) === 0) {
        await new Promise((resolve) => setImmediate(resolve));
      }
      const eventTime = Number(event.time);
      if (Number.isFinite(eventTime)) {
        if (firstEventTime === 0) firstEventTime = eventTime;
        if (eventTime > lastEventTime) lastEventTime = eventTime;
      }
      if (event.type === 'turn/end') turnEnds += 1;
      if (event.type === 'request/header') {
        const config = event.data?.header?.config;
        if (config?.provider && config?.model) {
          const headerModel = { provider: config.provider, model: config.model };
          if (initialModel === null) initialModel = headerModel;
          if (lastHeaderModel !== null
            && (lastHeaderModel.provider !== headerModel.provider || lastHeaderModel.model !== headerModel.model)) {
            modelChanges.push({ time: eventTime, ...headerModel });
          }
          lastHeaderModel = headerModel;
        }
      }
      if (event.type === 'model/selection') {
        const selected = event.data;
        if (selected?.provider && selected?.model && Number.isFinite(eventTime)) {
          modelChanges.push({
            time: eventTime,
            provider: selected.provider,
            model: selected.model,
          });
        }
      }
      if (event.type === 'assistant/message' && event.data?.usage) {
        addUsageBucket(usageByPeriod[deepSeekPeriodAt(event.time, holidays)], event.data.usage);
      }
      if (event.type === 'tool/call') {
        const name = event.data?.name;
        const callId = event.data?.callId;
        if (typeof name !== 'string' || !name) continue;
        if (callId !== undefined) callNames.set(callId, name);
        const entry = currentTools.get(name) ?? { name, available: false, calls: 0, errors: 0 };
        entry.calls += 1;
        currentTools.set(name, entry);
      } else if (event.type === 'tool/result' && event.data?.error) {
        const callId = event.data?.message?.source?.callId;
        const name = callId === undefined ? undefined : callNames.get(callId);
        if (typeof name === 'string') {
          const entry = currentTools.get(name) ?? { name, available: false, calls: 0, errors: 0 };
          entry.errors += 1;
          currentTools.set(name, entry);
        }
      }
    }
  } catch {
    /* an attached log should be readable; keep the route/tool summary if not */
  }
  let values = {};
  try {
    values = sessionProjections?.snapshot(session, ['tokenUsage', 'contextPressure', 'contextBreakdown', 'sessionStats'])?.values ?? {};
  } catch {
    /* projections are optional for this read */
  }
  const fallbackModel = initialModel ?? (
    context?.provider && context?.model
      ? { provider: context.provider, model: context.model }
      : header?.config?.provider && header?.config?.model
        ? { provider: header.config.provider, model: header.config.model }
        : null
  );
  const modelDurations = new Map();
  const addModelDuration = (model, durationMs) => {
    if (!model?.provider || !model?.model) return;
    const key = `${model.provider}\u0000${model.model}`;
    const current = modelDurations.get(key) ?? {
      provider: model.provider,
      model: model.model,
      durationMs: 0,
    };
    current.durationMs += Math.max(0, Number(durationMs) || 0);
    modelDurations.set(key, current);
  };
  let currentModel = initialModel;
  let currentStart = firstEventTime || lastEventTime;
  for (const change of modelChanges) {
    if (!currentModel) {
      currentModel = { provider: change.provider, model: change.model };
      currentStart = change.time;
      continue;
    }
    if (currentModel.provider === change.provider && currentModel.model === change.model) continue;
    addModelDuration(currentModel, change.time - currentStart);
    currentModel = { provider: change.provider, model: change.model };
    currentStart = change.time;
  }
  if (currentModel && lastEventTime >= currentStart) {
    addModelDuration(currentModel, lastEventTime - currentStart);
  }
  if (modelDurations.size === 0 && fallbackModel) {
    addModelDuration(fallbackModel, 0);
  }
  const modelUsage = [...modelDurations.values()]
    .sort((a, b) => b.durationMs - a.durationMs || a.model.localeCompare(b.model));

  return {
    id: session.id,
    live: true,
    provider: context?.provider ?? header?.config?.provider,
    model: context?.model ?? header?.config?.model,
    modelUsage,
    contextWindow: context?.contextWindow ?? values.contextPressure?.contextWindow,
    tokenUsage: values.tokenUsage,
    contextPressure: values.contextPressure,
    contextBreakdown: values.contextBreakdown,
    usageByPeriod,
    currentPeriod: deepSeekPeriodAt(Date.now(), holidays),
    stats: values.sessionStats ?? { turns: turnEnds },
    toolSource,
    tools: [...currentTools.values()].sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name)),
  };
}

export function apply(ctx) {
  const getService = (name) => (typeof ctx.get === 'function' ? ctx.get(name) : undefined);
  const webServer = getService('webServer');
  const tools = getService('tools');
  const approval = getService('approval');
  // The browser bridge (data + delete) is useful even when the optional
  // agent-tool services are absent. Only the agent tool needs tools+approval.
  if (!webServer) return;

  const bridgeToken = randomUUID();
  const pending = new Map();

  const rejectAll = (message) => {
    for (const entry of pending.values()) {
      try {
        entry.fail(new Error(message));
      } catch {
        /* already settled */
      }
    }
    pending.clear();
  };

  ctx.effect(() => () => rejectAll('session-groups 插件已卸载'), 'session-groups: bridge cleanup');

  const bridgeRequest = (kind, payload, timeoutMs, signal) => {
    const id = randomUUID();
    let settled = false;
    let timer = null;
    let resolvePromise;
    let rejectPromise;
    const promise = new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    const entry = {
      id,
      kind,
      payload,
      claimed: false,
      fail(error) {
        if (settled) return;
        settled = true;
        if (timer !== null) clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
        pending.delete(id);
        rejectPromise(error);
      },
      finish(value) {
        if (settled) return;
        settled = true;
        if (timer !== null) clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
        pending.delete(id);
        resolvePromise(value);
      },
    };
    const onAbort = () => entry.fail(new Error('操作已取消'));
    if (signal) {
      if (signal.aborted) {
        entry.fail(new Error('操作已取消'));
        return promise;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
    pending.set(id, entry);
    timer = setTimeout(() => {
      entry.fail(new Error(
        kind === 'snapshot'
          ? '未收到 DSH Web 客户端的分组数据。请确认页面已打开，且侧栏处于分组视图。'
          : '修改已获批准，但未收到 DSH Web 客户端的执行结果。请确认页面已打开，且侧栏处于分组视图。',
      ));
    }, timeoutMs);
    return promise;
  };

  const claimPending = () => {
    const claimed = [];
    for (const entry of pending.values()) {
      if (entry.claimed) continue;
      entry.claimed = true;
      claimed.push({ id: entry.id, kind: entry.kind, payload: entry.payload });
    }
    return claimed;
  };

  const handleBridge = async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (!url.pathname.startsWith(`${BRIDGE_PATH}/`)) {
        sendJson(res, 404, { ok: false, error: 'not found' });
        return;
      }
      if (url.pathname === `${BRIDGE_PATH}/config`) {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'method not allowed' });
          return;
        }
        sendJson(res, 200, { token: bridgeToken, path: BRIDGE_PATH });
        return;
      }

      const token = req.headers[BRIDGE_TOKEN_HEADER];
      const suppliedToken = Array.isArray(token) ? token[0] : token;
      if (suppliedToken !== bridgeToken) {
        sendJson(res, 403, { ok: false, error: 'forbidden' });
        return;
      }

      if (url.pathname === `${BRIDGE_PATH}/delete`) {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'method not allowed' });
          return;
        }
        const body = await readJsonBody(req);
        const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';
        if (!sessionId || sessionId.length > 256) {
          sendJson(res, 400, { ok: false, code: 'invalid_session_id', error: '无效的会话 id' });
          return;
        }
        try {
          const result = await deleteSessionTree(
            {
              sessions: getService('sessions'),
              registry: getService('workspaceRegistry'),
              persistence: getService('sessionPersistence'),
              subagents: getService('subagents'),
            },
            sessionId,
            {
              confirm: body.confirm === true,
              cascadeSubagents: body.cascadeSubagents === true,
              stopRunning: body.stopRunning === true,
              knownSubagents: Number(body.knownSubagents) || 0,
              currentSessionId: typeof body.currentSessionId === 'string' ? body.currentSessionId : undefined,
              title: typeof body.title === 'string' ? body.title : undefined,
            },
          );
          sendJson(res, 200, result);
        } catch (error) {
          sendJson(res, 200, {
            ok: false,
            code: typeof error?.code === 'string' ? error.code : 'delete_failed',
            error: error instanceof Error ? error.message : String(error),
            details: error?.details ?? {},
          });
        }
        return;
      }

      if (url.pathname === `${BRIDGE_PATH}/data`) {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'method not allowed' });
          return;
        }
        const sessions = getService('sessions');
        const sessionProjections = getService('sessionProjections');
        const sessionPersistence = getService('sessionPersistence');
        const toolsService = getService('tools');
        const agents = getService('agents');
        if (!sessions) {
          sendJson(res, 200, { ok: true, sessions: [], unavailable: true });
          return;
        }
        const body = await readJsonBody(req);
        const requested = Array.isArray(body?.sessionIds) ? body.sessionIds : [];
        const ids = [...new Set(requested.filter((id) => typeof id === 'string' && id.length > 0))].slice(0, MAX_DATA_SESSIONS);
        const holidays = new Set(Array.isArray(body?.holidays) ? body.holidays.filter((day) => typeof day === 'string') : []);
        const rows = [];
        for (const id of ids) {
          const storage = {};
          let snapshot;
          if (sessionPersistence && typeof sessionPersistence.stat === 'function') {
            try {
              snapshot = await sessionPersistence.stat(id);
              if (snapshot && Number.isFinite(Number(snapshot.sizeBytes))) storage.fileBytes = Number(snapshot.sizeBytes);
              if (snapshot && Number.isFinite(Number(snapshot.eventCount))) storage.eventCount = Number(snapshot.eventCount);
            } catch {
              /* size is optional; missing persistence must not hide the rest */
            }
          }
          Object.assign(storage, await readSessionFileSize(id, snapshot?.header?.cwd));
          const session = sessions.get(id);
          if (!session) {
            rows.push({ id, live: false, ...storage });
            continue;
          }
          try {
            rows.push({ ...(await collectLiveSessionData(session, sessionProjections, toolsService, agents, holidays)), ...storage });
          } catch (error) {
            rows.push({ id, live: true, error: error instanceof Error ? error.message : String(error), ...storage });
          }
        }
        sendJson(res, 200, { ok: true, sessions: rows });
        return;
      }

      if (url.pathname === `${BRIDGE_PATH}/poll`) {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'method not allowed' });
          return;
        }
        sendJson(res, 200, { ok: true, requests: claimPending() });
        return;
      }

      if (url.pathname === `${BRIDGE_PATH}/respond`) {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'method not allowed' });
          return;
        }
        const body = await readJsonBody(req);
        const requestId = body && typeof body.requestId === 'string' ? body.requestId : '';
        const entry = pending.get(requestId);
        if (!entry) {
          sendJson(res, 200, { ok: true });
          return;
        }
        if (body.ok === true) entry.finish(body.data ?? null);
        else entry.fail(new Error(typeof body.error === 'string' && body.error ? body.error : 'Web 客户端执行失败'));
        sendJson(res, 200, { ok: true });
        return;
      }

      sendJson(res, 404, { ok: false, error: 'not found' });
    } catch (error) {
      try {
        sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
      } catch {
        /* response already closed */
      }
    }
  };

  ctx.effect(
    () => webServer.register({ kind: 'prefix', path: BRIDGE_PATH, handler: handleBridge }),
    'session-groups: bridge route',
  );

  ctx.effect(() => {
    const onIndex = (table) => {
      table.push({
        kind: 'script',
        placement: 'head',
        text: `window.__DSH_SESSION_GROUPS_BRIDGE__=${JSON.stringify({
          token: bridgeToken,
          path: BRIDGE_PATH,
        })};`,
      });
    };
    ctx.on('webserver/index-inject', onIndex);
    return () => {
      if (typeof ctx.off === 'function') ctx.off('webserver/index-inject', onIndex);
    };
  }, 'session-groups: bridge token injection');

  const tool = {
    name: 'session_groups',
    description: [
      '读取或整理 DSH 侧栏的会话分组。',
      'read：不带 workspaceId 时返回工作区目录（id、标题、会话数、分组数）；带 workspaceId 时返回该工作区的会话和当前分组结构。不修改任何内容。',
      'apply：用一个完整计划替换指定工作区的分组结构。调用前必须先 read；计划必须覆盖该工作区的每个可见会话且恰好一次（放进某个分组的 sessionIds，或放进 ungroupedSessionIds）。执行前会请求用户审核，用户批准后才会写入。',
      '需要 DSH Web 侧栏处于分组视图并保持页面打开；原版视图下没有可读写的本地分组快照。',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['read', 'apply'],
          description: 'read 读取当前分组；apply 提交一次需要审核的分组修改。',
        },
        workspaceId: {
          type: 'string',
          description: 'read 省略时返回工作区目录；传入时返回该工作区的会话与分组详情。apply 时必填。',
        },
        groups: {
          type: 'array',
          description: 'apply 的完整目标分组列表；数组顺序决定同级分组的显示顺序。',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: '分组稳定 id。保留现有分组时复用 read 返回的 id；新分组使用计划内唯一的新 id。',
              },
              name: { type: 'string', description: '分组名称。' },
              color: { type: 'string', description: '可选，#rrggbb；省略时保留/使用预设色。' },
              parentGroupId: {
                type: 'string',
                description: '可选；计划内父分组的 id。最多 3 层嵌套。',
              },
              collapsed: { type: 'boolean', description: '是否折叠。' },
              sessionIds: {
                type: 'array',
                items: { type: 'string' },
                description: '直接放在该分组里的会话 id 顺序。',
              },
            },
            required: ['id', 'name', 'sessionIds'],
          },
        },
        ungroupedSessionIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'apply 时留在工作区未分组区域的会话 id 顺序。',
        },
        summary: {
          type: 'string',
          description: 'apply 时给用户审核看的简短改动摘要，使用用户当前的语言。',
        },
      },
      required: ['action'],
    },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => toolText(value),
    },
    async execute(args, exec) {
      if (!args || typeof args !== 'object' || Array.isArray(args)) {
        throw new Error('参数必须是对象');
      }
      const action = args.action;
      if (action === 'read') {
        const workspaceId = typeof args.workspaceId === 'string' ? args.workspaceId.trim() : '';
        const data = await bridgeRequest(
          'snapshot',
          { workspaceId },
          SNAPSHOT_TIMEOUT_MS,
          exec.signal,
        );
        if (!data || typeof data !== 'object' || data.view !== 'grouped') {
          throw new Error('当前没有可读取的分组视图。请在 DSH Web 中切换到分组视图后重试。');
        }
        const allWorkspaces = Array.isArray(data.workspaces) ? data.workspaces : [];
        if (!workspaceId) {
          const summaries = allWorkspaces.map((workspace) => ({
            id: workspace.id,
            title: workspace.title,
            path: workspace.path,
            sessionCount: Array.isArray(workspace.sessions) ? workspace.sessions.length : 0,
            groupCount: Array.isArray(workspace.groups) ? workspace.groups.length : 0,
          }));
          return {
            action: 'read',
            view: 'grouped',
            workspaces: summaries,
            next: '选择一个工作区的 id，再用 read + workspaceId 读取它的会话和分组详情。',
          };
        }
        const workspaces = allWorkspaces.filter((workspace) => workspace && workspace.id === workspaceId);
        if (workspaces.length === 0) {
          throw new Error(`未找到工作区 ${workspaceId}`);
        }
        return { action: 'read', view: 'grouped', workspaces };
      }
      if (action !== 'apply') {
        throw new Error('action 必须是 read 或 apply');
      }
      const plan = normalizePlan(args);
      if (!exec.agent) throw new Error('无法确定发起工具调用的会话，不能请求审核');
      const reason = approvalReason(plan);
      let outcome;
      try {
        outcome = await approval.request({
          agent: exec.agent,
          toolName: 'session_groups',
          callId: exec.callId,
          reason,
          signal: exec.signal,
        });
      } catch (error) {
        throw new Error(`请求用户审核失败：${error instanceof Error ? error.message : String(error)}`);
      }
      if (outcome !== 'allowed-once') {
        throw new Error(`用户未批准本次会话分组修改（${outcome}）。`);
      }
      const result = await bridgeRequest(
        'apply',
        {
          workspaceId: plan.workspaceId,
          groups: plan.groups,
          ungroupedSessionIds: plan.ungroupedSessionIds,
        },
        APPLY_TIMEOUT_MS,
        exec.signal,
      );
      return { action: 'apply', ...(result && typeof result === 'object' ? result : { result }) };
    },
  };

  if (tools && approval) {
    ctx.effect(
      () => tools.register(tool),
      'session-groups: approval-gated agent tool',
    );
  }
}
