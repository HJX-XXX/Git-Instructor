import { describe, expect, it, vi } from 'vitest';
import {
  applyWorldCommand,
  createConceptDemoWorld,
  createDemoWorld,
  createEmptyWorld,
  activeRepo,
} from '../engine/world';
import { LEVELS, getLevel } from './catalog';
import {
  checkLevel0,
  checkLevel1,
  checkLevel2,
  checkLevel3,
  checkLevel4,
  checkLevel5,
  checkLevel6,
  checkLevel7,
  checkLevel8,
} from './checks';
import { isLevelUnlocked, loadProgress, markCompleted, nextLevelId, defaultProgress } from './progress';
import type { LevelLogEntry } from './types';
import type { WorldState as W } from '../engine/types';
import { layoutGraph } from '../engine/layout';

function run(world: W, cmds: string[]) {
  let w = world;
  const log: LevelLogEntry[] = [];
  for (const c of cmds) {
    const r = applyWorldCommand(w, c);
    // user 记录命令执行后的身份（user xxx 切换后为新用户；顶栏切换在 App 中写入 user 字段）
    log.push({ input: c, ok: r.ok, user: r.world.activeUser });
    if (!r.ok) throw new Error(`${c}: ${r.stdout.join(' | ')}`);
    w = r.world;
  }
  return { w, log };
}

describe('level catalog', () => {
  it('has levels 1-25', () => {
    expect(LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]);
    expect(getLevel(2)?.concepts?.map((c) => c.id)).toEqual(['head', 'commit', 'branch']);
    expect(getLevel(1)?.title).toContain('init');
    expect(getLevel(4)?.title).toContain('状态');
    expect(getLevel(7)?.title).toContain('Fast-forward');
    expect(getLevel(25)?.title).toContain('mixed');
    expect(getLevel(19)?.title).toContain('origin');
    expect(LEVELS.map((l) => l.stageId)).toEqual([
      ...Array(4).fill('s1'), ...Array(4).fill('s2'), ...Array(2).fill('s3'),
      ...Array(4).fill('s4'), ...Array(5).fill('s5'), ...Array(6).fill('s6'),
    ]);
  });

  it('every level has a stage and practice cards matching objectives', () => {
    for (const lv of LEVELS) {
      expect(lv.stageId, `L${lv.id} stage`).toBeTruthy();
      expect(lv.concepts?.length, `L${lv.id} concepts`).toBeGreaterThan(0);
      expect(lv.concepts!.length, `L${lv.id} concepts vs objectives`).toBe(
        lv.objectiveLabels.length,
      );
      for (const c of lv.concepts!) {
        expect(c.practice?.command, `L${lv.id} ${c.id}`).toBeTruthy();
      }
    }
  });
});

