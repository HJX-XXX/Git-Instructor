import { describe, expect, it } from 'vitest';
import { applyCommand } from './apply';
import { createInitialDemoState } from './demo';
import { headCommitId } from './hash';
import type { RepoState } from './types';

function runAll(state: RepoState, cmds: string[]): RepoState {
  let s = state;
  for (const c of cmds) {
    const r = applyCommand(s, c);
    if (!r.ok) throw new Error(`command failed: ${c} → ${r.stdout.join(' | ')}`);
    s = r.state;
  }
  return s;
}

describe('applyCommand', () => {
  it('creates commits and moves branch', () => {
    const s0 = createInitialDemoState();
    const r = applyCommand(s0, 'git commit -m "feat: x"');
    expect(r.ok).toBe(true);
    expect(r.state.branches.main).not.toBe(s0.branches.main);
    expect(r.highlights?.createdCommits?.length).toBe(1);
    expect(r.state.commits[r.state.branches.main!]!.message).toBe('feat: x');
  });

  it('does not mutate original state', () => {
    const s0 = createInitialDemoState();
    applyCommand(s0, 'git commit -m "x"');
    expect(s0.branches.main).toBe('c33cf03');
    expect(Object.keys(s0.commits)).toHaveLength(3);
  });

  it('creates and switches branches', () => {
    const s = runAll(createInitialDemoState(), [
      'git switch -c feature',
      'git commit -m "feat: on branch"',
    ]);
    expect(s.head).toEqual({ kind: 'branch', name: 'feature' });
    expect(s.branches.feature).not.toBe(s.branches.main);
  });

  it('fast-forwards merge when current is behind', () => {
    const s = runAll(createInitialDemoState(), [
      'git switch -c feature',
      'git commit -m "feat: ff"',
      'git switch main',
      'git merge feature',
    ]);
    expect(s.branches.main).toBe(s.branches.feature);
  });

  it('creates merge commit when diverged', () => {
    const s = runAll(createInitialDemoState(), [
      'git switch -c feature',
      'git commit -m "feat: a"',
      'git switch main',
      'git commit -m "fix: b"',
      'git merge feature',
    ]);
    const tip = s.commits[s.branches.main!]!;
    expect(tip.parents).toHaveLength(2);
    expect(tip.message).toContain('Merge branch');
  });

  it('resets hard HEAD~1', () => {
    const s0 = createInitialDemoState();
    const before = s0.branches.main;
    const s = runAll(s0, ['git commit -m "temp"', 'git reset --hard HEAD~1']);
    expect(s.branches.main).toBe(before);
    expect(s.dirty).toBe(false);
  });

  it('reset soft marks dirty', () => {
    const s = runAll(createInitialDemoState(), ['git commit -m "temp"', 'git reset --soft HEAD~1']);
    expect(s.dirty).toBe(true);
  });

  it('rejects deleting current branch', () => {
    const r = applyCommand(createInitialDemoState(), 'git branch -d main');
    expect(r.ok).toBe(false);
    expect(r.state.branches.main).toBe('c33cf03');
  });

  it('deletes unmerged with -D after switching away', () => {
    const s = runAll(createInitialDemoState(), [
      'git switch -c feature',
      'git commit -m "x"',
      'git switch main',
    ]);
    const soft = applyCommand(s, 'git branch -d feature');
    expect(soft.ok).toBe(false);
    const hard = applyCommand(s, 'git branch -D feature');
    expect(hard.ok).toBe(true);
    expect(hard.state.branches.feature).toBeUndefined();
  });

  it('revert adds a commit', () => {
    const s0 = createInitialDemoState();
    const r = applyCommand(s0, 'git revert HEAD');
    expect(r.ok).toBe(true);
    const tip = r.state.commits[r.state.branches.main!]!;
    expect(tip.message).toContain('Revert');
    expect(tip.parents[0]).toBe('c33cf03');
  });

  it('rebase replays unique commits onto target', () => {
    const s = runAll(createInitialDemoState(), [
      'git switch -c feature',
      'git commit -m "f1"',
      'git commit -m "f2"',
      'git switch main',
      'git commit -m "m1"',
      'git switch feature',
      'git rebase main',
    ]);
    const tip = headCommitId(s)!;
    const c = s.commits[tip]!;
    expect(c.message).toBe('f2');
    expect(c.parents[0]).toBeDefined();
    const parent = s.commits[c.parents[0]!]!;
    expect(parent.message).toBe('f1');
  });

  it('unknown command fails without changing state', () => {
    const s0 = createInitialDemoState();
    const r = applyCommand(s0, 'git push origin main');
    expect(r.ok).toBe(false);
    expect(r.state.branches.main).toBe('c33cf03');
  });

  it('status and log are read-only', () => {
    const s0 = createInitialDemoState();
    const a = applyCommand(s0, 'git status');
    const b = applyCommand(a.state, 'git log --oneline');
    expect(b.ok).toBe(true);
    expect(b.stdout.length).toBeGreaterThan(0);
    expect(b.state.branches.main).toBe(s0.branches.main);
  });
});
