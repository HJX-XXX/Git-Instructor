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
  /** 该节点所在链的所属分支名；与分支签同色 */
  colorBranch: string | null;
  /** init = 时间轴底部的 git init 锚点；缺省为真实提交 */
  kind?: 'commit' | 'init';
}

export interface LayoutEdge {
  from: CommitId;
  to: CommitId;
  kind: 'first' | 'merge' | 'init';
}

export interface GraphLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
  laneCount: number;
  /** 每条 lane 的 x 坐标，便于画竖轨 */
  laneX: number[];
  /** 每条 lane 的所属分支名（与 laneX 对齐），供竖轨与分支签同色 */
  laneBranches: (string | null)[];
  /** hash 列右对齐 x（提交编号结束位置） */
  idX: number;
  /** 提交说明列起始 x */
  msgX: number;
}

const NODE_GAP_Y = 64;
/** 泳道竖线间距：收紧，避免多分支时压到右侧 hash */
const LANE_GAP_X = 36;
const RAIL_X = 28;
/** hash 文本约 7 字符，预留列宽 */
const HASH_COL_W = 56;
/** hash 列与最右竖轨之间的安全间距 */
const HASH_RAIL_GAP = 20;
/** 默认说明列起点（lane 很少时） */
const MSG_X_MIN = 180;
/** 说明列与 HEAD/分支列之间预留宽度（HEAD 签 + 箭头 + 间距） */
const HEAD_COL_RESERVE = 130;
/** 本地分支标签列（给 HEAD 指针 + 提交说明留出空间） */
export const REF_X = 560;
/** origin/* 远程标签列（与本地分开） */
export const ORIGIN_REF_X = 800;
export const MSG_MAX_CHARS = 48;
/** 布局用的 git init 锚点（非真实 commit） */
export const INIT_NODE_ID = '__git_init__';
const PAD_TOP = 58;
const PAD_BOTTOM = 36;

function textColumnsForLanes(laneCount: number): { idX: number; msgX: number } {
  const lastRail = RAIL_X + Math.max(0, laneCount - 1) * LANE_GAP_X;
  const idX = lastRail + HASH_RAIL_GAP + HASH_COL_W;
  // 说明列不得顶到 HEAD/分支区域
  const msgXMax = Math.max(MSG_X_MIN, REF_X - HEAD_COL_RESERVE - 160);
  const msgX = Math.min(Math.max(MSG_X_MIN, idX + 16), msgXMax);
  return { idX, msgX };
}

function reachableSet(
  state: RepoState,
  _remoteBranches: Record<string, CommitId> = {},
  _remoteCommits: Record<string, import('./types').Commit> = {},
): Set<CommitId> {
  // 只绘制本地已有提交；远程最新提交的对象进本地后再连出
  const store = (id: CommitId) => state.commits[id];
  const tips: CommitId[] = [
    ...Object.values(state.branches),
    ...(headCommitId(state) ? [headCommitId(state)!] : []),
    ...Object.values(_remoteBranches).filter((id) => state.commits[id]),
  ];
  const seen = new Set<CommitId>();
  const stack = [...tips];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    const c = store(id);
    if (!c) continue;
    seen.add(id);
    for (const p of c.parents) stack.push(p);
  }
  return seen;
}

/**
 * 新提交在上。泳道按分支最新提交的 first-parent 链分配；
 * 消息统一排在图右侧固定区域，避免和节点挤在一起。
 */
