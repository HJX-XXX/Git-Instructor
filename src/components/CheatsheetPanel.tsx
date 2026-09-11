import { useMemo, useState } from 'react';
import { CHEAT_CATEGORIES, filterCheats } from '../data/cheatsheet';

interface Props {
  onFill: (cmd: string) => void;
}

export function CheatsheetPanel({ onFill }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    // 默认只展开「查询」，其余收起，减少视觉噪音
    const init: Record<string, boolean> = {};
    for (const c of CHEAT_CATEGORIES) init[c] = c === '查询';
    return init;
  });

  const items = useMemo(() => filterCheats(query), [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return CHEAT_CATEGORIES.map((c) => ({ category: c, items: map.get(c) ?? [] })).filter(
      (g) => g.items.length > 0,
    );
  }, [items]);

  const searching = query.trim().length > 0;

  const toggle = (category: string) => {
    setOpen((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const expandAll = () => {
    setOpen(Object.fromEntries(CHEAT_CATEGORIES.map((c) => [c, true])));
  };

  const collapseAll = () => {
    setOpen(Object.fromEntries(CHEAT_CATEGORIES.map((c) => [c, false])));
  };

  return (
    <aside className="panel cheatsheet">
      <header className="panel-head">
        <div className="panel-head-row">
          <div>
            <h2>速查提示</h2>
            <p>点分类展开，一键填入终端</p>
          </div>
          <div className="panel-head-actions">
            <button type="button" className="btn-mini" onClick={expandAll}>
              全部
            </button>
            <button type="button" className="btn-mini" onClick={collapseAll}>
              收起
            </button>
          </div>
        </div>
      </header>
      <input
        className="search"
        placeholder="搜索：merge / 回退 / 分支…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="搜索速查命令"
      />
      <div className="cheat-scroll">
        {grouped.map((g) => {
          const isOpen = searching || open[g.category] !== false;
          return (
            <section key={g.category} className={`cheat-group${isOpen ? ' is-open' : ''}`}>
              <button
                type="button"
                className="cheat-group-toggle"
                onClick={() => toggle(g.category)}
                aria-expanded={isOpen}
              >
                <span className="chev" aria-hidden>
                  {isOpen ? '▾' : '▸'}
                </span>
                <span className="cheat-group-title">{g.category}</span>
                <span className="cheat-count">{g.items.length}</span>
              </button>
              {isOpen && (
                <div className="cheat-group-body">
                  {g.items.map((item) => (
                    <article key={item.id} className="cheat-card">
                      <div className="cheat-title">{item.title}</div>
                      <code className="cheat-syntax">{item.syntax}</code>
                      <p className="cheat-summary">{item.summary}</p>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => onFill(item.fill ?? item.syntax)}
                      >
                        填入终端
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          );
        })}
        {grouped.length === 0 && <p className="empty">没有匹配的命令</p>}
      </div>
    </aside>
  );
}
