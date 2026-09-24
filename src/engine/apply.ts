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
    staged: state.staged,
    stash: state.stash.map((s) => ({ ...s })),
    initialized: state.initialized,
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
  '  git init / git clone [url]',
  '  git status',
  '  git add [.|--all]',
  '  git commit -m "<msg>"',
  '  git diff [--staged]',
  '  git restore [--staged]',
  '  git stash [pop|list]',
  '  git branch <name>',
  '  git branch -d|-D <name>',
  '  git switch <name>          （等价 checkout <name>）',
  '  git switch -c <name>       （等价 checkout -b <name>）',
  '  git checkout <name>',
  '  git checkout -b <name>',
  '  git merge <name>',
  '  git reset --soft|--mixed|--hard HEAD~n',
  '  git revert <hash>|HEAD',
  '  git cherry-pick <hash>|HEAD',
  '  git rebase <branch> | origin/<branch>',
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
  const lines = [branch];
  if (state.staged) lines.push('暂存区：有已暂存改动（git add 过，尚未 commit）');
  else lines.push('暂存区：空');
  if (state.dirty) lines.push('工作区：有未提交改动（教学模拟）');
  else lines.push('工作区：干净');
  lines.push(`指向提交 ${headCommitId(state) ?? '(无)'}`);
  return ok(state, lines, {
    title: '查看状态',
    summary: 'status 分区显示暂存区与工作区，并标明当前分支；只读，不改提交图。',
    related: ['git add .', 'git diff', 'git log --oneline'],
  });
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
  state.initialized = true;
  const tip = headCommitId(state);
  const parents: CommitId[] = tip ? [tip] : [];
  const commit = createCommit(state, parents, message);
  const moved = setHeadTip(state, commit.id);
  state.dirty = false;
  state.staged = false;
  const branchName = state.head.kind === 'branch' ? state.head.name : 'HEAD';
  return ok(
    state,
    [`[${branchName} ${commit.id}] ${message}`],
    {
      title: tip ? '在当前分支上新增提交' : '创建了第一个提交',
      summary: tip
        ? `新提交 ${commit.id} 接在 ${tip} 之后，分支 ${moved ?? 'HEAD'} 前进到它。其它分支不会动。`
        : `空仓库里出现首个提交 ${commit.id}，分支 ${moved ?? 'HEAD'} 从「尚无提交」变成指向它。`,
      detail:
        '本沙箱用「提交」代表你在该分支上的改动。完整 Git 通常先 git add 进暂存区再 commit；本关若未 add 也可直接 commit（教学简化）。',
      related: ['git add .', 'git log --oneline', 'git status'],
    },
    { createdCommits: [commit.id], movedRefs: moved ? [moved] : [], newHead: true },
  );
}

function runInit(state: RepoState): CommandResult {
  if (state.initialized) {
    return ok(state, ['已存在 Git 仓库（沙箱已初始化）。', '图底部灰色 git init 锚点表示仓库起点。'], {
      title: 'git init',
      summary: '仓库已 init；图上应出现灰色锚点。',
      detail: '再次 init 不会新建另一个仓库。',
      related: ['git status', 'git commit -m "init: ..."'],
    });
  }
  state.initialized = true;
  state.head = { kind: 'branch', name: 'main' };
  return ok(
    state,
    ['Initialized empty Git repository（沙箱模拟）', '当前尚无提交，可 git commit 创建第一个存档。'],
    {
      title: 'git init',
      summary: '已在本地新建空仓库。图底部出现灰色 git init 锚点。',
      detail: 'init 之后还没有任何提交；commit 才会留下圆点。',
      related: ['git status', 'git clone', 'git commit -m "init: ..."'],
    },
  );
}

function runClone(_state: RepoState, url?: string): CommandResult {
  // clone 依赖共享远程；在 world 层执行。本地单独 apply 不伪造历史。
  return fail(
    _state,
    [`fatal: repository '${url ?? 'origin'}' not found（请在沙箱世界中 clone，且远程需有内容）`],
    {
      title: '无法 clone',
      summary: 'clone 必须从有历史的远程复制；远程为空会失败。',
      detail: '教学沙箱中 origin 若已含演示历史，执行 git clone 即可拉入。',
      related: ['git remote -v', 'git init'],
    },
  );
}