export function layoutGraph(
  state: RepoState,
  remoteBranches: Record<string, CommitId> = {},
  remoteCommits: Record<string, import('./types').Commit> = {},
): GraphLayout {
  const store = (id: CommitId) => state.commits[id];
  // 未 init 且本地无提交：图主体空白（远程列由 UI 单独绘制）
  const hasLocalContent =
    state.initialized ||
    Object.keys(state.commits).length > 0 ||
    Object.keys(state.branches).length > 0;
  if (!hasLocalContent) {
    const { idX, msgX } = textColumnsForLanes(1);
    return {
      nodes: [],
      edges: [],
      width: ORIGIN_REF_X + 240,
      height: 160,
      laneCount: 1,
      laneX: [RAIL_X],
      laneBranches: [null],
      idX,
      msgX,
    };
  }
  const reach = reachableSet(state, remoteBranches, remoteCommits);
  const ids = Object.keys(state.commits)
    .filter((id) => reach.has(id) && store(id))
    .sort((a, b) => {
      const ca = store(a)!;
      const cb = store(b)!;
      return cb.createdAt - ca.createdAt || a.localeCompare(b);
    });

  const yOf = new Map<CommitId, number>();
  ids.forEach((id, index) => {
    yOf.set(id, index);
  });

  const laneOf = new Map<CommitId, number>();
  const colorBranchOf = new Map<CommitId, string | null>();
  const laneBranches: (string | null)[] = [];
  let nextLane = 0;

  // 分支泳道固定优先级：main/master 在最左，其余按名称；不因 HEAD 切换而整体换道
  const branchNames = Object.keys(state.branches).sort((a, b) => {
    const rank = (n: string) => (n === 'main' ? 0 : n === 'master' ? 1 : 2);
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });

  // 按 first-parent 链铺道；链上已有节点则不新开道，避免共享 tip 空占泳道
  const claimChain = (tip: CommitId, branch: string | null) => {
    let cur: CommitId | null = tip;
    const lane = nextLane;
    let assigned = false;
    const seen = new Set<CommitId>();
    while (cur && store(cur) && !seen.has(cur)) {
      seen.add(cur);
      if (!laneOf.has(cur)) {
        laneOf.set(cur, lane);
        colorBranchOf.set(cur, branch);
        assigned = true;
      }
      cur = store(cur)!.parents[0] ?? null;
    }
    if (assigned) {
      laneBranches[lane] = branch;
      nextLane += 1;
    }
  };

  for (const name of branchNames) {
    claimChain(state.branches[name]!, name);
  }
  const headTip = headCommitId(state);
  if (headTip && !colorBranchOf.has(headTip)) {
    claimChain(headTip, state.head.kind === 'branch' ? state.head.name : null);
  }
  // 远程跟踪链：归属到同名远程分支，便于 origin/* 与线色一致
  for (const [name, tip] of Object.entries(remoteBranches)) {
    if (store(tip) && !colorBranchOf.has(tip)) claimChain(tip, name);
  }

  for (const id of ids) {
    if (!laneOf.has(id)) {
      laneOf.set(id, nextLane);
      colorBranchOf.set(id, null);
      laneBranches[nextLane] = null;
      nextLane += 1;
    }
  }

  const laneCount = Math.max(1, nextLane);
  const laneX: number[] = [];
  for (let i = 0; i < laneCount; i += 1) {
    laneX.push(RAIL_X + i * LANE_GAP_X);
  }

  const nodes: LayoutNode[] = ids.map((id) => {
    const c = store(id)!;
    const inLocal = Boolean(state.commits[id]);
    const lane = laneOf.get(id) ?? 0;
    const branches: string[] = [];
    if (inLocal) {
      for (const name of Object.keys(state.branches)) {
        if (state.branches[name] === id) branches.push(name);
      }
    }
    const remoteList: string[] = [];
    for (const [name, tip] of Object.entries(remoteBranches)) {
      if (tip === id) remoteList.push(`origin/${name}`);
    }
    const isHead =
      inLocal &&
      ((state.head.kind === 'detached' && state.head.commitId === id) ||
        (state.head.kind === 'branch' && state.branches[state.head.name] === id));
    return {
      id,
      lane,
      x: laneX[lane] ?? RAIL_X,
      y: PAD_TOP + (yOf.get(id) ?? 0) * NODE_GAP_Y,
      message: c.message,
      branches,
      remoteBranches: remoteList,
      isHead,
      colorBranch: colorBranchOf.get(id) ?? null,
    };
  });

  const edges: LayoutEdge[] = [];
  for (const id of ids) {
    const c = store(id)!;
    c.parents.forEach((p, idx) => {
      if (!yOf.has(p)) return;
      edges.push({ from: id, to: p, kind: idx === 0 ? 'first' : 'merge' });
    });
  }

  // 原生 git init 锚点：已 init 或已有提交（clone）时出现在时间轴最下端
  const hasCommits = ids.length > 0;
  const showInitAnchor = state.initialized || hasCommits || Object.keys(remoteCommits).length > 0;
  if (showInitAnchor) {
  const initY = hasCommits ? PAD_TOP + ids.length * NODE_GAP_Y : PAD_TOP;
  const unbornBranch =
    !hasCommits && state.head.kind === 'branch' ? state.head.name : null;
  const initNode: LayoutNode = {
    id: INIT_NODE_ID,
    lane: 0,
    x: laneX[0] ?? RAIL_X,
    y: initY,
    message: 'git init',
    branches: unbornBranch ? [unbornBranch] : [],
    remoteBranches: [],
    isHead: !hasCommits,
    colorBranch: unbornBranch,
    kind: 'init',
  };
  nodes.push(initNode);

  for (const id of ids) {
    const c = store(id);
    if (c && c.parents.length === 0) {
      edges.push({ from: id, to: INIT_NODE_ID, kind: 'init' });
    }
  }
  }

  const maxY = nodes.reduce((m, n) => Math.max(m, n.y), 0);
  const { idX, msgX } = textColumnsForLanes(laneCount);

  return {
    nodes,
    edges,
    width: ORIGIN_REF_X + 240,
    height: maxY + PAD_BOTTOM,
    laneCount,
    laneX,
    laneBranches,
    idX,
    msgX,
  };
}
