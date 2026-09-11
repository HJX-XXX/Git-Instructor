import { describe, expect, it } from 'vitest';
import { tokenize, parseCommand } from './parse';
import { resolveCommitId, isAncestor, walkBack } from './hash';
import { createInitialDemoState } from './demo';

describe('tokenize', () => {
  it('splits simple tokens', () => {
    expect(tokenize('git commit -m hello')).toEqual(['git', 'commit', '-m', 'hello']);
  });

  it('keeps quoted message', () => {
    expect(tokenize('git commit -m "feat: a b"')).toEqual(['git', 'commit', '-m', 'feat: a b']);
  });
});

describe('parseCommand', () => {
  it('parses commit with message', () => {
    expect(parseCommand('git commit -m "fix: x"')).toEqual({ type: 'commit', message: 'fix: x' });
  });

  it('allows omitting git prefix', () => {
    expect(parseCommand('switch main')).toEqual({ type: 'switch', name: 'main', create: false });
  });

  it('parses switch -c', () => {
    expect(parseCommand('git switch -c feature')).toEqual({
      type: 'switch',
      name: 'feature',
      create: true,
    });
  });

  it('parses reset hard HEAD~2', () => {
    expect(parseCommand('git reset --hard HEAD~2')).toEqual({
      type: 'reset',
      mode: 'hard',
      steps: 2,
    });
  });

  it('rejects unknown', () => {
    expect(parseCommand('git frobnicate').type).toBe('unknown');
  });

  it('parses push/fetch/pull/remote', () => {
    expect(parseCommand('git push origin main')).toEqual({
      type: 'push',
      branch: 'main',
      setUpstream: false,
    });
    expect(parseCommand('git fetch').type).toBe('fetch');
    expect(parseCommand('git pull')).toEqual({ type: 'pull', branch: undefined });
    expect(parseCommand('git remote -v').type).toBe('remote_list');
  });
});

describe('hash helpers', () => {
  const state = createInitialDemoState();

  it('resolves unique prefix', () => {
    expect(resolveCommitId(state, 'a11')).toBe('a11ce01');
  });

  it('checks ancestry', () => {
    expect(isAncestor(state.commits, 'a11ce01', 'c33cf03')).toBe(true);
    expect(isAncestor(state.commits, 'c33cf03', 'a11ce01')).toBe(false);
  });

  it('walks back', () => {
    expect(walkBack(state.commits, 'c33cf03', 0)).toBe('c33cf03');
    expect(walkBack(state.commits, 'c33cf03', 2)).toBe('a11ce01');
    expect(walkBack(state.commits, 'c33cf03', 5)).toBeNull();
  });
});
