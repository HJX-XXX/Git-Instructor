import { useCallback, useEffect, useRef, useState } from 'react';
import type { Explanation, Highlights, UserId } from './engine/types';
import {
  activeRepo,
  applyWorldCommand,
  createEmptyWorld,
  createDemoWorld,
  switchUser,
  USER_META,
  visibleRemoteRefs,
} from './engine/world';
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
  { text: '双用户协作沙箱已就绪。当前：Alice · 空白本地仓库 · 共享远程 origin 为空。', kind: 'out' },
  { text: '练习：Alice commit → push → 顶栏切到 Bob → fetch/pull 查看。', kind: 'out' },
  { text: '也可 git switch -c feature 在分支上开发；user alice|user bob 切换用户。', kind: 'out' },
];

export default function App() {
  const [world, setWorld] = useState(() => createEmptyWorld());
  const [lines, setLines] = useState<TermLine[]>(WELCOME);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [highlights, setHighlights] = useState<Highlights | undefined>(undefined);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const state = activeRepo(world);
  const userLabel = USER_META[world.activeUser].label;
  const remoteRefs = visibleRemoteRefs(world);

  const branchLabel =
    state.head.kind === 'branch'
      ? `${userLabel} · ${state.head.name}${Object.keys(state.commits).length === 0 ? '（尚无提交）' : ''}`
      : `${userLabel} · 游离 HEAD`;

  const run = useCallback((raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;
    const result = applyWorldCommand(world, cmd);
    setHistory((h) => [...h, cmd]);
    setHistIdx(-1);
    setLines((prev) => [
      ...prev,
      { text: `[${USER_META[result.world.activeUser].label}] ${cmd}`, kind: 'in' },
      ...result.stdout.map((t) => ({
        text: t,
        kind: result.ok ? ('out' as const) : ('err' as const),
      })),
    ]);
    if (result.ok) {
      setWorld(result.world);
      setHighlights(result.highlights);
    } else {
      // 失败不改仓库；但若命令本身是 switchUser 成功路径已处理
      setWorld(result.world);
      setHighlights(undefined);
    }
    setExplanation(result.explanation);
    setInput('');
  }, [world]);

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

  const onSwitchUser = useCallback(
    (id: UserId) => {
      if (id === world.activeUser) return;
      const result = switchUser(world, id);
      setWorld(result.world);
      setLines((prev) => [
        ...prev,
        { text: `— 切换到 ${USER_META[id].label} —`, kind: 'out' },
        ...result.stdout.map((t) => ({ text: t, kind: 'out' as const })),
      ]);
      setExplanation(result.explanation);
      setHighlights(undefined);
      inputRef.current?.focus();
    },
    [world],
  );

  const onResetEmpty = useCallback(() => {
    setWorld(createEmptyWorld());
    setLines([...WELCOME, { text: '已重置：Alice / Bob 本地与远程均为空白。', kind: 'out' }]);
    setExplanation(null);
    setHighlights(undefined);
    setInput('');
    setHistIdx(-1);
  }, []);

  const onLoadDemo = useCallback(() => {
    setWorld(createDemoWorld());
    setLines([
      ...WELCOME,
      { text: '已加载演示：Alice / Bob 各有相同的 main 历史，origin/main 已存在。', kind: 'out' },
    ]);
    setExplanation({
      title: '已加载协作演示',
      summary:
        '两人本地 main 历史相同，远程也有 main。可各自 switch -c 建 feature，push 后换人 pull。',
      detail: '点顶栏 Alice / Bob 切换；终端里也可用 user bob。',
      related: ['git switch -c feature', 'git push', 'user bob', 'git pull'],
    });
    setHighlights(undefined);
    setInput('');
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
        commitCount={Object.keys(state.commits).length}
        activeUser={world.activeUser}
        onSwitchUser={onSwitchUser}
        onResetEmpty={onResetEmpty}
        onLoadDemo={onLoadDemo}
        showHelp={showHelp}
        onToggleHelp={() => setShowHelp((v) => !v)}
      />
      {showHelp && (
        <div className="howto">
          <strong>协作怎么练：</strong>
          Alice：<code>git switch -c feature</code> → <code>git commit</code> →{' '}
          <code>git push origin feature</code>；顶栏切 Bob → <code>git fetch</code> →{' '}
          <code>git pull</code> 或 <code>git switch feature</code>。虚线蓝标签 ={' '}
          <code>origin/*</code> 远程跟踪。
        </div>
      )}
      <div className="layout">
        <CheatsheetPanel onFill={onFill} />
        <main className="center" ref={bodyRef}>
          <CommitGraph
            state={state}
            remoteBranches={remoteRefs}
            userLabel={userLabel}
            highlights={highlights}
            onFill={onFill}
          />
          <TerminalPanel
            lines={lines}
            input={input}
            onInputChange={setInput}
            onSubmit={onSubmit}
            onHistory={onHistory}
            onClear={() => setLines([])}
            inputRef={inputRef}
          />
        </main>
        <ExplanationPanel explanation={explanation} onFill={onFill} />
      </div>
    </div>
  );
}