describe('level checks', () => {
  it('L0 wins after switch feature, hotfix, and labeled commit', () => {
    const start = createConceptDemoWorld();
    const { w, log } = run(start, [
      'git switch feature',
      'git branch hotfix',
      'git commit -m "这是我的提交"',
    ]);
    const r = checkLevel0(w, log);
    expect(r.win).toBe(true);
  });

  it('L0 fails without the required commit message', () => {
    const start = createConceptDemoWorld();
    const { w, log } = run(start, [
      'git switch feature',
      'git branch hotfix',
      'git commit -m "随便写的"',
    ]);
    expect(checkLevel0(w, log).win).toBe(false);
  });

  it('L0 fails if HEAD never moves to feature', () => {
    const start = createConceptDemoWorld();
    const { w, log } = run(start, [
      'git branch hotfix',
      'git commit -m "这是我的提交"',
    ]);
    const r = checkLevel0(w, log);
    expect(r.win).toBe(false);
    expect(r.objectives[0]?.done).toBe(false);
  });

  it('L1 shows remote history from start; init adds anchor; clone joins local', () => {
    const l1 = getLevel(1)!;
    const b = l1.startWorld();
    // 主体图空白；远程引用始终保留
    expect(layoutGraph(b.users.alice, b.remoteBranches, b.remoteCommits).nodes).toHaveLength(0);
    expect(b.remoteBranches.main).toBeTruthy();
    expect(Object.keys(b.remoteCommits).length).toBeGreaterThan(0);
    const afterInit = run(b, ['git init']);
    expect(l1.check({ before: b, after: afterInit.w, log: afterInit.log }).win).toBe(false);
    const afterInitNodes = layoutGraph(
      afterInit.w.users.alice,
      afterInit.w.remoteBranches,
      afterInit.w.remoteCommits,
    ).nodes;
    expect(afterInitNodes.some((n) => n.kind === 'init')).toBe(true);
    expect(afterInitNodes.filter((n) => n.kind !== 'init')).toHaveLength(0);
    const afterClone = run(afterInit.w, ['git clone']);
    const r = l1.check({
      before: b,
      after: afterClone.w,
      log: [...afterInit.log, ...afterClone.log],
    });
    expect(r.win).toBe(true);
    expect(Object.keys(afterClone.w.users.alice.commits).length).toBeGreaterThan(0);
  });

  it('clone fails when remote is empty', () => {
    const emptyRemote = createEmptyWorld();
    const r = applyWorldCommand(emptyRemote, 'git clone');
    expect(r.ok).toBe(false);
  });

  it('L2 concept world still has feature; practice uses hotfix', () => {
    const repo = activeRepo(createConceptDemoWorld());
    expect(repo.branches.feature).toBeTruthy();
    expect(repo.branches.hotfix).toBeUndefined();
  });

  it('L1 wins after first commit on empty repo', () => {
    const before = createEmptyWorld();
    const { w } = run(before, ['git commit -m "init: x"']);
    const r = checkLevel1(before, w);
    expect(r.win).toBe(true);
    expect(r.objectives).toHaveLength(1);
  });

  it('L2 wins after status and log', () => {
    const before = createDemoWorld();
    const { w, log } = run(before, ['git status', 'git log --oneline']);
    expect(checkLevel2(before, w, log).win).toBe(true);
  });

  it('L3 requires create, status, and log in sequence', () => {
    const before = createDemoWorld();
    const afterCreate = run(before, ['git branch feature']);
    expect(checkLevel3(before, afterCreate.w, afterCreate.log).win).toBe(false);
    const afterStatus = run(afterCreate.w, ['git status']);
    expect(
      checkLevel3(before, afterStatus.w, [...afterCreate.log, ...afterStatus.log]).win,
    ).toBe(false);
    const afterLog = run(afterStatus.w, ['git log --oneline']);
    const r = checkLevel3(
      before,
      afterLog.w,
      [...afterCreate.log, ...afterStatus.log, ...afterLog.log],
    );
    expect(r.win).toBe(true);
  });

  it('L4 wins after switch feature, commit, then observe main via log', () => {
    const before = createDemoWorld();
    const { w, log } = run(before, [
      'git switch -c feature',
      'git commit -m "feat: x"',
      'git switch main',
      'git log --oneline',
    ]);
    const r = checkLevel4(before, w, log);
    expect(r.win).toBe(true);
  });

  it('L4 does not win if log runs on feature without switching to main', () => {
    const before = createDemoWorld();
    const { w, log } = run(before, [
      'git switch -c feature',
      'git commit -m "feat: x"',
      'git log --oneline',
    ]);
    const r = checkLevel4(before, w, log);
    expect(r.win).toBe(false);
    expect(r.objectives[2]!.done).toBe(false);
  });

  it('L4 fails if only branch without commit', () => {
    const before = createDemoWorld();
    const { w, log } = run(before, ['git branch feature']);
    expect(checkLevel4(before, w, log).win).toBe(false);
  });

  it('L5 wins on fast-forward merge', () => {
    const before = run(createDemoWorld(), [
      'git switch -c feature',
      'git commit -m "feat: a"',
      'git switch main',
    ]);
    const { w, log } = run(before.w, ['git status', 'git merge feature', 'git log --oneline']);
    expect(checkLevel5(before.w, w, [...before.log, ...log]).win).toBe(true);
  });

  it('L6 wins on merge commit', () => {
    const before = run(createDemoWorld(), [
      'git switch -c feature',
      'git commit -m "feat: a"',
      'git switch main',
      'git commit -m "fix: b"',
    ]);
    const { w, log } = run(before.w, [
      'git status',
      'git merge feature',
      'git log --oneline',
    ]);
    expect(checkLevel6(before.w, w, [...before.log, ...log]).win).toBe(true);
  });

  it('L7 completes cards in log → reset → status order', () => {
    const before = getLevel(7)!.startWorld();
    const afterLog = run(before, ['git log --oneline']);
    const c1 = checkLevel7(before, afterLog.w, afterLog.log);
    expect(c1.objectives[0]?.done).toBe(true);
    expect(c1.objectives[1]?.done).toBe(false);

    const afterReset = run(afterLog.w, ['git reset --hard HEAD~1']);
    const c2 = checkLevel7(before, afterReset.w, [...afterLog.log, ...afterReset.log]);
    expect(c2.objectives[0]?.done).toBe(true);
    expect(c2.objectives[1]?.done).toBe(true);
    expect(c2.objectives[2]?.done).toBe(false);
    expect(c2.win).toBe(false);

    const afterStatus = run(afterReset.w, ['git status']);
    const c3 = checkLevel7(
      before,
      afterStatus.w,
      [...afterLog.log, ...afterReset.log, ...afterStatus.log],
    );
    expect(c3.win).toBe(true);
  });

  it('L7 wins after log, reset HEAD~1, and status', () => {
    const before = run(createDemoWorld(), ['git commit -m "oops"']);
    const { w, log } = run(before.w, [
      'git log --oneline',
      'git reset --hard HEAD~1',
      'git status',
    ]);
    expect(checkLevel7(before.w, w, [...before.log, ...log]).win).toBe(true);
  });

  it('L5 keeps FF objective after later log command', () => {
    const before = getLevel(7)!.startWorld();
    const afterMerge = run(before, ['git status', 'git merge feature']);
    const mid = checkLevel5(before, afterMerge.w, afterMerge.log);
    expect(mid.objectives[1]?.done).toBe(true);
    const afterLog = run(afterMerge.w, ['git log --oneline']);
    const full = checkLevel5(
      before,
      afterLog.w,
      [...afterMerge.log, ...afterLog.log],
    );
    expect(full.objectives[1]?.done).toBe(true);
    expect(full.win).toBe(true);
  });

  it('L8 completes cards in commit → push → pull order', () => {
    const before = getLevel(8)!.startWorld();
    const afterCommit = run(before, ['git commit -m "alice: shared"']);
    const c1 = checkLevel8(before, afterCommit.w, afterCommit.log);
    expect(c1.objectives[0]?.done).toBe(true);
    expect(c1.objectives[1]?.done).toBe(false);

    const afterPush = run(afterCommit.w, ['git push origin main']);
    const c2 = checkLevel8(before, afterPush.w, [...afterCommit.log, ...afterPush.log]);
    expect(c2.objectives[0]?.done).toBe(true);
    expect(c2.objectives[1]?.done).toBe(true);
    expect(c2.objectives[2]?.done).toBe(false);

    const afterPull = run(afterPush.w, ['user bob', 'git pull']);
    const c3 = checkLevel8(before, afterPull.w, [...afterCommit.log, ...afterPush.log, ...afterPull.log]);
    expect(c3.win).toBe(true);
  });

  it('L8 wins after alice push and bob pull', () => {
    const before = createDemoWorld();
    const all = run(before, [
      'git commit -m "alice: shared"',
      'git push origin main',
      'user bob',
      'git pull',
    ]);
    expect(checkLevel8(before, all.w, all.log).win).toBe(true);
  });

  it('L8 does not win if pull runs as Alice only', () => {
    const before = createDemoWorld();
    const all = run(before, [
      'git commit -m "alice: shared"',
      'git push origin main',
      'git pull',
    ]);
    const r = checkLevel8(before, all.w, all.log);
    expect(r.win).toBe(false);
    expect(r.objectives[2]!.done).toBe(false);
  });

  it('catalog start worlds and checks work end-to-end', () => {
    for (const lv of LEVELS) {
      const before = lv.startWorld();
      expect(before.users.alice).toBeDefined();
    }

    const l7ff = getLevel(7)!;
    const b5 = l7ff.startWorld();
    const a5 = run(b5, ['git status', 'git merge feature', 'git log --oneline']);
    expect(
      l7ff.check({ before: b5, after: a5.w, log: a5.log }).win,
    ).toBe(true);

    const l8merge = getLevel(8)!;
    const b6 = l8merge.startWorld();
    const a6 = run(b6, ['git status', 'git merge feature', 'git log --oneline']);
    expect(
      l8merge.check({ before: b6, after: a6.w, log: a6.log }).win,
    ).toBe(true);

    const l9reset = getLevel(9)!;
    const b7 = l9reset.startWorld();
    const a7 = run(b7, ['git log --oneline', 'git reset --hard HEAD~1', 'git status']);
    expect(
      l9reset.check({ before: b7, after: a7.w, log: a7.log }).win,
    ).toBe(true);

    const l10push = getLevel(10)!;
    const b8 = l10push.startWorld();
    const a8 = run(b8, ['git commit -m "x"', 'git push origin main', 'user bob', 'git pull']);
    expect(
      l10push.check({
        before: b8,
        after: a8.w,
        log: a8.log,
      }).win,
    ).toBe(true);
  });

  it('later stages start worlds and happy paths', () => {
    const l11soft = getLevel(25)!;
    const b9 = l11soft.startWorld();
    const a9 = run(b9, [
      'git log --oneline',
      'git reset --soft HEAD~1',
      'git reset --mixed HEAD~1',
      'git reset --hard HEAD~1',
    ]);
    expect(l11soft.check({ before: b9, after: a9.w, log: a9.log }).win).toBe(true);

    // soft 后未 status 就 hard：不应把「soft 后 status」算成通过
    const a9b = run(b9, [
      'git log --oneline',
      'git reset --soft HEAD~1',
      'git reset --hard HEAD~1',
      'git status',
    ]);
    const r9b = l11soft.check({ before: b9, after: a9b.w, log: a9b.log });
    expect(r9b.win).toBe(false);
    expect(r9b.objectives[2]!.done).toBe(false);

    const l13rev = getLevel(12)!;
    const b10 = l13rev.startWorld();
    const a10 = run(b10, ['git log --oneline', 'git revert HEAD', 'git log --oneline']);
    expect(l13rev.check({ before: b10, after: a10.w, log: a10.log }).win).toBe(true);

    const l14rebase = getLevel(13)!;
    const b11 = l14rebase.startWorld();
    const a11 = run(b11, ['git switch feature', 'git rebase main', 'git log --oneline']);
    expect(l14rebase.check({ before: b11, after: a11.w, log: a11.log }).win).toBe(true);

    const l21fetch = getLevel(15)!;
    const b12 = l21fetch.startWorld();
    const a12 = run(b12, [
      'git push origin main',
      'user bob',
      'git fetch',
      'git pull',
    ]);
    expect(l21fetch.check({ before: b12, after: a12.w, log: a12.log }).win).toBe(true);

    // Alice 身份下 fetch/pull 不能算 Bob 已完成同步
    const a12wrong = run(b12, [
      'git push origin main',
      'git fetch',
      'git pull',
    ]);
    const r12wrong = l21fetch.check({ before: b12, after: a12wrong.w, log: a12wrong.log });
    expect(r12wrong.win).toBe(false);
    expect(r12wrong.objectives[1]!.done).toBe(false);

    const l22pushrej = getLevel(16)!;
    const b13 = l22pushrej.startWorld();
    const pushFail = applyWorldCommand(b13, 'git push origin main');
    expect(pushFail.ok).toBe(false);
    const a13 = run(pushFail.world, ['git pull', 'git push origin main']);
    expect(
      l22pushrej.check({
        before: b13,
        after: a13.w,
        log: [{ input: 'git push origin main', ok: false }, ...a13.log],
      }).win,
    ).toBe(true);

    const l23pullm = getLevel(17)!;
    const b14 = l23pullm.startWorld();
    const a14 = run(b14, [
      'git commit -m "bob: 仅在本地"',
      'git pull',
      'git log --oneline',
    ]);
    expect(l23pullm.check({ before: b14, after: a14.w, log: a14.log }).win).toBe(true);

    const l24brdel = getLevel(18)!;
    const b15 = l24brdel.startWorld();
    const delFeature = run(b15, ['git branch -d feature']);
    const dFail = applyWorldCommand(delFeature.w, 'git branch -d hotfix');
    expect(dFail.ok).toBe(false);
    const forceDel = run(dFail.world, ['git branch -D hotfix']);
    const l15log = [
      ...delFeature.log,
      { input: 'git branch -d hotfix', ok: false },
      ...forceDel.log,
    ];
    expect(l24brdel.check({ before: b15, after: forceDel.w, log: l15log }).win).toBe(true);

    const l25rebaseo = getLevel(19)!;
    const b16 = l25rebaseo.startWorld();
    const a16 = run(b16, ['git fetch', 'git rebase origin/main', 'git log --oneline']);
    expect(l25rebaseo.check({ before: b16, after: a16.w, log: a16.log }).win).toBe(true);
  });
});

