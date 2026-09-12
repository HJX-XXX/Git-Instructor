import { useMemo } from 'react';
import { headCommitId } from '../engine/hash';
import type { Highlights, RepoState } from '../engine/types';
import {
  layoutGraph,
  MSG_X,
  REF_X,
  ORIGIN_REF_X,
  MSG_MAX_CHARS,
  INIT_NODE_ID,
} from '../engine/layout';

const LANE_COLORS = ['#16A34A', '#7C3AED', '#2563EB', '#D97706', '#DB2777', '#0D9488'];

export type ConceptDemoFocus = 'head' | 'branch' | 'commit' | null;

interface Props {
  state: RepoState;
  remoteBranches?: Record<string, string>;
  userLabel?: string;
  highlights?: Highlights;
  onFill?: (cmd: string) => void;
  /** 关卡导读：高亮某一概念在图上的对应元素 */
  demoFocus?: ConceptDemoFocus;
}

function tipLabel(state: RepoState): string {
  return headCommitId(state) ?? '尚无提交';
}

function sameTipNote(state: RepoState): string | null {
  if (Object.keys(state.commits).length === 0) return null;
  const byTip = new Map<string, string[]>();
  for (const [name, tip] of Object.entries(state.branches)) {
    const arr = byTip.get(tip) ?? [];
    arr.push(name);
    byTip.set(tip, arr);
  }
  for (const names of byTip.values()) {
    if (names.length > 1) {
      return `${names.join('、')} 指向同一提交，尚未各自 commit`;
    }
  }
  return null;
}

function truncateMsg(msg: string): string {
  return msg.length > MSG_MAX_CHARS ? `${msg.slice(0, MSG_MAX_CHARS)}…` : msg;
}

function estimateTextWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    // CJK / 全角
    if (code > 0x2e80) w += 13;
    else w += 7.5;
  }
  return w;
}

function pillWidth(label: string): number {
  return Math.ceil(estimateTextWidth(label) + 32);
}

