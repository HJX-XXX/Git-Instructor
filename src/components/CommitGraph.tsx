import { useMemo } from 'react';
import { headCommitId } from '../engine/hash';
import type { Highlights, RepoState } from '../engine/types';
import { layoutGraph, MSG_X, REF_X, MSG_MAX_CHARS } from '../engine/layout';

const LANE_COLORS = ['#16A34A', '#7C3AED', '#2563EB', '#D97706', '#DB2777', '#0D9488'];

interface Props {
  state: RepoState;
  remoteBranches?: Record<string, string>;
  userLabel?: string;
  highlights?: Highlights;
  onFill?: (cmd: string) => void;
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
      return `分支 ${names.join('、')} 指向同一提交——通常表示还没有在其中一个分支上单独 commit。`;
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
}: Props) {
  const layout = useMemo(() => layoutGraph(state, remoteBranches), [state, remoteBranches]);
  const created = new Set(highlights?.createdCommits ?? []);
  const moved = new Set(highlights?.movedRefs ?? []);
  const empty = layout.nodes.length === 0;
  const note = sameTipNote(state);

  const nodeById = useMemo(
    () => new Map(layout.nodes.map((n) => [n.id, n])),
    [layout.nodes],
  );

  const width = Math.max(layout.width, 860);
  const height = Math.max(layout.height, 280);
  const viewBox = `0 0 ${width} ${height}`;

  const headBranch = state.head.kind === 'branch' ? state.head.name : null;
  const commitCount = Object.keys(state.commits).length;

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
    <div className="graph-panel">
      <div className="graph-toolbar">
        <div className="graph-title">
          <span className="graph-title-main">提交图</span>
          <span className="graph-title-sub">
            {empty
              ? '空仓库 · 先 commit 产生第一个点'
              : `${userLabel ? `${userLabel} · ` : ''}${commitCount} 个提交 · 上新下旧 · ${
                  headBranch ? `当前分支 ${headBranch}` : `HEAD @ ${tipLabel(state)}`
                }`}
          </span>
        </div>
        <div className="graph-legend">
          <span
            className="lg"
            title="HEAD = 你此刻站在哪条分支。橙环 + 右侧橙色标签 = 当前分支；git commit 只会让它前进。"
          >
            <i className="lg-dot head" /> HEAD / 当前分支（橙色）
          </span>
          <span className="lg" title="其它本地分支">
            <i className="lg-dot branch" /> 其它分支
          </span>
          <span className="lg" title="共享远程 origin 上的分支">
            <i className="lg-dot remote" /> origin/*
          </span>
          <span className="lg">
            <i className="lg-line merge" /> 合并
          </span>
        </div>
      </div>

      {headBranch && (
        <div className="graph-head-explain">
          右侧<strong>橙色标签</strong>（以及节点橙环）表示 <strong>HEAD</strong>
          所在的分支——你此刻站在上面；下一次 <code>git commit</code> 只会让它前进。其它分支为白底描边。
        </div>
      )}

      {note && <div className="graph-note">{note}</div>}

      <div className="graph-wrap" aria-label="提交图">
        {empty && (
          <div className="graph-empty">
            <div className="graph-empty-card">
              <h3>这里是空白仓库</h3>
              <p>
                打开时没有预置历史。每个圆点 = 一次<strong>提交</strong>；分支名 =
                指向提交的标签；<strong>HEAD</strong> = 你当前站在哪条分支。
              </p>
              <div className="graph-empty-actions">
                <button
                  type="button"
                  className="chip"
                  onClick={() => onFill?.('git commit -m "init: 第一次提交"')}
                >
                  git commit -m &quot;init: 第一次提交&quot;
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() => onFill?.('git switch -c feature')}
                >
                  git switch -c feature
                </button>
              </div>
              <p className="graph-empty-hint">在分支上「改动」= 切到该分支后再 commit。</p>
            </div>
          </div>
        )}

        {!empty && (
          <svg className="graph-svg" viewBox={viewBox} role="img">
            <text x={12} y={18} className="axis-label">
              最新
            </text>
            <text x={12} y={height - 10} className="axis-label">
              更早
            </text>
            <line x1={20} y1={28} x2={20} y2={height - 28} className="axis-line" />

            {/* 分支标签列分隔线，视觉分区 */}
            <line
              x1={REF_X - 16}
              y1={36}
              x2={REF_X - 16}
              y2={Math.max(80, height - 24)}
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray="4 4"
            />

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
            </defs>

            {layout.edges.map((e) => {
              const a = nodeById.get(e.from);
              const b = nodeById.get(e.to);
              if (!a || !b) return null;
              const midY = (a.y + b.y) / 2;
              const color =
                e.kind === 'merge'
                  ? '#64748B'
                  : (LANE_COLORS[a.colorIndex % LANE_COLORS.length] ?? '#94A3B8');
              const d =
                a.lane === b.lane
                  ? `M ${a.x} ${a.y + 10} L ${b.x} ${b.y - 10}`
                  : `M ${a.x} ${a.y + 10} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y - 10}`;
              return (
                <path
                  key={`${e.from}-${e.to}`}
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={e.kind === 'merge' ? 1.5 : 2.2}
                  strokeDasharray={e.kind === 'merge' ? '5 4' : undefined}
                  markerEnd={e.kind === 'merge' ? 'url(#arrow-merge)' : 'url(#arrow)'}
                  opacity={e.kind === 'merge' ? 0.85 : 0.95}
                />
              );
            })}

            {layout.nodes.map((n) => {
              const color = LANE_COLORS[n.colorIndex % LANE_COLORS.length]!;
              const isNew = created.has(n.id);
              const msg = truncateMsg(n.message);
              const branches = nodeBranches(n);
              return (
                <g key={n.id} className={`graph-node${isNew ? ' is-new' : ''}${n.isHead ? ' is-head-row' : ''}`}>
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
                    fill={color}
                    stroke="#fff"
                    strokeWidth={2.5}
                  />
                  {n.isHead && (
                    <circle cx={n.x} cy={n.y} r={13} fill="none" stroke="#F97316" strokeWidth="2.5" />
                  )}

                  <text x={MSG_X - 8} y={n.y + 4} className="graph-id" textAnchor="end">
                    {n.id}
                  </text>
                  <text x={MSG_X + 8} y={n.y + 4} className="graph-msg">
                    {msg}
                  </text>

                  {/* 分支标签：当前分支用唯一橙色高亮，文案为 HEAD · 分支名 */}
                  {branches.map((b, i) => {
                    const label = b.isCurrent ? `HEAD · ${b.name}` : b.name;
                    const pw = pillWidth(label);
                    const py = n.y - 11 - i * 26;
                    const isMoved = moved.has(b.name);
                    return (
                      <g
                        key={b.name}
                        className={`ref-badge${isMoved ? ' is-moved' : ''}${b.isCurrent ? ' is-current' : ''}`}
                      >
                        <title>
                          {b.isCurrent
                            ? `HEAD → ${b.name}：你当前所在的分支`
                            : `本地分支 ${b.name}`}
                        </title>
                        <rect
                          x={REF_X}
                          y={py}
                          width={pw}
                          height={22}
                          rx={11}
                          fill={b.isCurrent ? '#F97316' : '#fff'}
                          stroke={b.isCurrent ? '#C2410C' : color}
                          strokeWidth={b.isCurrent ? 0 : 1.8}
                        />
                        <text
                          x={REF_X + pw / 2}
                          y={py + 11}
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="ref-text"
                          fill={b.isCurrent ? '#ffffff' : color}
                        >
                          {label}
                        </text>
                      </g>
                    );
                  })}

                  {/* 远程跟踪引用 origin/* */}
                  {(n.remoteBranches ?? []).map((rb, i) => {
                    const py = n.y - 11 - (branches.length + i) * 26;
                    const pw = pillWidth(rb);
                    return (
                      <g key={rb} className="ref-badge is-remote">
                        <rect
                          x={REF_X}
                          y={py}
                          width={pw}
                          height={22}
                          rx={11}
                          fill="#EFF6FF"
                          stroke="#3B82F6"
                          strokeWidth="1.5"
                          strokeDasharray="3 2"
                        />
                        <text
                          x={REF_X + pw / 2}
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
        )}
      </div>

      {!empty && (
        <div className="graph-status">
          {headBranch ? (
            <>
              <span className="status-chip current">当前分支 {headBranch}</span>
              {' · '}
              HEAD 指向它 · 下一次 <code>git commit</code> 只会让 <strong>{headBranch}</strong>{' '}
              变长
            </>
          ) : (
            <span className="status-chip">HEAD 游离于 {tipLabel(state)}</span>
          )}
          {onFill && headBranch && (
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
      )}
    </div>
  );
}
