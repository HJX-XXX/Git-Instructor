import { describe, expect, it } from 'vitest';
import {
  applyWorldCommand,
  createDemoWorld,
  createEmptyWorld,
  switchUser,
  activeRepo,
} from './world';
import type { WorldState } from './types';

function runAll(world: WorldState, cmds: string[]): WorldState {
  let w = world;
  for (const c of cmds) {
    const r = applyWorldCommand(w, c);
    if (!r.ok) throw new Error(`${c} failed: ${r.stdout.join(' | ')}`);
    w = r.world;
  }
  return w;
}

describe('multi-user world', () => {
  it('starts empty for both users', () => {
    const w = createEmptyWorld();
    expect(w.activeUser).toBe('alice');
    expect(Object.keys(w.users.alice.commits)).toHaveLength(0);
    expect(Object.keys(w.users.bob.commits)).toHaveLength(0);
    expect(Object.keys(w.remoteBranches)).toHaveLength(0);
  });

  it('demo gives both same main history and remote main', () => {
    const w = createDemoWorld();
    expect(w.users.alice.branches.main).toBe('c33cf03');
    expect(w.users.bob.branches.main).toBe('c33cf03');
    expect(w.remoteBranches.main).toBe('c33cf03');
  });

  it('alice commits are not visible to bob until fetch/pull', () => {
    let w = createEmptyWorld();
    w = runAll(w, ['git commit -m "alice only"']);
    expect(activeRepo(w).branches.main).toBeDefined();
    const aliceTip = w.users.alice.branches.main!;

    w = switchUser(w, 'bob').world;
    expect(activeRepo(w).commits[aliceTip]).toBeUndefined();
    expect(activeRepo(w).branches.main).toBeUndefined();

    // push then switch bob pull
    w = switchUser(w, 'alice').world;
    w = runAll(w, ['git push origin main']);
    expect(w.remoteBranches.main).toBe(aliceTip);

    w = switchUser(w, 'bob').world;
    w = runAll(w, ['git pull']);
    expect(activeRepo(w).commits[aliceTip]).toBeDefined();
    expect(activeRepo(w).branches.main).toBe(aliceTip);
  });

  it('rejects non-fast-forward push', () => {
    let w = createEmptyWorld();
    w = runAll(w, ['git commit -m "base"', 'git push origin main']);

    w = switchUser(w, 'bob').world;
    w = runAll(w, ['git pull']);
    w = switchUser(w, 'alice').world;
    w = runAll(w, ['git commit -m "alice more"', 'git push origin main']);
    const advanced = w.remoteBranches.main!;

    w = switchUser(w, 'bob').world;
    const r = applyWorldCommand(w, 'git commit -m "bob on stale main"');
    expect(r.ok).toBe(true);
    const push = applyWorldCommand(r.world, 'git push origin main');
    expect(push.ok).toBe(false);
    expect(push.stdout.join('\n')).toContain('non-fast-forward');
    expect(push.world.remoteBranches.main).toBe(advanced);
  });

  it('fetch imports remote commits without merging', () => {
    let w = createEmptyWorld();
    w = runAll(w, ['git commit -m "shared"']);
    w = runAll(w, ['git push origin main']);
    const tip = w.users.alice.branches.main!;

    w = switchUser(w, 'bob').world;
    const fr = applyWorldCommand(w, 'git fetch');
    expect(fr.ok).toBe(true);
    expect(fr.world.users.bob.commits[tip]).toBeDefined();
    expect(fr.world.users.bob.branches.main).toBeUndefined();
  });

  it('push then other user sees origin/* after fetch via layout data', () => {
    let w = createEmptyWorld();
    w = runAll(w, ['git commit -m "x"', 'git push origin main']);
    w = switchUser(w, 'bob').world;
    w = runAll(w, ['git fetch']);
    expect(w.remoteBranches.main).toBeDefined();
    expect(w.users.bob.commits[w.remoteBranches.main!]).toBeDefined();
  });
});
