import type { ParsedCommand, ResetMode } from './types';

/** 支持双引号/单引号参数的简单 tokenizer */
export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const n = input.length;
  while (i < n) {
    while (i < n && /\s/.test(input[i]!)) i += 1;
    if (i >= n) break;
    const ch = input[i]!;
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i += 1;
      let buf = '';
      while (i < n && input[i] !== quote) {
        if (input[i] === '\\' && i + 1 < n) {
          buf += input[i + 1];
          i += 2;
        } else {
          buf += input[i];
          i += 1;
        }
      }
      if (i < n && input[i] === quote) i += 1;
      tokens.push(buf);
    } else {
      let buf = '';
      while (i < n && !/\s/.test(input[i]!)) {
        buf += input[i];
        i += 1;
      }
      tokens.push(buf);
    }
  }
  return tokens;
}

const RESET_FLAGS = new Set(['--soft', '--mixed', '--hard']);

function parseHeadSteps(arg: string): number | null {
  // HEAD~n / HEAD^n / HEAD
  if (arg === 'HEAD') return 0;
  const m = /^HEAD(?:~|\^)(\d+)$/.exec(arg);
  if (m) return Number(m[1]);
  // bare number like ~2 is not supported; hash handled by caller
  return null;
}

export function parseCommand(rawInput: string): ParsedCommand {
  const raw = rawInput.trim();
  if (!raw) {
    return { type: 'unknown', raw, hint: '请输入 Git 命令，例如：git commit -m "修复 bug"' };
  }

  let tokens = tokenize(raw);
  if (tokens[0] === 'git') tokens = tokens.slice(1);
  if (tokens.length === 0) {
    return { type: 'unknown', raw, hint: '只输入了 git，请跟子命令，例如 git status' };
  }

  const cmd = tokens[0]!.toLowerCase();
  const rest = tokens.slice(1);

  if (cmd === 'help') return { type: 'help' };
  if (cmd === 'status') return { type: 'status' };

  if (cmd === 'log') {
    const oneline = rest.includes('--oneline');
    return { type: 'log', oneline };
  }

  if (cmd === 'commit') {
    let message = '';
    for (let i = 0; i < rest.length; i += 1) {
      const a = rest[i]!;
      if (a === '-m' || a === '--message') {
        message = rest[i + 1] ?? '';
        i += 1;
      }
    }
    if (!message) {
      return { type: 'unknown', raw, hint: '请使用 git commit -m "提交说明"' };
    }
    return { type: 'commit', message };
  }

  if (cmd === 'branch') {
    const isD = rest.includes('-d') || rest.includes('-D');
    const names = rest.filter((a) => !a.startsWith('-'));
    if (isD) {
      const name = names[0];
      if (!name) return { type: 'unknown', raw, hint: '用法：git branch -d <分支名>' };
      return { type: 'branch_delete', name, force: rest.includes('-D') };
    }
    const name = names[0];
    if (!name) return { type: 'unknown', raw, hint: '用法：git branch <分支名> 或 git branch -d <分支名>' };
    return { type: 'branch_create', name };
  }

  if (cmd === 'switch' || cmd === 'checkout') {
    const create = rest.includes('-c') || rest.includes('-b');
    const names = rest.filter((a) => !a.startsWith('-'));
    const name = names[0];
    if (!name) {
      return {
        type: 'unknown',
        raw,
        hint: `用法：git ${cmd} <分支名> 或 git ${cmd} ${cmd === 'switch' ? '-c' : '-b'} <新分支名>`,
      };
    }
    return { type: 'switch', name, create };
  }

  if (cmd === 'merge') {
    const names = rest.filter((a) => !a.startsWith('-'));
    const name = names[0];
    if (!name) return { type: 'unknown', raw, hint: '用法：git merge <分支名>' };
    return { type: 'merge', name };
  }

  if (cmd === 'reset') {
    let mode: ResetMode = 'mixed';
    let steps = 0;
    let sawTarget = false;
    for (const a of rest) {
      if (a === '--soft') mode = 'soft';
      else if (a === '--mixed') mode = 'mixed';
      else if (a === '--hard') mode = 'hard';
      else if (RESET_FLAGS.has(a)) {
        /* already handled */
      } else if (a.startsWith('HEAD')) {
        const s = parseHeadSteps(a);
        if (s === null) {
          return { type: 'unknown', raw, hint: '暂支持 git reset --soft|--mixed|--hard HEAD~n' };
        }
        steps = s;
        sawTarget = true;
      } else if (/^\d+$/.test(a)) {
        // rare: git reset --hard 2 → treat as HEAD~2? No, keep explicit
        return { type: 'unknown', raw, hint: '请写成 HEAD~n，例如 git reset --hard HEAD~2' };
      }
    }
    if (!sawTarget) {
      return {
        type: 'unknown',
        raw,
        hint: '请指定目标，例如 git reset --hard HEAD~2',
      };
    }
    return { type: 'reset', mode, steps };
  }

  if (cmd === 'revert') {
    const names = rest.filter((a) => !a.startsWith('-'));
    const target = names[0] ?? 'HEAD';
    return { type: 'revert', target };
  }

  if (cmd === 'rebase') {
    const names = rest.filter((a) => !a.startsWith('-'));
    // git rebase origin <branch> / git rebase origin/<branch> / git rebase <branch>
    if (names[0] === 'origin' && names[1]) {
      return { type: 'rebase', target: `origin/${names[1]}` };
    }
    const target = names[0];
    if (!target) {
      return {
        type: 'unknown',
        raw,
        hint: '用法：git rebase <分支> 或 git rebase origin/<远程分支>',
      };
    }
    return { type: 'rebase', target };
  }

  if (cmd === 'push') {
    const setUpstream = rest.includes('-u') || rest.includes('--set-upstream');
    // git push / git push origin / git push origin main / git push -u origin main
    const names = rest.filter((a) => !a.startsWith('-') && a !== 'origin');
    const branch = names[0];
    return { type: 'push', branch, setUpstream };
  }

  if (cmd === 'fetch') {
    return { type: 'fetch' };
  }

  if (cmd === 'pull') {
    const names = rest.filter((a) => !a.startsWith('-') && a !== 'origin');
    return { type: 'pull', branch: names[0] };
  }

  if (cmd === 'remote') {
    if (rest.includes('-v') || rest.length === 0) return { type: 'remote_list' };
    return { type: 'remote_list' };
  }

  if (cmd === 'init') {
    return { type: 'init' };
  }

  if (cmd === 'clone') {
    const names = rest.filter((a) => !a.startsWith('-'));
    return { type: 'clone', url: names[0] };
  }

  if (cmd === 'add') {
    const all = rest.length === 0 || rest.includes('.') || rest.includes('-A') || rest.includes('--all');
    return { type: 'add', all };
  }

  if (cmd === 'diff') {
    const staged = rest.includes('--staged') || rest.includes('--cached');
    return { type: 'diff', staged };
  }

  if (cmd === 'restore') {
    const staged = rest.includes('--staged');
    return { type: 'restore', staged };
  }

  if (cmd === 'stash') {
    const sub = rest.find((a) => !a.startsWith('-'));
    if (sub === 'pop') return { type: 'stash', action: 'pop' };
    if (sub === 'list') return { type: 'stash', action: 'list' };
    return { type: 'stash', action: 'push' };
  }

  if (cmd === 'cherry-pick') {
    const names = rest.filter((a) => !a.startsWith('-'));
    const target = names[0] ?? 'HEAD';
    return { type: 'cherry_pick', target };
  }

  return {
    type: 'unknown',
    raw,
    hint: `暂不支持命令「${cmd}」。可先输入 help 查看支持列表。`,
  };
}
