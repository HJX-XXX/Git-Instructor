import { describe, expect, it } from 'vitest';
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
import { isLevelUnlocked, markCompleted, nextLevelId, defaultProgress } from './progress';
import type { LevelLogEntry } from './types';
import type { WorldState as W } from '../engine/types';

function run(world: W, cmds: string[]) {
  let w = world;
  const log: LevelLogEntry[] = [];
  for (const c of cmds) {
    const r = applyWorldCommand(w, c);
    log.push({ input: c, ok: r.ok });
    if (!r.ok) throw new Error(`${c}: ${r.stdout.join(' | ')}`);
    w = r.world;
  }
  return { w, log };
}

describe('level catalog', () => {
  it('has levels 0-16', () => {
    expect(LEVELS.map((l) => l.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect(getLevel(0)?.concepts?.map((c) => c.id)).toEqual(['head', 'commit', 'branch']);
    expect(getLevel(2)?.title).toContain('状态');
    expect(getLevel(5)?.title).toContain('Fast-forward');
    expect(getLevel(9)?.title).toContain('soft');
    expect(getLevel(16)?.stageId).toBe('s5');
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

  it('L0 concept world still has feature; practice uses hotfix', () => {
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

  it('L4 wins after switch -c feature, commit, and log', () => {
    const before = createDemoWorld();
    const { w, log } = run(before, [
      'git switch -c feature',
      'git commit -m "feat: x"',
      'git log --oneline',
    ]);
    const r = checkLevel4(before, w, log);
    expect(r.win).toBe(true);
    expect(activeRepo(w).head).toEqual({ kind: 'branch', name: 'feature' });
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
    const before = getLevel(5)!.startWorld();
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

    let w = applyWorldCommand(afterPush.w, 'user bob').world;
    const afterPull = run(w, ['git pull']);
    const c3 = checkLevel8(
      before,
      afterPull.w,
      [...afterCommit.log, ...afterPush.log, ...afterPull.log],
    );
    expect(c3.win).toBe(true);
  });

  it('L8 wins after alice push and bob pull', () => {
    let w = createDemoWorld();
    const before = w;
    const r1 = run(w, ['git commit -m "alice: shared"', 'git push origin main']);
    w = r1.w;
    w = applyWorldCommand(w, 'user bob').world;
    const r2 = run(w, ['git pull']);
    expect(checkLevel8(before, r2.w, [...r1.log, ...r2.log]).win).toBe(true);
  });

  it('catalog start worlds and checks work end-to-end', () => {
    for (const lv of LEVELS) {
      const before = lv.startWorld();
      expect(before.users.alice).toBeDefined();
    }

    const l5 = getLevel(5)!;
    const b5 = l5.startWorld();
    const a5 = run(b5, ['git status', 'git merge feature', 'git log --oneline']);
    expect(
      l5.check({ before: b5, after: a5.w, log: a5.log }).win,
    ).toBe(true);

    const l6 = getLevel(6)!;
    const b6 = l6.startWorld();
    const a6 = run(b6, ['git status', 'git merge feature', 'git log --oneline']);
    expect(
      l6.check({ before: b6, after: a6.w, log: a6.log }).win,
    ).toBe(true);

    const l7 = getLevel(7)!;
    const b7 = l7.startWorld();
    const a7 = run(b7, ['git log --oneline', 'git reset --hard HEAD~1', 'git status']);
    expect(
      l7.check({ before: b7, after: a7.w, log: a7.log }).win,
    ).toBe(true);

    const l8 = getLevel(8)!;
    const b8 = l8.startWorld();
    const step1 = run(b8, ['git commit -m "x"', 'git push origin main']);
    const afterSwitch = applyWorldCommand(step1.w, 'user bob').world;
    const step2 = run(afterSwitch, ['git pull']);
    expect(
      l8.check({
        before: b8,
        after: step2.w,
        log: [...step1.log, ...step2.log],
      }).win,
    ).toBe(true);
  });

  it('L9-L16 start worlds and happy paths', () => {
    const l9 = getLevel(9)!;
    const b9 = l9.startWorld();
    const a9 = run(b9, [
      'git log --oneline',
      'git reset --soft HEAD~1',
      'git reset --hard HEAD~1',
    ]);
    expect(l9.check({ before: b9, after: a9.w, log: a9.log }).win).toBe(true);

    const l10 = getLevel(10)!;
    const b10 = l10.startWorld();
    const a10 = run(b10, ['git log --oneline', 'git revert HEAD', 'git log --oneline']);
    expect(l10.check({ before: b10, after: a10.w, log: a10.log }).win).toBe(true);

    const l11 = getLevel(11)!;
    const b11 = l11.startWorld();
    const a11 = run(b11, ['git switch feature', 'git rebase main', 'git log --oneline']);
    expect(l11.check({ before: b11, after: a11.w, log: a11.log }).win).toBe(true);

    const l12 = getLevel(12)!;
    const b12 = l12.startWorld();
    const a12 = run(b12, [
      'git push origin main',
      'user bob',
      'git fetch',
      'git pull',
    ]);
    expect(l12.check({ before: b12, after: a12.w, log: a12.log }).win).toBe(true);

    const l13 = getLevel(13)!;
    const b13 = l13.startWorld();
    const pushFail = applyWorldCommand(b13, 'git push origin main');
    expect(pushFail.ok).toBe(false);
    const a13 = run(pushFail.world, ['git pull', 'git push origin main']);
    expect(
      l13.check({
        before: b13,
        after: a13.w,
        log: [{ input: 'git push origin main', ok: false }, ...a13.log],
      }).win,
    ).toBe(true);

    const l14 = getLevel(14)!;
    const b14 = l14.startWorld();
    const a14 = run(b14, [
      'git commit -m "bob: 仅在本地"',
      'git pull',
      'git log --oneline',
    ]);
    expect(l14.check({ before: b14, after: a14.w, log: a14.log }).win).toBe(true);

    const l15 = getLevel(15)!;
    const b15 = l15.startWorld();
    const delFeature = run(b15, ['git branch -d feature']);
    const dFail = applyWorldCommand(delFeature.w, 'git branch -d hotfix');
    expect(dFail.ok).toBe(false);
    const forceDel = run(dFail.world, ['git branch -D hotfix']);
    const l15log = [
      ...delFeature.log,
      { input: 'git branch -d hotfix', ok: false },
      ...forceDel.log,
    ];
    expect(l15.check({ before: b15, after: forceDel.w, log: l15log }).win).toBe(true);

    const l16 = getLevel(16)!;
    const b16 = l16.startWorld();
    const a16 = run(b16, ['git fetch', 'git rebase origin/main', 'git log --oneline']);
    expect(l16.check({ before: b16, after: a16.w, log: a16.log }).win).toBe(true);
  });
});

describe('progress helpers', () => {
  it('all levels are unlocked without requiring previous completion', () => {
    expect(isLevelUnlocked(0, [])).toBe(true);
    expect(isLevelUnlocked(1, [])).toBe(true);
    expect(isLevelUnlocked(9, [])).toBe(true);
    expect(isLevelUnlocked(16, [0])).toBe(true);
  });

  it('next level id', () => {
    expect(nextLevelId(0, [0])).toBe(1);
    expect(nextLevelId(7, [0, 1, 2, 3, 4, 5, 6, 7])).toBe(8);
    expect(nextLevelId(15, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])).toBe(16);
    expect(nextLevelId(16, LEVELS.map((l) => l.id).filter((n) => n !== 16))).toBeNull();
  });

  it('mark completed is idempotent', () => {
    const p = defaultProgress();
    const a = markCompleted(p, 1);
    const b = markCompleted(a, 1);
    expect(b.completed).toEqual([1]);
  });
});
