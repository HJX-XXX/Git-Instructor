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
  it('has levels 0-8', () => {
    expect(LEVELS.map((l) => l.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(getLevel(0)?.concepts?.map((c) => c.id)).toEqual(['head', 'commit', 'branch']);
    expect(getLevel(2)?.title).toContain('状态');
    expect(getLevel(5)?.title).toContain('Fast-forward');
  });

  it('every level has practice cards matching objectives', () => {
    for (const lv of LEVELS) {
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

  it('L7 wins after log, reset HEAD~1, and status', () => {
    const before = run(createDemoWorld(), ['git commit -m "oops"']);
    const { w, log } = run(before.w, [
      'git log --oneline',
      'git reset --hard HEAD~1',
      'git status',
    ]);
    expect(checkLevel7(before.w, w, [...before.log, ...log]).win).toBe(true);
  });

  it('L8 wins after alice push and bob pull', () => {
    let w = createDemoWorld();
    const before = w;
    const r1 = run(w, ['git commit -m "alice: shared"', 'git push origin main']);
    w = r1.w;
    w = applyWorldCommand(w, 'user bob').world;
    w = run(w, ['git pull']).w;
    expect(checkLevel8(before, w).win).toBe(true);
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
    let a8 = run(b8, ['git commit -m "x"', 'git push origin main']).w;
    a8 = applyWorldCommand(a8, 'user bob').world;
    a8 = run(a8, ['git pull']).w;
    expect(l8.check({ before: b8, after: a8, log: [] }).win).toBe(true);
  });
});

describe('progress helpers', () => {
  it('unlocks sequentially from L0', () => {
    expect(isLevelUnlocked(0, [])).toBe(true);
    expect(isLevelUnlocked(1, [])).toBe(false);
    expect(isLevelUnlocked(1, [0])).toBe(true);
    expect(isLevelUnlocked(4, [0, 1, 2])).toBe(false);
    expect(isLevelUnlocked(4, [0, 1, 2, 3])).toBe(true);
    expect(isLevelUnlocked(8, [0, 1, 2, 3, 4, 5, 6, 7])).toBe(true);
  });

  it('next level id', () => {
    expect(nextLevelId(0, [0])).toBe(1);
    expect(nextLevelId(7, [0, 1, 2, 3, 4, 5, 6, 7])).toBe(8);
    expect(nextLevelId(8, [0, 1, 2, 3, 4, 5, 6, 7, 8])).toBeNull();
  });

  it('mark completed is idempotent', () => {
    const p = defaultProgress();
    const a = markCompleted(p, 1);
    const b = markCompleted(a, 1);
    expect(b.completed).toEqual([1]);
  });
});
