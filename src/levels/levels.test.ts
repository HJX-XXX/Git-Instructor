import { describe, expect, it } from 'vitest';
import { applyWorldCommand, createDemoWorld, createEmptyWorld, activeRepo } from '../engine/world';
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
});

describe('level checks', () => {
  it('L0 wins after reading concepts and status', () => {
    const before = createDemoWorld();
    const { w, log } = run(before, ['git status']);
    const r = checkLevel0(w, log, ['head', 'commit', 'branch']);
    expect(r.win).toBe(true);
  });

  it('L1 wins after first commit on empty repo', () => {
    const before = createEmptyWorld();
    const { w } = run(before, ['git commit -m "init: x"']);
    expect(checkLevel1(before, w).win).toBe(true);
  });

  it('L2 wins after status and log', () => {
    const before = createDemoWorld();
    const { w, log } = run(before, ['git status', 'git log --oneline']);
    expect(checkLevel2(before, w, log).win).toBe(true);
  });

  it('L3 wins with branch without switch', () => {
    const before = createDemoWorld();
    const { w } = run(before, ['git branch feature']);
    expect(checkLevel3(before, w).win).toBe(true);
  });

  it('L4 wins after switch -c feature and commit', () => {
    const before = createDemoWorld();
    const { w } = run(before, [
      'git switch -c feature',
      'git commit -m "feat: x"',
    ]);
    const r = checkLevel4(before, w);
    expect(r.win).toBe(true);
    expect(activeRepo(w).head).toEqual({ kind: 'branch', name: 'feature' });
  });

  it('L4 fails if only branch without commit', () => {
    const before = createDemoWorld();
    const { w } = run(before, ['git branch feature']);
    expect(checkLevel4(before, w).win).toBe(false);
  });

  it('L5 wins on fast-forward merge', () => {
    const before = run(createDemoWorld(), [
      'git switch -c feature',
      'git commit -m "feat: a"',
      'git switch main',
    ]).w;
    const { w } = run(before, ['git merge feature']);
    expect(checkLevel5(before, w).win).toBe(true);
  });

  it('L6 wins on merge commit', () => {
    const before = run(createDemoWorld(), [
      'git switch -c feature',
      'git commit -m "feat: a"',
      'git switch main',
      'git commit -m "fix: b"',
    ]).w;
    const { w } = run(before, ['git merge feature']);
    expect(checkLevel6(before, w).win).toBe(true);
  });

  it('L7 wins after reset HEAD~1', () => {
    const before = run(createDemoWorld(), ['git commit -m "oops"']).w;
    const { w } = run(before, ['git reset --hard HEAD~1']);
    expect(checkLevel7(before, w).win).toBe(true);
  });

  it('L8 wins after alice push and bob pull', () => {
    let w = createDemoWorld();
    const before = w;
    w = run(w, ['git commit -m "alice: shared"', 'git push origin main']).w;
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
    const a5 = run(b5, ['git switch main', 'git merge feature']).w;
    expect(l5.check({ before: b5, after: a5, log: [] }).win).toBe(true);

    const l6 = getLevel(6)!;
    const b6 = l6.startWorld();
    const a6 = run(b6, ['git merge feature']).w;
    expect(l6.check({ before: b6, after: a6, log: [] }).win).toBe(true);

    const l7 = getLevel(7)!;
    const b7 = l7.startWorld();
    const a7 = run(b7, ['git reset --hard HEAD~1']).w;
    expect(l7.check({ before: b7, after: a7, log: [] }).win).toBe(true);

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