describe('progress helpers', () => {
  it('migrates saved progress from old level numbers only once', () => {
    const values = new Map<string, string>([
      ['git-instructor:progress', JSON.stringify({
        profile: 'beginner', completed: [11, 12, 25], currentLevelId: 25,
      })],
    ]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    try {
      expect(loadProgress()).toEqual({
        profile: 'beginner', completed: [25, 11, 19], currentLevelId: 19,
      });
      expect(loadProgress().currentLevelId).toBe(19);
      expect(values.has('git-instructor:progress:v2')).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('all levels are unlocked without requiring previous completion', () => {
    expect(isLevelUnlocked(0, [])).toBe(true);
    expect(isLevelUnlocked(1, [])).toBe(true);
    expect(isLevelUnlocked(9, [])).toBe(true);
    expect(isLevelUnlocked(16, [0])).toBe(true);
  });

  it('next level id walks within stage then jumps to next stage first', () => {
    expect(nextLevelId(1, [1])).toBe(2);
    expect(nextLevelId(8, [1, 2, 3, 4, 5, 6, 7, 8])).toBe(9);
    expect(nextLevelId(24, [])).toBe(25);
    expect(nextLevelId(10, [])).toBe(11);
    expect(nextLevelId(14, [])).toBe(15);
    // 阶段五末关 rebase 到 origin → 阶段六首关工作区与暂存区。
    expect(nextLevelId(19, [])).toBe(20);
    expect(nextLevelId(25, [])).toBeNull();
  });

  it('mark completed is idempotent', () => {
    const p = defaultProgress();
    const a = markCompleted(p, 1);
    const b = markCompleted(a, 1);
    expect(b.completed).toEqual([1]);
  });
});