function runAdd(state: RepoState): CommandResult {
  if (!state.dirty && state.staged) {
    return ok(state, ['已全部在暂存区'], {
      title: 'git add',
      summary: '没有新的工作区改动需要暂存。',
    });
  }
  if (!state.dirty && !state.staged) {
    return ok(state, ['nothing to stage（工作区无改动）'], {
      title: 'git add',
      summary: '把工作区改动放进暂存区（index）。当前没有可暂存的改动。',
      detail: '沙箱用两态模拟：工作区 / 暂存区，不列出具体文件。',
      related: ['git status', 'git diff'],
    });
  }
  state.staged = true;
  state.dirty = false;
  return ok(state, ['已暂存当前改动（教学模拟：全部 add）'], {
    title: 'git add',
    summary: '改动已从工作区「放进」暂存区，等待 commit。',
    detail: '真实 Git 可选择部分文件；沙箱用 git add . 表示全部暂存。',
    related: ['git status', 'git diff --staged', 'git commit -m "..."'],
  });
}

function runDiff(state: RepoState, staged: boolean): CommandResult {
  if (staged) {
    if (!state.staged) {
      return ok(state, ['（暂存区无改动）'], {
        title: 'git diff --staged',
        summary: '查看已暂存、尚未提交的差异。',
      });
    }
    return ok(state, ['（暂存区有未提交改动）'], {
      title: 'git diff --staged',
      summary: '暂存区有内容，commit 后才会进入历史。',
      detail: '沙箱只显示「有/无」两态，不列出文件级 diff。',
      related: ['git commit -m "..."', 'git restore --staged'],
    });
  }
  if (!state.dirty) {
    return ok(state, ['（工作区无改动）'], {
      title: 'git diff',
      summary: '查看工作区相对暂存区/上次提交的未暂存改动。',
    });
  }
  return ok(state, ['（工作区有未提交改动）'], {
    title: 'git diff',
    summary: '工作区有尚未 add 的改动。',
    detail: '沙箱只显示「有/无」两态，不列出文件级 diff。',
    related: ['git add .', 'git restore .', 'git status'],
  });
}

function runRestore(state: RepoState, staged: boolean): CommandResult {
  if (staged) {
    if (!state.staged) return ok(state, ['（暂存区已空）'], {
      title: 'git restore --staged',
      summary: '把改动从暂存区撤回工作区，不丢内容。',
    });
    state.staged = false;
    state.dirty = true;
    return ok(state, ['已从暂存区撤回工作区'], {
      title: 'git restore --staged',
      summary: '暂存区变空，改动仍在工作区。',
      related: ['git status', 'git add .'],
    });
  }
  if (!state.dirty) {
    return ok(state, ['（工作区已干净）'], {
      title: 'git restore',
      summary: '丢弃工作区未暂存改动。',
    });
  }
  state.dirty = false;
  return ok(state, ['已丢弃工作区改动（不可恢复）'], {
    title: 'git restore',
    summary: '丢弃工作区未 add 的改动。',
    detail: '危险操作：未提交且未 stash 的改动会丢失。',
    related: ['git status', 'git stash'],
  });
}

function runStash(state: RepoState, action: 'push' | 'pop' | 'list'): CommandResult {
  if (action === 'list') {
    return ok(
      state,
      state.stash.length ? state.stash.map((_, i) => `stash@{${i}}: WIP on branch`) : ['（stash 为空）'],
      {
        title: 'git stash list',
        summary: '列出暂存起来的现场。',
      },
    );
  }
  if (action === 'push') {
    if (!state.dirty && !state.staged) {
      return ok(state, ['You do not have the initial commit yet'], {
        title: 'git stash',
        summary: '没有可保存的改动。',
      });
    }
    state.stash.push({ dirty: state.dirty, staged: state.staged });
    state.dirty = false;
    state.staged = false;
    return ok(state, ['Saved working directory and index state（教学模拟）'], {
      title: 'git stash',
      summary: '把工作区/暂存区改动收进栈，工作区变干净。',
      detail: '之后可用 git stash pop 恢复现场。',
      related: ['git stash list', 'git stash pop', 'git status'],
    });
  }
  const top = state.stash.pop();
  if (!top) {
    return ok(state, ['No stash entries found'], {
      title: 'git stash pop',
      summary: '没有可恢复的 stash。',
    });
  }
  state.dirty = state.dirty || top.dirty;
  state.staged = state.staged || top.staged;
  return ok(state, ['Dropped refs/stash@{0}（已恢复现场）'], {
    title: 'git stash pop',
    summary: '从栈顶恢复改动到工作区/暂存区。',
    related: ['git status', 'git diff'],
  });
}

