import { useEffect, useRef, useState } from 'react';
import type { Explanation } from '../engine/types';

interface Props {
  explanation: Explanation | null;
  onFill: (cmd: string) => void;
}

export function ExplanationPanel({ explanation, onFill }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const prevKey = useRef<string | null>(null);
  const key = explanation ? explanation.title + explanation.summary : '';

  useEffect(() => {
    if (key === prevKey.current) return;
    prevKey.current = key;
    if (collapsed) setHasNew(true);
  }, [key, collapsed]);

  if (collapsed) {
    return (
      <aside className="panel explanation is-collapsed" aria-label="刚刚发生了什么（已收纳）">
        <button
          type="button"
          className="explain-rail"
          title="展开「刚刚发生了什么」"
          onClick={() => {
            setCollapsed(false);
            setHasNew(false);
          }}
        >
          <span className={`explain-rail-dot${hasNew ? ' is-new' : ''}`} aria-hidden />
          <span className="explain-rail-text">讲解</span>
          <span className="explain-rail-chevron" aria-hidden>
            ‹
          </span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="panel explanation">
      <header className="panel-head">
        <div className="panel-head-row">
          <div>
            <h2>刚刚发生了什么</h2>
            <p>命令执行后的中文讲解</p>
          </div>
          <button
            type="button"
            className="btn-mini"
            title="收纳本栏"
            onClick={() => setCollapsed(true)}
          >
            收起
          </button>
        </div>
      </header>
      <div className="explain-scroll">
        {!explanation ? (
          <div className="explain-empty">
            <p>在中间下方终端输入命令，或从左侧速查填入后执行。</p>
            <p className="muted">建议先试：</p>
            <code className="inline-code">git switch -c feature</code>
          </div>
        ) : (
          <div className="explain-body" key={explanation.title + explanation.summary}>
            <h3 className="explain-title">{explanation.title}</h3>
            <p className="explain-summary">{explanation.summary}</p>
            {explanation.detail && <p className="explain-detail">{explanation.detail}</p>}
            {explanation.related && explanation.related.length > 0 && (
              <div className="explain-related">
                <span>相关命令</span>
                <div className="related-list">
                  {explanation.related.map((r) => (
                    <button key={r} type="button" className="chip" onClick={() => onFill(r)}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
