import { headCommitId } from './hash';
import type { CommitId, RepoState } from './types';

export interface LayoutNode {
  id: CommitId;
  x: number;
  y: number;
  message: string;
  lane: number;
  branches: string[];
  isHead: boolean;
  reachable: boolean;
}

export interface LayoutEdge {
  from: CommitId;
  to: CommitId; // parent
  kind: 'first' | 'merge';
}

export interface GraphLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
  laneCount: number;
}

const NODE_GAP_Y = 72;
const LANE_GAP_X = 48;
const PAD_X = 56;
const PAD_Y = 40;

function reachableSet(state: RepoState): Set<CommitId> {
  const tips: CommitId[] = [
    ...Object.values(state.branches),
    ...(headCommitId(state) ? [headCommitId(state)!] : []),
  ];
  const seen = new Set<CommitId>();
  const stack = [...tips];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id) || !state.commits[id]) continue;
    seen.add(id);
    for (const p of state.commits[id]!.parents) stack.push(p);
  }
  return seen;
}

/**
 * 新提交在上：按 createdAt 降序；同层尽量稳定。
 * lane：简单 DFS 分配，尽量让历史主链保持一列。
 */
export function layoutGraph(state: RepoState): GraphLayout {
  const reach = reachableSet(state);
  const ids = Object.values(state.commits)
    .filter((c) => reach.has(c.id))
    .map((c) => c.id)
    .sort((a, b) => {
      const ca = state.commits[a]!;
      const cb = state.commits[b]!;
      return cb.createdAt - ca.createdAt || a.localeCompare(b);
    });

  const yOf = new Map<CommitId, number>();
  ids.forEach((id, index) => {
    yOf.set(id, index);
  });

  // lane assignment: main-like chain from each branch tip
  const laneOf = new Map<CommitId, number>();
  let nextLane = 0;
  const branchNames = Object.keys(state.branches).sort();
  const orderedTips: Array<{ name?: string; tip: CommitId }> = [];
  for (const name of branchNames) {
    orderedTips.push({ name, tip: state.branches[name]! });
  }
  const headTip = headCommitId(state);
  if (headTip) orderedTips.push({ tip: headTip });

  for (const { tip } of orderedTips) {
    let cur: CommitId | null = tip;
    const lane = nextLane;
    const seen = new Set<CommitId>();
    while (cur && state.commits[cur] && !seen.has(cur)) {
      seen.add(cur);
      if (!laneOf.has(cur)) {
        laneOf.set(cur, lane);
      }
      const parents: CommitId[] = state.commits[cur]!.parents;
      cur = parents[0] ?? null;
    }
    nextLane += 1;
  }

  // remaining commits (merge second parents etc.)
  for (const id of ids) {
    if (!laneOf.has(id)) {
      laneOf.set(id, nextLane);
      nextLane += 1;
    }
  }

  const laneCount = Math.max(1, nextLane);
  const nodes: LayoutNode[] = ids.map((id) => {
    const c = state.commits[id]!;
    const lane = laneOf.get(id) ?? 0;
    const branches: string[] = [];
    for (const name of Object.keys(state.branches)) {
      if (state.branches[name] === id) branches.push(name);
    }
    const isHead =
      (state.head.kind === 'detached' && state.head.commitId === id) ||
      (state.head.kind === 'branch' && state.branches[state.head.name] === id);
    return {
      id,
      lane,
      x: PAD_X + lane * LANE_GAP_X,
      y: PAD_Y + (yOf.get(id) ?? 0) * NODE_GAP_Y,
      message: c.message,
      branches,
      isHead,
      reachable: true,
    };
  });

  const edges: LayoutEdge[] = [];
  for (const id of ids) {
    const c = state.commits[id]!;
    c.parents.forEach((p, idx) => {
      if (!reach.has(p) || !yOf.has(p)) return;
      edges.push({ from: id, to: p, kind: idx === 0 ? 'first' : 'merge' });
    });
  }

  const maxY = nodes.reduce((m, n) => Math.max(m, n.y), 0);
  const maxX = nodes.reduce((m, n) => Math.max(m, n.x), 0);

  return {
    nodes,
    edges,
    width: maxX + PAD_X + 160,
    height: maxY + PAD_Y + 48,
    laneCount,
  };
}