export function CommitGraph({
  state,
  remoteBranches = {},
  userLabel,
  highlights,
  onFill,
  demoFocus = null,
}: Props) {
  const layout = useMemo(() => layoutGraph(state, remoteBranches), [state, remoteBranches]);
  const created = new Set(highlights?.createdCommits ?? []);
  const moved = new Set(highlights?.movedRefs ?? []);
  const commitNodes = layout.nodes.filter((n) => n.kind !== 'init');
  const empty = commitNodes.length === 0;
  const note = sameTipNote(state);

  const nodeById = useMemo(
    () => new Map(layout.nodes.map((n) => [n.id, n])),
    [layout.nodes],
  );

  const width = Math.max(layout.width, 720);
  // 高度贴合内容，避免大量空白（init 锚点已计入 layout.height）
  const height = Math.max(layout.height, empty ? 200 : 120);
  const viewBox = `0 0 ${width} ${height}`;

  const headBranch = state.head.kind === 'branch' ? state.head.name : null;
  const commitCount = commitNodes.length;

  // 当前分支在分支列表里优先显示，并标记 isCurrent
  const nodeBranches = (n: { branches: string[] }) => {
    const list = [...n.branches].sort((a, b) => {
      if (headBranch && a === headBranch) return -1;
      if (headBranch && b === headBranch) return 1;
      return a.localeCompare(b);
    });
    return list.map((b) => ({
      name: b,
      isCurrent: headBranch === b,
    }));
  };

  return (
    <div className={`graph-panel${demoFocus ? ` demo-${demoFocus}` : ''}`}>
      <div className="graph-toolbar">
        <div className="graph-title">
          <span className="graph-title-main">提交图</span>
          <span className="graph-title-sub">
            {empty
              ? '尚无提交'
              : `${userLabel ? `${userLabel} · ` : ''}${commitCount} 个提交 · ${
                  headBranch ?? 'HEAD'
                }`}
          </span>
        </div>
        <div className="graph-legend">
          <span
            className="lg"
            title="HEAD 是指针，用箭头指向当前分支；commit 只会让被指向的分支前进。"
          >
            <i className="lg-dot head" /> HEAD 指针（橙） → 当前分支
          </span>
          <span className="lg" title="其它本地分支">
            <i className="lg-dot branch" /> 其它分支
          </span>
          <span className="lg" title="共享远程上的分支（origin/xxx）">
            <i className="lg-dot remote" /> 远程分支
          </span>
          <span className="lg" title="时间轴起点：仓库初始化锚点，不是真实提交">
            <i className="lg-dot init" /> git init
          </span>
          <span className="lg">
            <i className="lg-line merge" /> 合并
          </span>
        </div>
      </div>

      {demoFocus && (
        <div className="graph-demo-bar" role="status" key={demoFocus}>
          <span className="demo-pulse" aria-hidden />
          <div className="demo-bar-text">
            {demoFocus === 'head' && (
              <>
                <span className="demo-tag">正在演示 · HEAD</span>
                <p>
                  只看<strong className="hl-orange">橙色箭头 HEAD → main</strong>
                  ：HEAD 是指针，指向当前分支 main。
                </p>
              </>
            )}
            {demoFocus === 'commit' && (
              <>
                <span className="demo-tag">正在演示 · 提交</span>
                <p>
                  看左侧<strong className="hl-green">闪烁的圆点</strong>
                  与卡片文案：每个圆点是一次 commit。
                </p>
              </>
            )}
            {demoFocus === 'branch' && (
              <>
                <span className="demo-tag">正在演示 · 分支</span>
                <p>
                  看右侧<strong className="hl-green">本地分支</strong>
                  列的
                  <strong className="hl-green">
                    {Object.keys(state.branches).join('、') || '分支名'}
                  </strong>
                  ：它们是标签，不是仓库副本。在分支上 commit，该标签才会往前挪。
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {note && <div className="graph-note">{note}</div>}

      <div className="graph-wrap" aria-label="提交图">
        <svg className="graph-svg" viewBox={viewBox} role="img">
            <text x={12} y={16} className="axis-label">
              最新
            </text>
            <text x={12} y={height - 10} className="axis-label">
              更早
            </text>
            <line x1={20} y1={28} x2={20} y2={height - 28} className="axis-line" />

            {/* 本地分支列 / 远程 origin 列分隔 */}
            <line
              x1={REF_X - 16}
              y1={36}
              x2={REF_X - 16}
              y2={Math.max(80, height - 24)}
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <line
              x1={ORIGIN_REF_X - 16}
              y1={36}
              x2={ORIGIN_REF_X - 16}
              y2={Math.max(80, height - 24)}
              stroke="#dbeafe"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text x={REF_X} y={30} className="col-label">
              本地分支
            </text>
            <text x={ORIGIN_REF_X} y={30} className="col-label origin">
              远程分支
            </text>

            {layout.laneX.map((x, i) => (
              <line
                key={`rail-${i}`}
                x1={x}
                y1={36}
                x2={x}
                y2={Math.max(80, height - 24)}
                stroke={LANE_COLORS[i % LANE_COLORS.length]!}
                strokeWidth={2}
                opacity={0.12}
              />
            ))}

            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6.5" refY="3" orient="auto">
                <path d="M0,0 L6.5,3 L0,6" fill="none" stroke="#94A3B8" strokeWidth="1.2" />
              </marker>
              <marker
                id="arrow-merge"
                markerWidth="8"
                markerHeight="8"
                refX="6.5"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L6.5,3 L0,6" fill="none" stroke="#64748B" strokeWidth="1.2" />
              </marker>
              <marker
                id="arrow-head"
                markerWidth="7"
                markerHeight="7"
                refX="5.5"
                refY="2.5"
                orient="auto"
              >
                <path d="M0,0 L5.5,2.5 L0,5" fill="none" stroke="#FB923C" strokeWidth="1.3" />
              </marker>
            </defs>

            {layout.edges.map((e) => {
              const a = nodeById.get(e.from);
              const b = nodeById.get(e.to);
              if (!a || !b) return null;
              const midY = (a.y + b.y) / 2;
              const color =
                e.kind === 'init'
                  ? '#94A3B8'
                  : e.kind === 'merge'
                    ? '#64748B'
                    : (LANE_COLORS[a.colorIndex % LANE_COLORS.length] ?? '#94A3B8');
              const d =
                a.lane === b.lane
                  ? `M ${a.x} ${a.y + 10} L ${b.x} ${b.y - 10}`
                  : `M ${a.x} ${a.y + 10} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y - 10}`;
              const dashed = e.kind === 'merge' || e.kind === 'init';
              return (
                <path
                  key={`${e.from}-${e.to}`}
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={e.kind === 'init' ? 1.4 : e.kind === 'merge' ? 1.5 : 2.2}
                  strokeDasharray={dashed ? '5 4' : undefined}
                  markerEnd={e.kind === 'first' ? 'url(#arrow)' : 'url(#arrow-merge)'}
                  opacity={e.kind === 'init' ? 0.7 : e.kind === 'merge' ? 0.85 : 0.95}
                />
              );
            })}

            {layout.nodes.map((n) => {
              const isInit = n.kind === 'init' || n.id === INIT_NODE_ID;
              const color = isInit
                ? '#64748B'
                : (LANE_COLORS[n.colorIndex % LANE_COLORS.length]!);
              const isNew = created.has(n.id);
              const msg = truncateMsg(n.message);
              const branches = nodeBranches(n);
              return (
                <g
                  key={n.id}
                  className={`graph-node${isNew ? ' is-new' : ''}${n.isHead ? ' is-head-row' : ''}${
                    isInit ? ' is-init' : ''
                  }`}
                >
                  {/* HEAD 所在行整行浅橙底，切换分支后会跟着变 */}
                  <rect
                    x={n.x - 10}
                    y={n.y - 14}
                    width={width - n.x}
                    height={28}
                    rx={6}
                    fill={n.isHead ? '#FFF7ED' : 'transparent'}
                  />
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={n.isHead ? 8 : 6.5}
                    fill={isInit ? '#F8FAFC' : color}
                    stroke={isInit ? '#94A3B8' : '#fff'}
                    strokeWidth={isInit ? 1.8 : 2.5}
                    strokeDasharray={isInit ? '3 2' : undefined}
                  />
                  {n.isHead && (
                    <circle cx={n.x} cy={n.y} r={13} fill="none" stroke="#F97316" strokeWidth="2.5" />
                  )}

                  <text x={MSG_X - 8} y={n.y + 4} className="graph-id" textAnchor="end">
                    {isInit ? 'init' : n.id}
                  </text>
                  <text x={MSG_X + 8} y={n.y + 4} className={`graph-msg${isInit ? ' is-init' : ''}`}>
                    {msg}
                  </text>

                  {/* 本地分支列：分支名独立成签；HEAD 是左侧指针，用箭头指向当前分支 */}
                  {(() => {
                    // 该节点若为 HEAD 行，保证至少渲染当前分支签 + HEAD 指针
                    // （即使 layout.branches 暂时为空，也避免 HEAD「消失」）
                    const headName =
                      state.head.kind === 'branch' ? state.head.name : null;
                    const list = [...branches];
                    if (n.isHead && headName && !list.some((b) => b.name === headName)) {
                      list.unshift({ name: headName, isCurrent: true });
                    }
                    return list.map((b, i) => {
                      const label = b.name;
                      const pw = pillWidth(label);
                      const x = REF_X;
                      const py2 = n.y - 11 + i * 26;
                      const isMoved = moved.has(b.name);
                      const showHead =
                        (b.isCurrent || (n.isHead && headName === b.name)) &&
                        state.head.kind === 'branch';
                      const headLabel = 'HEAD';
                      const hpw = pillWidth(headLabel);
                      const arrowSpace = 36;
                      const hx = x - arrowSpace - hpw;
                      const cy = py2 + 11;
                      return (
                        <g key={`${n.id}-${b.name}`}>
                          <g className={showHead ? 'head-chain' : undefined}>
                            {showHead && (
                              <g className="head-pointer">
                                <title>{`HEAD → ${b.name}（指针指向当前分支）`}</title>
                                <rect
                                  x={hx}
                                  y={py2}
                                  width={hpw}
                                  height={22}
                                  rx={11}
                                  fill="#F97316"
                                  stroke="#C2410C"
                                  strokeWidth={1}
                                />
                                <text
                                  x={hx + hpw / 2}
                                  y={py2 + 11}
                                  textAnchor="middle"
                                  dominantBaseline="central"
                                  className="ref-text"
                                  fill="#ffffff"
                                >
                                  {headLabel}
                                </text>
                                <path
                                  className="head-arrow"
                                  d={`M ${hx + hpw + 4} ${cy} L ${x - 7} ${cy}`}
                                  fill="none"
                                  stroke="#FB923C"
                                  strokeWidth={1.4}
                                  strokeLinecap="round"
                                  markerEnd="url(#arrow-head)"
                                />
                              </g>
                            )}
                            <g
                              className={`ref-badge${isMoved ? ' is-moved' : ''}${
                                showHead || b.isCurrent ? ' is-current' : ''
                              }`}
                            >
                              <title>
                                {showHead || b.isCurrent
                                  ? `分支 ${b.name}（HEAD 指向这里）`
                                  : `本地分支 ${b.name}`}
                              </title>
                              <rect
                                x={x}
                                y={py2}
                                width={pw}
                                height={22}
                                rx={11}
                                fill={showHead || b.isCurrent ? '#FFEDD5' : '#fff'}
                                stroke={showHead || b.isCurrent ? '#F97316' : color}
                                strokeWidth={showHead || b.isCurrent ? 2 : 1.6}
                              />
                              <text
                                x={x + pw / 2}
                                y={py2 + 11}
                                textAnchor="middle"
                                dominantBaseline="central"
                                className="ref-text"
                                fill={showHead || b.isCurrent ? '#C2410C' : color}
                              >
                                {label}
                              </text>
                            </g>
                          </g>
                        </g>
                      );
                    });
                  })()}

                  {/* origin/* 独立列 */}
                  {(n.remoteBranches ?? []).map((rb, i) => {
                    const pw = pillWidth(rb);
                    const x = ORIGIN_REF_X;
                    const py = n.y - 11 + i * 26;
                    return (
                      <g key={rb} className="ref-badge is-remote">
                        <title>{`共享远程 ${rb}`}</title>
                        <rect
                          x={x}
                          y={py}
                          width={pw}
                          height={22}
                          rx={11}
                          fill="#EFF6FF"
                          stroke="#3B82F6"
                          strokeWidth="1.6"
                          strokeDasharray="3 2"
                        />
                        <text
                          x={x + pw / 2}
                          y={py + 11}
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="ref-text"
                          fill="#1D4ED8"
                        >
                          {rb}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
      </div>

      <div className="graph-status">
        {headBranch ? (
          <span className="status-chip current">
            HEAD → {headBranch}
            {empty ? '（尚无提交）' : ''}
          </span>
        ) : (
          <span className="status-chip">HEAD @ {tipLabel(state)}</span>
        )}
        {!empty && onFill && headBranch && (
          <>
            {' · '}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => onFill(`git commit -m "feat: 在 ${headBranch} 上的改动"`)}
            >
              填入 commit
            </button>
          </>
        )}
      </div>
    </div>
  );
}
