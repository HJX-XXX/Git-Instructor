import { applyCommand } from './apply';
import { createConceptDemoRepo, createEmptyRepoState, createInitialDemoState, createUninitializedRepoState } from './demo';
import { headCommitId, isAncestor } from './hash';
import { parseCommand } from './parse';
import type {
  Commit,
  CommitId,
  Explanation,
  Highlights,
  RepoState,
  UserId,
  WorldCommandResult,
  WorldState,
} from './types';

export const USER_META: Record<UserId, { label: string; short: string; color: string }> = {
  alice: { label: 'Alice', short: 'A', color: '#2563EB' },
  bob: { label: 'Bob', short: 'B', color: '#7C3AED' },
};

export const USER_IDS: UserId[] = ['alice', 'bob'];

function cloneRepoState(state: RepoState): RepoState {
  return {
    commits: Object.fromEntries(
      Object.entries(state.commits).map(([k, v]) => [k, { ...v, parents: [...v.parents] }]),
    ),
    branches: { ...state.branches },
    head:
      state.head.kind === 'branch'
        ? ({ kind: 'branch', name: state.head.name } as const)
        : ({ kind: 'detached', commitId: state.head.commitId } as const),
    workingFiles: [...state.workingFiles],
    dirty: state.dirty,
    staged: state.staged,
    stash: state.stash.map((s) => ({ ...s })),
    initialized: state.initialized,
    commitSeq: state.commitSeq,
  };
}

function cloneWorld(world: WorldState): WorldState {
  return {
    activeUser: world.activeUser,
    users: {
      alice: cloneRepoState(world.users.alice),
      bob: cloneRepoState(world.users.bob),
    },
    remoteBranches: { ...world.remoteBranches },
    remoteCommits: Object.fromEntries(
      Object.entries(world.remoteCommits).map(([k, v]) => [k, { ...v, parents: [...v.parents] }]),
    ),
  };
}

export function createEmptyWorld(): WorldState {
  return {
    activeUser: 'alice',
    users: {
      alice: createUninitializedRepoState(),
      bob: createUninitializedRepoState(),
    },
    remoteBranches: {},
    remoteCommits: {},
  };
}

/** L1：本地未 init；共享远程 origin 已有演示历史 */
export function createCloneDemoWorld(): WorldState {
  const base = createInitialDemoState();
  return {
    activeUser: 'alice',
    users: {
      alice: createUninitializedRepoState(),
      bob: createUninitializedRepoState(),
    },
    remoteBranches: { main: base.branches.main! },
    remoteCommits: Object.fromEntries(
      Object.entries(base.commits).map(([k, v]) => [k, { ...v, parents: [...v.parents] }]),
    ),
  };
}

/** 已 init 的空世界（图上仅 git init 锚点） */
export function createInitedEmptyWorld(): WorldState {
  return {
    activeUser: 'alice',
    users: {
      alice: createEmptyRepoState(),
      bob: createEmptyRepoState(),
    },
    remoteBranches: {},
    remoteCommits: {},
  };
}

/** 两人已有相同的 main 历史，模拟从同一远程克隆过 */
export function createDemoWorld(): WorldState {
  const base = createInitialDemoState();
  return {
    activeUser: 'alice',
    users: {
      alice: cloneRepoState(base),
      bob: cloneRepoState(base),
    },
    remoteBranches: { main: 'c33cf03' },
    remoteCommits: Object.fromEntries(
      Object.entries(base.commits).map(([k, v]) => [k, { ...v, parents: [...v.parents] }]),
    ),
  };
}

/** 关卡 0：本地 main + feature 分叉，无远程，专注看分支标签 */
export function createConceptDemoWorld(): WorldState {
  const base = createConceptDemoRepo();
  return {
    activeUser: 'alice',
    users: {
      alice: cloneRepoState(base),
      bob: cloneRepoState(createEmptyRepoState()),
    },
    remoteBranches: {},
    remoteCommits: {},
  };
}

function collectReachable(commits: Record<CommitId, Commit>, tips: CommitId[]): CommitId[] {
  const seen = new Set<CommitId>();
  const stack = [...tips];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id) || !commits[id]) continue;
    seen.add(id);
    for (const p of commits[id]!.parents) stack.push(p);
  }
  return [...seen];
}

function copyCommits(
  from: Record<CommitId, Commit>,
  to: Record<CommitId, Commit>,
  ids: CommitId[],
): void {
  for (const id of ids) {
    const c = from[id];
    if (!c) continue;
    to[id] = { ...c, parents: [...c.parents] };
  }
}

