import { useMemo } from 'react';
import type { Highlights, RepoState } from '../engine/types';
import { layoutGraph } from '../engine/layout';

const LANE_COLORS = ['#22C55E', '#8B5CF6', '#3B82F6', '#F59E0B', '#EC4899', '#14B8A6'];

interface Props {
  state: RepoState;
  highlights?: Highlights;
}

export function CommitGraph({ state, highlights }: Props) {
  const layout = useMemo(() => layoutGraph(state), [state]);
  const created = new Set(highlights?.createdCommits ?? []);
  const moved = new Set(highlights?.movedRefs ?? []);

  const nodeById = useMemo(() => {
    const m = new Map(layout.nodes.map((n) => [n.id, n]));
    return m;
  }, [layout.nodes]);

  const viewBox = `0 0 ${Math.max(layout.width, 640)} ${Math.max(layout.height, 360)}`;

  return (
    <div className="graph-wrap" aria-label="提交图">
      <svg className="graph-svg" viewBox={viewBox} role="img">
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6" fill="none" stroke="#94A3B8" strokeWidth="1.2" />
          </marker>
        </defs>

        {layout.edges.map((e) => {
          const a = nodeById.get(e.from);
          const b = nodeById.get(e.to);
          if (!a || !b) return null;
          const midY = (a.y + b.y) / 2;
          const d =
            a.lane === b.lane
              ? `M ${a.x} ${a.y + 14} L ${b.x} ${b.y - 14}`
              : `M ${a.x} ${a.y + 14} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y - 14}`;
          return (
            <path
              key={`${e.from}-${e.to}`}
              d={d}
              fill="none"
              stroke={e.kind === 'merge' ? '#94A3B8' : '#CBD5E1'}
              strokeWidth={e.kind === 'merge' ? 1.6 : 1.8}
              strokeDasharray={e.kind === 'merge' ? '4 3' : undefined}
              markerEnd="url(#arrow)"
              className="graph-edge"
            />
          );
        })}

        {layout.nodes.map((n) => {
          const color = LANE_COLORS[n.lane % LANE_COLORS.length]!;
          const isNew = created.has(n.id);
          return (
            <g key={n.id} className={`graph-node${isNew ? ' is-new' : ''}`}>
              <circle
                cx={n.x}
                cy={n.y}
                r={n.isHead ? 11 : 9}
                fill={color}
                stroke={n.isHead ? '#F97316' : '#fff'}
                strokeWidth={n.isHead ? 3 : 2}
              />
              {n.isHead && (
                <circle cx={n.x} cy={n.y} r={15} fill="none" stroke="#F97316" strokeWidth="1.5" opacity="0.45" />
              )}
              <text x={n.x + 18} y={n.y + 4} className="graph-msg">
                {n.message.length > 28 ? `${n.message.slice(0, 28)}…` : n.message}
              </text>
              <text x={n.x + 18} y={n.y + 18} className="graph-id">
                {n.id}
              </text>

              {n.branches.map((b, i) => (
                <g key={b} className={`ref-badge${moved.has(b) ? ' is-moved' : ''}`}>
                  <rect
                    x={n.x - 8}
                    y={n.y - 36 - i * 22}
                    width={Math.max(48, b.length * 10 + 16)}
                    height={18}
                    rx={9}
                    fill="#fff"
                    stroke="#8B5CF6"
                    strokeWidth="1.5"
                  />
                  <text
                    x={n.x + (Math.max(48, b.length * 10 + 16) - 16) / 2}
                    y={n.y - 23 - i * 22}
                    textAnchor="middle"
                    className="ref-text"
                  >
                    {b}
                  </text>
                </g>
              ))}

              {n.isHead && (
                <g className={`ref-badge head-badge${highlights?.newHead ? ' is-moved' : ''}`}>
                  <rect
                    x={n.x + 18}
                    y={n.y - 56}
                    width={54}
                    height={18}
                    rx={9}
                    fill="#FFF7ED"
                    stroke="#F97316"
                    strokeWidth="1.5"
                  />
                  <text x={n.x + 45} y={n.y - 43} textAnchor="middle" className="head-text">
                    HEAD
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
