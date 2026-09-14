import type { LevelCheckResult, LevelLogEntry, LevelObjectiveState } from './types';
import type { WorldState } from '../engine/types';
import { isAncestor } from '../engine/hash';
import { activeRepo } from '../engine/world';

function result(
  labels: string[],
  dones: boolean[],
  feedback: string,
): LevelCheckResult {
  const objectives: LevelObjectiveState[] = labels.map((label, i) => ({
    id: String(i + 1),
    label,
    done: dones[i] ?? false,
  }));
  const win = objectives.every((o) => o.done);
  return { win, objectives, feedback: win ? '目标已全部达成。' : feedback };
}

function ranOk(log: LevelLogEntry[], match: (input: string) => boolean): boolean {
  return log.some((e) => e.ok && match(e.input.toLowerCase()));
}

/** L0：每张概念卡对应一条必做命令（演示图已有 feature；分支卡新建 hotfix） */
export function checkLevel0(
  after: WorldState,
  log: LevelLogEntry[],
): LevelCheckResult {
  const repo = activeRepo(after);
  const labels = [
    '把 HEAD 指向 feature',
    '提交说明为「这是我的提交」的 commit',
    '创建分支 hotfix',
  ];
  const ranOkMatch = (match: (input: string) => boolean) =>
    log.some((e) => e.ok && match(e.input.trim().toLowerCase()));

  const onFeature = repo.head.kind === 'branch' && repo.head.name === 'feature';
  const ranSwitchFeature = ranOkMatch((t) => {
    return (
      t === 'git switch feature' ||
      t === 'switch feature' ||
      t === 'git checkout feature' ||
      t === 'checkout feature'
    );
  });

  const ranCommitMsg = ranOkMatch(
    (t) => t.includes('commit') && t.includes('这是我的提交'),
  );
  const hasCommitMsg = Object.values(repo.commits).some(
    (c) => c.message.includes('这是我的提交'),
  );

  const hotfixExists = Boolean(
    repo.branches.hotfix && repo.commits[repo.branches.hotfix],
  );
  const featureKept = Boolean(
    repo.branches.feature && repo.commits[repo.branches.feature],
  );

  const dones = [
    onFeature && ranSwitchFeature,
    ranCommitMsg && hasCommitMsg,
    hotfixExists,
  ];

  let feedback = '依次完成三张卡上的实操：先自己写命令，想不起来再点「显示命令」。';
  if (!featureKept) {
    feedback = '请保留图上的演示分支 feature；HEAD 目标就是切到它。可重置本关重来。';
  } else if (!onFeature) {
    feedback = '执行 git switch feature，把 HEAD 从 main 挪到 feature。';
  } else if (!ranSwitchFeature) {
    feedback = '请执行 git switch feature 确认切换到演示分支。';
  } else if (!hotfixExists) {
    feedback = '再创建新分支 hotfix：git branch hotfix。';
  } else if (!ranCommitMsg || !hasCommitMsg) {
    feedback = '最后提交一条：git commit -m "这是我的提交"。';
  }
  return result(labels, dones, feedback);
}

/** L1：空仓库里完成第一次提交 */
export function checkLevel1(_before: WorldState, after: WorldState): LevelCheckResult {
  const repo = activeRepo(after);
  const labels = ['在 main 上产生至少 1 个提交', 'HEAD 仍指向 main'];
  const tip = repo.branches.main;
  const hasCommit = Boolean(tip && repo.commits[tip]);
  const onMain = repo.head.kind === 'branch' && repo.head.name === 'main';
  return result(
    labels,
    [hasCommit, onMain],
    hasCommit
      ? '还需要站在 main 上（git switch main）。'
      : '还没有提交。试试 git commit -m "init: 第一次提交"。',
  );
}

