import {
  headCommitId,
  isAncestor,
  resolveCommitId,
  shortHashFromSeq,
  walkBack,
} from './hash';
import { parseCommand } from './parse';
import type {
  CommandResult,
  Commit,
  CommitId,
  Explanation,
  Highlights,
  RepoState,
} from './types';

function cloneState(state: RepoState): RepoState {
  return {
    commits: Object.fromEntries(
      Object.entries(state.commits).map(([k, v]) => [k, { ...v, parents: [...v.parents] }]),
    ),
    branches: { ...state.branches },
    head:
      state.head.kind === 'branch'
        ? { kind: 'branch', name: state.head.name }
        : { kind: 'detached', commitId: state.head.commitId },
    workingFiles: [...state.workingFiles],
    dirty: state.dirty,
    commitSeq: state.commitSeq,
  };
}

function fail(
  state: RepoState,
  stdout: string[],
  explanation: Explanation,
): CommandResult {
  return { ok: false, state, stdout, explanation };
}

function ok(
  state: RepoState,
  stdout: string[],
  explanation: Explanation,
  highlights?: Highlights,
): CommandResult {
  return { ok: true, state, stdout, explanation, highlights };
}

function createCommit(
  state: RepoState,
  parents: CommitId[],
  message: string,
): Commit {
  const seq = state.commitSeq + 1;
  state.commitSeq = seq;
  const id = shortHashFromSeq(seq);
  const commit: Commit = {
    id,
    parents,
    message,
    createdAt: seq,
  };
  state.commits[id] = commit;
  return commit;
}

function setHeadTip(state: RepoState, commitId: CommitId): string | undefined {
  if (state.head.kind === 'branch') {
    state.branches[state.head.name] = commitId;
    return state.head.name;
  }
  state.head = { kind: 'detached', commitId };
  return undefined;
}

function headLabel(state: RepoState): string {
  if (state.head.kind === 'branch') return state.head.name;
  return `detached@${state.head.commitId}`;
}

const HELP_LINES = [
  '支持的教学命令：',
  '  git status',
  '  git commit -m "<msg>"',
  '  git branch <name>',
  '  git branch -d|-D <name>',
  '  git switch <name>          （等价 checkout <name>）',
  '  git switch -c <name>       （等价 checkout -b <name>）',
  '  git merge <name>',
  '  git reset --soft|--mixed|--hard HEAD~n',
  '  git revert <hash>|HEAD',
  '  git rebase <branch>',
  '  git log [--oneline]',
  '  help',
];

function explainUnknown(hint: string): Explanation {
  return {
    title: '无法执行',
    summary: hint,
    detail: '这是教学沙箱，只模拟部分常用命令。输入 help 查看完整列表。',
    related: ['git status', 'help'],
  };
}

function runHelp(state: RepoState): CommandResult {
  return ok(state, [...HELP_LINES], {
    title: '帮助',
    summary: '下列命令已在沙箱中实现，可直接输入练习。',
    detail: '输入可省略前缀 git。左侧速查也可一键填入。',
    related: ['git status', 'git commit -m "说明"'],
  });
}

function runStatus(state: RepoState): CommandResult {
  const branch =
    state.head.kind === 'branch'
      ? `当前分支 ${state.head.name}`
      : `HEAD 分离于 ${state.head.commitId}`;
  const dirtyLine = state.dirty
    ? '工作区有未提交改动（教学模拟）'
    : '工作区干净';
  return ok(
    state,
    [branch, dirtyLine, `指向提交 ${headCommitId(state) ?? '(无)'}`],
    {
      title: '查看状态',
      summary: 'status 只读取当前分支与工作区摘要，不会改变提交图。',
      related: ['git log --oneline'],
    },
  );
}

function runLog(state: RepoState, oneline: boolean): CommandResult {
  const tip = headCommitId(state);
  if (!tip) {
    return ok(state, ['尚无提交'], {
      title: '查看日志',
      summary: '当前没有可显示的提交。',
    });
  }
  const lines: string[] = [];
  const seen = new Set<CommitId>();
  const stack: CommitId[] = [tip];
  while (stack.length > 0) {
    const id = stack.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const c = state.commits[id]!;
    if (oneline) lines.push(`${c.id} ${c.message}`);
    else {
      lines.push(`commit ${c.id}`);
      if (c.parents.length > 1) {
        lines.push(`Merge: ${c.parents.join(' ')}`);
      }
      lines.push(`    ${c.message}`);
      lines.push('');
    }
    for (const p of c.parents) stack.push(p);
  }
  if (oneline) lines.unshift(`* 分支 ${headLabel(state)} 的历史：`);
  return ok(state, lines, {
    title: '查看日志',
    summary: '按当前 HEAD 的祖先链列出提交；图上节点与此对应。',
    detail: '真正的 git log 还有更丰富的格式化选项。',
    related: ['git status'],
  });
}

