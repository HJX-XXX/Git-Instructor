import { describe, expect, it } from 'vitest';
import { applyCommand } from './apply';
import { createEmptyRepoState, createInitialDemoState, createUninitializedRepoState } from './demo';
import { INIT_NODE_ID, layoutGraph } from './layout';
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
  it('uninitialized repo has blank graph without init anchor', () => {
    const blank = layoutGraph(createUninitializedRepoState());
    expect(blank.nodes).toHaveLength(0);
  });

  it('always includes a git init anchor', () => {
    const empty = layoutGraph(createEmptyRepoState());
    const initOnly = empty.nodes.filter((n) => n.kind === 'init');
    expect(initOnly).toHaveLength(1);
    expect(initOnly[0]!.id).toBe(INIT_NODE_ID);
    expect(initOnly[0]!.isHead).toBe(true);
    expect(initOnly[0]!.branches).toContain('main');

    const demo = layoutGraph(createInitialDemoState());
    const init = demo.nodes.find((n) => n.kind === 'init')!;
    expect(init).toBeDefined();
    expect(init.isHead).toBe(false);
    // 根提交连到 init
    const roots = demo.nodes.filter((n) => n.kind !== 'init' && n.message === 'init: 项目初始化');
    expect(roots).toHaveLength(1);
    const toInit = demo.edges.filter((e) => e.to === INIT_NODE_ID);
    expect(toInit.map((e) => e.from)).toContain(roots[0]!.id);
  });

  it('orders new commits above old ones', () => {
    const layout = layoutGraph(createInitialDemoState());
    const commits = layout.nodes.filter((n) => n.kind !== 'init');
    const ids = commits.map((n) => n.id);
    expect(ids[0]).toBe('c33cf03');
    expect(ids[ids.length - 1]).toBe('a11ce01');
    for (let i = 1; i < commits.length; i += 1) {
      expect(commits[i]!.y).toBeGreaterThan(commits[i - 1]!.y);
    }
    const init = layout.nodes.find((n) => n.kind === 'init')!;
    expect(init.y).toBeGreaterThan(commits[commits.length - 1]!.y);
  });

  it('keeps HEAD pointer target on branch tip after commit', () => {
    const empty = createEmptyRepoState();
    const before = layoutGraph(empty);
    const initBefore = before.nodes.find((n) => n.kind === 'init')!;
    expect(initBefore.isHead).toBe(true);
    expect(initBefore.branches).toContain('main');

    const s = runAll(empty, ['git commit -m "first"']);
    const after = layoutGraph(s);
    const heads = after.nodes.filter((n) => n.isHead);
    expect(heads).toHaveLength(1);
    expect(heads[0]!.kind).not.toBe('init');
    expect(heads[0]!.branches).toContain('main');
    expect(heads[0]!.id).toBe(s.branches.main);
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
    const messages = layout.nodes.filter((n) => n.kind !== 'init').map((n) => n.message);
    expect(messages).toContain('f1');
    expect(messages).toContain('m1');
    // old f1 may still exist in commits map but only one f1 in reachable graph
    expect(messages.filter((m) => m === 'f1')).toHaveLength(1);
  });

  it('keeps hash column clear of lane rails', () => {
    const s = runAll(createInitialDemoState(), [
      'git switch -c feature',
      'git commit -m "feat: a"',
      'git switch main',
      'git commit -m "fix: b"',
    ]);
    const layout = layoutGraph(s);
    const lastRail = Math.max(...layout.laneX);
    // hash 列结束位置必须在最右竖轨右侧，避免压住编号
    expect(layout.idX).toBeGreaterThan(lastRail);
    expect(layout.msgX).toBeGreaterThan(layout.idX);
  });

  it('includes commits only reachable via remote refs', () => {
    const s = runAll(createInitialDemoState(), [
      'git switch -c feature',
      'git commit -m "f1"',
    ]);
    const extraId = 'ffff001';
    s.commits[extraId] = {
      id: extraId,
      parents: ['c33cf03'],
      message: 'remote only',
      createdAt: 99,
    };
    const layout = layoutGraph(s, { other: extraId });
    expect(layout.nodes.map((n) => n.id)).toContain(extraId);
  });
});