/** L2：用 status / log 查看仓库（行为关） */
export function checkLevel2(
  _before: WorldState,
  after: WorldState,
  log: LevelLogEntry[],
): LevelCheckResult {
  const labels = ['执行过 git status', '执行过 git log --oneline', '仓库仍有 main 提交'];
  const usedStatus = ranOk(log, (i) => /(^|\s)status(\s|$)/.test(i) || i.endsWith('status'));
  const usedLog = ranOk(log, (i) => /(^|\s)log(\s|$)/.test(i));
  const repo = activeRepo(after);
  const hasMain = Boolean(repo.branches.main && repo.commits[repo.branches.main]);
  const dones = [usedStatus, usedLog, hasMain];
  let feedback = '按提示依次执行 git status 和 git log --oneline。';
  if (usedStatus && !usedLog) feedback = '还差 git log --oneline，看看提交历史长什么样。';
  if (!usedStatus && usedLog) feedback = '还差 git status，确认当前分支与工作区状态。';
  if (usedStatus && usedLog && !hasMain) feedback = 'main 上应仍有演示提交，可点「重置本关」。';
  return result(labels, dones, feedback);
}

/** L3：建分支但不切换 */
export function checkLevel3(_before: WorldState, after: WorldState): LevelCheckResult {
  const repo = activeRepo(after);
  const labels = [
    '创建分支 feature',
    'HEAD 仍在 main 上（没有 switch 过去）',
    'feature 与 main 指向同一提交',
  ];
  const featureTip = repo.branches.feature;
  const mainTip = repo.branches.main;
  const created = Boolean(featureTip && repo.commits[featureTip]);
  const stillOnMain = repo.head.kind === 'branch' && repo.head.name === 'main';
  const sameTip = created && Boolean(mainTip) && featureTip === mainTip;
  const dones = [created, stillOnMain, sameTip];
  let feedback = '先 git branch feature，不要 switch。';
  if (created && !stillOnMain) {
    feedback = '已经建了分支，但 HEAD 不在 main。可 git switch main 再确认两者最新提交相同。';
  } else if (created && stillOnMain && !sameTip) {
    feedback = 'feature 存在但与 main 最新提交不同。可重置本关后只执行 git branch feature。';
  }
  return result(labels, dones, feedback);
}

/** L4：站上 feature 并在其上提交，main 不动 */
export function checkLevel4(before: WorldState, after: WorldState): LevelCheckResult {
  const b = activeRepo(before);
  const a = activeRepo(after);
  const labels = [
    'HEAD 在 feature 上',
    'feature 上至少有 1 个 main 没有的提交',
    'main 最新提交未变',
  ];
  const onFeature = a.head.kind === 'branch' && a.head.name === 'feature';
  const featureTip = a.branches.feature;
  const mainTip = a.branches.main;
  const mainBefore = b.branches.main;
  const featureAhead =
    Boolean(featureTip && mainTip) &&
    featureTip !== mainTip &&
    !isAncestor(a.commits, featureTip!, mainTip!);
  const mainUnmoved = Boolean(mainBefore) && a.branches.main === mainBefore;
  const dones = [onFeature, featureAhead, mainUnmoved];
  let feedback = '先 git switch -c feature（或 switch feature），再 commit 一笔。';
  if (!onFeature) feedback = 'HEAD 还不在 feature 上，先 git switch feature。';
  else if (!featureAhead) {
    feedback = '在 feature 上执行 git commit -m "feat: ..."，让它比 main 多一个点。';
  } else if (!mainUnmoved) feedback = 'main 的最新提交不应变化。可重置本关重做。';
  return result(labels, dones, feedback);
}

/** L5：main 落后 feature，merge 后 fast-forward */
export function checkLevel5(before: WorldState, after: WorldState): LevelCheckResult {
  const b = activeRepo(before);
  const a = activeRepo(after);
  const labels = [
    '在 main 上完成合并',
    'main 已快进到 feature 的最新提交（FF）',
    '没有产生双父 merge 提交',
  ];
  const featureTip = b.branches.feature;
  const mainBefore = b.branches.main;
  const mainAfter = a.branches.main;
  const onMain = a.head.kind === 'branch' && a.head.name === 'main';
  const ff =
    Boolean(featureTip && mainAfter && mainBefore) &&
    mainAfter === featureTip &&
    mainAfter !== mainBefore;
  const tip = mainAfter ? a.commits[mainAfter] : undefined;
  const noMergeCommit = Boolean(tip) && tip!.parents.length <= 1;
  const dones = [onMain && ff, ff && onMain, ff && noMergeCommit];
  let feedback = '切到 main 后执行 git merge feature，应出现 Fast-forward。';
  if (!onMain) feedback = '先 git switch main，再 merge feature。';
  else if (!ff) feedback = '在 main 上执行 git merge feature。';
  return result(labels, dones, feedback);
}

