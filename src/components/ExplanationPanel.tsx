import type { Explanation } from '../engine/types';

interface Props {
  explanation: Explanation | null;
  onFill: (cmd: string) => void;
}

export function ExplanationPanel({ explanation, onFill }: Props) {
  return (
    <aside className="panel explanation">
      <header className="panel-head">
        <h2>刚刚发生了什么</h2>
        <p>命令执行后的中文讲解</p>
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