function runCommit(state: RepoState, message: string): CommandResult {
  const tip = headCommitId(state);
  const parents: CommitId[] = tip ? [tip] : [];
  const commit = createCommit(state, parents, message);
  const moved = setHeadTip(state, commit.id);
  state.dirty = false;
  const branchName = state.head.kind === 'branch' ? state.head.name : 'HEAD';
  return ok(
    state,
    [`[${branchName} ${commit.id}] ${message}`],
    {
      title: tip ? '在当前分支上新增提交' : '创建了第一个提交',
      summary: tip
        ? `新提交 ${commit.id} 接在 ${tip} 之后，分支 ${moved ?? 'HEAD'} 前进到它。其它分支不会动。`
        : `空仓库里出现首个提交 ${commit.id}，分支 ${moved ?? 'HEAD'} 从「尚无提交」变成指向它。`,
      detail: '本沙箱用「提交」代表你在该分支上的改动；图上圆点变多就说明这条分支往前走了。',
      related: ['git log --oneline', 'git status'],
    },
    { createdCommits: [commit.id], movedRefs: moved ? [moved] : [], newHead: true },
  );
}

function runBranchCreate(state: RepoState, name: string): CommandResult {
  if (state.branches[name]) {
    return fail(state, [`fatal: 分支 '${name}' 已存在`], {
      title: '分支已存在',
      summary: `分支名 ${name} 已被占用，换一个名字。`,
    });
  }
  const tip = headCommitId(state);
  if (!tip) {
    return fail(state, ['fatal: 当前没有提交，无法建分支'], {
      title: '无法建分支',
      summary: '请先至少有一个 commit。',
    });
  }
  state.branches[name] = tip;
  return ok(state, [`已创建分支 ${name} → ${tip}`], {
    title: '已创建分支，但还没站上去',
    summary: `分支 ${name} 只是一个指向 ${tip} 的指针。你仍在当前分支（${
      state.head.kind === 'branch' ? state.head.name : 'HEAD'
    }），所以图上 ${name} 和当前分支会指到同一个提交——这很正常。`,
    detail: '要在 feature 上产生改动：先切换过去，再 commit。本沙箱没有真实文件，「改动」用提交来模拟。',
    related: [`git switch ${name}`, `git commit -m "feat: 在 ${name} 上的第一笔改动"`],
  }, { movedRefs: [name] });
}

function runBranchDelete(
  state: RepoState,
  name: string,
  force: boolean,
): CommandResult {
  if (state.head.kind === 'branch' && state.head.name === name) {
    return fail(state, [`error: 不能删除当前分支 '${name}'`], {
      title: '拒绝删除',
      summary: '请先切换到其他分支再删除。',
      related: ['git switch main'],
    });
  }
  const tip = state.branches[name];
  if (!tip) {
    return fail(state, [`error: 分支 '${name}' 不存在`], {
      title: '分支不存在',
      summary: `没有名为 ${name} 的分支。`,
    });
  }
  const currentTip = headCommitId(state);
  if (!force && currentTip && !isAncestor(state.commits, tip, currentTip)) {
    return fail(
      state,
      [`error: 分支 '${name}' 尚未完全合并到当前分支`, '（使用 -D 强制删除）'],
      {
        title: '拒绝删除未合并分支',
        summary: `${name} 上还有当前分支没有的提交。加 -D 可强制删除。`,
        related: [`git branch -D ${name}`, `git merge ${name}`],
      },
    );
  }
  delete state.branches[name];
  return ok(state, [`已删除分支 ${name}`], {
    title: '删除分支',
    summary: `指针 ${name} 已移除；若提交无人引用，真实 Git 中会等待 GC，图上也不再显示标签。`,
  }, { deletedRefs: [name] });
}