/** L6：双方都有提交，merge 生成双父节点 */
export function checkLevel6(_before: WorldState, after: WorldState): LevelCheckResult {
  const a = activeRepo(after);
  const labels = [
    'HEAD 在 main 上',
    'main 最新提交是双父 merge 提交',
    '该提交能追溯到 feature',
  ];
  const onMain = a.head.kind === 'branch' && a.head.name === 'main';
  const tipId = a.branches.main;
  const tip = tipId ? a.commits[tipId] : undefined;
  const isMerge = Boolean(tip) && tip!.parents.length === 2;
  const featureTip = a.branches.feature;
  const containsFeature =
    isMerge && Boolean(featureTip) && isAncestor(a.commits, featureTip!, tipId!);
  const dones = [onMain, isMerge, containsFeature];
  let feedback = '双方各自 commit 后，在 main 上 git merge feature。';
  if (!onMain) feedback = '先 git switch main。';
  else if (!isMerge) feedback = '在 main 上执行 git merge feature，应生成双父节点。';
  else if (!containsFeature) feedback = 'merge 结果应能追溯到 feature 的最新提交。可重置本关重做。';
  return result(labels, dones, feedback);
}

/** L7：用 reset 把 main 往回拨一步 */
export function checkLevel7(before: WorldState, after: WorldState): LevelCheckResult {
  const b = activeRepo(before);
  const a = activeRepo(after);
  const labels = [
    'main 最新提交已回退到上一个提交',
    'HEAD 仍在 main 上',
    '回退目标正确（HEAD~1 的父提交）',
  ];
  const mainBefore = b.branches.main;
  const parent = mainBefore ? b.commits[mainBefore]?.parents[0] : undefined;
  const mainAfter = a.branches.main;
  const onMain = a.head.kind === 'branch' && a.head.name === 'main';
  const rolledBack = Boolean(parent) && mainAfter === parent;
  const dones = [rolledBack, onMain, rolledBack && onMain];
  let feedback = '在 main 上执行 git reset --hard HEAD~1（也可用 --soft）。';
  if (!rolledBack) feedback = 'main 还停在最新提交。执行 git reset --hard HEAD~1。';
  else if (!onMain) feedback = 'HEAD 应仍在 main 上。';
  return result(labels, dones, feedback);
}

/** L8：Alice 提交并 push，Bob pull 后本地包含该 tip */
export function checkLevel8(before: WorldState, after: WorldState): LevelCheckResult {
  const labels = [
    '远程 origin/main 已更新',
    'Bob 本地已有该提交',
    'Bob 的 main 与远程一致',
  ];
  const remoteTip = after.remoteBranches.main;
  const beforeRemote = before.remoteBranches.main;
  const remoteMoved = Boolean(remoteTip) && remoteTip !== beforeRemote;
  const bob = after.users.bob;
  const bobHas = Boolean(remoteTip && bob.commits[remoteTip]);
  const bobMain = bob.branches.main;
  const bobSynced = Boolean(remoteTip) && bobMain === remoteTip;
  const dones = [remoteMoved, bobHas, bobSynced];
  let feedback = 'Alice：commit → push origin main；顶栏切到 Bob → git pull。';
  if (!remoteMoved) feedback = '先以 Alice 提交并 git push origin main。';
  else if (!bobHas || !bobSynced) feedback = '顶栏切到 Bob，执行 git pull。';
  return result(labels, dones, feedback);
}
