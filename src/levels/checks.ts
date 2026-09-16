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
  const labels = ['在 main 上产生至少 1 个提交'];
  const tip = repo.branches.main;
  const hasCommit = Boolean(tip && repo.commits[tip]);
  const onMain = repo.head.kind === 'branch' && repo.head.name === 'main';
  return result(
    labels,
    [hasCommit && onMain],
    hasCommit && !onMain
      ? '提交已在，但 HEAD 不在 main。可重置本关后在 main 上再试。'
      : '还没有提交。先自己想命令；想不起来再点卡内「显示命令」。',
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

function ranOkMatch(log: LevelLogEntry[], match: (input: string) => boolean): boolean {
  return log.some((e) => e.ok && match(e.input.trim().toLowerCase()));
}

function ranStatus(log: LevelLogEntry[]): boolean {
  return ranOkMatch(log, (t) => t === 'status' || t === 'git status' || t.endsWith(' status') || /\sstatus$/.test(t));
}

function ranLog(log: LevelLogEntry[]): boolean {
  return ranOkMatch(log, (t) => /(^|\s)log(\s|$)/.test(t));
}

function ranCreateFeature(log: LevelLogEntry[]): boolean {
  return ranOkMatch(log, (t) => {
    if (t.includes('-d') || t.includes('-D')) return false;
    return (
      t === 'git branch feature' ||
      t === 'branch feature' ||
      t === 'git switch -c feature' ||
      t === 'switch -c feature' ||
      t === 'git checkout -b feature' ||
      t === 'checkout -b feature'
    );
  });
}

function ranSwitchToFeature(log: LevelLogEntry[]): boolean {
  return ranOkMatch(log, (t) => {
    return (
      t === 'git switch feature' ||
      t === 'switch feature' ||
      t === 'git checkout feature' ||
      t === 'checkout feature' ||
      t === 'git switch -c feature' ||
      t === 'switch -c feature' ||
      t === 'git checkout -b feature' ||
      t === 'checkout -b feature'
    );
  });
}

/** L3：建分支但不切换——三张卡各自要执行对应命令 */
export function checkLevel3(
  _before: WorldState,
  after: WorldState,
  log: LevelLogEntry[],
): LevelCheckResult {
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

  const didCreate = created && ranCreateFeature(log);
  const didCheckStatus = stillOnMain && ranStatus(log);
  const didObserve = sameTip && ranLog(log);

  const dones = [didCreate, didCheckStatus, didObserve];
  let feedback = '按卡片顺序实操：先创建 feature，再用 status 确认，再用 log 观察。';
  if (!didCreate) {
    feedback = '先创建分支 feature（不要切换）。可点「显示命令」查看。';
  } else if (!stillOnMain) {
    feedback = 'HEAD 不在 main。请切回 main 后，只保留「建分支、不切换」这一关要求。';
  } else if (!didCheckStatus) {
    feedback = 'feature 已创建。执行 status，确认 HEAD 仍指向 main。';
  } else if (!sameTip) {
    feedback = 'feature 与 main 最新提交不同。可重置本关后只执行创建分支。';
  } else if (!didObserve) {
    feedback = '执行 log --oneline，观察两分支尚未分叉。';
  }
  return result(labels, dones, feedback);
}

/** L4：HEAD 指向 feature 并在其上提交，main 不动 */
export function checkLevel4(
  before: WorldState,
  after: WorldState,
  log: LevelLogEntry[],
): LevelCheckResult {
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

  const didSwitch = onFeature && ranSwitchToFeature(log);
  const didCommit = featureAhead && ranOkMatch(log, (t) => t.includes('commit'));
  const didObserve = didCommit && mainUnmoved && ranLog(log);

  const dones = [didSwitch, didCommit, didObserve];
  let feedback = '按卡片顺序：先把 HEAD 指向 feature，再提交，最后用 log 观察。';
  if (!didSwitch) {
    feedback = '先让 HEAD 指向 feature（可新建并切换）。';
  } else if (!didCommit) {
    feedback = '在 feature 上提交一笔，让它比 main 多一个点。';
  } else if (!mainUnmoved) {
    feedback = 'main 的最新提交不应变化。可重置本关重做。';
  } else if (!didObserve) {
    feedback = '执行 log --oneline，观察分叉：只有 feature 前进了。';
  }
  return result(labels, dones, feedback);
}

/** L5：main 落后 feature，merge 后 fast-forward */
export function checkLevel5(
  before: WorldState,
  after: WorldState,
  log: LevelLogEntry[],
): LevelCheckResult {
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
  const ranMerge = ranOkMatch(log, (t) => /(^|\s)merge(\s|$)/.test(t));
  // 卡片1：切到 main（或本就在 main 时用 status 确认）
  const card1 =
    onMain &&
    (ranOkMatch(log, (t) => t.includes('switch main') || t.includes('checkout main')) ||
      ranStatus(log));
  const card2 = ff && ranMerge;
  const card3 = card2 && noMergeCommit && ranLog(log);
  const dones = [card1, card2, card3];
  let feedback = '按卡片顺序：切到 main → merge → 用 log 观察无新圆点。';
  if (!onMain) feedback = '先让 HEAD 指向 main。';
  else if (!card1) feedback = '执行 status 确认在 main 上，或先切换到 main。';
  else if (!ff) feedback = '在 main 上执行 merge，应出现 Fast-forward。';
  else if (!ranMerge) feedback = '请执行 merge 命令。';
  else if (!ranLog(log)) feedback = '执行 log --oneline，确认没有新的 merge 圆点。';
  return result(labels, dones, feedback);
}

/** L6：双方都有提交，merge 生成双父节点 */
export function checkLevel6(
  _before: WorldState,
  after: WorldState,
  log: LevelLogEntry[],
): LevelCheckResult {
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

  const ranMerge = ranOkMatch(log, (t) => /(^|\s)merge(\s|$)/.test(t));
  const ranMainCheck = onMain && (ranStatus(log) || ranOkMatch(log, (t) => t.includes('switch main') || t.includes('checkout main')));

  const dones = [
    ranMainCheck,
    isMerge && ranMerge,
    containsFeature && isMerge && ranLog(log),
  ];
  let feedback = '按卡片顺序：确认在 main 上，再 merge，最后用 log 观察双父节点。';
  if (!onMain) feedback = '先让 HEAD 指向 main。';
  else if (!ranMainCheck) feedback = '执行 status 确认 HEAD 在 main 上。';
  else if (!isMerge) feedback = '在 main 上执行 merge，应生成双父节点。';
  else if (!ranMerge) feedback = '请执行 merge 命令完成合并。';
  else if (!containsFeature) feedback = 'merge 结果应能追溯到 feature 的最新提交。可重置本关重做。';
  else if (!ranLog(log)) feedback = '执行 log --oneline，确认能追溯到 feature。';
  return result(labels, dones, feedback);
}

/** L7：用 reset 把 main 往回拨一步 */
export function checkLevel7(
  before: WorldState,
  after: WorldState,
  log: LevelLogEntry[],
): LevelCheckResult {
  const b = activeRepo(before);
  const a = activeRepo(after);
  const labels = [
    '已查看当前提交历史',
    'main 最新提交已回退到上一个提交',
    'HEAD 仍在 main 上',
  ];
  const mainBefore = b.branches.main;
  const parent = mainBefore ? b.commits[mainBefore]?.parents[0] : undefined;
  const mainAfter = a.branches.main;
  const onMain = a.head.kind === 'branch' && a.head.name === 'main';
  const rolledBack = Boolean(parent) && mainAfter === parent;
  const ranResetHead = ranOkMatch(
    log,
    (t) => t.includes('reset') && t.includes('head'),
  );
  const didSeeLog = ranLog(log);
  const didConfirm = onMain && ranStatus(log);

  const dones = [didSeeLog, rolledBack && ranResetHead, didConfirm];
  let feedback = '按卡片顺序：先 log 看清历史，再 reset 回退，最后 status 确认。';
  if (!didSeeLog) {
    feedback = '先执行 log --oneline，看清当前最新提交。';
  } else if (!ranResetHead) {
    feedback = '在 main 上执行 reset（含 HEAD~1），把最新提交拨回上一个。';
  } else if (!rolledBack) {
    feedback = 'main 还没有拨回父提交。可重置本关后，对当前分支执行 reset HEAD~1。';
  } else if (!onMain) {
    feedback = 'HEAD 应仍在 main 上。';
  } else if (!didConfirm) {
    feedback = '执行 status，确认 HEAD 仍在 main。';
  }
  return result(labels, dones, feedback);
}

/** L8：Alice 提交 → push → Bob pull；三卡与命令一一对应 */
export function checkLevel8(
  before: WorldState,
  after: WorldState,
  log: LevelLogEntry[],
): LevelCheckResult {
  const labels = [
    'Alice 已创建一笔提交',
    '远程 origin/main 已更新（已 push）',
    'Bob 已 pull 并与远程一致',
  ];
  const remoteTip = after.remoteBranches.main;
  const beforeRemote = before.remoteBranches.main;
  const remoteMoved = Boolean(remoteTip) && remoteTip !== beforeRemote;
  const bob = after.users.bob;
  const bobMain = bob.branches.main;
  const bobSynced = Boolean(remoteTip) && bobMain === remoteTip;

  const aliceBefore = before.users.alice;
  const aliceAfter = after.users.alice;
  const aliceCommitted =
    aliceAfter.commitSeq > aliceBefore.commitSeq &&
    Object.keys(aliceAfter.commits).length > Object.keys(aliceBefore.commits).length;

  const ranCommit = ranOkMatch(log, (t) => t.includes('commit'));
  const ranPush = ranOkMatch(log, (t) => t.includes('push'));
  const ranPull = ranOkMatch(log, (t) => t.includes('pull'));

  const dones = [
    aliceCommitted && ranCommit,
    remoteMoved && ranPush,
    bobSynced && ranPull,
  ];
  let feedback = '按卡片顺序：Alice commit → Alice push → 切到 Bob 后 pull。';
  if (!ranCommit) feedback = '先以 Alice 提交一笔（顶栏确认是 Alice）。';
  else if (!aliceCommitted) feedback = '提交尚未记在 Alice 仓库，可重置本关重试。';
  else if (!ranPush) feedback = '执行 push，把 Alice 的 main 发布到 origin。';
  else if (!remoteMoved) feedback = '远程 main 还没更新。请在 Alice 下执行 git push origin main。';
  else if (!ranPull) feedback = '顶栏切到 Bob，执行 git pull。';
  else if (!bobSynced) feedback = 'Bob 的 main 还未与远程一致。再执行一次 git pull。';
  return result(labels, dones, feedback);
}

/** L9：soft 与 hard reset 对比 */
export function checkLevel9(
  before: WorldState,
  after: WorldState,
  log: LevelLogEntry[],
): LevelCheckResult {
  const b = activeRepo(before);
  const a = activeRepo(after);
  const labels = [
    '已查看当前提交历史',
    '已用 soft reset 回退一步',
    '已用 hard reset 再回退一步',
  ];
  const startTip = b.branches.main;
  const parent = startTip ? b.commits[startTip]?.parents[0] : undefined;
  const grand = parent ? b.commits[parent]?.parents[0] : undefined;
  const endTip = a.branches.main;
  const didSeeLog = ranLog(log);
  const ranSoft = ranOkMatch(log, (t) => t.includes('reset') && t.includes('soft'));
  const ranHard = ranOkMatch(log, (t) => t.includes('reset') && t.includes('hard'));
  const hardDone = Boolean(grand) && endTip === grand && ranHard;

  const dones = [didSeeLog, ranSoft, hardDone];
  let feedback = '按卡片顺序：log → soft reset → hard reset。';
  if (!didSeeLog) feedback = '先执行 log --oneline，看清最近两笔错误提交。';
  else if (!ranSoft) feedback = '先执行 git reset --soft HEAD~1，只拨回指针。';
  else if (!ranHard) feedback = '再执行 git reset --hard HEAD~1，再拨一步。';
  else if (!hardDone) feedback = 'main 应停在错误提交之前第二笔。可重置本关重做。';
  return result(labels, dones, feedback);
}

/** L10：revert 不改写历史 */
export function checkLevel10(
  before: WorldState,
  after: WorldState,
  log: LevelLogEntry[],
): LevelCheckResult {
  const b = activeRepo(before);
  const a = activeRepo(after);
  const labels = [
    '已查看当前提交历史',
    '已 revert 当前提交（生成抵消提交）',
    '原提交仍在历史中可追溯',
  ];
  const beforeTip = b.branches.main;
  const afterTip = a.branches.main;
  const didSeeLog = ranLog(log);
  const ranRevert = ranOkMatch(log, (t) => t.includes('revert'));
  const newTip = afterTip && beforeTip ? afterTip !== beforeTip : false;
  const isRevertCommit = Boolean(afterTip && a.commits[afterTip]?.message.includes('Revert'));
  const originalKept =
    Boolean(beforeTip && afterTip) && isAncestor(a.commits, beforeTip!, afterTip!);

  const dones = [
    didSeeLog,
    ranRevert && newTip && isRevertCommit,
    ranRevert && newTip && isRevertCommit && originalKept,
  ];
  let feedback = '按卡片顺序：log → revert → 再 log 确认原提交仍在。';
  if (!didSeeLog) feedback = '先执行 log --oneline，看清要撤销的那一笔。';
  else if (!ranRevert) feedback = '执行 git revert HEAD，生成抵消提交。';
  else if (!isRevertCommit) feedback = 'revert 后应出现说明以 Revert 开头的新提交。';
  else if (!originalKept) feedback = '原提交应仍能从 main 追溯到。可重置本关重做。';
  return result(labels, dones, feedback);
}

/** L11：rebase 把 feature 独有提交接到 main 之上 */
export function checkLevel11(
  _before: WorldState,
  after: WorldState,
  log: LevelLogEntry[],
): LevelCheckResult {
  const a = activeRepo(after);
  const labels = [
    'HEAD 在 feature 上',
    '已把 feature rebase 到 main 之上',
    '用 log 确认历史更线性（无双父）',
  ];
  const onFeature = a.head.kind === 'branch' && a.head.name === 'feature';
  const featureTip = a.branches.feature;
  const mainTip = a.branches.main;
  const ranSwitch = ranOkMatch(log, (t) => t.includes('switch feature') || t.includes('checkout feature') || t.includes('switch -c feature'));
  const ranRebase = ranOkMatch(log, (t) => t.includes('rebase'));
  const linearOntoMain =
    Boolean(featureTip && mainTip) &&
    isAncestor(a.commits, mainTip!, featureTip!) &&
    featureTip !== mainTip;
  const tipParents = featureTip ? a.commits[featureTip]?.parents.length ?? 0 : 0;
  const noMergeOnTip = tipParents <= 1;

  const dones = [
    onFeature && (ranSwitch || ranRebase),
    ranRebase && linearOntoMain && noMergeOnTip,
    ranRebase && linearOntoMain && noMergeOnTip && ranLog(log),
  ];
  let feedback = '按卡片顺序：切到 feature → rebase main → log 观察。';
  if (!onFeature) feedback = '先让 HEAD 指向 feature。';
  else if (!ranRebase) feedback = '在 feature 上执行 rebase main。';
  else if (!linearOntoMain) feedback = 'rebase 后 feature 应接在 main 之上。可重置本关重做。';
  else if (!ranLog(log)) feedback = '执行 log --oneline，确认没有双父 merge 节点。';
  return result(labels, dones, feedback);
}

/** L12：fetch 只更新远程引用，再 pull 同步 */
export function checkLevel12(
  before: WorldState,
  after: WorldState,
  log: LevelLogEntry[],
): LevelCheckResult {
  const labels = [
    'Alice 已 commit 并 push 到 origin',
    'Bob 已 fetch（本地 main 未自动变）',
    'Bob 已 pull 并与远程一致',
  ];
  const remoteTip = after.remoteBranches.main;
  const beforeRemote = before.remoteBranches.main;
  const remoteMoved = Boolean(remoteTip) && remoteTip !== beforeRemote;
  const bobBeforeMain = before.users.bob.branches.main;
  const bob = after.users.bob;
  const ranPush = ranOkMatch(log, (t) => t.includes('push'));
  const ranFetch = ranOkMatch(log, (t) => t.includes('fetch'));
  const ranPull = ranOkMatch(log, (t) => t.includes('pull'));
  // fetch 后 Bob 本地 main 仍应是初始 tip；pull 后与远程一致
  const bobStillAtStart = bob.branches.main === bobBeforeMain;
  const bobSynced = Boolean(remoteTip) && bob.branches.main === remoteTip;

  const dones = [
    remoteMoved && ranPush,
    ranFetch && remoteMoved && (bobStillAtStart || bobSynced),
    ranPull && bobSynced,
  ];
  let feedback = '按卡片：Alice push → Bob fetch → Bob pull。';
  if (!remoteMoved) feedback = '先以 Alice 提交并 push（顶栏确认 Alice）。';
  else if (!ranFetch) feedback = '切到 Bob，先执行 git fetch，观察本地 main 未自动变化。';
  else if (!ranPull) feedback = '再执行 git pull，把远程合入本地 main。';
  else if (!bobSynced) feedback = 'Bob 的 main 应与远程一致。';
  return result(labels, dones, feedback);
}

/** L13：远程已领先时 push 被拒，pull 后再 push */
export function checkLevel13(
  before: WorldState,
  after: WorldState,
  log: LevelLogEntry[],
): LevelCheckResult {
  const labels = [
    '以 Alice 尝试 push（预期被拒绝）',
    '已 pull 同步远程',
    '再次 push 成功，远程与 Alice 一致',
  ];
  const failedPush = log.some((e) => !e.ok && e.input.toLowerCase().includes('push'));
  const okPush = log.some((e) => e.ok && e.input.toLowerCase().includes('push'));
  const ranPull = ranOkMatch(log, (t) => t.includes('pull'));
  const remoteTip = after.remoteBranches.main;
  const aliceTip = after.users.alice.branches.main;
  const synced = Boolean(remoteTip) && aliceTip === remoteTip;
  const aliceHasMore =
    Object.keys(after.users.alice.commits).length >
    Object.keys(before.users.alice.commits).length;

  const dones = [failedPush && aliceHasMore, ranPull, okPush && synced];
  let feedback = '按卡片：在 Alice 下 push（应失败）→ pull → 再 push。';
  if (!aliceHasMore) feedback = '先确认 Alice 本地有未推送的提交。';
  else if (!failedPush) feedback = '在 Alice 下执行 git push origin main，观察被拒绝。';
  else if (!ranPull) feedback = '执行 git pull，合并远程领先提交。';
  else if (!okPush || !synced) feedback = 'pull 后再次 push，使远程与 Alice 一致。';
  return result(labels, dones, feedback);
}

/** L14：Bob 本地有提交时 pull 生成 merge */
export function checkLevel14(
  _before: WorldState,
  after: WorldState,
  log: LevelLogEntry[],
): LevelCheckResult {
  const labels = [
    'Bob 本地已有自己的提交',
    'pull 后 main 是双父 merge 提交',
    '该提交能追溯到 Alice 已推送的提交',
  ];
  const bob = after.users.bob;
  const tip = bob.branches.main;
  const commit = tip ? bob.commits[tip] : undefined;
  const isMerge = Boolean(commit) && commit!.parents.length === 2;
  const ranPull = ranOkMatch(log, (t) => t.includes('pull'));
  const ranCommit = ranOkMatch(log, (t) => t.includes('commit'));
  const remoteTip = after.remoteBranches.main;
  const containsRemote =
    isMerge && Boolean(remoteTip) && isAncestor(bob.commits, remoteTip!, tip!);

  const dones = [
    ranCommit && Boolean(tip),
    ranPull && isMerge,
    ranPull && isMerge && containsRemote,
  ];
  let feedback = '按卡片：Bob 先 commit → 再 pull → 观察双父节点。';
  if (!ranCommit) feedback = '切到 Bob，先创建一笔本地提交。';
  else if (!ranPull) feedback = '执行 git pull，应与远程分叉合并。';
  else if (!isMerge) feedback = 'pull 后 main tip 应是双父提交。可重置本关重做。';
  else if (!containsRemote) feedback = 'merge 结果应能追溯到远程提交。';
  return result(labels, dones, feedback);
}

/** L15：分支 -d / -D 删除 */
export function checkLevel15(
  _before: WorldState,
  after: WorldState,
  log: LevelLogEntry[],
): LevelCheckResult {
  const labels = [
    '已删除已合并的 feature（-d）',
    '未合并分支 -d 被拒绝',
    '用 -D 强制删除 hotfix',
  ];
  const a = activeRepo(after);
  const featureGone = !a.branches.feature;
  const deletedFeature = log.some(
    (e) =>
      e.ok &&
      e.input.toLowerCase().includes('branch') &&
      e.input.toLowerCase().includes('feature') &&
      e.input.includes('-d'),
  );
  const failedHotfixD = log.some(
    (e) =>
      !e.ok &&
      e.input.toLowerCase().includes('branch') &&
      e.input.toLowerCase().includes('hotfix'),
  );
  const hotfixGone = !a.branches.hotfix;
  const forceDeleted = log.some(
    (e) =>
      e.ok &&
      e.input.toLowerCase().includes('branch') &&
      e.input.toLowerCase().includes('hotfix') &&
      e.input.includes('-D'),
  );

  const dones = [featureGone && deletedFeature, failedHotfixD, hotfixGone && forceDeleted];
  let feedback = '按卡片：-d 删 feature → -d hotfix（应失败）→ -D 强制删。';
  if (!featureGone) feedback = '先删除已合并的 feature。';
  else if (!deletedFeature) feedback = '请执行 git branch -d feature。';
  else if (!failedHotfixD) feedback = '尝试 git branch -d hotfix，应被拒绝（有未合并提交）。';
  else if (!forceDeleted) feedback = '执行 git branch -D hotfix 强制删除。';
  return result(labels, dones, feedback);
}

/** L16：fetch 后把本地提交 rebase 到 origin/main */
export function checkLevel16(
  _before: WorldState,
  after: WorldState,
  log: LevelLogEntry[],
): LevelCheckResult {
  const labels = [
    '已 fetch 远程更新',
    '已 rebase 到 origin/main',
    'log 显示本地提交接在远程之上且线性',
  ];
  const a = activeRepo(after);
  const tip = a.branches.main;
  const remoteTip = after.remoteBranches.main;
  const ranFetch = ranOkMatch(log, (t) => t.includes('fetch'));
  const ranRebase = ranOkMatch(log, (t) => t.includes('rebase'));
  const ontoRemote =
    Boolean(tip && remoteTip) &&
    tip !== remoteTip &&
    isAncestor(a.commits, remoteTip!, tip!);
  const tipParents = tip ? a.commits[tip]?.parents.length ?? 0 : 0;
  const linear = tipParents <= 1;

  const dones = [
    ranFetch,
    ranRebase && ontoRemote && linear,
    ranRebase && ontoRemote && linear && ranLog(log),
  ];
  let feedback = '按卡片：fetch → rebase origin/main → log 观察。';
  if (!ranFetch) feedback = '先执行 git fetch，更新远程跟踪引用。';
  else if (!ranRebase) feedback = '执行 git rebase origin/main。';
  else if (!ontoRemote) feedback = 'rebase 后本地 main 应接在 origin/main 之上。';
  else if (!ranLog(log)) feedback = '执行 log --oneline 确认线性。';
  return result(labels, dones, feedback);
}