function runSwitch(
  state: RepoState,
  name: string,
  create: boolean,
): CommandResult {
  if (create) {
    if (state.branches[name]) {
      return fail(state, [`fatal: 分支 '${name}' 已存在`], {
        title: '无法创建',
        summary: '分支名已存在，可直接 switch 过去。',
        related: [`git switch ${name}`],
      });
    }
    const tip = headCommitId(state);
    if (!tip) {
      return fail(state, ['fatal: 没有提交，无法创建分支'], {
        title: '无法创建分支',
        summary: '请先 commit。',
      });
    }
    state.branches[name] = tip;
    state.head = { kind: 'branch', name };
    return ok(state, [`已切换到新分支 ${name}`], {
      title: '已站上新分支',
      summary: `在 ${tip} 上创建了 ${name}，HEAD 已指向它。现在你在这个分支上。`,
      detail: '下一步：用 git commit 提交改动，图上只有 feature 会前进，main 停在原处。',
      related: [`git commit -m "feat: 在 ${name} 上的第一笔改动"`, 'git log --oneline'],
    }, { movedRefs: [name], newHead: true });
  }

  if (!state.branches[name]) {
    return fail(state, [`error: 路径规范 '${name}' 既不是本地分支也不是可解析引用`], {
      title: '分支不存在',
      summary: `找不到分支 ${name}。`,
      related: ['git branch feature', `git switch -c ${name}`],
    });
  }
  state.head = { kind: 'branch', name };
  const tip = state.branches[name]!;
  return ok(state, [`已切换到分支 ${name}`], {
    title: '切换分支',
    summary: `HEAD 现在指向 ${name}（tip ${tip}）。之后的 commit 会记在 ${name} 上。`,
    detail: '切换不创建提交，只是把 HEAD 移到该分支指针。',
    related: [`git commit -m "feat: 在 ${name} 上的改动"`, 'git status'],
  }, { newHead: true });
}

function runMerge(state: RepoState, name: string): CommandResult {
  const currentBranch = state.head.kind === 'branch' ? state.head.name : null;
  if (!currentBranch) {
    return fail(state, ['fatal: 游离 HEAD 不支持 merge（教学简化）'], {
      title: '无法合并',
      summary: '请先 switch 回某个分支。',
    });
  }
  if (name === currentBranch) {
    return fail(state, ["fatal: 不能 merge 当前分支到自己"], {
      title: '无法合并',
      summary: '请选择另一个分支作为合并来源。',
    });
  }
  const fromTip = state.branches[name];
  if (!fromTip) {
    return fail(state, [`fatal: '${name}' 不是本地分支`], {
      title: '分支不存在',
      summary: `没有分支 ${name}。`,
    });
  }
  const toTip = state.branches[currentBranch]!;
  if (fromTip === toTip || isAncestor(state.commits, fromTip, toTip)) {
    return ok(state, ['Already up to date.'], {
      title: '已经最新',
      summary: `${name} 的提交都已在当前分支中，无需合并。`,
      related: [`git log --oneline`],
    });
  }
  if (isAncestor(state.commits, toTip, fromTip)) {
    state.branches[currentBranch] = fromTip;
    return ok(
      state,
      [`Fast-forwarding ${currentBranch} to ${fromTip}`],
      {
        title: 'Fast-forward 合并',
        summary: `当前分支没有独有提交，指针直接前移到 ${name} 的 tip ${fromTip}。`,
        detail: '没有产生新的 merge commit。若要强制生成合并节点，可用 git merge --no-ff（本沙箱未实现）。',
        related: [`git log --oneline`, 'git commit -m "..."'],
      },
      { movedRefs: [currentBranch], newHead: true },
    );
  }

  // 分叉：工作区脏时模拟 CONFLICT，干净时自动完成并提示真实 Git 冲突可能
  if (state.dirty) {
    return fail(
      state,
      [
        `CONFLICT (content): 合并冲突`,
        `Automatic merge failed; fix conflicts and then commit the result.`,
        `（教学模拟：当前工作区有未提交改动时拒绝 merge。请先 commit 或 git reset --hard 对齐后再试。）`,
      ],
      {
        title: '合并冲突',
        summary: `双方都有独有提交，且工作区不干净；merge 已停止，分支未移动。`,
        detail: '真实 Git 还会在「同一文件两边都改」时产生 CONFLICT。本沙箱用 dirty 标记模拟「停下来解决」。',
        related: ['git status', 'git reset --hard HEAD', `git merge ${name}`],
      },
    );
  }

  const commit = createCommit(state, [toTip, fromTip], `Merge branch '${name}' into ${currentBranch}`);
  state.branches[currentBranch] = commit.id;
  state.dirty = false;
  return ok(
    state,
    [
      `Merge made by the 'ort' strategy.`,
      `已创建合并提交 ${commit.id}`,
      `提示：真实 Git 在双方修改同一文件时会 CONFLICT 并要求你手动解决；本沙箱无文件内容，分叉且工作区干净时直接生成合并节点。`,
    ],
    {
      title: '创建合并提交',
      summary: `把 ${name}（${fromTip}）合并进 ${currentBranch}，生成双父节点 ${commit.id}。`,
      detail: '图上从合并节点会分出两条父链；这是理解冲突与历史的关键形状。若工作区有未提交改动，本沙箱会以 CONFLICT 拒绝合并。',
      related: ['git log --oneline', `git branch ${name}`],
    },
    { createdCommits: [commit.id], movedRefs: [currentBranch], newHead: true },
  );
}