function failWorld(
  world: WorldState,
  stdout: string[],
  explanation: Explanation,
): WorldCommandResult {
  return { ok: false, world, stdout, explanation };
}

function okWorld(
  world: WorldState,
  stdout: string[],
  explanation: Explanation,
  highlights?: Highlights,
  switchedUser?: UserId,
): WorldCommandResult {
  return { ok: true, world, stdout, explanation, highlights, switchedUser };
}

function currentBranchName(state: RepoState): string | null {
  return state.head.kind === 'branch' ? state.head.name : null;
}

function runPush(world: WorldState, branchArg?: string): WorldCommandResult {
  const user = world.activeUser;
  const local = world.users[user]!;
  const branch = branchArg ?? currentBranchName(local);
  if (!branch) {
    return failWorld(world, ['fatal: 游离 HEAD，无法 push（请指定分支）'], {
      title: '无法 push',
      summary: '请先切到分支，或 git push origin <分支名>。',
    });
  }
  const localTip = local.branches[branch];
  if (!localTip || !local.commits[localTip]) {
    return failWorld(world, [`error: 本地分支 '${branch}' 不存在或尚无提交`], {
      title: '无法 push',
      summary: `请先在 ${branch} 上 commit，再推送。`,
      related: ['git commit -m "..."', `git push origin ${branch}`],
    });
  }

  const remoteTip = world.remoteBranches[branch];
  if (remoteTip && remoteTip !== localTip) {
    const canFF = local.commits[remoteTip]
      ? isAncestor(local.commits, remoteTip, localTip)
      : false;
    if (!canFF) {
      return failWorld(
        world,
        [
          `! [rejected]        ${branch} -> ${branch} (non-fast-forward)`,
          'hint: 远程有你本地没有的提交，请先 git pull 再 push。',
        ],
        {
          title: '推送被拒绝（非快进）',
          summary: `origin/${branch} 有你本地没有的提交，push 无法快进完成，会被拒。先 git pull 再 push。`,
          detail: '快进 = 远程分支指针沿同一条历史前移。生产环境禁止对共享分支 force push，这里也按此模拟。',
          related: ['git pull', `git push origin ${branch}`],
        },
      );
    }
  }

  const ids = collectReachable(local.commits, [localTip]);
  copyCommits(local.commits, world.remoteCommits, ids);
  world.remoteBranches[branch] = localTip;

  return okWorld(
    world,
    [
      'To origin',
      ` * [new reference]     ${branch} -> ${branch}`,
      `已推送 ${USER_META[user].label} 的 ${branch}（${localTip}）到共享远程。`,
    ],
    {
      title: 'push 成功',
      summary: `分支 ${branch} 已发布到 origin。切换到另一名用户后，需要 git fetch / git pull 才能看到。`,
      detail: `远程最新提交 = ${localTip}。协作：push 分享 → 对方 pull 同步。`,
      related: ['git fetch', 'git pull', 'git remote -v'],
    },
    { remoteRefs: [branch] },
  );
}

function runFetch(world: WorldState): WorldCommandResult {
  const user = world.activeUser;
  const local = world.users[user]!;
  const names = Object.keys(world.remoteBranches);
  if (names.length === 0) {
    return okWorld(
      world,
      ['From origin', '（远程还没有任何分支可取）'],
      {
        title: 'fetch 完成',
        summary: '远程为空。请另一名用户先 commit 再 push。',
        related: [`user ${user === 'alice' ? 'bob' : 'alice'}`, 'git push'],
      },
    );
  }
  const imported: string[] = [];
  for (const name of names) {
    const tip = world.remoteBranches[name]!;
    const ids = collectReachable(world.remoteCommits, [tip]);
    copyCommits(world.remoteCommits, local.commits, ids);
    imported.push(`origin/${name} -> ${tip}`);
  }
  return okWorld(
    world,
    ['From origin', ...imported.map((l) => `   ${l}`)],
    {
      title: 'fetch 已同步远程',
      summary: `已把 origin 的提交下载到 ${USER_META[user].label} 本地，图上可能出现 origin/* 标签。`,
      detail: 'fetch 只更新远程跟踪引用，不自动合并；pull = fetch + merge。',
      related: ['git pull', 'git log --oneline'],
    },
    { remoteRefs: names },
  );
}

