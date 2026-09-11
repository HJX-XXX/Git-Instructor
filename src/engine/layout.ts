import { headCommitId } from './hash';
import type { CommitId, RepoState } from './types';

export interface LayoutNode {
  id: CommitId;
  x: number;
  y: number;
  message: string;
  lane: number;
  branches: string[];
  /** origin/xxx 远程跟踪引用 */
  remoteBranches: string[];
  isHead: boolean;
  colorIndex: number;
}

export interface LayoutEdge {
  from: CommitId;
  to: CommitId;
  kind: 'first' | 'merge';
}

export interface GraphLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
  laneCount: number;
  /** 每条 lane 的 x 坐标，便于画竖轨 */
  laneX: number[];
  /** 最新在上时的节点列表（已是该顺序） */
}

const NODE_GAP_Y = 64;
const LANE_GAP_X = 56;
const RAIL_X = 28;
export const MSG_X = 180;
/** 本地分支标签列 */
export const REF_X = 480;
/** origin/* 远程标签列（与本地分开） */
export const ORIGIN_REF_X = 700;
export const MSG_MAX_CHARS = 48;
const PAD_TOP = 48;
const PAD_BOTTOM = 36;

function reachableSet(
  state: RepoState,
  remoteBranches: Record<string, CommitId> = {},
): Set<CommitId> {
  const tips: CommitId[] = [
    ...Object.values(state.branches),
    ...(headCommitId(state) ? [headCommitId(state)!] : []),
    // 已 fetch 到本地的远程 tip 也要画出来
    ...Object.values(remoteBranches).filter((id) => state.commits[id]),
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
 * 新提交在上。lane 按分支 tip 的 first-parent 链分配；
 * 消息统一排在图右侧固定区域，避免和节点挤在一起。
 */
export function layoutGraph(
  state: RepoState,
  remoteBranches: Record<string, CommitId> = {},
): GraphLayout {
  const reach = reachableSet(state, remoteBranches);
  const ids = Object.keys(state.commits)
    .filter((id) => reach.has(id) && state.commits[id])
    .sort((a, b) => {
      const ca = state.commits[a]!;
      const cb = state.commits[b]!;
      return cb.createdAt - ca.createdAt || a.localeCompare(b);
    });

  const yOf = new Map<CommitId, number>();
  ids.forEach((id, index) => {
    yOf.set(id, index);
  });

  const laneOf = new Map<CommitId, number>();
  const colorOf = new Map<CommitId, number>();
  let nextLane = 0;

  // 当前 HEAD 所在分支优先占 lane 0，便于一眼看到主链
  const branchNames = Object.keys(state.branches).sort((a, b) => {
    const headName = state.head.kind === 'branch' ? state.head.name : '';
    if (a === headName) return -1;
    if (b === headName) return 1;
    return a.localeCompare(b);
  });

  const orderedTips: CommitId[] = [];
  for (const name of branchNames) {
    orderedTips.push(state.branches[name]!);
  }
  const headTip = headCommitId(state);
  if (headTip && !orderedTips.includes(headTip)) orderedTips.push(headTip);

  for (const tip of orderedTips) {
    let cur: CommitId | null = tip;
    const lane = nextLane;
    const seen = new Set<CommitId>();
    while (cur && state.commits[cur] && !seen.has(cur)) {
      seen.add(cur);
      if (!laneOf.has(cur)) {
        laneOf.set(cur, lane);
        colorOf.set(cur, lane);
      }
      const parents: CommitId[] = state.commits[cur]!.parents;
      cur = parents[0] ?? null;
    }
    nextLane += 1;
  }

  for (const id of ids) {
    if (!laneOf.has(id)) {
      laneOf.set(id, nextLane);
      colorOf.set(id, nextLane);
      nextLane += 1;
    }
  }

  const laneCount = Math.max(1, nextLane);
  const laneX: number[] = [];
  for (let i = 0; i < laneCount; i += 1) {
    laneX.push(RAIL_X + i * LANE_GAP_X);
  }

  const nodes: LayoutNode[] = ids.map((id) => {
    const c = state.commits[id]!;
    const lane = laneOf.get(id) ?? 0;
    const branches: string[] = [];
    for (const name of Object.keys(state.branches)) {
      if (state.branches[name] === id) branches.push(name);
    }
    const remoteList: string[] = [];
    for (const [name, tip] of Object.entries(remoteBranches)) {
      if (tip === id && state.commits[id]) remoteList.push(`origin/${name}`);
    }
    const isHead =
      (state.head.kind === 'detached' && state.head.commitId === id) ||
      (state.head.kind === 'branch' && state.branches[state.head.name] === id);
    return {
      id,
      lane,
      x: laneX[lane] ?? RAIL_X,
      y: PAD_TOP + (yOf.get(id) ?? 0) * NODE_GAP_Y,
      message: c.message,
      branches,
      remoteBranches: remoteList,
      isHead,
      colorIndex: colorOf.get(id) ?? 0,
    };
  });

  const edges: LayoutEdge[] = [];
  for (const id of ids) {
    const c = state.commits[id]!;
    c.parents.forEach((p, idx) => {
      if (!yOf.has(p)) return;
      edges.push({ from: id, to: p, kind: idx === 0 ? 'first' : 'merge' });
    });
  }

  const maxY = nodes.reduce((m, n) => Math.max(m, n.y), 0);

  return {
    nodes,
    edges,
    width: ORIGIN_REF_X + 240,
    height: maxY + PAD_BOTTOM,
    laneCount,
    laneX,
  };
}
