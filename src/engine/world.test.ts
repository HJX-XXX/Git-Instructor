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

  it('after fetch, remote tip commits are in local store for graph', () => {
    let w = createEmptyWorld();
    w = runAll(w, [
      'git commit -m "base"',
      'git push origin main',
      'git switch -c feature',
      'git commit -m "alice feature"',
      'git push origin feature',
    ]);
    const featureTip = w.users.alice.branches.feature!;

    w = switchUser(w, 'bob').world;
    w = runAll(w, ['git fetch']);
    // Bob 本地 main 仍只有 base，但 feature 提交对象已导入，且 origin/feature 可解析
    expect(w.users.bob.commits[featureTip]).toBeDefined();
    expect(w.remoteBranches.feature).toBe(featureTip);
    expect(w.users.bob.branches.feature).toBeUndefined();
  });

  it('push then other user sees origin/* after fetch via layout data', () => {
    let w = createEmptyWorld();
    w = runAll(w, ['git commit -m "x"', 'git push origin main']);
    w = switchUser(w, 'bob').world;
    w = runAll(w, ['git fetch']);
    expect(w.remoteBranches.main).toBeDefined();
    expect(w.users.bob.commits[w.remoteBranches.main!]).toBeDefined();
  });

  it('rebases local branch onto origin/<remote>', () => {
    let w = createEmptyWorld();
    // Alice 建 main 并推远程
    w = runAll(w, ['git commit -m "base"', 'git push origin main']);
    // Alice 再在 feature 上提交并 push
    w = runAll(w, [
      'git switch -c feature',
      'git commit -m "alice work"',
      'git push origin feature',
    ]);
    const featureTip = w.users.alice.branches.feature!;

    // Bob 同步后在自己分支上提交，再 rebase 到 origin/feature
    w = switchUser(w, 'bob').world;
    w = runAll(w, ['git fetch', 'git pull']);
    w = runAll(w, ['git switch -c mywork', 'git commit -m "bob work"']);
    const before = w.users.bob.branches.mywork!;

    const r = applyWorldCommand(w, 'git rebase origin/feature');
    expect(r.ok).toBe(true);
    const after = r.world.users.bob.branches.mywork!;
    expect(after).not.toBe(before);
    // 重放后 parent 应是远程 feature tip
    expect(r.world.users.bob.commits[after]!.parents[0]).toBe(featureTip);
  });
});
