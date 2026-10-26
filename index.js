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

export const name = 'session-groups';

/**
 * The sidebar half is browser-only and must activate even on hosts without a
 * Web carrier (DSH Desktop). Optional services are resolved at apply time so
 * the agent bridge can be skipped without blocking the client bundle.
 */
export const inject = [];

const BRIDGE_PATH = '/dsh-session-groups-bridge';
const BRIDGE_TOKEN_HEADER = 'x-dsh-session-groups-token';
const MAX_BODY_BYTES = 512 * 1024;
const SNAPSHOT_TIMEOUT_MS = 12000;
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

export function apply(ctx) {
  const getService = (name) => (typeof ctx.get === 'function' ? ctx.get(name) : undefined);
  const webServer = getService('webServer');
  const tools = getService('tools');
  const approval = getService('approval');
  if (!webServer || !tools || !approval) return;

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

  ctx.effect(
    () => tools.register(tool),
    'session-groups: approval-gated agent tool',
  );
}
