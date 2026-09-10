import { describe, expect, it } from 'vitest';
import { applyCommand } from './apply';
import { createInitialDemoState } from './demo';
import { layoutGraph } from './layout';
import type { RepoState } from './types';

function runAll(state: RepoState, cmds: string[]): RepoState {
  let s = state;
  for (const c of cmds) {
    const r = applyCommand(s, c);
    if (!r.ok) throw new Error(`command failed: ${c}`);
    s = r.state;
  }
  return s;
}

describe('layoutGraph', () => {
  it('orders new commits above old ones', () => {
    const layout = layoutGraph(createInitialDemoState());
    const ids = layout.nodes.map((n) => n.id);
    expect(ids[0]).toBe('c33cf03');
    expect(ids[ids.length - 1]).toBe('a11ce01');
    for (let i = 1; i < layout.nodes.length; i += 1) {
      expect(layout.nodes[i]!.y).toBeGreaterThan(layout.nodes[i - 1]!.y);
    }
  });

  it('marks HEAD node', () => {
    const layout = layoutGraph(createInitialDemoState());
    const heads = layout.nodes.filter((n) => n.isHead);
    expect(heads).toHaveLength(1);
    expect(heads[0]!.id).toBe('c33cf03');
    expect(heads[0]!.branches).toContain('main');
  });

  it('lays out merge with two parents', () => {
    const s = runAll(createInitialDemoState(), [
      'git switch -c feature',
      'git commit -m "feat: a"',
      'git switch main',
      'git commit -m "fix: b"',
      'git merge feature',
    ]);
    const layout = layoutGraph(s);
    const merge = layout.nodes.find((n) => n.id === s.branches.main)!;
    const edges = layout.edges.filter((e) => e.from === merge.id);
    expect(edges).toHaveLength(2);
  });

  it('only includes reachable commits after rebase', () => {
    const s = runAll(createInitialDemoState(), [
      'git switch -c feature',
      'git commit -m "f1"',
      'git switch main',
      'git commit -m "m1"',
      'git switch feature',
      'git rebase main',
    ]);
    const layout = layoutGraph(s);
    const messages = layout.nodes.map((n) => n.message);
    expect(messages).toContain('f1');
    expect(messages).toContain('m1');
    // old f1 may still exist in commits map but only one f1 in reachable graph
    expect(messages.filter((m) => m === 'f1')).toHaveLength(1);
  });
});