function runPull(world: WorldState, branchArg?: string): WorldCommandResult {
  const user = world.activeUser;
  let w = cloneWorld(world);
  const fetchRes = runFetch(w);
  w = fetchRes.world;
  if (!fetchRes.ok) return fetchRes;

  const local = w.users[user]!;
  const branch = branchArg ?? currentBranchName(local);
  if (!branch) {
    return failWorld(w, ['fatal: 游离 HEAD，无法 pull'], {
      title: '无法 pull',
      summary: '请先切到本地分支。',
    });
  }
  const remoteTip = w.remoteBranches[branch];
  if (!remoteTip) {
    return okWorld(
      w,
      fetchRes.stdout,
      {
        title: 'fetch 完成，无可合并',
        summary: `远程没有分支 ${branch}。`,
        related: ['git fetch', 'git push'],
      },
      { remoteRefs: Object.keys(w.remoteBranches) },
    );
  }

  if (!local.branches[branch]) {
    local.branches[branch] = remoteTip;
    if (local.head.kind !== 'branch') {
      local.head = { kind: 'branch', name: branch };
    }
    return okWorld(
      w,
      [...fetchRes.stdout, `已创建本地分支 ${branch} 并跟踪 origin/${branch}`],
      {
        title: 'pull 创建了本地分支',
        summary: `远程有 ${branch}，本地没有，已指向 ${remoteTip}。`,
        related: ['git log --oneline', 'git switch ' + branch],
      },
      { remoteRefs: [branch], movedRefs: [branch] },
    );
  }

  const localTip = local.branches[branch]!;
  if (localTip === remoteTip || isAncestor(local.commits, remoteTip, localTip)) {
    return okWorld(
      w,
      [...fetchRes.stdout, 'Already up to date.'],
      {
        title: '已经最新',
        summary: `本地 ${branch} 已包含 origin/${branch}。`,
        related: ['git log --oneline'],
      },
      { remoteRefs: [branch] },
    );
  }

  if (isAncestor(local.commits, localTip, remoteTip)) {
    local.branches[branch] = remoteTip;
    return okWorld(
      w,
      [...fetchRes.stdout, `Fast-forward ${branch} to ${remoteTip}`],
      {
        title: 'pull 快进更新',
        summary: `本地没有独有提交，${branch} 前进到远程的 ${remoteTip}。`,
        related: ['git log --oneline'],
      },
      { remoteRefs: [branch], movedRefs: [branch], newHead: true },
    );
  }

  if (local.head.kind === 'branch' && local.head.name !== branch) {
    local.head = { kind: 'branch', name: branch };
  }
  const tempName = `origin/${branch}`;
  local.branches[tempName] = remoteTip;
  const merged = applyCommand(local, `git merge ${tempName}`);
  delete merged.state.branches[tempName];
  w.users[user] = merged.state;

  if (!merged.ok) {
    return failWorld(w, [...fetchRes.stdout, ...merged.stdout], {
      title: 'pull 未能自动合并',
      summary: merged.explanation.summary,
      detail: '可先 git status 查看；教学沙箱对 dirty 工作区会拒绝合并。',
      related: ['git status', `git merge origin/${branch}`],
    });
  }

  return okWorld(
    w,
    [...fetchRes.stdout, ...merged.stdout],
    {
      title: 'pull 已合并远程',
      summary: `已把 origin/${branch} 合入本地 ${branch}。可以再 push 分享合并结果。`,
      detail: merged.explanation.detail,
      related: [`git push origin ${branch}`, 'git log --oneline'],
    },
    { ...merged.highlights, remoteRefs: [branch] },
  );
}

export function switchUser(world: WorldState, userId: UserId): WorldCommandResult {
  if (world.activeUser === userId) {
    return okWorld(world, [`已经是 ${USER_META[userId].label}`], {
      title: '当前用户',
      summary: `你正在以 ${USER_META[userId].label} 身份操作本地仓库。`,
    });
  }
  const w = cloneWorld(world);
  w.activeUser = userId;
  return okWorld(
    w,
    [`当前用户：${USER_META[userId].label}`],
    {
      title: `已切换到 ${USER_META[userId].label}`,
      summary: `${USER_META[userId].label} 有自己的本地分支与提交。对方 push 的内容不会自动出现，需要 git fetch / git pull。`,
      detail: '模拟生产协作：每人一套本地引用，共享 origin 作为中枢。',
      related: ['git fetch', 'git pull', 'git push'],
    },
    undefined,
    userId,
  );
}

