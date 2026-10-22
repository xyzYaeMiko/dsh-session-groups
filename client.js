/**
 * Session Groups — browser half.
 *
 * Registers a replacement occupant for the sidebar shell's `sidebar.workspaces`
 * single slot (priority below the shipped browser), then renders workspaces with
 * draggable sessions grouped into colored, collapsible groups.
 *
 * Groups are browser-local view state: they are namespaced by workspace id and
 * never contain a session that is not a member of that workspace. Session
 * membership, titles, archive state, and the selected session still come from
 * the Session and Workspace controllers through the slot's standard hooks.
 */

window.__ModuleLoader__.load({
  id: 'dsh-session-groups',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'sessionGroups';
    const STORAGE_KEY = 'dsh.session-groups.v1';
    const GROUP_COLORS = [
      '#4c7dff',
      '#e4539c',
      '#a259d9',
      '#3f9bf0',
      '#2fa7a0',
      '#e28a3a',
      '#d6b02f',
      '#8a8f98',
    ];

    const ZH = {
      'section.title': '工作区',
      'section.loading': '正在加载工作区…',
      'section.empty': '还没有工作区',
      'section.emptySearch': '没有匹配的会话',
      'addWorkspace': '添加工作区',
      'addWorkspace.dialogTitle': '添加工作区',
      'addWorkspace.pathLabel': '目录绝对路径',
      'addWorkspace.pathPlaceholder': '例如 /home/user/project',
      'addWorkspace.confirm': '添加',
      'addWorkspace.cancel': '取消',
      'addWorkspace.invalidPath': '请输入绝对路径',
      'addWorkspace.pickerTitle': '选择工作区目录',
      'addWorkspace.useThis': '使用此目录',
      'addWorkspace.loading': '正在读取目录…',
      'addWorkspace.empty': '当前目录没有子文件夹',
      'addWorkspace.parent': '上一级',
      'addWorkspace.home': '主目录',
      'addWorkspace.pickerUnavailable': '目录选择器不可用',
      'browser.title': '选择工作区目录',
      'browser.home': '主目录',
      'browser.newFolder': '新建文件夹',
      'browser.folderName': '文件夹名称',
      'browser.createIn': '在“{name}”中新建文件夹',
      'browser.untitledFolder': '未命名文件夹',
      'browser.create': '创建',
      'browser.cancel': '取消',
      'browser.open': '打开',
      'browser.editPath': '编辑路径',
      'browser.loading': '加载中…',
      'browser.truncated': '文件夹过多，仅显示开头部分。',
      'browser.showHidden': '显示隐藏文件',
      'status.running': '进行中',
      'status.subagentsRunning.one': '{n} 个子智能体运行中',
      'status.subagentsRunning.other': '{n} 个子智能体运行中',
      'status.idle': '空闲',
      'status.waitingApproval': '等待审批',
      'status.planReview': '计划待审',
      'status.waitingAnswer': '等待回答',
      'status.compact.approval': '待审批',
      'status.compact.planReview': '计划待审',
      'status.compact.answer': '待回答',
      'status.completed': '已完成',
      'sessions.expand': '展开其余 {n} 个会话',
      'sessions.collapse': '收起',
      'notice.workspaceAdded': '已添加工作区',
      'search.open': '搜索会话',
      'search.placeholder': '搜索会话',
      'search.clear': '清除搜索',
      'newSession': '新会话',
      'newSession.aria': '在「{name}」中新建会话',
      'workspace.expand': '展开工作区',
      'workspace.collapse': '收起工作区',
      'workspace.menu': '工作区操作',
      'workspace.hideArchived': '隐藏已归档',
      'workspace.sortByTime': '按时间顺序排列',
      'workspace.rename': '重命名工作区',
      'workspace.delete': '删除工作区',
      'workspace.deleteConfirm': '确定删除工作区「{name}」？会话不会被删除。',
      'workspace.sortedByTime': '已按时间顺序排列',
      'workspace.renamed': '已重命名工作区',
      'workspace.deleted': '已删除工作区',
      'workspace.renameFailed': '重命名失败：{reason}',
      'workspace.deleteFailed': '删除失败：{reason}',
      'view.options': '视图选项',
      'view.grouped': '分组视图',
      'view.official': '原版视图',
      'view.expandAllGroups': '展开所有分组',
      'view.collapseAllGroups': '折叠所有分组',
      'view.expandAllWorkspaces': '展开所有工作区',
      'view.collapseAllWorkspaces': '折叠所有工作区',
      'view.resetOrder': '恢复自动排序',
      'ungrouped': '未分组',
      'group.defaultName': '组 {n}',
      'group.aria': '分组：{name}',
      'group.count': '{n}个会话',
      'group.menu': '分组操作',
      'group.newSession': '在分组中新建会话',
      'group.rename': '重命名分组',
      'group.color': '分组颜色',
      'group.collapse': '折叠分组',
      'group.expand': '展开分组',
      'group.dissolve': '解散分组',
      'session.menu': '会话操作',
      'session.pin': '置顶会话',
      'session.unpin': '取消置顶',
      'session.rename': '重命名',
      'session.newGroup': '新建分组',
      'session.removeFromGroup': '从分组中移出',
      'session.moveToGroup': '移入「{name}」',
      'session.archive': '归档会话',
      'session.unarchive': '取消归档',
      'session.fork': '分叉会话',
      'session.copyId': '复制 Session ID',
      'notice.grouped': '已放入分组',
      'notice.ungrouped': '已移出分组',
      'notice.groupDissolved': '已解散分组',
      'notice.archived': '会话已归档',
      'notice.reordered': '已调整顺序',
      'notice.sessionCreated': '已新建会话',
      'notice.newSessionFailed': '新建会话失败：{reason}',
      'notice.sameWorkspace': '只能在本工作区内建立分组',
      'notice.dropUngroup': '拖到此处移出分组',
      'notice.copied': '已复制会话 ID',
      'notice.copyFailed': '复制失败：{reason}',
      'notice.archiveFailed': '归档失败：{reason}',
      'notice.pinFailed': '置顶失败：{reason}',
      'notice.renameFailed': '重命名失败：{reason}',
      'notice.forkFailed': '分叉失败：{reason}',
      'notice.addWorkspaceFailed': '添加工作区失败：{reason}',
      'hint.drag': '拖动会话到另一个会话中段可成组；拖到上下边缘可调整顺序',
      'untitled': '未命名',
      'loading': '加载中…',
      'time.now': '刚刚',
      'time.minutes': '{n} 分钟',
      'time.hours': '{n} 小时',
      'time.days': '{n} 天',
      'status.running': '正在运行',
      'status.pending': '等待处理',
      'status.done': '有未读完成',
      'status.idle': '空闲',
    };

    const EN = {
      'section.title': 'Workspaces',
      'section.loading': 'Loading workspaces…',
      'section.empty': 'No workspaces yet',
      'section.emptySearch': 'No matching sessions',
      'addWorkspace': 'Add workspace',
      'addWorkspace.dialogTitle': 'Add workspace',
      'addWorkspace.pathLabel': 'Absolute directory path',
      'addWorkspace.pathPlaceholder': 'e.g. /home/user/project',
      'addWorkspace.confirm': 'Add',
      'addWorkspace.cancel': 'Cancel',
      'addWorkspace.invalidPath': 'Enter an absolute path',
      'addWorkspace.pickerTitle': 'Choose a workspace directory',
      'addWorkspace.useThis': 'Use this directory',
      'addWorkspace.loading': 'Reading directory…',
      'addWorkspace.empty': 'No subfolders here',
      'addWorkspace.parent': 'Up',
      'addWorkspace.home': 'Home',
      'addWorkspace.pickerUnavailable': 'Directory picker unavailable',
      'browser.title': 'Select Workspace Directory',
      'browser.home': 'Home',
      'browser.newFolder': 'New folder',
      'browser.folderName': 'Folder name',
      'browser.createIn': 'New folder in “{name}”',
      'browser.untitledFolder': 'Untitled folder',
      'browser.create': 'Create',
      'browser.cancel': 'Cancel',
      'browser.open': 'Open',
      'browser.editPath': 'Edit path',
      'browser.loading': 'Loading…',
      'browser.truncated': 'Too many folders to list; only the beginning is shown.',
      'browser.showHidden': 'Show hidden files',
      'status.running': 'Running',
      'status.subagentsRunning.one': '{n} subagent running',
      'status.subagentsRunning.other': '{n} subagents running',
      'status.idle': 'Idle',
      'status.waitingApproval': 'Waiting for approval',
      'status.planReview': 'Plan awaiting review',
      'status.waitingAnswer': 'Waiting for answer',
      'status.compact.approval': 'Approval',
      'status.compact.planReview': 'Plan review',
      'status.compact.answer': 'Answer',
      'status.completed': 'Completed',
      'sessions.expand': 'Show {n} more sessions',
      'sessions.collapse': 'Show less',
      'notice.workspaceAdded': 'Workspace added',
      'search.open': 'Search sessions',
      'search.placeholder': 'Search sessions',
      'search.clear': 'Clear search',
      'newSession': 'New session',
      'newSession.aria': 'New session in {name}',
      'workspace.expand': 'Expand workspace',
      'workspace.collapse': 'Collapse workspace',
      'workspace.menu': 'Workspace actions',
      'workspace.hideArchived': 'Hide archived',
      'workspace.sortByTime': 'Sort by time',
      'workspace.rename': 'Rename workspace',
      'workspace.delete': 'Delete workspace',
      'workspace.deleteConfirm': 'Delete workspace “{name}”? Sessions are kept.',
      'workspace.sortedByTime': 'Sorted by time',
      'workspace.renamed': 'Workspace renamed',
      'workspace.deleted': 'Workspace deleted',
      'workspace.renameFailed': 'Rename failed: {reason}',
      'workspace.deleteFailed': 'Delete failed: {reason}',
      'view.options': 'View options',
      'view.grouped': 'Grouped view',
      'view.official': 'Original view',
      'view.expandAllGroups': 'Expand all groups',
      'view.collapseAllGroups': 'Collapse all groups',
      'view.expandAllWorkspaces': 'Expand all workspaces',
      'view.collapseAllWorkspaces': 'Collapse all workspaces',
      'view.resetOrder': 'Reset to automatic order',
      'ungrouped': 'Ungrouped',
      'group.defaultName': 'Group {n}',
      'group.aria': 'Group: {name}',
      'group.count': '{n} sessions',
      'group.menu': 'Group actions',
      'group.newSession': 'New session in group',
      'group.rename': 'Rename group',
      'group.color': 'Group color',
      'group.collapse': 'Collapse group',
      'group.expand': 'Expand group',
      'group.dissolve': 'Dissolve group',
      'session.menu': 'Session actions',
      'session.pin': 'Pin session',
      'session.unpin': 'Unpin session',
      'session.rename': 'Rename',
      'session.newGroup': 'New group',
      'session.removeFromGroup': 'Remove from group',
      'session.moveToGroup': 'Move into “{name}”',
      'session.archive': 'Archive session',
      'session.unarchive': 'Unarchive session',
      'session.fork': 'Fork session',
      'session.copyId': 'Copy Session ID',
      'notice.grouped': 'Added to group',
      'notice.ungrouped': 'Removed from group',
      'notice.groupDissolved': 'Group dissolved',
      'notice.archived': 'Session archived',
      'notice.reordered': 'Order updated',
      'notice.sessionCreated': 'Session created',
      'notice.newSessionFailed': 'Could not create session: {reason}',
      'notice.sameWorkspace': 'Groups stay inside one workspace',
      'notice.dropUngroup': 'Drop here to leave the group',
      'notice.copied': 'Session ID copied',
      'notice.copyFailed': 'Copy failed: {reason}',
      'notice.archiveFailed': 'Archive failed: {reason}',
      'notice.pinFailed': 'Pin failed: {reason}',
      'notice.renameFailed': 'Rename failed: {reason}',
      'notice.forkFailed': 'Fork failed: {reason}',
      'notice.addWorkspaceFailed': 'Could not add workspace: {reason}',
      'hint.drag': 'Drop on a session middle to group; drop on its edge to reorder',
      'untitled': 'Untitled',
      'loading': 'Loading…',
      'time.now': 'now',
      'time.minutes': '{n}m',
      'time.hours': '{n}h',
      'time.days': '{n}d',
      'status.running': 'Running',
      'status.pending': 'Waiting for you',
      'status.done': 'Unread completion',
      'status.idle': 'Idle',
    };

    const FALLBACK = ZH;

    /* ── small helpers ─────────────────────────────────────────────── */

    function interpolate(text, params) {
      if (!params) return text;
      return String(text).replace(/\{(\w+)\}/g, (match, name) =>
        Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
      );
    }

    function translate(key, params) {
      const text = FALLBACK[key] ?? key;
      return interpolate(text, params);
    }

    function loadPrefs() {
      const empty = { groups: {}, collapsedWorkspaces: {}, manualOrders: {}, topOrders: {}, hideArchived: true };
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return empty;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return empty;
        const groups = {};
        if (parsed.groups && typeof parsed.groups === 'object') {
          for (const [workspaceId, list] of Object.entries(parsed.groups)) {
            if (!workspaceId || !Array.isArray(list)) continue;
            const clean = [];
            for (const item of list) {
              if (!item || typeof item !== 'object') continue;
              if (typeof item.id !== 'string' || item.id.length === 0) continue;
              const name = typeof item.name === 'string' && item.name.trim()
                ? item.name.trim().slice(0, 60)
                : '组';
              const color = GROUP_COLORS.includes(item.color)
                ? item.color
                : GROUP_COLORS[clean.length % GROUP_COLORS.length];
              const sessionIds = Array.isArray(item.sessionIds)
                ? [...new Set(item.sessionIds.filter((id) => typeof id === 'string' && id.length > 0))]
                : [];
              if (sessionIds.length === 0) continue;
              clean.push({
                id: item.id,
                name,
                color,
                collapsed: item.collapsed === true,
                sessionIds,
              });
            }
            if (clean.length > 0) groups[workspaceId] = clean;
          }
        }
        const collapsedWorkspaces = {};
        if (parsed.collapsedWorkspaces && typeof parsed.collapsedWorkspaces === 'object') {
          for (const [workspaceId, value] of Object.entries(parsed.collapsedWorkspaces)) {
            if (workspaceId && value === true) collapsedWorkspaces[workspaceId] = true;
          }
        }
        const manualOrders = {};
        if (parsed.manualOrders && typeof parsed.manualOrders === 'object') {
          for (const [workspaceId, order] of Object.entries(parsed.manualOrders)) {
            if (!workspaceId || !Array.isArray(order)) continue;
            const clean = [...new Set(order.filter((id) => typeof id === 'string' && id.length > 0))];
            if (clean.length > 0) manualOrders[workspaceId] = clean;
          }
        }
        const topOrders = {};
        if (parsed.topOrders && typeof parsed.topOrders === 'object') {
          for (const [workspaceId, order] of Object.entries(parsed.topOrders)) {
            if (!workspaceId || !Array.isArray(order)) continue;
            const clean = [...new Set(order.filter((key) => typeof key === 'string' && key.length > 0))];
            if (clean.length > 0) topOrders[workspaceId] = clean;
          }
        }
        return { groups, collapsedWorkspaces, manualOrders, topOrders, hideArchived: parsed.hideArchived !== false };
      } catch {
        return empty;
      }
    }

    function savePrefs(prefs) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      } catch {
        /* view state is best-effort */
      }
    }

    function newGroupId() {
      return 'g-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    }

    function updateGroups(prefs, workspaceId, groups) {
      const next = { ...prefs.groups };
      if (groups.length === 0) delete next[workspaceId];
      else next[workspaceId] = groups;
      return { ...prefs, groups: next };
    }

    function removeSessionFromGroups(prefs, workspaceId, sessionId) {
      const groups = prefs.groups[workspaceId];
      if (!Array.isArray(groups) || groups.length === 0) return prefs;
      let changed = false;
      const next = [];
      for (const group of groups) {
        if (!group.sessionIds.includes(sessionId)) {
          next.push(group);
          continue;
        }
        changed = true;
        const sessionIds = group.sessionIds.filter((id) => id !== sessionId);
        if (sessionIds.length > 0) next.push({ ...group, sessionIds });
      }
      if (!changed) return prefs;
      return updateGroups(prefs, workspaceId, next);
    }

    function setManualOrder(prefs, workspaceId, order) {
      const manualOrders = { ...(prefs.manualOrders ?? {}) };
      if (order.length === 0) delete manualOrders[workspaceId];
      else manualOrders[workspaceId] = order;
      return { ...prefs, manualOrders };
    }

    function setTopOrder(prefs, workspaceId, order) {
      const topOrders = { ...(prefs.topOrders ?? {}) };
      if (order.length === 0) delete topOrders[workspaceId];
      else topOrders[workspaceId] = order;
      return { ...prefs, topOrders };
    }

    function topKeyOfGroup(groupId) {
      return 'g:' + groupId;
    }

    function topKeyOfSession(sessionId) {
      return 's:' + sessionId;
    }

    const MODE_KEY = 'dsh.session-groups.view';

    function createViewModeStore() {
      let mode = false;
      try {
        mode = window.localStorage.getItem(MODE_KEY) === 'grouped';
      } catch {
        mode = false;
      }
      const listeners = new Set();
      return {
        getSnapshot: () => mode,
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        set: (next) => {
          const grouped = next === true;
          if (grouped === mode) return;
          mode = grouped;
          try {
            window.localStorage.setItem(MODE_KEY, grouped ? 'grouped' : 'official');
          } catch {
            /* best effort */
          }
          for (const listener of [...listeners]) listener();
        },
      };
    }

    function ViewModeToggle(props) {
      const { wide, t, modeStore } = props;
      const grouped = React.useSyncExternalStore(modeStore.subscribe, modeStore.getSnapshot);
      const tr = typeof t === 'function' ? t : translate;
      const label = grouped ? tr('view.official') : tr('view.grouped');
      const css = '.dsg-viewToggle{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}.dsg-viewToggle:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dsg-viewToggle[aria-pressed=true]{color:var(--dsw-alias-state-business-primary)}';
      return h(
        React.Fragment,
        null,
        h('style', { key: 'style' }, css),
        h(
          'button',
          {
            type: 'button',
            className: 'dsg-viewToggle' + (wide ? ' wide' : ''),
            title: label,
            'aria-label': label,
            'aria-pressed': grouped,
            onClick: () => modeStore.set(!grouped),
          },
          h(IconGroup, { width: wide ? 16 : 18, height: wide ? 16 : 18 }),
        ),
      );
    }

    function createGroup(prefs, workspaceId, sessionIds, makeName) {
      const groups = prefs.groups[workspaceId] ?? [];
      const group = {
        id: newGroupId(),
        name: makeName(groups.length),
        color: GROUP_COLORS[groups.length % GROUP_COLORS.length],
        collapsed: false,
        sessionIds: [...new Set(sessionIds)],
      };
      return updateGroups(prefs, workspaceId, [...groups, group]);
    }

    function createGroupAt(prefs, workspaceId, sessionIds, makeName, anchorSessionId, topItems) {
      const groups = prefs.groups[workspaceId] ?? [];
      const group = {
        id: newGroupId(),
        name: makeName(groups.length),
        color: GROUP_COLORS[groups.length % GROUP_COLORS.length],
        collapsed: false,
        sessionIds: [...new Set(sessionIds)],
      };
      let next = updateGroups(prefs, workspaceId, [...groups, group]);
      if (!Array.isArray(topItems) || topItems.length === 0) return next;
      const anchorKey = topKeyOfSession(anchorSessionId);
      const memberKeys = new Set(group.sessionIds.map((sessionId) => topKeyOfSession(sessionId)));
      const groupKey = topKeyOfGroup(group.id);
      const order = [];
      let inserted = false;
      for (const item of topItems) {
        if (item.key === anchorKey) {
          order.push(groupKey);
          inserted = true;
          continue;
        }
        if (memberKeys.has(item.key)) continue;
        order.push(item.key);
      }
      if (!inserted) order.push(groupKey);
      next = setTopOrder(next, workspaceId, order);
      return next;
    }

    function insertIntoGroup(prefs, workspaceId, groupId, sessionId, anchorId, position) {
      const groups = prefs.groups[workspaceId];
      if (!Array.isArray(groups)) return prefs;
      let found = false;
      const next = groups.map((group) => {
        if (group.id !== groupId) return group;
        found = true;
        if (group.sessionIds.includes(sessionId)) return group;
        const sessionIds = [...group.sessionIds];
        let index = anchorId ? sessionIds.indexOf(anchorId) : -1;
        if (index === -1) index = sessionIds.length;
        else if (position === 'after') index += 1;
        sessionIds.splice(index, 0, sessionId);
        return { ...group, sessionIds };
      });
      if (!found) return prefs;
      return updateGroups(prefs, workspaceId, next);
    }

    function patchGroup(prefs, workspaceId, groupId, patch) {
      const groups = prefs.groups[workspaceId];
      if (!Array.isArray(groups)) return prefs;
      let changed = false;
      const next = groups.map((group) => {
        if (group.id !== groupId) return group;
        changed = true;
        return { ...group, ...patch };
      });
      if (!changed) return prefs;
      return updateGroups(prefs, workspaceId, next);
    }

    function dissolveGroup(prefs, workspaceId, groupId) {
      const groups = prefs.groups[workspaceId];
      if (!Array.isArray(groups)) return prefs;
      const next = groups.filter((group) => group.id !== groupId);
      if (next.length === groups.length) return prefs;
      return updateGroups(prefs, workspaceId, next);
    }

    function pinnedFirst(sessionIds, pinnedSessionIds) {
      if (!pinnedSessionIds || pinnedSessionIds.size === 0) return sessionIds;
      const pinned = [];
      const rest = [];
      for (const id of sessionIds) {
        if (pinnedSessionIds.has(id)) pinned.push(id);
        else rest.push(id);
      }
      return [...pinned, ...rest];
    }

    function relativeTime(timestamp, now, t) {
      if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return '';
      const diff = Math.max(0, now - timestamp);
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return t('time.now');
      if (minutes < 60) return t('time.minutes', { n: minutes });
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return t('time.hours', { n: hours });
      const days = Math.floor(hours / 24);
      return t('time.days', { n: days });
    }

    function errorMessage(error) {
      if (!error) return 'unknown';
      if (typeof error === 'string') return error;
      if (typeof error.message === 'string' && error.message.length > 0) return error.message;
      if (error.rpcError && typeof error.rpcError.message === 'string') return error.rpcError.message;
      try {
        return JSON.stringify(error);
      } catch {
        return String(error);
      }
    }

    function useNow(intervalMs) {
      const [now, setNow] = React.useState(() => Date.now());
      React.useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
        return () => window.clearInterval(timer);
      }, [intervalMs]);
      return now;
    }

    /* ── icons ─────────────────────────────────────────────────────── */

    function icon(children, props) {
      return h(
        'svg',
        {
          width: 16,
          height: 16,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
          ...(props ?? {}),
        },
        children,
      );
    }

    const officialIcon = (children, props) => h(
      'svg',
      {
        width: 16,
        height: 16,
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1,
        'aria-hidden': 'true',
        focusable: 'false',
        ...(props ?? {}),
      },
      children,
    );

    const IconChevron = (props) => icon(
      h('path', { d: 'm9 5 7 7-7 7' }),
      props,
    );
    // 原版工作区图标（16×16，strokeWidth 1）：收起=闭合文件夹，展开=打开文件夹。
    const folderSvg = (props, children) => h(
      'svg',
      {
        width: props.width ?? 16,
        height: props.height ?? 16,
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1,
        'aria-hidden': 'true',
      },
      children,
    );
    const IconFolderClose = (props = {}) => folderSvg(props, [
      h('path', { key: 'f', d: 'M1.50439 3.11059C1.50439 2.55831 1.95211 2.1106 2.50439 2.1106H5.43389C5.67773 2.1106 5.91318 2.19969 6.09593 2.36113L7.71649 3.79265C7.89924 3.95409 8.1347 4.04319 8.3785 4.04319H13.4958C14.0481 4.04319 14.4958 4.4909 14.4958 5.04319V12.8894C14.4958 13.4417 14.0481 13.8894 13.4958 13.8894H2.50439C1.95211 13.8894 1.50439 13.4417 1.50439 12.8894V4.04319V3.11059Z' }),
      h('path', { key: 'line', d: 'M3.63501 7.66614H12.3647' }),
    ]);
    const IconFolderOpen = (props = {}) => folderSvg(props, [
      h('path', { key: 'a', d: 'M2.55912 7.93683C2.67584 7.49906 3.0723 7.19446 3.52536 7.19446H13.6491C14.3061 7.19446 14.7846 7.81725 14.6153 8.45209L13.4411 12.856C13.3244 13.2938 12.9279 13.5984 12.4748 13.5984H2.35113C1.69411 13.5984 1.21562 12.9756 1.38489 12.3407L2.55912 7.93683Z', fill: 'currentColor', opacity: 0.16, stroke: 'none' }),
      h('path', { key: 'b', d: 'M13.6491 6.69446C14.6346 6.69453 15.3522 7.62895 15.0983 8.58118L13.9245 12.9845C13.7494 13.6412 13.1539 14.0988 12.4743 14.0988H2.35126C1.36574 14.0988 0.648153 13.1643 0.902044 12.212L2.07587 7.80774C2.25102 7.15128 2.84567 6.69455 3.52509 6.69446H13.6491ZM3.52509 7.69446C3.29865 7.69455 3.10004 7.84674 3.04169 8.06555L1.86786 12.4698C1.78345 12.7872 2.02285 13.0988 2.35126 13.0988H12.4743C12.7007 13.0988 12.8992 12.9463 12.9577 12.7277L14.1325 8.32336C14.2171 8.00598 13.9776 7.69453 13.6491 7.69446H3.52509Z', fill: 'currentColor', stroke: 'none' }),
      h('path', { key: 'c', d: 'M4.7666 1.90137C5.13227 1.90144 5.48571 2.03525 5.75977 2.27734L7.27246 3.61328C7.36379 3.69382 7.48174 3.73828 7.60352 3.73828H12.3994C13.2276 3.73841 13.8993 4.41005 13.8994 5.23828V6.7168C13.8183 6.70327 13.735 6.69436 13.6494 6.69434H12.8994V5.23828C12.8993 4.96233 12.6754 4.73841 12.3994 4.73828H7.60352C7.23781 4.73828 6.88446 4.60438 6.61035 4.3623L5.09766 3.02637C5.00636 2.94576 4.88838 2.90144 4.7666 2.90137H2.0498C1.77366 2.90137 1.5498 3.12523 1.5498 3.40137V9.78223L0.902344 12.2119C0.648452 13.1642 1.36604 14.0986 2.35156 14.0986H2.0498C1.2214 14.0986 0.549838 13.427 0.549805 12.5986V3.40137C0.549805 2.57294 1.22138 1.90137 2.0498 1.90137H4.7666Z', fill: 'currentColor', stroke: 'none' }),
    ]);
    const IconPlus = (props) => icon(
      [h('path', { key: 'h', d: 'M12 5v14' }), h('path', { key: 'v', d: 'M5 12h14' })],
      props,
    );
    const IconSearch = (props) => officialIcon([
      h('path', { key: 'a', d: 'M6.58727 11.8586C9.55061 11.8586 11.9529 9.45637 11.9529 6.49304C11.9529 3.5297 9.55061 1.12744 6.58727 1.12744C3.62394 1.12744 1.22168 3.5297 1.22168 6.49304C1.22168 9.45637 3.62394 11.8586 6.58727 11.8586Z', stroke: 'currentColor' }),
      h('path', { key: 'b', d: 'M10.2991 10.3933L14.7783 14.8725', stroke: 'currentColor' }),
    ], props);
    const IconSliders = (props) => officialIcon([
      h('path', { key: 'a', d: 'M2.3 5h5.85M12.05 5h1.65' }),
      h('circle', { key: 'b', cx: '9.95', cy: '5', r: '1.45' }),
      h('path', { key: 'c', d: 'M2.3 11h1.65M7.85 11h5.85' }),
      h('circle', { key: 'd', cx: '5.75', cy: '11', r: '1.45' }),
    ], { strokeLinecap: 'round', ...(props ?? {}) });
    const IconWorkspaceAdd = (props) => officialIcon([
      h('path', { key: 'a', d: 'M5.54492 2.06738C5.91034 2.06754 6.26318 2.20149 6.53711 2.44336L7.94043 3.68164V4.7998C7.71462 4.74105 7.50367 4.63139 7.32617 4.47461L5.87598 3.19238C5.78477 3.11185 5.66658 3.06754 5.54492 3.06738H2.94922C2.67322 3.06738 2.44946 3.29145 2.44922 3.56738V12.4326C2.44927 12.7087 2.67311 12.9326 2.94922 12.9326H12.9326C13.2086 12.9325 13.4326 12.7086 13.4326 12.4326V8.53613H14.4326V12.4326C14.4326 13.2609 13.7609 13.9325 12.9326 13.9326H2.94922C2.12083 13.9326 1.44927 13.261 1.44922 12.4326V3.56738C1.44946 2.73916 2.12094 2.06738 2.94922 2.06738H5.54492Z', fill: 'currentColor', stroke: 'none' }),
      h('path', { key: 'b', d: 'M9.75977 4.50208H14.5509', stroke: 'currentColor' }),
      h('path', { key: 'c', d: 'M12.1492 6.89758L12.1492 2.10642', stroke: 'currentColor' }),
    ], props);
    const IconNewChatCircle = (props) => officialIcon([
      h('path', { key: 'a', d: 'M2.37091 11.2501C1.58745 9.89288 1.32067 8.29835 1.61969 6.76006C1.91872 5.22177 2.76342 3.8433 3.99826 2.87846C5.2331 1.91362 6.77494 1.42737 8.33988 1.50925C9.90482 1.59113 11.3875 2.23562 12.5149 3.32406C13.6425 4.41269 14.3387 5.87206 14.4754 7.4334C14.612 8.99474 14.18 10.5529 13.2587 11.8209C12.3375 13.0888 10.9891 13.9813 9.46194 14.3337C8.18691 14.628 6.85895 14.5294 5.64989 14.0605C5.1712 13.8748 4.76962 13.4932 4.26534 13.3967C3.67413 13.2835 2.95257 13.5598 2.03794 14.3337', stroke: 'currentColor' }),
      h('path', { key: 'b', d: 'M8 5V11', stroke: 'currentColor' }),
      h('path', { key: 'c', d: 'M5 8H11', stroke: 'currentColor' }),
    ], props);
    const IconCheck = (props) => icon(
      h('path', { d: 'M4 12.5 9.5 18 20 6' }),
      props,
    );
    const IconTriangle = (props) => officialIcon(
      h('path', { d: 'M5.5 4.5C5.5 4.40714 5.52586 4.31612 5.57467 4.23713C5.62349 4.15815 5.69334 4.09431 5.77639 4.05279C5.85945 4.01126 5.95242 3.99368 6.0449 4.00202C6.13738 4.01036 6.22572 4.04429 6.3 4.1L10.967 7.6C11.0291 7.64657 11.0795 7.70697 11.1142 7.77639C11.1489 7.84582 11.167 7.92238 11.167 8C11.167 8.07762 11.1489 8.15418 11.1142 8.22361C11.0795 8.29303 11.0291 8.35343 10.967 8.4L6.3 11.9C6.22572 11.9557 6.13738 11.9896 6.0449 11.998C5.95242 12.0063 5.85945 11.9887 5.77639 11.9472C5.69334 11.9057 5.62349 11.8419 5.57467 11.7629C5.52586 11.6839 5.5 11.5929 5.5 11.5V4.5Z', fill: 'currentColor', stroke: 'none' }),
      props,
    );
    const IconEdit = (props) => officialIcon([
      h('path', { key: 'a', d: 'M8.85596 2.69971H4.19971C3.37141 2.69971 2.69992 3.37146 2.69971 4.19971V11.8003C2.69992 12.6285 3.37141 13.3003 4.19971 13.3003H11.8003C12.6283 13.2999 13.3001 12.6283 13.3003 11.8003V7.89893H14.3003V11.8003C14.3001 13.1806 13.1806 14.2999 11.8003 14.3003H4.19971C2.81913 14.3003 1.69992 13.1808 1.69971 11.8003V4.19971C1.69992 2.81918 2.81913 1.69971 4.19971 1.69971H8.85596V2.69971Z', fill: 'currentColor', stroke: 'none' }),
      h('path', { key: 'b', d: 'M7.7849 8.23878L13.888 2.13574', stroke: 'currentColor' }),
    ], props);
    const IconSort = (props) => officialIcon([
      h('path', { key: 'up', d: 'm5.1 6 2.9-2.9L10.9 6' }),
      h('path', { key: 'down', d: 'm5.1 10 2.9 2.9 2.9-2.9' }),
    ], props);
    const IconTrash = (props) => officialIcon([
      h('path', { key: 'a', d: 'M1.28149 3.88831H14.7187', stroke: 'currentColor' }),
      h('path', { key: 'b', d: 'M5.41602 3.88833V2.47962C5.41602 2.29282 5.52492 2.11366 5.71876 1.98157C5.9126 1.84948 6.17551 1.77527 6.44964 1.77527H9.55053C9.82466 1.77527 10.0876 1.84948 10.2814 1.98157C10.4753 2.11366 10.5842 2.29282 10.5842 2.47962V3.88833', stroke: 'currentColor' }),
      h('path', { key: 'c', d: 'M2.57349 3.88831L3.19366 13.2943C3.21937 13.5502 3.33952 13.7872 3.53065 13.9593C3.72178 14.1313 3.97016 14.2259 4.22729 14.2246H11.7728C12.0299 14.2259 12.2783 14.1313 12.4694 13.9593C12.6605 13.7872 12.7807 13.5502 12.8064 13.2943L13.4266 3.88831', stroke: 'currentColor' }),
      h('path', { key: 'd', d: 'M6.44946 6.98926V11.1238', stroke: 'currentColor' }),
      h('path', { key: 'e', d: 'M9.55054 6.98926V11.1238', stroke: 'currentColor' }),
    ], props);
    const IconClose = (props) => icon(
      [h('path', { key: 'a', d: 'm6 6 12 12' }), h('path', { key: 'b', d: 'm18 6-12 12' })],
      props,
    );
    const IconMore = (props) => officialIcon([
      h('path', { key: 'a', d: 'M3 9C3.55228 9 4 8.55228 4 8C4 7.44772 3.55228 7 3 7C2.44772 7 2 7.44772 2 8C2 8.55228 2.44772 9 3 9Z', fill: 'currentColor' }),
      h('path', { key: 'b', d: 'M8 9C8.55228 9 9 8.55228 9 8C9 7.44772 8.55228 7 8 7C7.44772 7 7 7.44772 7 8C7 8.55228 7.44772 9 8 9Z', fill: 'currentColor' }),
      h('path', { key: 'c', d: 'M13 9C13.5523 9 14 8.55228 14 8C14 7.44772 13.5523 7 13 7C12.4477 7 12 7.44772 12 8C12 8.55228 12.4477 9 13 9Z', fill: 'currentColor' }),
    ], props);
    const IconPin = (props) => icon(
      h('path', { d: 'M9 4h6l-.8 5.2 3.3 3.3H6.5l3.3-3.3L9 4Zm3 8.5V20' }),
      props,
    );
    const IconPinOutline = (props) => officialIcon([
      h('path', { key: 'a', d: 'M9.96976 1.70572L13.1554 3.93629L10.9019 8.12317L11.5158 11.605L10.7192 12.7427L2.52767 7.00693L3.3243 5.86922L6.80612 5.25528L9.96976 1.70572Z', stroke: 'currentColor', strokeLinejoin: 'round' }),
      h('path', { key: 'b', d: 'M6.05285 9.47511C6.27284 9.16094 6.70586 9.08458 7.02003 9.30457C7.3342 9.52455 7.41055 9.95757 7.19057 10.2717L3.98587 14.4708L3.21223 13.9291L6.05285 9.47511Z', fill: 'currentColor', stroke: 'none' }),
    ], props);
    const IconPinFill = (props) => officialIcon([
      h('path', { key: 'a', d: 'M9.96976 1.70572L13.1554 3.93629L10.9019 8.12317L11.5158 11.605L10.7192 12.7427L2.52767 7.00693L3.3243 5.86922L6.80612 5.25528L9.96976 1.70572Z', fill: 'currentColor', stroke: 'currentColor', strokeLinejoin: 'round' }),
      h('path', { key: 'b', d: 'M6.05285 9.47511C6.27284 9.16094 6.70586 9.08458 7.02003 9.30457C7.3342 9.52455 7.41055 9.95757 7.19057 10.2717L3.98587 14.4708L3.21223 13.9291L6.05285 9.47511Z', fill: 'currentColor', stroke: 'none' }),
    ], props);
    const IconArchive = (props) => officialIcon([
      h('path', { key: 'a', d: 'M13.5 2.5H2.5C1.94772 2.5 1.5 2.94772 1.5 3.5V4.5C1.5 5.05228 1.94772 5.5 2.5 5.5H13.5C14.0523 5.5 14.5 5.05228 14.5 4.5V3.5C14.5 2.94772 14.0523 2.5 13.5 2.5Z', stroke: 'currentColor' }),
      h('path', { key: 'b', d: 'M2.5 5.5V13.5C2.5 13.7652 2.60536 14.0196 2.79289 14.2071C2.98043 14.3946 3.23478 14.5 3.5 14.5H12.5C12.7652 14.5 13.0196 14.3946 13.2071 14.2071C13.3946 14.0196 13.5 13.7652 13.5 13.5V5.5', stroke: 'currentColor' }),
      h('path', { key: 'c', d: 'M6.5 9.5H9.5', stroke: 'currentColor' }),
    ], props);
    const IconArchiveOff = (props = {}) => {
      const rawId = typeof React.useId === 'function' ? React.useId() : 'dsg-archive-off';
      const maskId = 'dsg-archive-off-' + String(rawId).replace(/:/g, '');
      return h(
        'svg',
        {
          width: 16,
          height: 16,
          viewBox: '0 0 16 16',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
          ...(props ?? {}),
        },
        h(
          'mask',
          { key: 'mask', id: maskId, maskUnits: 'userSpaceOnUse', x: '0', y: '0', width: '16', height: '16' },
          h('rect', { key: 'bg', x: '0', y: '0', width: '16', height: '16', fill: 'white', stroke: 'none' }),
          h('path', { key: 'slash', d: 'm2.2 1.3 11.6 12.8', stroke: 'black', strokeWidth: 4 }),
        ),
        h(
          'g',
          { key: 'body', mask: `url(#${maskId})` },
          h('rect', { key: 'lid', x: '1.9', y: '2.1', width: '12.2', height: '3.4', rx: '1.1' }),
          h('path', { key: 'box', d: 'M2.95 5.7v4.8a2.9 2.9 0 0 0 2.9 2.9h4.3a2.9 2.9 0 0 0 2.9-2.9V5.7' }),
        ),
        h('path', { key: 'slasher', d: 'm2.2 1.3 11.6 12.8' }),
      );
    };
    const IconBranch = (props) => officialIcon([
      h('path', { key: 'a', d: 'M1.01503 8.0001L5.6964 8.0001C6.41913 8.0001 6.78049 8.0001 7.12115 7.91951C7.4232 7.84804 7.71233 7.73014 7.97821 7.57C8.27809 7.38939 8.5364 7.13669 9.05303 6.63129L11.3281 4.40564', stroke: 'currentColor' }),
      h('path', { key: 'b', d: 'M1.01221 7.9999L5.6964 7.9999C6.41913 7.9999 6.78049 7.9999 7.12115 8.08049C7.4232 8.15196 7.71233 8.26986 7.97821 8.43C8.27809 8.61061 8.5364 8.86331 9.05303 9.36871L11.3281 11.5944', stroke: 'currentColor' }),
      h('circle', { key: 'c', cx: '12.4502', cy: '3.3079', r: '1.56962', stroke: 'currentColor' }),
      h('circle', { key: 'd', cx: '12.4502', cy: '12.6921', r: '1.56962', stroke: 'currentColor' }),
    ], props);
    const IconCopy = (props) => officialIcon([
      h('rect', { key: 'a', x: '1.52075', y: '4.07373', width: '10.3932', height: '10.3932', rx: '2', stroke: 'currentColor' }),
      h('path', { key: 'b', d: 'M11.9792 1.53296C13.36 1.53296 14.4792 2.65225 14.4792 4.03296V9.42847C14.4792 10.3756 13.9521 11.1987 13.1755 11.6228V10.3298C13.3652 10.0787 13.4792 9.7674 13.4792 9.42847V4.03296C13.4792 3.20453 12.8077 2.53296 11.9792 2.53296H6.58374C6.27966 2.53301 5.99684 2.6235 5.7605 2.77905H4.42358C4.85652 2.03463 5.66056 1.53304 6.58374 1.53296H11.9792Z', fill: 'currentColor', stroke: 'none' }),
    ], props);
    const IconUngroup = (props) => icon(
      [h('rect', { key: 'a', x: 4, y: 4, width: 7, height: 7, rx: 1.5 }),
        h('rect', { key: 'b', x: 13, y: 13, width: 7, height: 7, rx: 1.5 }),
        h('path', { key: 'c', d: 'M13 6h7M17 3l3 3-3 3' })],
      props,
    );
    const IconGroup = (props) => icon(
      [h('rect', { key: 'a', x: 4, y: 4, width: 16, height: 6, rx: 2 }),
        h('rect', { key: 'b', x: 4, y: 14, width: 16, height: 6, rx: 2 })],
      props,
    );

    /* ── styles ────────────────────────────────────────────────────── */

    const CSS = `
      .dsg-root{display:flex;flex-direction:column;flex:1;min-height:0;gap:2px;color:var(--dsw-alias-label-primary);font-size:14px}
      .dsg-header{display:flex;align-items:center;gap:2px;flex:none;height:36px;padding:0 2px 0 8px;color:var(--dsw-alias-label-tertiary)}
      .dsg-title{flex:1;min-width:0;font-size:14px;font-weight:400;line-height:20px;letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .dsg-iconBtn{width:28px;height:28px;flex:none;display:inline-flex;align-items:center;justify-content:center;padding:0;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
      .dsg-iconBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
      .dsg-iconBtn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
      .dsg-searchRow{display:flex;align-items:center;gap:4px;flex:none;height:36px;padding:0 2px 0 8px;margin-bottom:2px}
      .dsg-searchInput{flex:1;min-width:0;height:28px;box-sizing:border-box;padding:0 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}
      .dsg-searchInput:focus{border-color:var(--dsw-alias-brand-primary)}
      .dsg-searchInput::placeholder{color:var(--dsw-alias-label-tertiary)}
      .dsg-scroll{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:1px 2px 14px;display:flex;flex-direction:column;gap:2px;scrollbar-width:thin;scrollbar-color:var(--dsw-alias-scrollbar-bg-l2) transparent}
      .dsg-workspace{display:flex;flex-direction:column;gap:1px;margin-bottom:2px}
      .dsg-wsHeader{display:flex;align-items:center;gap:7px;height:34px;padding:0 4px 0 7px;border-radius:7px;cursor:pointer;color:var(--dsw-alias-label-primary);flex:none}
      .dsg-wsHeader:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .dsg-wsHeader.active .dsg-folder{color:var(--dsw-alias-state-business-primary)}
      .dsg-wsHeader:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
      .dsg-folder{width:17px;height:17px;flex:none;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary)}
      .dsg-wsChevron{display:none;width:17px;height:17px;flex:none;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary)}
      .dsg-wsChevron.open{transform:rotate(90deg)}
      .dsg-wsHeader:hover .dsg-folder,.dsg-wsHeader:focus-within .dsg-folder{display:none}
      .dsg-wsHeader:hover .dsg-wsChevron,.dsg-wsHeader:focus-within .dsg-wsChevron{display:inline-flex}
      .dsg-wsActions{display:none;align-items:center;gap:15px;flex:none}
      .dsg-wsHeader:hover .dsg-wsActions,.dsg-wsHeader:focus-within .dsg-wsActions{display:inline-flex}
      .dsg-wsAction{width:16px;height:16px;padding:0;border:none;background:transparent;color:var(--dsw-alias-label-tertiary);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;border-radius:3px}
      .dsg-wsAction:hover{color:var(--dsw-alias-label-primary)}
      .dsg-wsName{flex:1;min-width:0;font-size:14px;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .dsg-wsBody{display:flex;flex-direction:column;gap:1px}
      .dsg-group{display:flex;flex-direction:column;gap:1px;margin:2px 2px 0 24px}
      .dsg-groupHeader{display:flex;align-items:center;gap:6px;height:30px;box-sizing:border-box;padding:0 5px 0 6px;border-radius:7px;cursor:pointer;flex:none;color:var(--dsw-alias-label-primary);background:color-mix(in srgb, var(--dsg-group-color) 11%, transparent)}
      .dsg-groupHeader:hover{background:color-mix(in srgb, var(--dsg-group-color) 18%, transparent)}
      .dsg-groupHeader.selected{box-shadow:inset 0 0 0 1.5px var(--dsg-group-color)}
      .dsg-groupHeader:focus-visible{outline:2px solid var(--dsg-group-color);outline-offset:-2px}
      .dsg-groupDrop{outline:1.5px dashed var(--dsw-alias-state-business-primary);outline-offset:-1px;background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent)!important}
      .dsg-groupHeader.dsg-groupDragging{opacity:.65}
      .dsg-groupHeader.dsg-dropTopBefore{box-shadow:inset 0 2px 0 var(--dsw-alias-state-business-primary)}
      .dsg-groupHeader.dsg-dropTopAfter{box-shadow:inset 0 -2px 0 var(--dsw-alias-state-business-primary)}
      .dsg-groupChevron{width:14px;height:14px;flex:none;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary);transition:transform .14s var(--ds-ease-in-out, ease)}
      .dsg-groupChevron.open{transform:rotate(90deg)}
      .dsg-groupDot{width:8px;height:8px;border-radius:50%;flex:none;background:var(--dsg-group-color);box-shadow:0 0 0 2px color-mix(in srgb, var(--dsg-group-color) 22%, transparent)}
      .dsg-groupStatuses{display:inline-flex;align-items:center;gap:7px;flex:none;margin-right:1px}
      .dsg-groupStatusItem{display:inline-flex;align-items:center;gap:2px}
      .dsg-groupStatusCount{font-size:10.5px;line-height:14px;font-weight:500;color:var(--dsw-alias-label-secondary)}
      .dsg-groupName{flex:1;min-width:0;font-size:12.5px;font-weight:600;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .dsg-groupCount{flex:none;margin-left:auto;color:var(--dsw-alias-label-tertiary);font-size:10.5px;line-height:14px;white-space:nowrap}
      .dsg-groupActions{display:inline-flex;align-items:center;gap:6px;flex:none;max-width:0;overflow:hidden;opacity:0;transition:max-width .14s var(--ds-ease-in-out, ease), opacity .14s var(--ds-ease-in-out, ease)}
      .dsg-groupHeader:hover .dsg-groupActions,.dsg-groupHeader:focus-within .dsg-groupActions{max-width:42px;opacity:1}
      .dsg-groupBody{display:flex;flex-direction:column;gap:1px;margin-left:6px;padding-left:0;border-left:2px solid var(--dsg-group-color)}
      .dsg-groupBody>.dsg-sessionRow{padding-left:26px}
      .dsg-groupBody>.dsg-sessionRow.hasStatus{padding-left:10px}
      .dsg-wsBody>.dsg-sessionRow{margin:0 2px 0 24px;padding-left:10px}
      .dsg-groupBody.dsg-zoneDim{margin-left:6px}
      .dsg-sessionOverflow{width:100%;box-sizing:border-box;height:28px;flex:none;padding:0 12px 0 26px;border:none;border-radius:7px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12px;line-height:20px;text-align:left;cursor:pointer}
      .dsg-sessionOverflow:hover{color:var(--dsw-alias-label-secondary)}
      .dsg-wsBody>.dsg-sessionOverflow,.dsg-simpleList>.dsg-sessionOverflow{margin:0 2px 0 24px;padding-left:10px}
      .dsg-statusSlot{width:16px;height:16px;flex:none;display:inline-flex;align-items:center;justify-content:flex-start}
      .dsg-stateDot{position:relative;display:inline-block;flex:none}
      .dsg-stateDot:after{content:"";position:absolute;inset:20%;border-radius:50%;background:currentColor}
      .dsg-stateDot[data-state=done]{color:var(--dsw-alias-state-success-primary)}
      .dsg-stateDot[data-state=warning]{color:var(--dsw-alias-state-warn-primary)}
      .dsg-stateDot[data-state=error]{color:var(--dsw-alias-state-error-primary)}
      .dsg-stateDot[data-state=idle]{color:var(--dsw-alias-state-idle-primary)}
      .dsg-stateSpinner{flex:none;color:var(--dsw-alias-label-tertiary)}
      .dsg-stateSpinnerMotion{transform-origin:center;animation:dsg-state-dot-spin 1.5s linear infinite}
      .dsg-stateSpinnerTrack,.dsg-stateSpinnerArc{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}
      .dsg-stateSpinnerTrack{opacity:.25}
      .dsg-stateSpinnerArc{stroke-dasharray:12 150;animation:dsg-state-dot-dash 1.5s ease-in-out infinite}
      @keyframes dsg-state-dot-spin{to{transform:rotate(360deg)}}
      @keyframes dsg-state-dot-dash{0%{stroke-dasharray:12 150;stroke-dashoffset:0}50%{stroke-dasharray:24 150;stroke-dashoffset:-6}to{stroke-dasharray:12 150;stroke-dashoffset:0}}
      @media(prefers-reduced-motion:reduce){.dsg-stateSpinnerMotion,.dsg-stateSpinnerArc{animation:none}.dsg-stateSpinnerArc{stroke-dasharray:18 150;stroke-dashoffset:-3}}
      .dsg-visuallyHidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
      .dsg-sessionRow{display:flex;align-items:center;gap:7px;height:30px;box-sizing:border-box;padding:0 5px 0 8px;border-radius:7px;cursor:pointer;flex:none;position:relative;min-width:0;color:var(--dsw-alias-label-primary)}
      .dsg-sessionRow:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .dsg-sessionRow.active{background:var(--dsw-alias-interactive-bg-hover)}
      .dsg-sessionRow:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
      .dsg-sessionRow.dsg-dropBefore::before,.dsg-sessionRow.dsg-dropAfter::after{content:"";z-index:1;background:linear-gradient(55deg,transparent calc(50% - 1px),var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px),transparent calc(50% + 1px)) 0 0/5px 7px no-repeat,linear-gradient(125deg,transparent calc(50% - 1px),var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px),transparent calc(50% + 1px)) 0 5px/5px 7px no-repeat,linear-gradient(var(--dsw-alias-state-business-primary) 0 0) 4px 5px/calc(100% - 4px) 2px no-repeat;pointer-events:none;height:12px;position:absolute;left:0;right:4px}
      .dsg-sessionRow.dsg-dropBefore::before{top:-7px}
      .dsg-sessionRow.dsg-dropAfter::after{bottom:-7px}
      .dsg-sessionRow.dsg-dropGroup{outline:2px dashed var(--dsw-alias-state-business-primary);outline-offset:-2px;background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent)}
      .dsg-sessionRow.archived .dsg-titleText{color:var(--dsw-alias-label-caption)}
      .dsg-titleText{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:14px;line-height:20px;letter-spacing:.005em}
      .dsg-time{flex:none;margin-left:2px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:14px;white-space:nowrap}
      .dsg-rowMore{width:22px;height:22px;flex:none;display:none;align-items:center;justify-content:center;padding:0;border:none;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
      .dsg-sessionRow:hover .dsg-rowMore,.dsg-sessionRow:focus-within .dsg-rowMore{display:inline-flex}
      .dsg-rowMore:hover{background:var(--dsw-alias-interactive-bg-active);color:var(--dsw-alias-label-primary)}
      .dsg-ungroupedZone{display:flex;flex-direction:column;gap:1px;min-height:4px;border-radius:7px;margin-top:1px;padding:0}
      .dsg-ungroupedZone>.dsg-sessionRow{margin:0 2px 0 24px;padding-left:10px}
      .dsg-simpleList>.dsg-sessionRow{margin:0 2px 0 24px;padding-left:10px}
      .dsg-ungroupedZone.dsg-zoneHint{min-height:30px;border:1px dashed var(--dsw-alias-border-l2);align-items:center;justify-content:center}
      .dsg-ungroupedZone.dsg-zoneDrop{border-color:transparent;background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent)}
      .dsg-zoneText{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;padding:6px 0}
      .dsg-ungroupedHeader{display:flex;align-items:center;gap:7px;height:30px;padding:0 8px 0 10px;flex:none;color:var(--dsw-alias-label-secondary);font-size:11.5px;font-weight:500}
      .dsg-simpleList{display:flex;flex-direction:column;gap:1px;padding-left:0}
      .dsg-empty{padding:26px 16px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;display:flex;flex-direction:column;align-items:center;gap:10px}
      .dsg-emptyAction{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}
      .dsg-emptyAction:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .dsg-viewToggle{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
      .dsg-viewToggle:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
      .dsg-viewToggle[aria-pressed=true]{color:var(--dsw-alias-state-business-primary)}
      .dsg-viewToggle.wide{width:28px}
      .dsg-modalBackdrop{position:fixed;inset:0;z-index:95;background:rgb(0 0 0 / .24);display:flex;align-items:flex-start;justify-content:center;padding-top:16vh}
      .dsg-modal{width:380px;max-width:calc(100vw - 32px);box-sizing:border-box;padding:16px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-overlay);box-shadow:0 18px 48px rgb(0 0 0 / .24);color:var(--dsw-alias-label-primary)}
      .dsg-modalTitle{font-size:14px;font-weight:600;line-height:20px;margin-bottom:14px}
      .dsg-modalLabel{display:block;font-size:12px;line-height:16px;color:var(--dsw-alias-label-secondary);margin-bottom:6px}
      .dsg-modalInput{width:100%;height:32px;box-sizing:border-box;padding:0 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}
      .dsg-modalInput:focus{border-color:var(--dsw-alias-state-business-primary)}
      .dsg-modalInput:disabled{opacity:.6}
      .dsg-modalError{margin-top:8px;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:16px;overflow-wrap:break-word}
      .dsg-modalActions{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:16px}
      .dsg-modalButton{height:30px;padding:0 13px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}
      .dsg-modalButton:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .dsg-modalButton.primary{border-color:transparent;background:var(--dsw-alias-state-business-primary);color:#fff}
      .dsg-modalButton.primary:hover{background:var(--dsw-alias-state-business-primary);opacity:.9}
      .dsg-modalButton:disabled{opacity:.55;cursor:default}
      .dsg-modal.dsg-picker{width:680px;height:min(500px,calc(100vh - 80px));display:flex;flex-direction:column}
      .dsg-pickerPathRow{display:flex;align-items:center;gap:6px;flex:none;margin-bottom:8px}
      .dsg-pickerPathInput{flex:1;min-width:0;height:30px;box-sizing:border-box;padding:0 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;outline:none}
      .dsg-pickerPathInput:focus{border-color:var(--dsw-alias-state-business-primary)}
      .dsg-pickerIconButton{width:30px;height:30px;flex:none;display:inline-flex;align-items:center;justify-content:center;padding:0;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:14px;cursor:pointer}
      .dsg-pickerIconButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
      .dsg-pickerIconButton:disabled{opacity:.4;cursor:default}
      .dsg-pickerCrumbs{display:flex;align-items:center;gap:2px;flex-wrap:nowrap;overflow-x:auto;flex:none;padding-bottom:6px;margin-bottom:6px;border-bottom:1px solid var(--dsw-alias-border-l1);scrollbar-width:thin}
      .dsg-pickerCrumb{flex:none;max-width:150px;height:24px;padding:0 6px;border:none;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
      .dsg-pickerCrumb:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
      .dsg-pickerCrumb.current{color:var(--dsw-alias-label-primary)}
      .dsg-pickerCrumb:disabled{opacity:.6;cursor:default}
      .dsg-pickerList{flex:1;min-height:0;overflow-y:auto;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);padding:4px;display:flex;flex-direction:column;gap:1px;scrollbar-width:thin}
      .dsg-pickerEntry{display:flex;align-items:center;gap:8px;height:32px;padding:0 9px;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;text-align:left;cursor:pointer}
      .dsg-pickerEntry:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
      .dsg-pickerEntry:disabled{opacity:.6;cursor:default}
      .dsg-pickerEntryIcon{width:16px;height:16px;flex:none;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary)}
      .dsg-pickerEntryName{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dsg-pickerEmpty{display:flex;flex:1;align-items:center;justify-content:center;padding:18px;color:var(--dsw-alias-label-tertiary);font-size:12px;text-align:center}
.dsgDir_dialog.dsgDir_dialog{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);gap:0;width:min(680px,100%);height:min(500px,100dvh - 32px);padding:0}.dsgDir_editorScope{display:contents}.dsgDir_header{border-bottom:.5px solid var(--dsw-alias-border-l3);flex-direction:column;flex:none;gap:8px;padding:16px 14px 8px 24px;display:flex}.dsgDir_title{min-height:28px;color:var(--dsw-alias-label-primary);align-items:flex-end;margin:0;font-size:16px;font-weight:510;line-height:24px;display:flex}.dsgDir_crumbBar{box-sizing:border-box;border-radius:var(--dsw-radius-sm);border:1px solid #0000;align-items:center;gap:4px;min-height:24px;margin-left:-9px;padding:0 8px;display:flex}.dsgDir_crumbBar:has(.dsgDir_crumbEditZone:enabled:hover),.dsgDir_crumbBar:has(.dsgDir_crumbEditZone:focus-visible),.dsgDir_crumbBar:has(.dsgDir_pathInput){border-color:var(--dsw-alias-border-l2)}.dsgDir_millerRow{scrollbar-width:none;flex:1 1 0;align-items:stretch;gap:12px;min-height:0;display:flex;overflow-x:auto}.dsgDir_crumbTrail{scrollbar-width:none;flex:0 auto;align-items:center;gap:4px;min-width:0;display:flex;overflow-x:auto}.dsgDir_crumbSeat{flex:none;align-items:center;gap:4px;min-width:0;display:inline-flex}.dsgDir_crumb{text-overflow:ellipsis;white-space:nowrap;max-width:160px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;padding:0;font-size:13px;font-weight:500;line-height:20px;overflow:hidden}.dsgDir_crumb:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}.dsgDir_crumb:hover{color:var(--dsw-alias-label-primary)}.dsgDir_crumbChevron{color:var(--dsw-alias-label-tertiary);flex:none}.dsgDir_crumbEditZone{cursor:text;background:0 0;border:none;outline:none;flex:1 0 34px;justify-content:flex-end;align-items:center;min-width:34px;height:22px;padding:0;display:flex}.dsgDir_crumbEditGlyph{color:var(--dsw-alias-label-tertiary);flex:none}.dsgDir_crumbEditZone:enabled:hover .dsgDir_crumbEditGlyph,.dsgDir_crumbEditZone:focus-visible .dsgDir_crumbEditGlyph{color:var(--dsw-alias-label-primary)}.dsgDir_crumbEditZone:disabled{cursor:default}.dsgDir_crumbEditZone:disabled .dsgDir_crumbEditGlyph{color:var(--dsw-alias-label-caption)}.dsgDir_pathInput{box-sizing:border-box;min-width:0;height:22px;color:var(--dsw-alias-label-primary);background:0 0;border:none;outline:none;flex:1 1 0;padding:0;font-size:13px;line-height:20px}.dsgDir_content{flex-direction:column;flex:1 1 0;min-height:0;padding:16px 16px 16px 24px;display:flex;position:relative}.dsgDir_column{flex-direction:column;flex:1 1 0;gap:2px;min-width:256px;padding-right:8px;display:flex;overflow-y:auto}.dsgDir_divider{background:var(--dsw-alias-border-l3);flex:none;width:.5px}.dsgDir_rowSeat{flex:none;display:flex}.dsgDir_row{border-radius:var(--dsw-radius-sm);text-align:left;cursor:pointer;background:0 0;border:none;flex:none;align-items:center;gap:4px;width:100%;height:28px;padding:4px;display:flex}.dsgDir_row:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}.dsgDir_row:hover{background:var(--dsw-alias-interactive-bg-hover)}.dsgDir_rowSelected,.dsgDir_rowSelected:hover{background:var(--dsw-alias-interactive-bg-active,var(--dsw-alias-interactive-bg-hover))}.dsgDir_rowIcon{color:var(--dsw-alias-label-secondary);flex:none}.dsgDir_rowIconSelected{color:var(--dsw-alias-button-info-fill);flex:none}.dsgDir_rowName{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-primary);flex:1 1 0;font-size:13px;font-weight:500;line-height:20px;overflow:hidden}.dsgDir_rowChevron{color:var(--dsw-alias-label-tertiary);flex:none}.dsgDir_status,.dsgDir_error{padding:4px 120px 4px 4px;font-size:12px;line-height:18px}.dsgDir_status{color:var(--dsw-alias-label-secondary)}.dsgDir_error{color:var(--dsw-alias-state-error-primary)}.dsgDir_loadingFloat{background:var(--dsw-alias-bg-layer-2);padding:2px 8px;position:absolute;bottom:8px;right:16px}.dsgDir_footerBar{border-top:.5px solid var(--dsw-alias-border-l3);flex-wrap:wrap;flex:none;align-items:center;gap:8px;padding:16px 24px;display:flex}.dsgDir_showHiddenToggle{color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;background:0 0;border:none;align-items:center;gap:4px;padding:0;font-size:13px;font-weight:500;line-height:20px;display:inline-flex}.dsgDir_showHiddenToggle:hover{color:var(--dsw-alias-label-primary)}.dsgDir_showHiddenToggle:disabled{color:var(--dsw-alias-label-caption);cursor:default}.dsgDir_showHiddenToggleActive{color:var(--dsw-alias-label-primary)}.dsgDir_footerGap{flex:1 1 0}.dsgDir_footerAction{min-width:72px}.dsgDir_createDialog.dsgDir_createDialog{gap:0;width:min(380px,100%);padding:0}.dsgDir_createBody{flex-direction:column;gap:12px;padding:22px 24px 20px;display:flex}.dsgDir_createTitle{color:var(--dsw-alias-label-primary);margin:0;font-size:16px;font-weight:510;line-height:24px}.dsgDir_createIn{color:var(--dsw-alias-label-primary);margin:0;font-size:14px;line-height:22px}.dsgDir_createInput{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);width:100%;height:44px;color:var(--dsw-alias-label-primary);background:0 0;outline:none;padding:7px 14px;font-size:14px;line-height:22px}.dsgDir_createInput::placeholder{color:var(--dsw-alias-label-caption)}.dsgDir_createActions{justify-content:flex-end;align-items:center;gap:8px;margin-top:8px;display:flex}

      .dsgDir_backdrop{position:fixed;inset:0;z-index:96;display:flex;align-items:center;justify-content:center;padding:16px;background:rgb(0 0 0 / .3)}
      .dsgDir_panel{position:relative;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--dsw-alias-border-l3);border-radius:12px;background:var(--dsw-alias-bg-overlay);box-shadow:0 24px 64px rgb(0 0 0 / .28);color:var(--dsw-alias-label-primary)}
      .dsgDir_btn{box-sizing:border-box;height:32px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 14px;border:1px solid transparent;border-radius:8px;font:inherit;font-size:13px;font-weight:500;line-height:20px;cursor:pointer;white-space:nowrap}
      .dsgDir_btn:disabled{opacity:.5;cursor:default}
      .dsgDir_btnOutline{border-color:var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary)}
      .dsgDir_btnOutline:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
      .dsgDir_btnPrimary{border-color:transparent;background:var(--dsw-alias-state-business-primary);color:#fff}
      .dsgDir_btnPrimary:hover:not(:disabled){opacity:.9}
      .dsgDir_footerAction{min-width:72px}
      .dsgDir_createBackdrop{position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;padding:16px;background:rgb(0 0 0 / .24);border-radius:12px}
      .dsgDir_createPanel{display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--dsw-alias-border-l3);border-radius:12px;background:var(--dsw-alias-bg-overlay);box-shadow:0 18px 48px rgb(0 0 0 / .28);color:var(--dsw-alias-label-primary)}
      .dsg-rail{display:flex;flex-direction:column;align-items:center;gap:6px;padding:2px 0 8px}
      .dsg-railBtn{width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer}
      .dsg-railBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .dsg-railBtn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
      .dsg-editInput{flex:1;min-width:0;height:22px;box-sizing:border-box;padding:0 5px;border:1px solid var(--dsw-alias-brand-primary);border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;font-weight:600;outline:none}
      .dsg-menu{position:fixed;z-index:80;min-width:214px;max-width:300px;max-height:312px;overflow-y:auto;padding:4px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-overlay);box-shadow:0 8px 28px rgb(0 0 0 / .22);color:var(--dsw-alias-label-primary)}
      .dsg-menuItem{display:flex;align-items:center;gap:8px;width:100%;height:29px;box-sizing:border-box;padding:0 8px;border:none;border-radius:5px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
      .dsg-menuItem:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .dsg-menuItem:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
      .dsg-menuItem.danger{color:var(--dsw-alias-state-error-primary)}
      .dsg-menuItem.danger .dsg-menuIcon{color:var(--dsw-alias-state-error-primary)}
      .dsg-menuItem.danger:hover,.dsg-menuItem.danger:focus-visible{background:var(--dsw-alias-interactive-bg-hover-danger)}
      .dsg-menuIcon{width:16px;height:16px;flex:none;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary)}
      .dsg-menuLabel{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
      .dsg-menuCheck{flex:none;margin-left:12px;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-primary)}
      .dsg-menuShortcut{flex:none;margin-left:12px;color:var(--dsw-alias-label-tertiary);font-size:10.5px;line-height:14px;white-space:nowrap}
      .dsg-rowAction{width:22px;height:22px;flex:none;display:none;align-items:center;justify-content:center;padding:0;border:none;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
      .dsg-sessionRow:hover .dsg-rowAction,.dsg-sessionRow:focus-within .dsg-rowAction{display:inline-flex}
      .dsg-rowAction:hover{background:var(--dsw-alias-interactive-bg-active);color:var(--dsw-alias-label-primary)}
      .dsg-sessionRow:hover .dsg-time,.dsg-sessionRow:focus-within .dsg-time{display:none}
      .dsg-menuLabelText{padding:4px 8px 2px;color:var(--dsw-alias-label-tertiary);font-size:10.5px;line-height:14px;white-space:nowrap}
      .dsg-menuSeparator{height:1px;margin:4px 6px;background:var(--dsw-alias-border-l1)}
      .dsg-swatches{display:flex;align-items:center;gap:7px;padding:3px 9px 6px;flex-wrap:wrap}
      .dsg-swatch{width:17px;height:17px;padding:0;border-radius:50%;border:2px solid transparent;cursor:pointer;flex:none}
      .dsg-swatch.selected{border-color:var(--dsw-alias-label-primary);box-shadow:0 0 0 1px var(--dsw-alias-bg-overlay)}
      .dsg-swatch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
    `;

    /* ── shared small components ──────────────────────────────────── */

    function MenuItem({ icon: menuIcon, label, danger, shortcut, checked, onClick }) {
      return h(
        'button',
        {
          type: 'button',
          role: 'menuitem',
          className: danger ? 'dsg-menuItem danger' : 'dsg-menuItem',
          title: label,
          onClick,
        },
        menuIcon ? h('span', { className: 'dsg-menuIcon' }, menuIcon) : null,
        h('span', { className: 'dsg-menuLabel' }, label),
        shortcut ? h('span', { className: 'dsg-menuShortcut' }, shortcut) : null,
        checked
          ? h('span', { className: 'dsg-menuCheck' }, h(IconCheck, { width: 14, height: 14 }))
          : null,
      );
    }

    function InlineMenu({ rect, onClose, children }) {
      const ref = React.useRef(null);
      React.useEffect(() => {
        const close = (event) => {
          if (ref.current && ref.current.contains(event.target)) return;
          onClose();
        };
        const keyDown = (event) => {
          if (event.key === 'Escape') onClose();
        };
        document.addEventListener('pointerdown', close, true);
        document.addEventListener('keydown', keyDown, true);
        window.addEventListener('scroll', onClose, true);
        window.addEventListener('resize', onClose);
        return () => {
          document.removeEventListener('pointerdown', close, true);
          document.removeEventListener('keydown', keyDown, true);
          window.removeEventListener('scroll', onClose, true);
          window.removeEventListener('resize', onClose);
        };
      }, [onClose]);

      const width = 252;
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
      const left = Math.max(8, Math.min(rect.left, viewportWidth - width - 8));
      const estimated = 300;
      let top = rect.bottom + 4;
      if (top + estimated > viewportHeight) top = Math.max(8, rect.top - estimated - 4);
      return h(
        'div',
        {
          ref,
          className: 'dsg-menu',
          role: 'menu',
          style: { left, top, width },
          onPointerDown: (event) => event.stopPropagation(),
        },
        children,
      );
    }

    function GroupNameEditor({ initialValue, onCommit, onCancel }) {
      const [value, setValue] = React.useState(initialValue ?? '');
      const inputRef = React.useRef(null);
      const finishedRef = React.useRef(false);
      React.useEffect(() => {
        const input = inputRef.current;
        if (!input) return;
        input.focus();
        input.select();
      }, []);
      const commit = () => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        const next = value.trim();
        if (next) onCommit(next.slice(0, 60));
        else onCancel();
      };
      const cancel = () => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        onCancel();
      };
      return h('input', {
        ref: inputRef,
        className: 'dsg-editInput',
        value,
        maxLength: 60,
        'aria-label': NS,
        onClick: (event) => event.stopPropagation(),
        onPointerDown: (event) => event.stopPropagation(),
        onChange: (event) => setValue(event.target.value),
        onKeyDown: (event) => {
          event.stopPropagation();
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
          }
        },
        onBlur: commit,
      });
    }

    /* ── session status dots (same data + visual as the official browser) ── */

    function statusValue(statuses, sessionId) {
      if (!statuses) return undefined;
      if (typeof statuses.get === 'function') return statuses.get(sessionId);
      return statuses[sessionId];
    }

    function visiblePendingKind(kind) {
      if (kind === 'approval' || kind === 'plan-review' || kind === 'question') return kind;
      return undefined;
    }

    function runningChildCountFor(list, parentId, statuses) {
      const catalog = list.projectionsBySession?.[parentId]?.values?.subagentCatalog;
      if (!Array.isArray(catalog)) return 0;
      let count = 0;
      for (const child of catalog) {
        const status = statusValue(statuses, child.id);
        if ((status?.running ?? list.byId?.[child.id]?.running) === true) count += 1;
      }
      return count;
    }

    function buildSessionStatuses(node, tr) {
      const subagents = node.runningSubagentCount > 0
        ? {
            state: 'ongoing',
            label: tr(
              node.runningSubagentCount === 1 ? 'status.subagentsRunning.one' : 'status.subagentsRunning.other',
              { n: node.runningSubagentCount },
            ),
          }
        : undefined;
      let pending;
      if (node.pendingInteraction === 'approval') {
        pending = {
          state: 'warning',
          label: tr('status.waitingApproval'),
          trailingLabel: tr('status.compact.approval'),
        };
      } else if (node.pendingInteraction === 'plan-review') {
        pending = {
          state: 'warning',
          label: tr('status.planReview'),
          trailingLabel: tr('status.compact.planReview'),
        };
      } else if (node.pendingInteraction === 'question') {
        pending = {
          state: 'warning',
          label: tr('status.waitingAnswer'),
          trailingLabel: tr('status.compact.answer'),
        };
      }
      if (pending !== undefined) return subagents === undefined ? [pending] : [pending, subagents];
      if (node.running) {
        const primary = { state: 'ongoing', label: tr('status.running') };
        return subagents === undefined ? [primary] : [primary, subagents];
      }
      if (subagents !== undefined) return [subagents];
      if (node.completed) return [{ state: 'done', label: tr('status.completed') }];
      return [{ state: 'idle', label: tr('status.idle') }];
    }

    function StateDot({ state, size }) {
      const dimension = size ?? (state === 'ongoing' ? 14 : 10);
      if (state === 'ongoing') {
        return h(
          'svg',
          {
            className: 'dsg-stateSpinner',
            width: dimension,
            height: dimension,
            viewBox: '0 0 24 24',
            'aria-hidden': 'true',
          },
          h(
            'g',
            { className: 'dsg-stateSpinnerMotion' },
            h('circle', { className: 'dsg-stateSpinnerTrack', cx: '12', cy: '12', r: '9.5' }),
            h('circle', { className: 'dsg-stateSpinnerArc', cx: '12', cy: '12', r: '9.5' }),
          ),
        );
      }
      return h('span', {
        className: 'dsg-stateDot',
        'data-state': state,
        style: { width: dimension, height: dimension },
        'aria-hidden': 'true',
      });
    }

    function SessionRow(props) {
      const {
        sessionId,
        title,
        timeText,
        statuses,
        showStatus,
        active,
        pinned,
        archived,
        dragging,
        dropPos,
        dropGroup,
        canDrag,
        editing,
        editingValue,
        t,
        onOpen,
        onRenameStart,
        onRenameCommit,
        onRenameCancel,
        onTogglePin,
        onMenu,
        onDragStart,
        onDragOver,
        onDrop,
        onDragEnd,
      } = props;
      const blockDragRef = React.useRef(false);
      const blockDrag = () => {
        blockDragRef.current = true;
        window.setTimeout(() => {
          blockDragRef.current = false;
        }, 260);
      };
      const classes = ['dsg-sessionRow'];
      if (active) classes.push('active');
      if (dragging) classes.push('dragging');
      if (dropPos === 'before') classes.push('dsg-dropBefore');
      if (dropPos === 'after') classes.push('dsg-dropAfter');
      if (dropGroup) classes.push('dsg-dropGroup');
      if (showStatus) classes.push('hasStatus');
      if (archived) classes.push('archived');
      return h(
        'div',
        {
          className: classes.join(' '),
          role: 'button',
          tabIndex: 0,
          draggable: canDrag === true,
          'data-session-id': sessionId,
          title,
          onClick: () => onOpen(sessionId),
          onKeyDown: (event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onOpen(sessionId);
            }
          },
          onDragStart: (event) => {
            if (blockDragRef.current) {
              event.preventDefault();
              return;
            }
            onDragStart(event, sessionId);
          },
          onDragEnd,
          onDragOver: canDrag ? (event) => onDragOver(event, sessionId) : undefined,
          onDrop: canDrag ? (event) => onDrop(event, sessionId) : undefined,
        },
        showStatus
          ? h(
              'span',
              { className: 'dsg-statusSlot' },
              h(StateDot, { state: statuses[0].state }),
              statuses.map((status, index) => h(
                'span',
                { key: index, className: 'dsg-visuallyHidden' },
                status.label,
              )),
            )
          : null,
        editing
          ? h(GroupNameEditor, {
              initialValue: editingValue,
              onCommit: onRenameCommit,
              onCancel: onRenameCancel,
            })
          : h(
              'span',
              {
                className: 'dsg-titleText',
                onDoubleClick: (event) => {
                  event.stopPropagation();
                  if (onRenameStart) onRenameStart();
                },
              },
              title,
            ),
        h('span', { className: 'dsg-time' }, timeText),
        h(
          'button',
          {
            type: 'button',
            className: 'dsg-rowMore',
            title: typeof t === 'function' ? t('session.menu') : translate('session.menu'),
            'aria-label': typeof t === 'function' ? t('session.menu') : translate('session.menu'),
            onPointerDown: (event) => {
              event.stopPropagation();
              blockDrag();
            },
            onClick: (event) => {
              event.stopPropagation();
              onMenu(event, sessionId);
            },
          },
          h(IconMore, { width: 15, height: 15 }),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dsg-rowAction',
            title: archived
              ? (typeof t === 'function' ? t('session.unarchive') : translate('session.unarchive'))
              : (typeof t === 'function' ? t('session.archive') : translate('session.archive')),
            'aria-label': archived
              ? (typeof t === 'function' ? t('session.unarchive') : translate('session.unarchive'))
              : (typeof t === 'function' ? t('session.archive') : translate('session.archive')),
            onPointerDown: (event) => event.stopPropagation(),
            onClick: (event) => {
              event.stopPropagation();
              if (archived) props.onUnarchive(sessionId);
              else props.onArchive(sessionId);
            },
          },
          h(IconArchive, { width: 14, height: 14 }),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dsg-rowAction',
            title: pinned
              ? (typeof t === 'function' ? t('session.unpin') : translate('session.unpin'))
              : (typeof t === 'function' ? t('session.pin') : translate('session.pin')),
            'aria-label': pinned
              ? (typeof t === 'function' ? t('session.unpin') : translate('session.unpin'))
              : (typeof t === 'function' ? t('session.pin') : translate('session.pin')),
            onPointerDown: (event) => event.stopPropagation(),
            onClick: (event) => {
              event.stopPropagation();
              onTogglePin(sessionId);
            },
          },
          pinned ? h(IconPinFill, { width: 14, height: 14 }) : h(IconPinOutline, { width: 14, height: 14 }),
        ),
      );
    }

    function GroupHeader(props) {
      const {
        group,
        count,
        collapsed,
        selected,
        statuses,
        dropActive,
        dropTopPosition,
        dragging,
        onToggle,
        onMenu,
        onAddSession,
        onEditStart,
        editing,
        editingValue,
        onEditChange,
        onEditCommit,
        onEditCancel,
        onDragOver,
        onDrop,
        onDragStart,
        onDragEnd,
        t,
      } = props;
      const tr = typeof t === 'function' ? t : translate;
      const blockDragRef = React.useRef(false);
      const blockDrag = () => {
        blockDragRef.current = true;
        window.setTimeout(() => {
          blockDragRef.current = false;
        }, 260);
      };
      const classes = ['dsg-groupHeader'];
      if (dropActive) classes.push('dsg-groupDrop');
      if (dragging) classes.push('dsg-groupDragging');
      if (selected) classes.push('selected');
      if (dropTopPosition === 'before') classes.push('dsg-dropTopBefore');
      if (dropTopPosition === 'after') classes.push('dsg-dropTopAfter');
      return h(
        'div',
        {
          className: classes.join(' '),
          role: 'button',
          tabIndex: 0,
          draggable: true,
          'data-group-id': group.id,
          'aria-label': tr('group.aria', { name: group.name }),
          'aria-expanded': !collapsed,
          'aria-current': selected ? 'true' : undefined,
          style: { '--dsg-group-color': group.color },
          onClick: onToggle,
          onKeyDown: (event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onToggle();
            }
          },
          onDragOver,
          onDrop,
          onDragStart: (event) => {
            if (blockDragRef.current) {
              event.preventDefault();
              return;
            }
            onDragStart(event, group.id);
          },
          onDragEnd,
        },
        h('span', { className: 'dsg-groupChevron' + (collapsed ? '' : ' open') }, h(IconChevron)),
        Array.isArray(statuses) && statuses.length > 0
          ? h(
              'span',
              {
                className: 'dsg-groupStatuses',
                title: statuses.map((status) => (
                  status.count > 1 ? `${status.label} ×${status.count}` : status.label
                )).join('，'),
                'aria-label': statuses.map((status) => (
                  status.count > 1 ? `${status.label} ×${status.count}` : status.label
                )).join('，'),
              },
              statuses.map((status) => h(
                'span',
                { key: status.state, className: 'dsg-groupStatusItem' },
                h(StateDot, { state: status.state }),
                status.count > 1
                  ? h('span', { className: 'dsg-groupStatusCount' }, String(status.count))
                  : null,
              )),
            )
          : null,
        editing
          ? h(GroupNameEditor, {
              initialValue: editingValue,
              onCommit: onEditCommit,
              onCancel: onEditCancel,
            })
          : h('span', { className: 'dsg-groupName', title: group.name }, group.name),
        h('span', { className: 'dsg-groupCount' }, tr('group.count', { n: count })),
        h(
          'span',
          { className: 'dsg-groupActions' },
          h(
            'button',
            {
              type: 'button',
              className: 'dsg-iconBtn',
              style: { width: 16, height: 16 },
              title: tr('group.newSession'),
              'aria-label': tr('group.newSession'),
              onClick: (event) => {
                event.stopPropagation();
                onAddSession();
              },
              onPointerDown: (event) => {
                event.stopPropagation();
                blockDrag();
              },
            },
            h(IconNewChatCircle, { width: 16, height: 16 }),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsg-iconBtn',
              style: { width: 16, height: 16 },
              title: tr('group.menu'),
              'aria-label': tr('group.menu'),
              onClick: (event) => {
                event.stopPropagation();
                onMenu(event);
              },
              onPointerDown: (event) => {
                event.stopPropagation();
                blockDrag();
              },
            },
            h(IconMore),
          ),
        ),
      );
    }

    /* ── self-contained directory picker (modeled on the official browser) ── */

    function directoryFailureText(error) {
      if (error !== null && typeof error === 'object' && error.rpcError && typeof error.rpcError.message === 'string') {
        return error.rpcError.message;
      }
      return error instanceof Error ? error.message : String(error);
    }

    function directorySeparator(listing) {
      return listing && typeof listing.home === 'string' && listing.home.includes('\\') ? '\\' : '/';
    }

    function directoryCrumbs(listing, homeLabel) {
      if (!listing) return [];
      const homeIndex = Array.isArray(listing.crumbs)
        ? listing.crumbs.findIndex((crumb) => crumb.path === listing.home)
        : -1;
      if (homeIndex === -1) return Array.isArray(listing.crumbs) ? listing.crumbs : [];
      return [
        { name: homeLabel, path: listing.home, hidden: false },
        ...listing.crumbs.slice(homeIndex + 1),
      ];
    }

    function DirectoryLevel({ entries, selectedPath, busy, showHidden, onPick, pathEditing }) {
      const visible = entries.filter((entry) => (
        entry.path === selectedPath || showHidden || !entry.hidden
      ));
      return h(
        'div',
        { className: 'dsgDir_column', role: 'list' },
        visible.map((entry) => {
          const selected = entry.path === selectedPath;
          return h(
            'span',
            { key: entry.path, role: 'listitem', className: 'dsgDir_rowSeat' },
            h(
              'button',
              {
                type: 'button',
                'aria-current': selected ? 'true' : undefined,
                className: 'dsgDir_row' + (selected ? ' dsgDir_rowSelected' : ''),
                disabled: busy,
                onMouseDown: pathEditing
                  ? (event) => event.preventDefault()
                  : undefined,
                onClick: () => onPick(entry),
              },
              selected
                ? h(IconFolderOpen, { width: 16, height: 16, className: 'dsgDir_rowIconSelected' })
                : h(IconFolderClose, { width: 16, height: 16, className: 'dsgDir_rowIcon' }),
              h('span', { className: 'dsgDir_rowName' }, entry.name),
              h(IconChevron, { width: 12, height: 12, className: 'dsgDir_rowChevron', strokeWidth: 1 }),
            ),
          );
        }),
      );
    }

    function DirectoryPickerDialog({ t, listDirectory, createDirectory, onPicked, onClose, busy }) {
      const tr = typeof t === 'function' ? t : translate;
      const [parent, setParent] = React.useState(null);
      const [selected, setSelected] = React.useState(null);
      const [child, setChild] = React.useState(null);
      const [loading, setLoading] = React.useState(false);
      const [error, setError] = React.useState(null);
      const [pathDraft, setPathDraft] = React.useState(null);
      const [showHidden, setShowHidden] = React.useState(false);
      const [folderDraft, setFolderDraft] = React.useState(null);
      const [creating, setCreating] = React.useState(false);
      const [createError, setCreateError] = React.useState(null);
      const sequence = React.useRef(0);
      const pathInputRef = React.useRef(null);

      const loadLevel = (path) => {
        const seq = ++sequence.current;
        setLoading(true);
        setError(null);
        return listDirectory(path).then((level) => {
          if (seq !== sequence.current) return null;
          setParent(level);
          setSelected(null);
          setChild(null);
          setLoading(false);
          return level;
        }, (reason) => {
          if (seq !== sequence.current) return null;
          setLoading(false);
          setError(directoryFailureText(reason));
          return null;
        });
      };

      React.useEffect(() => {
        void loadLevel(undefined);
        return () => {
          sequence.current += 1;
        };
      }, []);

      React.useEffect(() => {
        if (pathDraft !== null && pathInputRef.current) pathInputRef.current.focus();
      }, [pathDraft]);

      const pick = (entry) => {
        if (busy) return;
        setPathDraft(null);
        setSelected(entry);
        setChild(null);
        setLoading(true);
        setError(null);
        const seq = ++sequence.current;
        listDirectory(entry.path).then((next) => {
          if (seq !== sequence.current) return;
          setChild(next);
          setLoading(false);
        }, (reason) => {
          if (seq !== sequence.current) return;
          setLoading(false);
          setError(directoryFailureText(reason));
          setSelected(null);
        });
      };

      const advance = (entry) => {
        if (child === null || busy) return;
        setParent(child);
        pick(entry);
      };

      const navigate = (path) => {
        setPathDraft(null);
        void loadLevel(path);
      };

      const submitDraft = () => {
        if (pathDraft === null) return;
        const next = pathDraft.trim();
        if (!next) return;
        void loadLevel(next).then((level) => {
          if (level) setPathDraft(null);
        });
      };

      const beginPathEdit = () => {
        if (!parent) return;
        const sep = directorySeparator(parent);
        const base = selected?.path ?? parent.path;
        setPathDraft(base.endsWith(sep) ? base : base + sep);
      };

      const targetPath = selected?.path ?? parent?.path ?? null;
      const targetName = selected?.name
        ?? (parent ? directoryCrumbs(parent, tr('browser.home')).slice(-1)[0]?.name ?? parent.path : '');
      const crumbs = parent ? directoryCrumbs(parent, tr('browser.home')) : [];
      const twoPane = selected !== null;
      const parentInert = busy || folderDraft !== null;

      const confirmCreate = () => {
        if (targetPath === null || folderDraft === null || creating) return;
        const name = folderDraft.trim();
        if (!name) return;
        const generation = sequence.current;
        setCreating(true);
        setCreateError(null);
        createDirectory(targetPath, name).then((createdPath) => {
          if (generation !== sequence.current) return;
          setCreating(false);
          setFolderDraft(null);
          const seq = ++sequence.current;
          setLoading(true);
          listDirectory(targetPath).then((level) => {
            if (seq !== sequence.current) return;
            setParent(level);
            setSelected({ name, path: createdPath, hidden: false });
            setChild(null);
            setLoading(false);
            setError(null);
          }, (reason) => {
            if (seq !== sequence.current) return;
            setLoading(false);
            setError(directoryFailureText(reason));
          });
        }, (reason) => {
          if (generation !== sequence.current) return;
          setCreating(false);
          setCreateError(directoryFailureText(reason));
        });
      };

      const closeCreate = () => {
        if (creating) return;
        setFolderDraft(null);
        setCreateError(null);
      };

      const panel = h(
        'div',
        {
          className: 'dsgDir_dialog dsgDir_panel',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': tr('browser.title'),
          onKeyDown: (event) => {
            if (event.key !== 'Escape') return;
            if (folderDraft !== null) {
              event.stopPropagation();
              closeCreate();
              return;
            }
            if (pathDraft !== null) {
              event.stopPropagation();
              setPathDraft(null);
              return;
            }
            event.stopPropagation();
            onClose();
          },
          onMouseDown: (event) => event.stopPropagation(),
        },
        h(
          'div',
          { className: 'dsgDir_editorScope' },
          h(
            'div',
            { className: 'dsgDir_header' },
            h('h2', { className: 'dsgDir_title' }, tr('browser.title')),
            h(
              'div',
              { className: 'dsgDir_crumbBar' },
              pathDraft === null
                ? [
                    h(
                      'span',
                      { key: 'trail', className: 'dsgDir_crumbTrail', role: 'navigation' },
                      crumbs.map((crumb, index) => h(
                        'span',
                        { key: crumb.path, className: 'dsgDir_crumbSeat' },
                        index > 0
                          ? h(IconChevron, { width: 12, height: 12, className: 'dsgDir_crumbChevron', strokeWidth: 1 })
                          : null,
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'dsgDir_crumb',
                            disabled: parentInert,
                            title: crumb.path,
                            onClick: () => navigate(crumb.path),
                          },
                          crumb.name,
                        ),
                      )),
                    ),
                    h(
                      'button',
                      {
                        key: 'edit',
                        type: 'button',
                        className: 'dsgDir_crumbEditZone',
                        'aria-label': tr('browser.editPath'),
                        title: tr('browser.editPath'),
                        disabled: parentInert,
                        onClick: beginPathEdit,
                      },
                      h(IconEdit, { width: 14, height: 14, className: 'dsgDir_crumbEditGlyph' }),
                    ),
                  ]
                : h('input', {
                    key: 'draft',
                    className: 'dsgDir_pathInput',
                    ref: pathInputRef,
                    value: pathDraft,
                    'aria-label': tr('browser.editPath'),
                    disabled: parentInert,
                    onChange: (event) => setPathDraft(event.target.value),
                    onKeyDown: (event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        submitDraft();
                      } else if (event.key === 'Escape') {
                        event.stopPropagation();
                        setPathDraft(null);
                      }
                    },
                    onBlur: () => setPathDraft(null),
                  }),
            ),
          ),
          h(
            'div',
            { className: 'dsgDir_content' },
            h(
              'div',
              { className: 'dsgDir_millerRow' },
              parent
                ? h(DirectoryLevel, {
                    entries: parent.entries ?? [],
                    selectedPath: selected?.path ?? null,
                    busy: parentInert,
                    showHidden,
                    pathEditing: pathDraft !== null,
                    onPick: pick,
                  })
                : null,
              twoPane ? h('span', { className: 'dsgDir_divider' }) : null,
              twoPane && child
                ? h(DirectoryLevel, {
                    entries: child.entries ?? [],
                    selectedPath: null,
                    busy: parentInert,
                    showHidden,
                    pathEditing: pathDraft !== null,
                    onPick: advance,
                  })
                : null,
            ),
            !parent && loading
              ? h('div', { className: 'dsgDir_status dsgDir_loadingFloat', role: 'status' }, tr('browser.loading'))
              : null,
            (parent?.truncated === true || child?.truncated === true)
              ? h('div', { className: 'dsgDir_status', role: 'status' }, tr('browser.truncated'))
              : null,
            error !== null
              ? h('div', { className: 'dsgDir_error', role: 'alert' }, error)
              : null,
          ),
          h(
            'div',
            { className: 'dsgDir_footerBar' },
            h(
              'button',
              {
                type: 'button',
                className: 'dsgDir_btn dsgDir_btnOutline',
                disabled: parent === null || loading || parentInert || pathDraft !== null,
                onClick: () => {
                  setFolderDraft('');
                  setCreateError(null);
                },
              },
              h(IconPlus, { width: 14, height: 14 }),
              h('span', null, tr('browser.newFolder')),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dsgDir_showHiddenToggle'
                  + (showHidden ? ' dsgDir_showHiddenToggleActive' : ''),
                'aria-pressed': showHidden ? 'true' : 'false',
                disabled: parentInert,
                onClick: () => setShowHidden((previous) => !previous),
              },
              tr('browser.showHidden'),
              showHidden ? h(IconCheck, { width: 14, height: 14 }) : null,
            ),
            h('span', { className: 'dsgDir_footerGap' }),
            h(
              'button',
              {
                type: 'button',
                className: 'dsgDir_btn dsgDir_btnOutline dsgDir_footerAction',
                disabled: parentInert,
                onClick: onClose,
              },
              tr('browser.cancel'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dsgDir_btn dsgDir_btnPrimary dsgDir_footerAction',
                disabled: targetPath === null || loading || parentInert || pathDraft !== null,
                onClick: () => {
                  if (targetPath !== null) onPicked(targetPath);
                },
              },
              tr('browser.open'),
            ),
          ),
        ),
      );

      return h(
        'div',
        {
          className: 'dsgDir_backdrop',
          onMouseDown: (event) => {
            if (event.target === event.currentTarget && folderDraft === null && !busy) onClose();
          },
        },
        panel,
        folderDraft !== null
          ? h(
              'div',
              {
                className: 'dsgDir_createBackdrop',
                onMouseDown: (event) => event.stopPropagation(),
              },
              h(
                'div',
                { className: 'dsgDir_createDialog dsgDir_createPanel', role: 'dialog', 'aria-modal': 'true' },
                h(
                  'div',
                  { className: 'dsgDir_createBody' },
                  h('h3', { className: 'dsgDir_createTitle' }, tr('browser.newFolder')),
                  h('p', { className: 'dsgDir_createIn' }, tr('browser.createIn', { name: targetName })),
                  h('input', {
                    className: 'dsgDir_createInput',
                    value: folderDraft,
                    'aria-label': tr('browser.folderName'),
                    placeholder: tr('browser.untitledFolder'),
                    disabled: creating,
                    autoFocus: true,
                    onChange: (event) => setFolderDraft(event.target.value),
                    onKeyDown: (event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        confirmCreate();
                      } else if (event.key === 'Escape') {
                        event.stopPropagation();
                        closeCreate();
                      }
                    },
                  }),
                  createError !== null
                    ? h('div', { className: 'dsgDir_error', role: 'alert' }, createError)
                    : null,
                  h(
                    'div',
                    { className: 'dsgDir_createActions' },
                    h(
                      'button',
                      { type: 'button', className: 'dsgDir_btn dsgDir_btnOutline', disabled: creating, onClick: closeCreate },
                      tr('browser.cancel'),
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'dsgDir_btn dsgDir_btnPrimary',
                        disabled: creating || folderDraft.trim() === '',
                        onClick: confirmCreate,
                      },
                      tr('browser.create'),
                    ),
                  ),
                ),
              ),
            )
          : null,
      );
    }

    function Rail({ t, expandSidebar, onAddWorkspace }) {
      return h(
        'div',
        { className: 'dsg-rail' },
        h(
          'button',
          {
            type: 'button',
            className: 'dsg-railBtn',
            title: t('section.title'),
            'aria-label': t('section.title'),
            onClick: expandSidebar,
          },
          h(IconFolderClose, { width: 19, height: 19 }),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dsg-railBtn',
            title: t('search.open'),
            'aria-label': t('search.open'),
            onClick: () => {
              expandSidebar();
              setTimeout(() => {
                if (typeof window === 'undefined') return;
                const input = document.querySelector('.dsg-searchInput');
                if (input && typeof input.focus === 'function') input.focus();
              }, 120);
            },
          },
          h(IconSearch, { width: 18, height: 18 }),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dsg-railBtn',
            title: t('addWorkspace'),
            'aria-label': t('addWorkspace'),
            onClick: () => {
              expandSidebar();
              setTimeout(onAddWorkspace, 120);
            },
          },
          h(IconWorkspaceAdd, { width: 18, height: 18 }),
        ),
      );
    }

    /* ── browser ───────────────────────────────────────────────────── */

    function SessionGroupsBrowser(props) {
      const {
        wide,
        expandSidebar,
        useSessions,
        useWorkspaces,
        useSessionStatus,
        usePanelInfo,
        t,
        openSession,
        startSession,
        archiveSession,
        unarchiveSession,
        pinSession,
        unpinSession,
        renameSession,
        forkSession,
        addWorkspace,
        addWorkspaceAtPath,
        listDirectory,
        createDirectory,
        insertSessionBefore,
        renameWorkspace,
        deleteWorkspace,
        setGroupedMode,
      } = props;

      const [prefs, setPrefs] = React.useState(loadPrefs);
      const [searchOpen, setSearchOpen] = React.useState(false);
      const [searchText, setSearchText] = React.useState('');
      const [editingGroup, setEditingGroup] = React.useState(null);
      const [editingWorkspace, setEditingWorkspace] = React.useState(null);
      const [editingSession, setEditingSession] = React.useState(null);
      const [menu, setMenu] = React.useState(null);
      const [viewMenu, setViewMenu] = React.useState(null);
      const [notice, setNotice] = React.useState(null);
      const [addingWorkspace, setAddingWorkspace] = React.useState(false);
      const [addWorkspaceDialog, setAddWorkspaceDialog] = React.useState(null);
      const [overflowExpanded, setOverflowExpanded] = React.useState({});
      const [dragInfo, setDragInfo] = React.useState(null);
      const [dropHint, setDropHint] = React.useState(null);
      const dragRef = React.useRef(null);
      const noticeTimerRef = React.useRef(null);
      const pendingGroupSessionRef = React.useRef(null);

      const list = useSessions((state) => state);
      const workspaceState = useWorkspaces((state) => state);
      const sessionStatusesMap = typeof useSessionStatus === 'function'
        ? useSessionStatus((state) => state)
        : null;
      const activePanelId = usePanelInfo((state) => state.activePanelId);
      const now = useNow(60000);

      const tr = React.useCallback(
        (key, params) => {
          if (typeof t === 'function') {
            const text = t(key, params);
            if (text !== key) return text;
          }
          return interpolate(FALLBACK[key] ?? key, params);
        },
        [t],
      );

      const notify = React.useCallback((message) => {
        setNotice(message);
        if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = window.setTimeout(() => {
          setNotice(null);
          noticeTimerRef.current = null;
        }, 2800);
      }, []);

      React.useEffect(() => {
        savePrefs(prefs);
      }, [prefs]);

      React.useEffect(() => () => {
        if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
      }, []);

      const workspaces = Array.isArray(workspaceState?.items) ? workspaceState.items : [];
      const phase = workspaceState?.phase ?? 'pending';
      const archivedSessionIds = React.useMemo(
        () => new Set(Array.isArray(workspaceState?.archivedSessionIds) ? workspaceState.archivedSessionIds : []),
        [workspaceState?.archivedSessionIds],
      );
      const pinnedSessionIds = React.useMemo(
        () => new Set(Array.isArray(workspaceState?.pinnedSessionIds) ? workspaceState.pinnedSessionIds : []),
        [workspaceState?.pinnedSessionIds],
      );

      const currentSessionId = React.useMemo(() => {
        for (const id of list.ids ?? []) {
          const row = list.byId?.[id];
          if (row && (row.retainedBy?.mainView ?? 0) > 0) return id;
        }
        return null;
      }, [list]);

      React.useEffect(() => {
        // Workspace data arrives asynchronously; reconciling against the empty
        // pending snapshot would prune every saved group and persist the loss.
        if (phase !== 'ready') return;
        const signature = workspaces
          .map((workspace) => workspace.workspaceId + ':' + (workspace.sessionIds ?? []).join(','))
          .join('|');
        setPrefs((previous) => {
          let changed = false;
          const memberSets = new Map();
          for (const workspace of workspaces) {
            memberSets.set(workspace.workspaceId, new Set(workspace.sessionIds ?? []));
          }
          const nextGroups = {};
          for (const [workspaceId, groups] of Object.entries(previous.groups ?? {})) {
            const members = memberSets.get(workspaceId);
            if (!members) {
              changed = true;
              continue;
            }
            const kept = [];
            for (const group of groups) {
              const sessionIds = group.sessionIds.filter((id) => members.has(id));
              if (sessionIds.length !== group.sessionIds.length) changed = true;
              if (sessionIds.length === 0) {
                changed = true;
                continue;
              }
              kept.push(sessionIds.length === group.sessionIds.length ? group : { ...group, sessionIds });
            }
            if (kept.length > 0) nextGroups[workspaceId] = kept;
          }
          const nextCollapsed = {};
          for (const [workspaceId, value] of Object.entries(previous.collapsedWorkspaces ?? {})) {
            if (memberSets.has(workspaceId)) nextCollapsed[workspaceId] = value;
            else changed = true;
          }
          const nextManualOrders = {};
          for (const [workspaceId, order] of Object.entries(previous.manualOrders ?? {})) {
            const members = memberSets.get(workspaceId);
            if (!members || !Array.isArray(order)) {
              changed = true;
              continue;
            }
            const kept = order.filter((id) => members.has(id));
            if (kept.length !== order.length) changed = true;
            if (kept.length > 0) nextManualOrders[workspaceId] = kept;
          }
          const nextTopOrders = {};
          for (const [workspaceId, order] of Object.entries(previous.topOrders ?? {})) {
            const members = memberSets.get(workspaceId);
            if (!members || !Array.isArray(order)) {
              changed = true;
              continue;
            }
            const groupIds = new Set((nextGroups[workspaceId] ?? []).map((group) => group.id));
            const kept = [];
            for (const key of order) {
              if (key.startsWith('g:') && groupIds.has(key.slice(2))) kept.push(key);
              else if (key.startsWith('s:') && members.has(key.slice(2))) kept.push(key);
              else changed = true;
            }
            if (kept.length > 0) nextTopOrders[workspaceId] = kept;
          }
          if (!changed) return previous;
          return {
            groups: nextGroups,
            collapsedWorkspaces: nextCollapsed,
            manualOrders: nextManualOrders,
            topOrders: nextTopOrders,
            hideArchived: previous.hideArchived !== false,
          };
        });
      }, [workspaces, phase]);

      React.useEffect(() => {
        const pending = pendingGroupSessionRef.current;
        if (!pending) return;
        const workspace = workspaces.find((item) => item.workspaceId === pending.workspaceId);
        if (!workspace) return;
        const sessionId = (workspace.sessionIds ?? []).find((id) => !pending.known.has(id));
        const sessionRow = sessionId ? list.byId?.[sessionId] : undefined;
        if (!sessionId || !sessionRow || sessionRow.blank !== true) return;
        if ((sessionRow.retainedBy?.mainView ?? 0) <= 0) return;
        pendingGroupSessionRef.current = null;
        setPrefs((previous) => {
          const groups = previous.groups?.[pending.workspaceId];
          if (!Array.isArray(groups) || !groups.some((group) => group.id === pending.groupId)) {
            return previous;
          }
          return insertIntoGroup(previous, pending.workspaceId, pending.groupId, sessionId, null, 'end');
        });
        notify(tr('notice.sessionCreated'));
      }, [workspaces, list, notify, tr]);

      const query = searchOpen ? searchText.trim().toLowerCase() : '';
      const workspaceTitle = (workspace) => workspace.title || workspace.path || tr('untitled');
      const titleOf = (sessionId) => {
        const row = list.byId?.[sessionId];
        if (!row) return tr('untitled');
        if (row.blank) return tr('newSession');
        const stored = typeof row.title === 'string' ? row.title.trim() : '';
        const display = typeof row.displayTitle === 'string' ? row.displayTitle : '';
        const candidate = stored || display;
        if (!candidate || candidate === sessionId) return tr('untitled');
        return candidate;
      };
      const isVisible = (sessionId) => {
        const row = list.byId?.[sessionId];
        if (!row) return false;
        if (row.origin === 'subagent') return false;
        if (row.blank && sessionId !== currentSessionId) return false;
        if (archivedSessionIds.has(sessionId) && prefs.hideArchived !== false) return false;
        return true;
      };
      const matches = (sessionId) => !query || titleOf(sessionId).toLowerCase().includes(query);
      const orderByUpdated = (sessionIds) => {
        return [...sessionIds].sort((left, right) => {
          const leftPinned = pinnedSessionIds.has(left) ? 0 : 1;
          const rightPinned = pinnedSessionIds.has(right) ? 0 : 1;
          if (leftPinned !== rightPinned) return leftPinned - rightPinned;
          const leftTime = list.byId?.[left]?.updatedAt ?? 0;
          const rightTime = list.byId?.[right]?.updatedAt ?? 0;
          return rightTime - leftTime;
        });
      };

      const sections = [];
      for (const workspace of workspaces) {
        const memberIds = Array.isArray(workspace.sessionIds) ? workspace.sessionIds : [];
        const workspaceMatches = Boolean(query) && workspaceTitle(workspace).toLowerCase().includes(query);
        const storedGroups = Array.isArray(prefs.groups?.[workspace.workspaceId])
          ? prefs.groups[workspace.workspaceId]
          : [];
        const groups = [];
        for (const group of storedGroups) {
          const members = group.sessionIds.filter((id) => isVisible(id) && memberIds.includes(id));
          if (members.length === 0) continue;
          const groupMatches = !query
            || workspaceMatches
            || group.name.toLowerCase().includes(query)
            || members.some((id) => matches(id));
          if (!groupMatches) continue;
          groups.push({ group, members });
        }
        const groupedIds = new Set(storedGroups.flatMap((group) => group.sessionIds ?? []));
        const visibleUngroupedIds = memberIds.filter((id) => !groupedIds.has(id) && isVisible(id));
        const manualOrder = prefs.manualOrders?.[workspace.workspaceId];
        let orderedUngrouped;
        if (Array.isArray(manualOrder)) {
          const visibleSet = new Set(visibleUngroupedIds);
          const seen = new Set();
          orderedUngrouped = [];
          for (const id of manualOrder) {
            if (!visibleSet.has(id) || seen.has(id)) continue;
            seen.add(id);
            orderedUngrouped.push(id);
          }
          orderedUngrouped.push(...orderByUpdated(visibleUngroupedIds.filter((id) => !seen.has(id))));
        } else {
          orderedUngrouped = orderByUpdated(visibleUngroupedIds);
        }
        orderedUngrouped = pinnedFirst(orderedUngrouped, pinnedSessionIds);
        const selectedBlankId = currentSessionId && list.byId?.[currentSessionId]?.blank
          ? currentSessionId
          : null;
        if (selectedBlankId) {
          const blankIndex = orderedUngrouped.indexOf(selectedBlankId);
          if (blankIndex > 0) {
            orderedUngrouped = [selectedBlankId, ...orderedUngrouped.filter((id) => id !== selectedBlankId)];
          }
        }
        const ungrouped = orderedUngrouped.filter((id) => workspaceMatches || matches(id));
        if (query && !workspaceMatches && groups.length === 0 && ungrouped.length === 0) continue;
        const referenceIds = pinnedFirst(
          orderByUpdated(memberIds.filter((id) => isVisible(id))),
          pinnedSessionIds,
        );
        const referenceIndex = new Map(referenceIds.map((id, index) => [id, index]));
        const defaultTopItems = [
          ...groups.map((item) => {
            const indexes = item.members
              .map((id) => referenceIndex.get(id))
              .filter((index) => index !== undefined);
            return {
              kind: 'group',
              key: topKeyOfGroup(item.group.id),
              group: item.group,
              members: item.members,
              sortIndex: indexes.length > 0 ? Math.min(...indexes) : Number.MAX_SAFE_INTEGER,
            };
          }),
          ...ungrouped.map((id) => ({
            kind: 'session',
            key: topKeyOfSession(id),
            id,
            sortIndex: referenceIndex.get(id) ?? Number.MAX_SAFE_INTEGER,
          })),
        ].sort((left, right) => left.sortIndex - right.sortIndex)
          .map(({ sortIndex, ...item }) => item);
        const savedTopOrder = prefs.topOrders?.[workspace.workspaceId];
        let topItems = defaultTopItems;
        if (Array.isArray(savedTopOrder)) {
          const byKey = new Map(defaultTopItems.map((item) => [item.key, item]));
          const seen = new Set();
          topItems = [];
          for (const key of savedTopOrder) {
            const item = byKey.get(key);
            if (!item || seen.has(key)) continue;
            seen.add(key);
            topItems.push(item);
          }
          for (const item of defaultTopItems) {
            if (!seen.has(item.key)) topItems.push(item);
          }
        }
        sections.push({
          key: workspace.workspaceId,
          workspace,
          groups,
          ungrouped,
          ungroupedAll: orderedUngrouped,
          topItems,
          collapsed: !query && prefs.collapsedWorkspaces?.[workspace.workspaceId] === true,
        });
      }

      const accounted = new Set(workspaces.flatMap((workspace) => workspace.sessionIds ?? []));
      const ungroupedSessionIds = orderByUpdated(
        (list.ids ?? []).filter((id) => !accounted.has(id) && isVisible(id) && matches(id)),
      );
      if (ungroupedSessionIds.length > 0) {
        sections.push({
          key: '__ungrouped__',
          ungroupedOnly: true,
          groups: [],
          ungrouped: ungroupedSessionIds,
          collapsed: false,
        });
      }

      const hasAnyGroup = Object.values(prefs.groups ?? {}).some((groups) => Array.isArray(groups) && groups.length > 0);
      const visibleCount = sections.reduce(
        (total, section) => total + section.ungrouped.length
          + section.groups.reduce((sum, item) => sum + item.members.length, 0),
        0,
      );

      const closeMenu = React.useCallback(() => setMenu(null), []);

      const clearDrag = React.useCallback(() => {
        dragRef.current = null;
        setDragInfo(null);
        setDropHint(null);
      }, []);

      const handleDragStart = (event, sessionId, workspaceId, groupId) => {
        if (!workspaceId) {
          event.preventDefault();
          return;
        }
        if (event.target && typeof event.target.closest === 'function' && event.target.closest('button,input')) {
          event.preventDefault();
          return;
        }
        const info = { kind: 'session', sessionId, workspaceId, groupId: groupId ?? null };
        dragRef.current = info;
        setDragInfo(info);
        setDropHint(null);
        try {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', sessionId);
          event.dataTransfer.setData('application/x-dsh-session-group', JSON.stringify(info));
        } catch {
          /* dataTransfer may be unavailable in synthetic drags */
        }
      };

      const handleDragEnd = () => clearDrag();

      const rowDropZone = (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = (event.clientY - rect.top) / Math.max(1, rect.height);
        if (ratio < 0.3) return 'before';
        if (ratio > 0.7) return 'after';
        return 'group';
      };

      const reorderUngrouped = (workspaceId, sourceId, targetSessionId, position) => {
        const section = sections.find((candidate) => candidate.workspace?.workspaceId === workspaceId);
        const baseOrder = Array.isArray(section?.ungroupedAll) ? section.ungroupedAll : [];
        const allIds = baseOrder.includes(sourceId) ? baseOrder : [...baseOrder, sourceId];
        let order = Array.isArray(prefs.manualOrders?.[workspaceId])
          ? prefs.manualOrders[workspaceId].filter((id) => allIds.includes(id))
          : [...baseOrder];
        for (const id of allIds) {
          if (!order.includes(id)) order.push(id);
        }
        order = order.filter((id) => id !== sourceId);
        let index = order.indexOf(targetSessionId);
        if (index === -1) index = order.length;
        else if (position === 'after') index += 1;
        order.splice(index, 0, sourceId);
        setPrefs((previous) => setManualOrder(
          removeSessionFromGroups(previous, workspaceId, sourceId),
          workspaceId,
          order,
        ));
        const sourceIndex = order.indexOf(sourceId);
        const beforeId = sourceIndex >= 0 ? order[sourceIndex + 1] : undefined;
        try {
          const pending = insertSessionBefore?.(workspaceId, sourceId, beforeId);
          if (pending && typeof pending.catch === 'function') pending.catch(() => {});
        } catch {
          /* the browser-local order still stands; Host order is a durability bonus */
        }
        notify(tr('notice.reordered'));
      };

      const moveTopItem = (workspaceId, sourceKey, targetKey, position) => {
        const section = sections.find((candidate) => candidate.workspace?.workspaceId === workspaceId);
        if (!section) return;
        const keys = (section.topItems ?? []).map((item) => item.key);
        const next = keys.filter((key) => key !== sourceKey);
        let index = targetKey === undefined ? next.length : next.indexOf(targetKey);
        if (index === -1) index = next.length;
        else if (position === 'after') index += 1;
        next.splice(index, 0, sourceKey);
        setPrefs((previous) => setTopOrder(previous, workspaceId, next));
        notify(tr('notice.reordered'));
      };

      const handleGroupDragStart = (event, workspaceId, groupId) => {
        if (event.target && typeof event.target.closest === 'function' && event.target.closest('button,input')) {
          event.preventDefault();
          return;
        }
        const info = {
          kind: 'group',
          workspaceId,
          groupId,
          key: topKeyOfGroup(groupId),
        };
        dragRef.current = info;
        setDragInfo(info);
        setDropHint(null);
        try {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', info.key);
          event.dataTransfer.setData('application/x-dsh-session-group-item', JSON.stringify(info));
        } catch {
          /* ignore */
        }
      };

      const handleRowDragOver = (event, workspaceId, groupId, targetSessionId) => {
        const drag = dragRef.current;
        if (!drag || drag.workspaceId !== workspaceId || drag.sessionId === targetSessionId) return;
        event.preventDefault();
        event.stopPropagation();
        try {
          event.dataTransfer.dropEffect = 'move';
        } catch {
          /* ignore */
        }
        const zone = rowDropZone(event);
        if (drag.kind === 'group') {
          if (groupId) return;
          setDropHint({
            kind: 'top',
            key: topKeyOfSession(targetSessionId),
            workspaceId,
            position: zone === 'after' ? 'after' : 'before',
          });
          return;
        }
        if (groupId) {
          setDropHint({
            kind: 'row',
            id: targetSessionId,
            position: zone === 'after' ? 'after' : 'before',
          });
        } else if (zone === 'group') {
          setDropHint({ kind: 'rowGroup', id: targetSessionId });
        } else {
          setDropHint({ kind: 'row', id: targetSessionId, position: zone });
        }
      };

      const handleRowDrop = (event, workspaceId, groupId, targetSessionId) => {
        const drag = dragRef.current;
        if (!drag || drag.workspaceId !== workspaceId || drag.sessionId === targetSessionId) return;
        event.preventDefault();
        event.stopPropagation();
        const zone = rowDropZone(event);
        if (drag.kind === 'group') {
          if (groupId) return;
          const key = drag.key;
          clearDrag();
          moveTopItem(workspaceId, key, topKeyOfSession(targetSessionId), zone === 'after' ? 'after' : 'before');
          return;
        }
        const sourceId = drag.sessionId;
        const sourceGroupId = drag.groupId;
        clearDrag();
        if (groupId) {
          const position = zone === 'after' ? 'after' : 'before';
          setPrefs((previous) => {
            const removed = removeSessionFromGroups(previous, workspaceId, sourceId);
            return insertIntoGroup(removed, workspaceId, groupId, sourceId, targetSessionId, position);
          });
          notify(tr(sourceGroupId === groupId ? 'notice.reordered' : 'notice.grouped'));
          return;
        }
        if (zone === 'group') {
          const section = sections.find((candidate) => candidate.workspace?.workspaceId === workspaceId);
          const topItems = query ? null : section?.topItems;
          setPrefs((previous) => {
            const removed = removeSessionFromGroups(previous, workspaceId, sourceId);
            const members = [targetSessionId, sourceId];
            return createGroupAt(
              removed,
              workspaceId,
              members,
              (index) => tr('group.defaultName', { n: index + 1 }),
              targetSessionId,
              topItems,
            );
          });
          notify(tr('notice.grouped'));
          return;
        }
        reorderUngrouped(workspaceId, sourceId, targetSessionId, zone);
      };

      const groupHeaderHalf = (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      };

      const handleGroupDragOver = (event, workspaceId, groupId) => {
        const drag = dragRef.current;
        if (!drag || drag.workspaceId !== workspaceId || drag.groupId === groupId) return;
        event.preventDefault();
        event.stopPropagation();
        try {
          event.dataTransfer.dropEffect = 'move';
        } catch {
          /* ignore */
        }
        if (drag.kind === 'group') {
          setDropHint({
            kind: 'topGroup',
            key: topKeyOfGroup(groupId),
            workspaceId,
            position: groupHeaderHalf(event),
          });
          return;
        }
        setDropHint({ kind: 'group', id: groupId });
      };

      const handleGroupDrop = (event, workspaceId, groupId) => {
        const drag = dragRef.current;
        if (!drag || drag.workspaceId !== workspaceId || drag.groupId === groupId) return;
        event.preventDefault();
        event.stopPropagation();
        if (drag.kind === 'group') {
          const key = drag.key;
          const position = groupHeaderHalf(event);
          clearDrag();
          moveTopItem(workspaceId, key, topKeyOfGroup(groupId), position);
          return;
        }
        const sourceId = drag.sessionId;
        clearDrag();
        setPrefs((previous) => {
          const removed = removeSessionFromGroups(previous, workspaceId, sourceId);
          return insertIntoGroup(removed, workspaceId, groupId, sourceId, null, 'end');
        });
        notify(tr('notice.grouped'));
      };

      const handleUngroupedDragOver = (event, workspaceId) => {
        const drag = dragRef.current;
        if (!drag || drag.workspaceId !== workspaceId) return;
        if (drag.kind === 'group') {
          event.preventDefault();
          event.stopPropagation();
          setDropHint({ kind: 'topEnd', workspaceId });
          return;
        }
        if (!drag.groupId) return;
        event.preventDefault();
        event.stopPropagation();
        setDropHint({ kind: 'ungrouped', workspaceId });
      };

      const handleUngroupedDrop = (event, workspaceId) => {
        const drag = dragRef.current;
        if (!drag || drag.workspaceId !== workspaceId) return;
        event.preventDefault();
        event.stopPropagation();
        if (drag.kind === 'group') {
          const key = drag.key;
          clearDrag();
          moveTopItem(workspaceId, key, undefined, 'end');
          return;
        }
        const sourceId = drag.sessionId;
        const sourceGroupId = drag.groupId;
        clearDrag();
        if (!sourceGroupId) return;
        setPrefs((previous) => removeSessionFromGroups(previous, workspaceId, sourceId));
        notify(tr('notice.ungrouped'));
      };

      const handleWorkspaceDragOver = (event, workspaceId) => {
        const drag = dragRef.current;
        if (!drag || drag.workspaceId !== workspaceId) return;
        if (drag.kind === 'group') {
          event.preventDefault();
          event.stopPropagation();
          setDropHint({ kind: 'topEnd', workspaceId });
          return;
        }
        if (!drag.groupId) return;
        event.preventDefault();
        event.stopPropagation();
        setDropHint({ kind: 'ungrouped', workspaceId });
      };

      const handleWorkspaceDrop = (event, workspaceId) => {
        handleUngroupedDrop(event, workspaceId);
      };

      const handleWorkspaceBodyDragOver = (event, workspaceId) => {
        handleUngroupedDragOver(event, workspaceId);
      };

      const handleWorkspaceBodyDrop = (event, workspaceId) => {
        handleUngroupedDrop(event, workspaceId);
      };

      const toggleWorkspace = (workspaceId) => {
        setPrefs((previous) => {
          const collapsed = { ...(previous.collapsedWorkspaces ?? {}) };
          if (collapsed[workspaceId]) delete collapsed[workspaceId];
          else collapsed[workspaceId] = true;
          return { ...previous, collapsedWorkspaces: collapsed };
        });
      };

      const toggleGroup = (workspaceId, groupId) => {
        setPrefs((previous) => {
          const groups = previous.groups?.[workspaceId];
          if (!Array.isArray(groups)) return previous;
          const target = groups.find((group) => group.id === groupId);
          if (!target) return previous;
          return patchGroup(previous, workspaceId, groupId, { collapsed: !target.collapsed });
        });
      };

      const beginGroupRename = (workspaceId, groupId) => {
        const groups = prefs.groups?.[workspaceId] ?? [];
        const group = groups.find((item) => item.id === groupId);
        if (!group) return;
        setEditingGroup({ workspaceId, groupId, value: group.name });
        closeMenu();
      };

      const commitGroupRename = (value) => {
        if (!editingGroup) return;
        const { workspaceId, groupId } = editingGroup;
        setEditingGroup(null);
        setPrefs((previous) => patchGroup(previous, workspaceId, groupId, { name: value }));
      };

      const cancelGroupRename = () => setEditingGroup(null);

      const beginWorkspaceRename = (workspace) => {
        const title = workspace.title || workspace.path || '';
        setEditingWorkspace({ workspaceId: workspace.workspaceId, value: title });
        closeMenu();
      };

      const commitWorkspaceRename = async (value) => {
        if (!editingWorkspace) return;
        const { workspaceId } = editingWorkspace;
        setEditingWorkspace(null);
        try {
          await renameWorkspace(workspaceId, value);
          notify(tr('workspace.renamed'));
        } catch (error) {
          notify(tr('workspace.renameFailed', { reason: errorMessage(error) }));
        }
      };

      const cancelWorkspaceRename = () => setEditingWorkspace(null);

      const openWorkspaceMenu = (event, workspace) => {
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        setMenu({
          kind: 'workspace',
          workspaceId: workspace.workspaceId,
          rect: { left: rect.left, top: rect.top, bottom: rect.bottom },
        });
      };

      const handleDeleteWorkspace = async (workspace) => {
        closeMenu();
        const title = workspace.title || workspace.path || '';
        try {
          if (typeof window.confirm === 'function'
            && !window.confirm(tr('workspace.deleteConfirm', { name: title }))) {
            return;
          }
          await deleteWorkspace(workspace.workspaceId);
          notify(tr('workspace.deleted'));
        } catch (error) {
          notify(tr('workspace.deleteFailed', { reason: errorMessage(error) }));
        }
      };

      const handleSortWorkspaceByTime = (workspaceId) => {
        closeMenu();
        const workspace = workspaces.find((item) => item.workspaceId === workspaceId);
        if (!workspace) return;
        const timeOf = (sessionId) => list.byId?.[sessionId]?.updatedAt ?? 0;
        setPrefs((previous) => {
          const groups = previous.groups?.[workspaceId] ?? [];
          const nextGroups = groups.map((group) => ({
            ...group,
            sessionIds: [...group.sessionIds].sort((left, right) => (
              timeOf(right) - timeOf(left) || String(left).localeCompare(String(right))
            )),
          }));
          const groupedIds = new Set(nextGroups.flatMap((group) => group.sessionIds));
          const ungrouped = (workspace.sessionIds ?? []).filter((sessionId) => !groupedIds.has(sessionId));
          const topItems = [
            ...nextGroups.map((group) => ({
              key: topKeyOfGroup(group.id),
              time: group.sessionIds.reduce((latest, sessionId) => Math.max(latest, timeOf(sessionId)), 0),
            })),
            ...ungrouped.map((sessionId) => ({
              key: topKeyOfSession(sessionId),
              time: timeOf(sessionId),
            })),
          ].sort((left, right) => right.time - left.time || left.key.localeCompare(right.key));
          let next = { ...previous, groups: { ...(previous.groups ?? {}) } };
          if (nextGroups.length === 0) delete next.groups[workspaceId];
          else next.groups[workspaceId] = nextGroups;
          next = setTopOrder(next, workspaceId, topItems.map((item) => item.key));
          return next;
        });
        notify(tr('workspace.sortedByTime'));
      };

      const handleToggleHideArchived = () => {
        closeMenu();
        setViewMenu(null);
        setPrefs((previous) => ({
          ...previous,
          hideArchived: previous.hideArchived === false,
        }));
      };

      const openViewMenu = (event) => {
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        setViewMenu({ rect: { left: rect.left, top: rect.top, bottom: rect.bottom } });
      };

      const applyViewAction = (action) => {
        setViewMenu(null);
        setPrefs((previous) => {
          if (action === 'expandGroups' || action === 'collapseGroups') {
            const collapsed = action === 'collapseGroups';
            const groups = {};
            for (const [workspaceId, list] of Object.entries(previous.groups ?? {})) {
              groups[workspaceId] = list.map((group) => (
                group.collapsed === collapsed ? group : { ...group, collapsed }
              ));
            }
            return { ...previous, groups };
          }
          if (action === 'expandWorkspaces') {
            return { ...previous, collapsedWorkspaces: {} };
          }
          if (action === 'collapseWorkspaces') {
            const collapsedWorkspaces = {};
            for (const workspace of workspaces) collapsedWorkspaces[workspace.workspaceId] = true;
            return { ...previous, collapsedWorkspaces };
          }
          if (action === 'resetOrder') {
            return { ...previous, manualOrders: {} };
          }
          return previous;
        });
      };

      const openGroupMenu = (event, workspaceId, groupId) => {
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        setMenu({
          kind: 'group',
          workspaceId,
          groupId,
          rect: { left: rect.left, top: rect.top, bottom: rect.bottom },
        });
      };

      const openSessionMenu = (event, workspaceId, groupId, sessionId) => {
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        setMenu({
          kind: 'session',
          workspaceId,
          groupId: groupId ?? null,
          sessionId,
          rect: { left: rect.left, top: rect.top, bottom: rect.bottom },
        });
      };

      const beginSessionRename = (sessionId) => {
        if (list.byId?.[sessionId]?.blank) return;
        setEditingSession({ sessionId, value: titleOf(sessionId) });
        closeMenu();
      };

      const commitSessionRename = async (value) => {
        if (!editingSession) return;
        const { sessionId } = editingSession;
        setEditingSession(null);
        try {
          await renameSession(sessionId, value);
        } catch (error) {
          notify(tr('notice.renameFailed', { reason: errorMessage(error) }));
        }
      };

      const cancelSessionRename = () => setEditingSession(null);

      const handleTogglePin = async (sessionId) => {
        const pinned = pinnedSessionIds.has(sessionId);
        closeMenu();
        try {
          if (pinned) await unpinSession(sessionId);
          else await pinSession(sessionId);
        } catch (error) {
          notify(tr('notice.pinFailed', { reason: errorMessage(error) }));
        }
      };

      const handleUnarchive = async (sessionId) => {
        closeMenu();
        try {
          await unarchiveSession(sessionId);
        } catch (error) {
          notify(tr('notice.archiveFailed', { reason: errorMessage(error) }));
        }
      };

      const handleArchive = async (sessionId) => {
        closeMenu();
        try {
          await archiveSession(sessionId);
          notify(tr('notice.archived'));
        } catch (error) {
          notify(tr('notice.archiveFailed', { reason: errorMessage(error) }));
        }
      };

      const handleFork = async (sessionId) => {
        closeMenu();
        try {
          await forkSession(sessionId);
        } catch (error) {
          notify(tr('notice.forkFailed', { reason: errorMessage(error) }));
        }
      };

      const handleCopyId = async (sessionId) => {
        closeMenu();
        try {
          await navigator.clipboard.writeText(sessionId);
          notify(tr('notice.copied'));
        } catch (error) {
          notify(tr('notice.copyFailed', { reason: errorMessage(error) }));
        }
      };

      const handleCreateGroupForSession = (workspaceId, sessionId) => {
        closeMenu();
        const section = sections.find((candidate) => candidate.workspace?.workspaceId === workspaceId);
        const topItems = query ? null : section?.topItems;
        setPrefs((previous) => {
          const removed = removeSessionFromGroups(previous, workspaceId, sessionId);
          return createGroupAt(
            removed,
            workspaceId,
            [sessionId],
            (index) => tr('group.defaultName', { n: index + 1 }),
            sessionId,
            topItems,
          );
        });
        notify(tr('notice.grouped'));
      };

      const handleMoveToGroup = (workspaceId, groupId, sessionId) => {
        closeMenu();
        setPrefs((previous) => {
          const removed = removeSessionFromGroups(previous, workspaceId, sessionId);
          return insertIntoGroup(removed, workspaceId, groupId, sessionId, null, 'end');
        });
        notify(tr('notice.grouped'));
      };

      const handleRemoveFromGroup = (workspaceId, sessionId) => {
        closeMenu();
        setPrefs((previous) => removeSessionFromGroups(previous, workspaceId, sessionId));
        notify(tr('notice.ungrouped'));
      };

      const handleDissolveGroup = (workspaceId, groupId) => {
        closeMenu();
        setPrefs((previous) => dissolveGroup(previous, workspaceId, groupId));
        notify(tr('notice.groupDissolved'));
      };

      const handleAddWorkspace = () => {
        setAddWorkspaceDialog({ busy: false, error: '' });
      };

      const closeAddWorkspaceDialog = () => {
        if (addWorkspaceDialog?.busy) return;
        setAddWorkspaceDialog(null);
      };

      const pickAddWorkspaceDirectory = async (path) => {
        if (!path || addWorkspaceDialog?.busy) return;
        setAddingWorkspace(true);
        setAddWorkspaceDialog((previous) => previous ? { ...previous, busy: true, error: '' } : previous);
        try {
          if (typeof addWorkspaceAtPath === 'function') await addWorkspaceAtPath(path);
          else await addWorkspace();
          setAddWorkspaceDialog(null);
          notify(tr('notice.workspaceAdded'));
        } catch (error) {
          const message = errorMessage(error);
          setAddWorkspaceDialog((previous) => previous ? { ...previous, busy: false, error: message } : previous);
          notify(tr('notice.addWorkspaceFailed', { reason: message }));
        } finally {
          setAddingWorkspace(false);
        }
      };

      const handleNewSessionInGroup = (workspaceId, groupId) => {
        if (pendingGroupSessionRef.current) return;
        const workspace = workspaces.find((item) => item.workspaceId === workspaceId);
        const known = new Set([
          ...(list.ids ?? []),
          ...((workspace?.sessionIds) ?? []),
        ]);
        const pending = { workspaceId, groupId, known };
        pendingGroupSessionRef.current = pending;
        window.setTimeout(() => {
          if (pendingGroupSessionRef.current === pending) pendingGroupSessionRef.current = null;
        }, 10000);
        try {
          startSession(workspaceId);
        } catch (error) {
          pendingGroupSessionRef.current = null;
          notify(tr('notice.newSessionFailed', { reason: errorMessage(error) }));
        }
      };

      const WATERMARK_BASE = 5;
      const WATERMARK_AUTO_MAX = 50;

      const statusInfoFor = (sessionId) => {
        const row = list.byId?.[sessionId] ?? {};
        const uiStatus = statusValue(sessionStatusesMap, sessionId);
        const statuses = buildSessionStatuses({
          running: uiStatus?.running ?? row.running,
          completed: uiStatus?.completionUnread === true,
          pendingInteraction: visiblePendingKind(uiStatus?.pendingInteraction?.kind),
          runningSubagentCount: runningChildCountFor(list, sessionId, sessionStatusesMap),
        }, tr);
        const primaryStatus = statuses[0];
        return {
          row,
          statuses,
          primaryStatus,
          showStatus: row.blank !== true
            && !archivedSessionIds.has(sessionId)
            && primaryStatus.state !== 'idle',
        };
      };

      const watermarkRows = (sessionIds, watermark) => {
        let count = 0;
        const rows = sessionIds.filter((sessionId) => {
          if (list.byId?.[sessionId]?.blank === true) return true;
          count += 1;
          return count <= watermark;
        });
        return { rows, hiddenCount: sessionIds.length - rows.length };
      };

      const requiredWatermark = (sessionIds) => {
        let index = 0;
        let required = 0;
        for (const sessionId of sessionIds) {
          if (list.byId?.[sessionId]?.blank === true) continue;
          index += 1;
          const info = statusInfoFor(sessionId);
          if (index <= WATERMARK_AUTO_MAX && (info.showStatus || sessionId === currentSessionId)) {
            required = index;
          }
        }
        return required;
      };

      const overflowFor = (key, sessionIds) => {
        if (query) {
          return { rows: sessionIds, button: null };
        }
        const base = watermarkRows(sessionIds, WATERMARK_BASE);
        const collapsedHidden = sessionIds.length - base.rows.length;
        if (collapsedHidden <= 0) {
          return { rows: sessionIds, button: null };
        }
        const expanded = overflowExpanded[key] === true;
        const watermark = expanded
          ? sessionIds.length
          : Math.max(WATERMARK_BASE, requiredWatermark(sessionIds));
        const visible = watermarkRows(sessionIds, watermark);
        const sessionsExpanded = visible.hiddenCount === 0;
        return {
          rows: visible.rows,
          button: h(
            'button',
            {
              type: 'button',
              className: 'dsg-sessionOverflow',
              'aria-expanded': sessionsExpanded ? 'true' : 'false',
              onClick: () => setOverflowExpanded((previous) => ({
                ...previous,
                [key]: previous[key] !== true,
              })),
            },
            sessionsExpanded
              ? tr('sessions.collapse')
              : tr('sessions.expand', { n: visible.hiddenCount }),
          ),
        };
      };

      const renderSessionRow = (sessionId, workspaceId, groupId) => {
        const active = activePanelId === null && currentSessionId === sessionId;
        let dropPos = dropHint?.kind === 'row' && dropHint.id === sessionId ? dropHint.position : null;
        if (dropHint?.kind === 'top' && dropHint.key === topKeyOfSession(sessionId)) {
          dropPos = dropHint.position;
        }
        const dropGroup = dropHint?.kind === 'rowGroup' && dropHint.id === sessionId;
        const { row, statuses, primaryStatus, showStatus } = statusInfoFor(sessionId);
        return h(SessionRow, {
          key: sessionId,
          sessionId,
          title: titleOf(sessionId),
          timeText: row.blank
            ? ''
            : primaryStatus.trailingLabel ?? relativeTime(row.updatedAt, now, tr),
          statuses,
          showStatus,
          active,
          pinned: pinnedSessionIds.has(sessionId),
          archived: archivedSessionIds.has(sessionId),
          editing: editingSession?.sessionId === sessionId,
          editingValue: editingSession?.value ?? '',
          dragging: dragInfo?.sessionId === sessionId,
          dropPos,
          dropGroup,
          canDrag: Boolean(workspaceId) && !query
            && list.byId?.[sessionId]?.blank !== true
            && !archivedSessionIds.has(sessionId),
          t: tr,
          onOpen: (id) => openSession(id),
          onRenameStart: () => beginSessionRename(sessionId),
          onRenameCommit: commitSessionRename,
          onRenameCancel: cancelSessionRename,
          onTogglePin: handleTogglePin,
          onArchive: (id) => handleArchive(id),
          onUnarchive: (id) => handleUnarchive(id),
          onMenu: (event, id) => openSessionMenu(event, workspaceId, groupId, id),
          onDragStart: (event, id) => handleDragStart(event, id, workspaceId, groupId),
          onDragOver: (event, id) => handleRowDragOver(event, workspaceId, groupId, id),
          onDrop: (event, id) => handleRowDrop(event, workspaceId, groupId, id),
          onDragEnd: handleDragEnd,
        });
      };

      const renderGroup = (workspace, group, members) => {
        const orderedMembers = pinnedFirst(members, pinnedSessionIds);
        const overflow = overflowFor('group:' + workspace.workspaceId + ':' + group.id, orderedMembers);
        const editing = editingGroup?.workspaceId === workspace.workspaceId
          && editingGroup?.groupId === group.id;
        const dropActive = dropHint?.kind === 'group' && dropHint.id === group.id;
        const dropTopPosition = dropHint?.kind === 'topGroup'
          && dropHint.key === topKeyOfGroup(group.id)
          ? dropHint.position
          : null;
        const dragging = dragInfo?.kind === 'group' && dragInfo.groupId === group.id;
        const collapsed = group.collapsed && !query;
        const selected = collapsed
          && activePanelId === null
          && currentSessionId !== null
          && members.includes(currentSessionId);
        const collapsedStatuses = [];
        if (collapsed) {
          const buckets = new Map();
          for (const sessionId of orderedMembers) {
            const info = statusInfoFor(sessionId);
            if (!info.showStatus) continue;
            const state = info.primaryStatus.state;
            const bucket = buckets.get(state) ?? {
              state,
              label: info.primaryStatus.label,
              count: 0,
              priority: state === 'warning' ? 0 : state === 'ongoing' ? 1 : 2,
            };
            bucket.count += 1;
            buckets.set(state, bucket);
          }
          collapsedStatuses.push(...[...buckets.values()].sort((left, right) => (
            left.priority - right.priority
          )));
        }
        return h(
          'div',
          { key: group.id, className: 'dsg-group' },
          h(GroupHeader, {
            group,
            count: members.length,
            collapsed,
            selected,
            statuses: collapsedStatuses,
            dropActive,
            dropTopPosition,
            dragging,
            editing,
            editingValue: editing ? editingGroup.value : '',
            onToggle: () => toggleGroup(workspace.workspaceId, group.id),
            onMenu: (event) => openGroupMenu(event, workspace.workspaceId, group.id),
            onAddSession: () => handleNewSessionInGroup(workspace.workspaceId, group.id),
            onEditStart: () => beginGroupRename(workspace.workspaceId, group.id),
            onEditChange: (value) => setEditingGroup((previous) => (previous ? { ...previous, value } : previous)),
            onEditCommit: commitGroupRename,
            onEditCancel: cancelGroupRename,
            onDragOver: (event) => handleGroupDragOver(event, workspace.workspaceId, group.id),
            onDrop: (event) => handleGroupDrop(event, workspace.workspaceId, group.id),
            onDragStart: (event) => handleGroupDragStart(event, workspace.workspaceId, group.id),
            onDragEnd: handleDragEnd,
            t: tr,
          }),
          collapsed
            ? null
            : h(
                'div',
                {
                  className: 'dsg-groupBody' + (dropActive ? ' dsg-groupDrop' : ''),
                  style: { '--dsg-group-color': group.color },
                  onDragOver: (event) => handleGroupDragOver(event, workspace.workspaceId, group.id),
                  onDrop: (event) => handleGroupDrop(event, workspace.workspaceId, group.id),
                },
                overflow.rows.map((sessionId) => renderSessionRow(sessionId, workspace.workspaceId, group.id)),
                overflow.button,
              ),
        );
      };

      const renderWorkspace = (section) => {
        if (section.ungroupedOnly) {
          const globalOverflow = overflowFor('global:ungrouped', section.ungrouped);
          return h(
            'section',
            { className: 'dsg-workspace', key: section.key },
            h(
              'div',
              { className: 'dsg-ungroupedHeader' },
              h(IconGroup, { width: 14, height: 14 }),
              tr('ungrouped'),
            ),
            h(
              'div',
              { className: 'dsg-simpleList' },
              globalOverflow.rows.map((sessionId) => renderSessionRow(sessionId, null, null)),
              globalOverflow.button,
            ),
          );
        }
        const { workspace, groups, ungrouped, collapsed } = section;
        const ungroupedOverflow = overflowFor('workspace:' + workspace.workspaceId, ungrouped);
        const visibleUngrouped = new Set(ungroupedOverflow.rows);
        const topItems = section.topItems.filter((item) => (
          item.kind === 'group' || visibleUngrouped.has(item.id)
        ));
        const hasGroups = groups.length > 0;
        const zoneActive = dropHint?.kind === 'ungrouped' && dropHint.workspaceId === workspace.workspaceId;
        const showUngroupBar = Boolean(dragInfo?.groupId)
          && dragInfo.workspaceId === workspace.workspaceId
          && hasGroups;
        const workspaceActive = activePanelId === null
          && currentSessionId !== null
          && (workspace.sessionIds ?? []).includes(currentSessionId);
        return h(
          'section',
          { className: 'dsg-workspace', key: section.key },
          h(
            'div',
            {
              className: 'dsg-wsHeader' + (workspaceActive ? ' active' : ''),
              role: 'button',
              tabIndex: 0,
              'data-workspace-id': workspace.workspaceId,
              'aria-expanded': !collapsed,
              title: workspace.path || workspaceTitle(workspace),
              onClick: () => toggleWorkspace(workspace.workspaceId),
              onKeyDown: (event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  toggleWorkspace(workspace.workspaceId);
                }
              },
              onDragOver: (event) => handleWorkspaceDragOver(event, workspace.workspaceId),
              onDrop: (event) => handleWorkspaceDrop(event, workspace.workspaceId),
            },
            h('span', { className: 'dsg-folder' }, h(collapsed ? IconFolderClose : IconFolderOpen)),
            h(
              'span',
              { className: 'dsg-wsChevron' + (collapsed ? '' : ' open') },
              h(IconTriangle, { width: 15, height: 15 }),
            ),
            editingWorkspace?.workspaceId === workspace.workspaceId
              ? h(GroupNameEditor, {
                  initialValue: editingWorkspace.value,
                  onCommit: commitWorkspaceRename,
                  onCancel: cancelWorkspaceRename,
                })
              : h('span', { className: 'dsg-wsName' }, workspaceTitle(workspace)),
            h(
              'span',
              { className: 'dsg-wsActions' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsg-wsAction',
                  title: tr('workspace.menu'),
                  'aria-label': tr('workspace.menu'),
                  onPointerDown: (event) => event.stopPropagation(),
                  onClick: (event) => openWorkspaceMenu(event, workspace),
                },
                h(IconMore, { width: 16, height: 16 }),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsg-wsAction',
                  title: tr('newSession.aria', { name: workspaceTitle(workspace) }),
                  'aria-label': tr('newSession.aria', { name: workspaceTitle(workspace) }),
                  onPointerDown: (event) => event.stopPropagation(),
                  onClick: (event) => {
                    event.stopPropagation();
                    startSession(workspace.workspaceId);
                  },
                },
                h(IconNewChatCircle, { width: 16, height: 16 }),
              ),
            ),
          ),
          collapsed
            ? null
            : h(
                'div',
                {
                  className: 'dsg-wsBody',
                  onDragOver: (event) => handleUngroupedDragOver(event, workspace.workspaceId),
                  onDrop: (event) => handleUngroupedDrop(event, workspace.workspaceId),
                },
                topItems.map((item) => (
                  item.kind === 'group'
                    ? renderGroup(workspace, item.group, item.members)
                    : renderSessionRow(item.id, workspace.workspaceId, null)
                )),
                ungroupedOverflow.button,
                h(
                  'div',
                  {
                    className: 'dsg-ungroupedZone' + (zoneActive ? ' dsg-zoneDrop' : ''),
                    onDragOver: (event) => handleUngroupedDragOver(event, workspace.workspaceId),
                    onDrop: (event) => handleUngroupedDrop(event, workspace.workspaceId),
                  },
                ),
              ),
        );
      };

      const renderAddWorkspaceDialog = () => {
        if (!addWorkspaceDialog) return null;
        return h(DirectoryPickerDialog, {
          t: tr,
          listDirectory,
          createDirectory,
          onPicked: pickAddWorkspaceDirectory,
          onClose: closeAddWorkspaceDialog,
          busy: addWorkspaceDialog.busy === true,
        });
      };

      const renderHeader = () => {
        if (searchOpen) {
          return h(
            'div',
            { className: 'dsg-searchRow' },
            h(IconSearch, { width: 15, height: 15, style: { color: 'var(--dsw-alias-label-tertiary)', flex: 'none', marginLeft: 2 } }),
            h('input', {
              className: 'dsg-searchInput',
              autoFocus: true,
              value: searchText,
              placeholder: tr('search.placeholder'),
              'aria-label': tr('search.placeholder'),
              onChange: (event) => setSearchText(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setSearchText('');
                  setSearchOpen(false);
                }
              },
            }),
            h(
              'button',
              {
                type: 'button',
                className: 'dsg-iconBtn',
                title: tr('search.clear'),
                'aria-label': tr('search.clear'),
                onClick: () => {
                  if (searchText) setSearchText('');
                  else setSearchOpen(false);
                },
              },
              h(IconClose, { width: 14, height: 14 }),
            ),
          );
        }
        return h(
          'div',
          { className: 'dsg-header' },
          h('span', { className: 'dsg-title' }, tr('section.title')),
          h(
            'button',
            {
              type: 'button',
              className: 'dsg-iconBtn',
              title: tr('search.open'),
              'aria-label': tr('search.open'),
              onClick: () => setSearchOpen(true),
            },
            h(IconSearch, { width: 15, height: 15 }),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsg-iconBtn',
              title: tr('view.options'),
              'aria-label': tr('view.options'),
              onClick: openViewMenu,
            },
            h(IconSliders, { width: 15, height: 15 }),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsg-iconBtn',
              title: tr('addWorkspace'),
              'aria-label': tr('addWorkspace'),
              disabled: addingWorkspace,
              onClick: handleAddWorkspace,
            },
            h(IconWorkspaceAdd, { width: 16, height: 16 }),
          ),
        );
      };

      const renderMenu = () => {
        if (!menu) return null;
        if (menu.kind === 'group') {
          const groups = prefs.groups?.[menu.workspaceId] ?? [];
          const group = groups.find((item) => item.id === menu.groupId);
          if (!group) return null;
          return h(
            InlineMenu,
            { rect: menu.rect, onClose: closeMenu },
            h(MenuItem, {
              icon: h(IconGroup),
              label: tr('group.rename'),
              onClick: () => beginGroupRename(menu.workspaceId, menu.groupId),
            }),
            h('div', { className: 'dsg-menuLabelText' }, tr('group.color')),
            h(
              'div',
              { className: 'dsg-swatches' },
              GROUP_COLORS.map((color) => h('button', {
                key: color,
                type: 'button',
                className: 'dsg-swatch' + (color === group.color ? ' selected' : ''),
                title: color,
                'aria-label': color,
                style: { background: color },
                onClick: () => {
                  setPrefs((previous) => patchGroup(previous, menu.workspaceId, menu.groupId, { color }));
                  closeMenu();
                },
              })),
            ),
            h('div', { className: 'dsg-menuSeparator' }),
            h(MenuItem, {
              icon: h(IconUngroup),
              label: tr('group.dissolve'),
              danger: true,
              onClick: () => handleDissolveGroup(menu.workspaceId, menu.groupId),
            }),
          );
        }
        if (menu.kind === 'workspace') {
          const workspace = workspaces.find((item) => item.workspaceId === menu.workspaceId);
          if (!workspace) return null;
          return h(
            InlineMenu,
            { rect: menu.rect, onClose: closeMenu },
            h(MenuItem, {
              icon: h(IconSort),
              label: tr('workspace.sortByTime'),
              onClick: () => handleSortWorkspaceByTime(workspace.workspaceId),
            }),
            h('div', { className: 'dsg-menuSeparator' }),
            h(MenuItem, {
              icon: h(IconEdit),
              label: tr('workspace.rename'),
              onClick: () => beginWorkspaceRename(workspace),
            }),
            h(MenuItem, {
              icon: h(IconTrash),
              label: tr('workspace.delete'),
              danger: true,
              onClick: () => handleDeleteWorkspace(workspace),
            }),
          );
        }
        const groups = menu.workspaceId ? prefs.groups?.[menu.workspaceId] ?? [] : [];
        const currentGroup = menu.groupId ? groups.find((group) => group.id === menu.groupId) : null;
        const otherGroups = groups.filter((group) => group.id !== menu.groupId);
        const pinned = pinnedSessionIds.has(menu.sessionId);
        const archived = archivedSessionIds.has(menu.sessionId);
        const blank = list.byId?.[menu.sessionId]?.blank === true;
        return h(
          InlineMenu,
          { rect: menu.rect, onClose: closeMenu },
          h(MenuItem, {
            icon: pinned ? h(IconPinFill) : h(IconPinOutline),
            label: pinned ? tr('session.unpin') : tr('session.pin'),
            onClick: () => handleTogglePin(menu.sessionId),
          }),
          blank
            ? null
            : h(MenuItem, {
                icon: h(IconEdit),
                label: tr('session.rename'),
                shortcut: 'Ctrl + Alt + G',
                onClick: () => beginSessionRename(menu.sessionId),
              }),
          h(MenuItem, {
            icon: h(IconBranch),
            label: tr('session.fork'),
            shortcut: 'Ctrl + Shift + F',
            onClick: () => handleFork(menu.sessionId),
          }),
          h(MenuItem, {
            icon: h(IconArchive),
            label: archived ? tr('session.unarchive') : tr('session.archive'),
            shortcut: archived ? undefined : 'Ctrl + Alt + A',
            onClick: () => (archived ? handleUnarchive(menu.sessionId) : handleArchive(menu.sessionId)),
          }),
          h(MenuItem, {
            icon: h(IconCopy),
            label: tr('session.copyId'),
            onClick: () => handleCopyId(menu.sessionId),
          }),
          h('div', { className: 'dsg-menuSeparator' }),
          menu.workspaceId
            ? h(MenuItem, {
                icon: h(IconGroup),
                label: tr('session.newGroup'),
                onClick: () => handleCreateGroupForSession(menu.workspaceId, menu.sessionId),
              })
            : null,
          currentGroup
            ? h(MenuItem, {
                icon: h(IconUngroup),
                label: tr('session.removeFromGroup'),
                onClick: () => handleRemoveFromGroup(menu.workspaceId, menu.sessionId),
              })
            : null,
          otherGroups.length > 0
            ? h('div', { className: 'dsg-menuSeparator' })
            : null,
          ...otherGroups.map((group) => h(MenuItem, {
            key: group.id,
            icon: h('span', {
              className: 'dsg-groupDot',
              style: { '--dsg-group-color': group.color },
            }),
            label: tr('session.moveToGroup', { name: group.name }),
            onClick: () => handleMoveToGroup(menu.workspaceId, group.id, menu.sessionId),
          })),
        );
      };

      const renderViewMenu = () => {
        if (!viewMenu) return null;
        return h(
          InlineMenu,
          { rect: viewMenu.rect, onClose: () => setViewMenu(null) },
          h(MenuItem, {
            icon: h(IconGroup),
            label: tr('view.expandAllGroups'),
            onClick: () => applyViewAction('expandGroups'),
          }),
          h(MenuItem, {
            icon: h(IconGroup),
            label: tr('view.collapseAllGroups'),
            onClick: () => applyViewAction('collapseGroups'),
          }),
          h('div', { className: 'dsg-menuSeparator' }),
          h(MenuItem, {
            label: tr('view.expandAllWorkspaces'),
            onClick: () => applyViewAction('expandWorkspaces'),
          }),
          h(MenuItem, {
            label: tr('view.collapseAllWorkspaces'),
            onClick: () => applyViewAction('collapseWorkspaces'),
          }),
          h('div', { className: 'dsg-menuSeparator' }),
          h(MenuItem, {
            label: tr('view.resetOrder'),
            onClick: () => applyViewAction('resetOrder'),
          }),
          h('div', { className: 'dsg-menuSeparator' }),
          h(MenuItem, {
            icon: h(IconArchiveOff),
            label: tr('workspace.hideArchived'),
            checked: prefs.hideArchived !== false,
            onClick: handleToggleHideArchived,
          }),
          h('div', { className: 'dsg-menuSeparator' }),
          h(MenuItem, {
            label: tr('view.official'),
            onClick: () => {
              setViewMenu(null);
              setGroupedMode(false);
            },
          }),
        );
      };

      if (!wide) {
        return h(
          React.Fragment,
          null,
          h('style', { key: 'styles' }, CSS),
          h(Rail, {
            t: tr,
            expandSidebar,
            onAddWorkspace: handleAddWorkspace,
          }),
        );
      }

      const showHint = !query
        && !hasAnyGroup
        && visibleCount >= 2
        && phase === 'ready';

      return h(
        React.Fragment,
        null,
        h('style', { key: 'styles' }, CSS),
        h(
          'div',
          { className: 'dsg-root' },
          renderHeader(),
          h(
            'div',
            { className: 'dsg-scroll' },
            phase === 'pending' && sections.length === 0
              ? h('div', { className: 'dsg-empty' }, tr('section.loading'))
              : sections.length === 0
                ? h(
                    'div',
                    { className: 'dsg-empty' },
                    query ? tr('section.emptySearch') : tr('section.empty'),
                    !query
                      ? h(
                          'button',
                          {
                            type: 'button',
                            className: 'dsg-emptyAction',
                            onClick: handleAddWorkspace,
                          },
                          h(IconWorkspaceAdd, { width: 14, height: 14 }),
                          tr('addWorkspace'),
                        )
                      : null,
                  )
                : sections.map((section) => renderWorkspace(section)),
          ),
        ),
        renderMenu(),
        renderViewMenu(),
        renderAddWorkspaceDialog(),
      );
    }

    /* ── plugin body ───────────────────────────────────────────────── */

    /**
     * A page booted before this bundle was installed has a stale boot graph even
     * after HMR loads the new module; the sidebar shell may keep its old tree.
     * Reload once so the page boots with this entry in its graph, then leave a
     * tab-scoped marker so a failed refresh cannot become a reload loop.
     */
    function reloadStaleBootPage() {
      const boot = window.__DSH_BOOT__;
      const bootHasEntry = !boot || !Array.isArray(boot.entries)
        ? false
        : boot.entries.some((entry) => entry && entry.id === 'dsh-session-groups');
      let elapsed = 0;
      try {
        elapsed = typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now()
          : 0;
      } catch {
        elapsed = 0;
      }
      // A late apply means HMR mounted us into a page whose boot tree predates
      // the bundle; a fresh boot applies this module as part of page startup.
      if (bootHasEntry && elapsed < 1500) return false;
      try {
        const key = 'dsh.session-groups.boot-reload.v2';
        if (window.sessionStorage.getItem(key) === '1') return false;
        window.sessionStorage.setItem(key, '1');
        window.location.reload();
        return true;
      } catch {
        return false;
      }
    }

    return {
      inject: ['slots', 'locale', 'uiWorkspace', 'workspaces', 'sessions'],
      apply(ctx) {
        if (reloadStaleBootPage()) return;
        ctx.effect(
          () => ctx.locale.register(NS, { zh: ZH, en: EN }),
          'session-groups: locale dictionaries',
        );

        const modeStore = createViewModeStore();
        const injected = () => ({
          setGroupedMode: (next) => modeStore.set(next),
          openSession: (sessionId) => ctx.uiWorkspace.openSession(sessionId),
          startSession: (workspaceId) => ctx.uiWorkspace.startSession(workspaceId),
          archiveSession: (sessionId) => ctx.uiWorkspace.archiveSession(sessionId),
          unarchiveSession: (sessionId) => ctx.uiWorkspace.unarchiveSession(sessionId),
          forkSession: (sessionId) => ctx.uiWorkspace.forkSession(sessionId),
          pinSession: (sessionId) => ctx.workspaces.pinSession(sessionId),
          unpinSession: (sessionId) => ctx.workspaces.unpinSession(sessionId),
          renameSession: async (sessionId, title) => {
            await ctx.sessions.using(sessionId, { source: 'workspaceOperation' }, async (reference) => {
              await reference.ready;
              const result = await reference.binding.session.rename(title);
              if (result && result.ok === false) {
                throw new Error(result.error?.message ?? 'rename failed');
              }
            });
          },
          insertSessionBefore: (workspaceId, sessionId, beforeSessionId) =>
            ctx.workspaces.insertSessionBefore(workspaceId, sessionId, beforeSessionId),
          renameWorkspace: (workspaceId, title) => ctx.workspaces.rename(workspaceId, title),
          deleteWorkspace: (workspaceId) => ctx.workspaces.delete(workspaceId),
          listDirectory: (path, signal) => ctx.uiWorkspace.listDirectory(path, signal),
          createDirectory: (path, name) => ctx.uiWorkspace.createDirectory(path, name),
          addWorkspaceAtPath: async (path) => {
            const workspace = await ctx.workspaces.create({ path });
            if (workspace && workspace.workspaceId) {
              try {
                await ctx.uiWorkspace.openWorkspace(workspace.workspaceId);
              } catch {
                /* the workspace is registered even if opening its blank session fails */
              }
            }
            return workspace;
          },
          addWorkspace: async () => {
            const path = await ctx.uiWorkspace.pickDirectory();
            if (!path) return null;
            const workspace = await ctx.workspaces.create({ path });
            if (workspace && workspace.workspaceId) {
              try {
                await ctx.uiWorkspace.openWorkspace(workspace.workspaceId);
              } catch {
                /* the workspace is registered even if the blank session fails */
              }
            }
            return path;
          },
        });

        let slotDeclared = false;
        let browserDispose = null;
        const uninstallBrowser = () => {
          if (browserDispose === null) return;
          browserDispose();
          browserDispose = null;
        };
        const installBrowser = () => {
          if (!slotDeclared || !modeStore.getSnapshot() || browserDispose !== null) return;
          browserDispose = ctx.slots.register(
            {
              name: 'sidebar.workspaces',
              id: 'session-groups-browser',
              priority: -100,
              locale: NS,
              inject: injected,
            },
            SessionGroupsBrowser,
          );
        };
        ctx.slots.inject('sidebar.workspaces', () => {
          slotDeclared = true;
          installBrowser();
          return () => {
            slotDeclared = false;
            uninstallBrowser();
          };
        });
        ctx.effect(
          () => modeStore.subscribe(() => {
            if (modeStore.getSnapshot()) installBrowser();
            else uninstallBrowser();
          }),
          'session-groups: grouped view mode',
        );
        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
          {
            name: 'sidebar.footer.action',
            id: 'session-groups-view-toggle',
            order: 20,
            locale: NS,
            inject: () => ({ modeStore }),
          },
          ViewModeToggle,
        ));
      },
    };
  },
});