function runCherryPick(state: RepoState, target: string): CommandResult {
  const id = resolveCommitId(state, target);
  if (!id) {
    return fail(state, [`error: unknown revision '${target}'`], {
      title: '无法 cherry-pick',
      summary: '请使用短 hash 前缀、分支名或 HEAD（与真实 Git 一致）。',
    });
  }
  const tip = headCommitId(state);
  if (!tip) {
    return fail(state, ['fatal: 仓库为空'], {
      title: '无法 cherry-pick',
      summary: '没有提交。',
    });
  }
  if (id === tip) {
    return fail(
      state,
      [
        `error: 摘取目标 (${id}) 就是当前分支最新提交，cherry-pick 为空`,
        'hint: 请摘取其它分支上的提交，例如：git cherry-pick feature',
      ],
      {
        title: '无法 cherry-pick',
        summary: '目标与当前最新提交相同，没有可复制的改动。',
        detail: '在 main 上应摘取 feature 等其它分支的提交，例如 git cherry-pick feature。',
        related: ['git log --oneline', 'git cherry-pick feature'],
      },
    );
  }
  const original = state.commits[id]!;
  const commit = createCommit(state, [tip], original.message);
  const moved = setHeadTip(state, commit.id);
  state.dirty = false;
  state.staged = false;
  return ok(
    state,
    [`[detached? ${commit.id}] ${original.message}`, '（教学模拟：已在当前最新提交之上复制该提交）'],
    {
      title: 'cherry-pick 提交',
      summary: `把「${original.message}」复制到当前分支最新提交之上，源分支指针不变。`,
      detail: '真实 Git 会重算 hash，并可能冲突；沙箱始终成功。',
      related: ['git log --oneline', 'git rebase main'],
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
    title: '已创建分支，HEAD 未指向它',
    summary: `分支 ${name} 只是一个指向 ${tip} 的指针。HEAD 仍指向当前分支（${
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
      title: 'HEAD 已指向新分支',
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
    summary: `HEAD 现在指向 ${name}（最新提交 ${tip}）。之后的 commit 会记在 ${name} 上。`,
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
        summary: `当前分支没有独有提交，指针直接前移到 ${name} 的最新提交 ${fromTip}。`,
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
    state.staged = false;
  } else if (mode === 'mixed') {
    state.staged = false;
    if (steps > 0) state.dirty = true;
  } else if (steps > 0) {
    // soft：改动标记保留；若原先已暂存则仍算 staged
    if (!state.staged) state.dirty = true;
  }
  const softHard =
    mode === 'hard'
      ? 'hard：分支指针已拨回，暂存区与工作区标记都清空。'
      : mode === 'soft'
        ? 'soft：只把分支指针拨回；暂存区/未提交改动仍保留（status 会显示仍有改动），可继续 commit。'
        : 'mixed（默认）：分支指针已拨回；暂存区清空，改动回到工作区（介于 soft 与 hard 之间）。';
  return ok(
    state,
    [
      `${state.head.name} 已重置到 ${target}（${mode}）`,
      softHard,
      '提示：可执行 git status，对照 soft / hard 后「工作区」文案的差别。',
    ],
    {
      title: `reset --${mode}`,
      summary: `当前分支最新提交从 ${tip} 回退到 ${target}。三种模式都会移动分支指针。`,
      detail:
        softHard +
        ' 记法：soft = 只动历史指针；mixed = 指针 + 改动回工作区；hard = 指针 + 工作区一起对齐。旧提交对象可能仍在，直到无人引用被回收。',
      related: ['git status', 'git log --oneline', 'git revert HEAD'],
    },
    { movedRefs: [state.head.name], newHead: true },
  );
}

function runRevert(state: RepoState, target: string): CommandResult {
  const id = resolveCommitId(state, target);
  if (!id) {
    return fail(state, [`error: 未知提交 '${target}'`], {
      title: '无法 revert',
      summary: '请使用短 hash 前缀、分支名或 HEAD（与真实 Git 一致）。',
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
      summary: `把 ${current} 独有的 ${created.length} 个提交复制到 ${name} 最新提交之上，并更新分支指针。`,
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
    case 'init':
      return runInit(next);
    case 'clone':
      return runClone(next, parsed.url);
    case 'add':
      return runAdd(next);
    case 'diff':
      return runDiff(next, parsed.staged);
    case 'restore':
      return runRestore(next, parsed.staged);
    case 'stash':
      return runStash(next, parsed.action);
    case 'cherry_pick':
      return runCherryPick(next, parsed.target);
    default:
      return fail(next, ['error: 未实现'], explainUnknown('未实现'));
  }
}