/** 支持 rebase 到本地分支或 origin/<远程分支>（自动 fetch 缺失对象） */
function runRebaseWorld(
  world: WorldState,
  target: string,
  raw: string,
): WorldCommandResult {
  const user = world.activeUser;
  const local = world.users[user]!;

  // 本地分支优先
  if (local.branches[target] && !target.startsWith('origin/')) {
    const result = applyCommand(local, raw);
    world.users[user] = result.state;
    return {
      ok: result.ok,
      world,
      stdout: result.stdout,
      explanation: result.explanation,
      highlights: result.highlights,
    };
  }

  let remoteName = target;
  if (remoteName.startsWith('origin/')) remoteName = remoteName.slice('origin/'.length);

  const remoteTip = world.remoteBranches[remoteName];
  if (!remoteTip) {
    return failWorld(
      world,
      [
        `fatal: '${target}' 既不是本地分支，也不是已知远程分支`,
        'hint: 先 git fetch，再 git rebase origin/<分支名>',
      ],
      {
        title: '无法 rebase',
        summary: `找不到 ${target}。远程分支要用 origin/ 前缀，例如 git rebase origin/feature。`,
        related: ['git fetch', 'git remote -v', `git rebase origin/${remoteName}`],
      },
    );
  }

  // 确保远程提交在本地
  if (!local.commits[remoteTip]) {
    const fr = runFetch(world);
    if (!fr.ok) return fr;
    if (!local.commits[remoteTip]) {
      return failWorld(world, [...fr.stdout, 'fatal: 远程提交尚未同步到本地'], {
        title: '无法 rebase',
        summary: '请先 git fetch 后再 rebase origin/<分支>。',
        related: ['git fetch', `git rebase origin/${remoteName}`],
      });
    }
  }

  const temp = `origin/${remoteName}`;
  local.branches[temp] = remoteTip;
  const result = applyCommand(local, `git rebase ${temp}`);
  delete result.state.branches[temp];
  world.users[user] = result.state;

  return {
    ok: result.ok,
    world,
    stdout: [
      `（已把 origin/${remoteName} 作为变基目标（最新提交 ${remoteTip}））`,
      ...result.stdout,
    ],
    explanation: {
      title: result.ok ? `已 rebase 到 origin/${remoteName}` : result.explanation.title,
      summary: result.ok
        ? `把当前分支的独有提交重放到远程 ${remoteName}（${remoteTip}）之上。`
        : result.explanation.summary,
      detail:
        result.explanation.detail ??
        '真实写法：git fetch 后 git rebase origin/<branch>；本沙箱会自动拉取缺失的远程提交。',
      related: [`git log --oneline`, `git push origin ${local.head.kind === 'branch' ? local.head.name : ''}`],
    },
    highlights: result.highlights,
  };
}

/** 同步两人 commitSeq，降低短 hash 碰撞 */
function syncSeq(world: WorldState): void {
  const maxSeq = Math.max(
    world.users.alice.commitSeq,
    world.users.bob.commitSeq,
    ...Object.values(world.remoteCommits).map((c) => c.createdAt),
    0,
  );
  world.users.alice.commitSeq = Math.max(world.users.alice.commitSeq, maxSeq);
  world.users.bob.commitSeq = Math.max(world.users.bob.commitSeq, maxSeq);
}

/** 从共享远程复制历史到当前用户本地；远程为空则失败 */
function runCloneWorld(w: WorldState, url?: string): WorldCommandResult {
  const user = w.activeUser;
  const local = w.users[user]!;
  const tips = Object.entries(w.remoteBranches).filter(([, tip]) => Boolean(w.remoteCommits[tip]));
  if (tips.length === 0) {
    return failWorld(
      w,
      [`fatal: repository '${url ?? 'https://sandbox.local/git/teach.git'}' does not exist or is empty`],
      {
        title: '无法 clone',
        summary: '远程仓库是空的，没有可复制的提交历史。',
        detail: 'clone 的前提是远程已有内容。本关起点里 origin 已含演示历史；若远程为空会失败。',
        related: ['git remote -v', 'git init'],
      },
    );
  }

  // 把远程上可达的提交全部装入本地
  const rootTips = tips.map(([, tip]) => tip);
  const reach: Record<string, true> = {};
  const stack = [...rootTips];
  while (stack.length) {
    const id = stack.pop()!;
    if (reach[id] || !w.remoteCommits[id]) continue;
    reach[id] = true;
    for (const p of w.remoteCommits[id]!.parents) stack.push(p);
  }
  local.commits = {};
  for (const id of Object.keys(reach)) {
    const c = w.remoteCommits[id]!;
    local.commits[id] = { ...c, parents: [...c.parents] };
  }
  local.branches = Object.fromEntries(tips.map(([name, tip]) => [name, tip]));
  local.head = { kind: 'branch', name: tips[0]![0] };
  local.workingFiles = [];
  local.dirty = false;
  local.staged = false;
  local.stash = [];
  local.initialized = true;
  local.commitSeq = Math.max(
    local.commitSeq,
    ...Object.values(local.commits).map((c) => c.createdAt),
    0,
  );

  return okWorld(
    w,
    [
      `Cloning into 'sandbox' from ${url ?? 'https://sandbox.local/git/teach.git'}...`,
      `remote: 共 ${Object.keys(local.commits).length} 个提交已发送。`,
      `done. ${local.head.kind === 'branch' ? local.head.name : 'HEAD'} → ${headCommitId(local)}`,
    ],
    {
      title: 'git clone',
      summary: `已从远程 origin 复制 ${Object.keys(local.commits).length} 个提交到本地，并建立 ${tips.map(([n]) => n).join('、')} 与 origin 跟踪。`,
      detail: '远程本来就有历史，clone 才能成功；若远程为空会报 does not exist or is empty。',
      related: ['git log --oneline', 'git remote -v', 'git status'],
    },
    {
      createdCommits: Object.keys(local.commits),
      movedRefs: Object.keys(local.branches),
      newHead: true,
      remoteRefs: tips.map(([n]) => `origin/${n}`),
    },
  );
}