function runReset(
  state: RepoState,
  mode: 'soft' | 'mixed' | 'hard',
  steps: number,
): CommandResult {
  if (state.head.kind !== 'branch') {
    return fail(state, ['fatal: 游离 HEAD 不支持 reset（教学简化）'], {
      title: '无法 reset',
      summary: '请先回到分支上。',
    });
  }
  const tip = state.branches[state.head.name]!;
  const target = walkBack(state.commits, tip, steps);
  if (!target) {
    return fail(state, [`fatal: 无法回退 ${steps} 步，历史不足`], {
      title: '目标不存在',
      summary: '回退步数超过了可到达的历史。',
    });
  }
  state.branches[state.head.name] = target;
  if (mode === 'hard') {
    state.dirty = false;
  } else if (steps > 0) {
    // 撤销提交后，教学上标记为仍有改动待提交
    state.dirty = true;
  }
  const modeNote =
    mode === 'hard'
      ? '工作区已强制对齐目标提交（教学模拟）。'
      : mode === 'soft'
        ? '保留「已暂存」改动标记，便于继续 commit。'
        : '改动回到工作区未暂存（默认 mixed）。';
  return ok(
    state,
    [`${state.head.name} 已重置到 ${target}（${mode}）`],
    {
      title: `reset --${mode}`,
      summary: `当前分支 tip 从 ${tip} 回退到 ${target}。`,
      detail: modeNote + ' 旧提交可能仍存在于对象库，直到被回收。',
      related: ['git log --oneline', 'git status'],
    },
    { movedRefs: [state.head.name], newHead: true },
  );
}

function runRevert(state: RepoState, target: string): CommandResult {
  const id = resolveCommitId(state, target);
  if (!id) {
    return fail(state, [`error: 未知提交 '${target}'`], {
      title: '无法 revert',
      summary: '请使用短 hash 前缀或 HEAD。',
    });
  }
  const tip = headCommitId(state);
  if (!tip) {
    return fail(state, ['fatal: 仓库为空'], { title: '无法 revert', summary: '没有提交。' });
  }
  // MVP: always create a revert commit on current tip (even if not linear application)
  const original = state.commits[id]!;
  const commit = createCommit(
    state,
    [tip],
    `Revert "${original.message}"`,
  );
  const moved = setHeadTip(state, commit.id);
  state.dirty = false;
  return ok(
    state,
    [`已创建反向提交 ${commit.id}`],
    {
      title: 'revert 提交',
      summary: `新提交 ${commit.id} 用于撤销「${original.message}」的内容，历史仍向前推进。`,
      detail: 'revert 与 reset 不同：不改写历史，而是追加抵消提交。',
      related: ['git log --oneline', 'git reset --soft HEAD~1'],
    },
    { createdCommits: [commit.id], movedRefs: moved ? [moved] : [], newHead: true },
  );
}

function collectReachable(commits: RepoState['commits'], tips: CommitId[]): Set<CommitId> {
  const seen = new Set<CommitId>();
  const stack = [...tips];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id) || !commits[id]) continue;
    seen.add(id);
    for (const p of commits[id]!.parents) stack.push(p);
  }
  return seen;
}

