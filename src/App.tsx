import { useCallback, useEffect, useRef, useState } from 'react';
import { applyCommand } from './engine/apply';
import { createInitialDemoState } from './engine/demo';
import type { CommandResult, Explanation, Highlights, RepoState } from './engine/types';
import { CheatsheetPanel } from './components/CheatsheetPanel';
import { CommitGraph } from './components/CommitGraph';
import { ExplanationPanel } from './components/ExplanationPanel';
import { TerminalPanel } from './components/TerminalPanel';
import { TopBar } from './components/TopBar';

interface TermLine {
  text: string;
  kind: 'in' | 'out' | 'err';
}

const WELCOME: TermLine[] = [
  { text: 'Git 可视化教学沙箱已就绪。当前为演示仓库（main × 3 commits）。', kind: 'out' },
  { text: '输入 help 查看命令，或从左侧「速查提示」填入。', kind: 'out' },
];

export default function App() {
  const [state, setState] = useState<RepoState>(() => createInitialDemoState());
  const [lines, setLines] = useState<TermLine[]>(WELCOME);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [highlights, setHighlights] = useState<Highlights | undefined>(undefined);
  const [showHelp, setShowHelp] = useState(true);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const branchLabel =
    state.head.kind === 'branch' ? `分支 ${state.head.name}` : `游离 HEAD ${state.head.commitId}`;

  const run = useCallback((raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;
    const result: CommandResult = applyCommand(state, cmd);
    setHistory((h) => [...h, cmd]);
    setHistIdx(-1);
    setLines((prev) => [
      ...prev,
      { text: cmd, kind: 'in' },
      ...result.stdout.map((t) => ({ text: t, kind: result.ok ? ('out' as const) : ('err' as const) })),
    ]);
    if (result.ok) {
      setState(result.state);
      setHighlights(result.highlights);
    } else {
      // 保留原 state
      setHighlights(undefined);
    }
    setExplanation(result.explanation);
    setInput('');
  }, [state]);

  const onSubmit = useCallback(() => {
    run(input);
  }, [input, run]);

  const onFill = useCallback((cmd: string) => {
    setInput(cmd);
    inputRef.current?.focus();
  }, []);

  const onHistory = useCallback(
    (dir: -1 | 1) => {
      if (history.length === 0) return;
      let next = histIdx === -1 ? history.length - 1 : histIdx + dir;
      if (next < 0) next = 0;
      if (next >= history.length) {
        setHistIdx(-1);
        setInput('');
        return;
      }
      setHistIdx(next);
      setInput(history[next] ?? '');
    },
    [history, histIdx],
  );

  const onReset = useCallback(() => {
    setState(createInitialDemoState());
    setLines([
      ...WELCOME,
      { text: '沙箱已重置为初始演示仓库。', kind: 'out' },
    ]);
    setExplanation(null);
    setHighlights(undefined);
    setInput('');
    setHistory((h) => [...h, '__reset__']);
    setHistIdx(-1);
  }, []);

  useEffect(() => {
    const el = bodyRef.current?.querySelector('.terminal-body');
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div className="app">
      <TopBar
        branch={branchLabel}
        onReset={onReset}
        showHelp={showHelp}
        onToggleHelp={() => setShowHelp((v) => !v)}
      />
      {showHelp && (
        <div className="howto">
          <strong>怎么用：</strong>
          在下方终端输入 Git 命令 → 中间观察分支图变化 → 右侧阅读讲解。
          左侧速查可点「填入终端」。可尝试：{' '}
          <code>git switch -c feature</code> →{' '}
          <code>git commit -m &quot;feat: work&quot;</code> →{' '}
          <code>git switch main</code> → <code>git merge feature</code>
        </div>
      )}
      <div className="layout">
        <CheatsheetPanel onFill={onFill} />
        <main className="center" ref={bodyRef}>
          <CommitGraph state={state} highlights={highlights} />
          <TerminalPanel
            lines={lines}
            input={input}
            onInputChange={setInput}
            onSubmit={onSubmit}
            onHistory={onHistory}
            inputRef={inputRef}
          />
        </main>
        <ExplanationPanel explanation={explanation} onFill={onFill} />
      </div>
    </div>
  );
}
