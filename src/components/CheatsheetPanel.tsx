import { useMemo, useState } from 'react';
import { CHEAT_CATEGORIES, filterCheats } from '../data/cheatsheet';

interface Props {
  onFill: (cmd: string) => void;
}

export function CheatsheetPanel({ onFill }: Props) {
  const [query, setQuery] = useState('');
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

  return (
    <aside className="panel cheatsheet">
      <header className="panel-head">
        <h2>速查提示</h2>
        <p>点选填入终端，改参数后回车</p>
      </header>
      <input
        className="search"
        placeholder="搜索：merge / 回退 / 分支…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="搜索速查命令"
      />
      <div className="cheat-scroll">
        {grouped.map((g) => (
          <section key={g.category} className="cheat-group">
            <h3>{g.category}</h3>
            {g.items.map((item) => (
              <article key={item.id} className="cheat-card">
                <div className="cheat-title">{item.title}</div>
                <code className="cheat-syntax">{item.syntax}</code>
                <p className="cheat-summary">{item.summary}</p>
                <button type="button" className="btn-ghost" onClick={() => onFill(item.fill ?? item.syntax)}>
                  填入终端
                </button>
              </article>
            ))}
          </section>
        ))}
        {grouped.length === 0 && <p className="empty">没有匹配的命令</p>}
      </div>
    </aside>
  );
}