export function applyWorldCommand(world: WorldState, input: string): WorldCommandResult {
  const trimmed = input.trim();
  const userAlias = /^user\s+(alice|bob)$/i.exec(trimmed);
  if (userAlias) {
    return switchUser(world, userAlias[1]!.toLowerCase() as UserId);
  }

  const parsed = parseCommand(trimmed);
  const w = cloneWorld(world);
  syncSeq(w);
  const user = w.activeUser;
  const local = w.users[user]!;

  if (parsed.type === 'unknown') {
    return failWorld(w, [`error: ${parsed.hint}`], {
      title: '无法执行',
      summary: parsed.hint,
      detail: '输入 help 查看命令；协作：git push / fetch / pull，user alice|bob 切换用户。',
      related: ['help', 'git push', 'git pull'],
    });
  }

  if (parsed.type === 'push') return runPush(w, parsed.branch);
  if (parsed.type === 'fetch') return runFetch(w);
  if (parsed.type === 'pull') return runPull(w, parsed.branch);

  if (parsed.type === 'clone') {
    return runCloneWorld(w, parsed.url);
  }

  if (parsed.type === 'rebase') {
    return runRebaseWorld(w, parsed.target, trimmed);
  }

  if (parsed.type === 'remote_list') {
    const branches = Object.keys(w.remoteBranches);
    return okWorld(
      w,
      [
        'origin  https://sandbox.local/git/teach.git (fetch)',
        'origin  https://sandbox.local/git/teach.git (push)',
        branches.length
          ? `远程分支：${branches.map((b) => `${b} → ${w.remoteBranches[b]}`).join(', ')}`
          : '远程分支：（空）',
        `当前用户：${USER_META[user].label}`,
      ],
      {
        title: '共享远程 origin',
        summary: 'Alice 与 Bob 共用这一个模拟远程。push 上传，fetch/pull 下载。',
        related: ['git push', 'git fetch', 'user bob'],
      },
    );
  }

  if (parsed.type === 'help') {
    const localHelp = applyCommand(local, 'help');
    return okWorld(
      w,
      [
        ...localHelp.stdout,
        '--- 协作 ---',
        '  git push [origin] [branch]',
        '  git fetch',
        '  git pull [origin] [branch]',
        '  git remote -v',
        '  user alice | user bob',
      ],
      localHelp.explanation,
    );
  }

  const result = applyCommand(local, trimmed);
  w.users[user] = result.state;
  syncSeq(w);

  return {
    ok: result.ok,
    world: w,
    stdout: result.stdout,
    explanation: result.explanation,
    highlights: result.highlights,
  };
}

export function activeRepo(world: WorldState): RepoState {
  return world.users[world.activeUser];
}

/** 本地可见的远程引用 */
export function visibleRemoteRefs(world: WorldState): Record<string, CommitId> {
  // 远程引用始终可见（未 clone 时本地可能还没有对应对象）
  return { ...world.remoteBranches };
}

export function describeUserLine(world: WorldState): string {
  const u = world.activeUser;
  const tip = headCommitId(activeRepo(world));
  return `${USER_META[u].label} · ${tip ?? '尚无提交'}`;
}
