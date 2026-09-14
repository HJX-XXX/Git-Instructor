import type { CommitId, RepoState } from './types';

/** 教学用模拟短 hash，形如 a11ce01 / e55ab05，避免出现 1000001 这类顺号 */
const HEX = '0123456789abcdef';

export function shortHashFromSeq(seq: number): CommitId {
  const n = Math.max(0, Math.floor(seq));
  const a = HEX[10 + (n % 6)]!; // a-f
  const d = String(n % 10);
  const b = HEX[10 + ((n + 1) % 6)]!;
  const mid = HEX[(n + 8) % 16]!;
  const e = HEX[10 + ((n + 3) % 6)]!;
  const last = String((n + 2) % 10);
  return `${a}${d}${d}${b}${mid}${e}${last}`;
}

/** 在仓库中按前缀解析唯一 commit id；失败返回 null */
export function resolveCommitId(state: RepoState, ref: string): CommitId | null {
  if (!ref) return null;
  if (ref === 'HEAD') return headCommitId(state);

  const lower = ref.toLowerCase();
  if (state.commits[lower]) return lower;

  const matches = Object.keys(state.commits).filter((id) => id.startsWith(lower));
  if (matches.length === 1) return matches[0]!;
  return null;
}

export function headCommitId(state: RepoState): CommitId | null {
  if (state.head.kind === 'detached') return state.head.commitId;
  return state.branches[state.head.name] ?? null;
}

/** 是否能从 tips 集合到达 commit */
export function isReachable(
  commits: RepoState['commits'],
  tips: CommitId[],
  target: CommitId,
): boolean {
  const seen = new Set<CommitId>();
  const stack = [...tips];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    if (id === target) return true;
    seen.add(id);
    const c = commits[id];
    if (!c) continue;
    for (const p of c.parents) stack.push(p);
  }
  return false;
}

/** from 是否为 to 的祖先（或相等） */
export function isAncestor(
  commits: RepoState['commits'],
  ancestor: CommitId,
  descendant: CommitId,
): boolean {
  if (ancestor === descendant) return true;
  return isReachable(commits, [descendant], ancestor);
}

/** 从 tip 回溯 n 步（0 = tip 本身） */
export function walkBack(commits: RepoState['commits'], tip: CommitId, steps: number): CommitId | null {
  let cur: CommitId | null = tip;
  for (let i = 0; i < steps; i += 1) {
    if (!cur) return null;
    const c: { parents: CommitId[] } | undefined = commits[cur];
    cur = c && c.parents.length > 0 ? c.parents[0]! : null;
  }
  return cur;
}

/** 仅沿 first-parent 回溯可到达的 id 列表（含 tip） */
export function firstParentChain(commits: RepoState['commits'], tip: CommitId): CommitId[] {
  const out: CommitId[] = [];
  const seen = new Set<CommitId>();
  let cur: CommitId | null = tip;
  while (cur && commits[cur] && !seen.has(cur)) {
    out.push(cur);
    seen.add(cur);
    const parents: CommitId[] = commits[cur]!.parents;
    cur = parents.length > 0 ? parents[0]! : null;
  }
  return out;
}
