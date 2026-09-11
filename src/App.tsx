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

function welcomeFor(id: UserId): TermLine[] {
  const name = USER_META[id].label;
  return [
    { text: `${name} 的沙箱终端已就绪（与另一名用户互不干扰）。`, kind: 'out' },
    { text: '练习：commit → push origin <branch> → 换人 fetch/pull。', kind: 'out' },
    { text: '协作命令：git push / fetch / pull / remote -v；顶栏可切换用户。', kind: 'out' },
  ];
}

function emptyHist(): Record<UserId, TermLine[]> {
  return { alice: welcomeFor('alice'), bob: welcomeFor('bob') };
}

function emptyHistories(): Record<UserId, string[]> {
  return { alice: [], bob: [] };
}

export default function App() {
  const [world, setWorld] = useState(() => createEmptyWorld());
  const [termByUser, setTermByUser] = useState<Record<UserId, TermLine[]>>(emptyHist);
  const [historyByUser, setHistoryByUser] = useState<Record<UserId, string[]>>(emptyHistories);
  const [input, setInput] = useState('');
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
  const lines = termByUser[world.activeUser];
  const history = historyByUser[world.activeUser];

  const branchLabel =
    state.head.kind === 'branch'
      ? `${userLabel} · ${state.head.name}${Object.keys(state.commits).length === 0 ? '（尚无提交）' : ''}`
      : `${userLabel} · 游离 HEAD`;

  const appendTerm = useCallback((userId: UserId, extra: TermLine[]) => {
    setTermByUser((prev) => ({
      ...prev,
      [userId]: [...prev[userId], ...extra],
    }));
  }, []);

  const run = useCallback(
    (raw: string) => {
      const cmd = raw.trim();
      if (!cmd) return;
      const fromUser = world.activeUser;
      const result = applyWorldCommand(world, cmd);
      setHistoryByUser((prev) => ({
        ...prev,
        [fromUser]: [...prev[fromUser], cmd],
      }));
      setHistIdx(-1);
      appendTerm(fromUser, [
        { text: `[${USER_META[fromUser].label}] ${cmd}`, kind: 'in' },
        ...result.stdout.map((t) => ({
          text: t,
          kind: result.ok ? ('out' as const) : ('err' as const),
        })),
      ]);
      if (result.ok) {
        setWorld(result.world);
        setHighlights(result.highlights);
      } else {
        setWorld(result.world);
        setHighlights(undefined);
      }
      setExplanation(result.explanation);
      setInput('');
    },
    [world, appendTerm],
  );

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

  const onClear = useCallback(() => {
    const id = world.activeUser;
    setTermByUser((prev) => ({
      ...prev,
      [id]: [{ text: `— 已清空 ${USER_META[id].label} 的终端输出 —`, kind: 'out' }],
    }));
  }, [world.activeUser]);

  const onSwitchUser = useCallback(
    (id: UserId) => {
      if (id === world.activeUser) return;
      const result = switchUser(world, id);
      setWorld(result.world);
      appendTerm(id, [
        { text: `— 你正在查看 ${USER_META[id].label} 的终端 —`, kind: 'out' },
        ...result.stdout.map((t) => ({ text: t, kind: 'out' as const })),
      ]);
      setExplanation(result.explanation);
      setHighlights(undefined);
      setHistIdx(-1);
      setInput('');
      inputRef.current?.focus();
    },
    [world, appendTerm],
  );

  const onResetEmpty = useCallback(() => {
    setWorld(createEmptyWorld());
    setTermByUser(emptyHist());
    setHistoryByUser(emptyHistories());
    setExplanation(null);
    setHighlights(undefined);
    setInput('');
    setHistIdx(-1);
  }, []);

  const onLoadDemo = useCallback(() => {
    setWorld(createDemoWorld());
    setTermByUser((prev) => ({
      alice: [
        ...prev.alice,
        { text: '已加载演示：Alice / Bob 各有相同 main 历史，origin/main 已存在。', kind: 'out' },
      ],
      bob: [
        ...prev.bob,
        { text: '已加载演示：Alice / Bob 各有相同 main 历史，origin/main 已存在。', kind: 'out' },
      ],
    }));
    setExplanation({
      title: '已加载协作演示',
      summary: '两人本地 main 相同，远程也有 main。可各自建 feature，push 后换人 pull。',
      detail: '顶栏 Alice / Bob 切换；两人终端历史互相独立。',
      related: ['git switch -c feature', 'git push', 'user bob', 'git pull'],
    });
    setHighlights(undefined);
    setInput('');
    setHistIdx(-1);
  }, []);

  useEffect(() => {
    const el = bodyRef.current?.querySelector('.terminal-body');
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, world.activeUser]);

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
          <code>git push origin feature</code>；顶栏切 Bob → <code>git fetch</code> → 图上会出现{' '}
          <code>origin/feature</code>；再 <code>git pull</code> 或 <code>git switch feature</code>。
          蓝色虚线 = 远程跟踪。
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
            onClear={onClear}
            inputRef={inputRef}
          />
        </main>
        <ExplanationPanel explanation={explanation} onFill={onFill} />
      </div>
    </div>
  );
}