function runRebase(state: RepoState, name: string): CommandResult {
  if (state.head.kind !== 'branch') {
    return fail(state, ['fatal: 游离 HEAD 不支持 rebase（教学简化）'], {
      title: '无法 rebase',
      summary: '请先切换到分支。',
    });
  }
  const current = state.head.name;
  if (name === current) {
    return fail(state, ['fatal: 不能 rebase 到当前分支'], {
      title: '无法 rebase',
      summary: '请选择上游分支。',
    });
  }
  const ontoTip = state.branches[name];
  if (!ontoTip) {
    return fail(state, [`fatal: '${name}' 不是本地分支`], {
      title: '分支不存在',
      summary: `没有分支 ${name}。`,
    });
  }
  const currentTip = state.branches[current]!;
  if (isAncestor(state.commits, currentTip, ontoTip)) {
    // current is ancestor of onto → ff
    state.branches[current] = ontoTip;
    return ok(state, [`${current} fast-forward 到 ${name}`], {
      title: 'rebase 变成 fast-forward',
      summary: '当前分支没有独有提交，直接前移。',
      related: ['git log --oneline'],
    }, { movedRefs: [current], newHead: true });
  }

  const upstreamReach = collectReachable(state.commits, [ontoTip]);
  // commits reachable from current but not from onto, in chronological order
  const unique: Commit[] = [];
  const currentReach = collectReachable(state.commits, [currentTip]);
  const all = Object.values(state.commits)
    .filter((c) => currentReach.has(c.id) && !upstreamReach.has(c.id))
    .sort((a, b) => a.createdAt - b.createdAt);

  // Prefer first-parent chain from currentTip for linear rebase
  const chain: CommitId[] = [];
  let cur: CommitId | null = currentTip;
  const guard = new Set<CommitId>();
  while (cur && !guard.has(cur)) {
    guard.add(cur);
    if (upstreamReach.has(cur)) break;
    chain.push(cur);
    const c: Commit = state.commits[cur]!;
    cur = c.parents[0] ?? null;
  }
  chain.reverse(); // oldest first
  for (const id of chain) {
    const c = state.commits[id]!;
    if (!unique.find((u) => u.id === id)) unique.push(c);
  }
  // fallback if chain empty but all has items
  if (unique.length === 0) {
    unique.push(...all);
  }

  if (unique.length === 0) {
    return ok(state, ['Current branch is up to date.'], {
      title: '已是最新',
      summary: '没有需要重放的提交。',
    });
  }

  let base = ontoTip;
  const created: CommitId[] = [];
  for (const c of unique) {
    const nc = createCommit(state, [base], c.message);
    created.push(nc.id);
    base = nc.id;
  }
  state.branches[current] = base;
  return ok(
    state,
    [
      `Successfully rebased and updated refs/heads/${current}.`,
      `重放了 ${created.length} 个提交到 ${name} 之上。`,
    ],
    {
      title: 'rebase 重放提交',
      summary: `把 ${current} 独有的 ${created.length} 个提交复制到 ${name} tip 之上，并更新分支指针。`,
      detail: '旧提交对象可能仍在，但分支已指向新链；共享历史保持不变。',
      related: ['git log --oneline', `git merge ${name}`],
    },
    { createdCommits: created, movedRefs: [current], newHead: true },
  );
}

/** 执行一条用户输入的命令 */
export function applyCommand(state: RepoState, input: string): CommandResult {
  const parsed = parseCommand(input);
  if (parsed.type === 'unknown') {
    return fail(cloneState(state), [`error: ${parsed.hint}`], explainUnknown(parsed.hint));
  }
  // help/status/log 也不应原地改；其余命令在 clone 上变更
  const next = cloneState(state);

  switch (parsed.type) {
    case 'help':
      return runHelp(next);
    case 'status':
      return runStatus(next);
    case 'log':
      return runLog(next, parsed.oneline);
    case 'commit':
      return runCommit(next, parsed.message);
    case 'branch_create':
      return runBranchCreate(next, parsed.name);
    case 'branch_delete':
      return runBranchDelete(next, parsed.name, parsed.force);
    case 'switch':
      return runSwitch(next, parsed.name, parsed.create);
    case 'merge':
      return runMerge(next, parsed.name);
    case 'reset':
      return runReset(next, parsed.mode, parsed.steps);
    case 'revert':
      return runRevert(next, parsed.target);
    case 'rebase':
      return runRebase(next, parsed.target);
    default:
      return fail(next, ['error: 未实现'], explainUnknown('未实现'));
  }
}
