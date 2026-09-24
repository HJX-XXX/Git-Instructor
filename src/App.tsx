import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Explanation, Highlights, UserId, WorldState } from './engine/types';
import {
  activeRepo,
  applyWorldCommand,
  createEmptyWorld,
  createDemoWorld,
  createInitedEmptyWorld,
  switchUser,
  USER_META,
  visibleRemoteRefs,
} from './engine/world';
import { getLevel, LEVELS } from './levels/catalog';
import {
  loadProgress,
  markCompleted,
  saveProgress,
  withProfile,
} from './levels/progress';
import type {
  AppMode,
  GraphFlashFocus,
  LevelCheckResult,
  LevelDef,
  LevelLogEntry,
  LevelProgress,
  SkillProfile,
} from './levels/types';
import { ChapterLearnModal } from './components/ChapterLearnModal';
import { CheatsheetPanel } from './components/CheatsheetPanel';
import { CommitGraph } from './components/CommitGraph';
import { ExplanationPanel } from './components/ExplanationPanel';
import { LevelPanel } from './components/LevelPanel';
import { Onboarding } from './components/Onboarding';
import { TerminalPanel } from './components/TerminalPanel';
import { TopBar } from './components/TopBar';

interface TermLine {
  text: string;
  kind: 'in' | 'out' | 'err';
}

function welcomeFor(_id: UserId): TermLine[] {
  return [];
}

function emptyHist(): Record<UserId, TermLine[]> {
  return { alice: [], bob: [] };
}

function emptyHistories(): Record<UserId, string[]> {
  return { alice: [], bob: [] };
}

function levelWelcome(levelTitle: string, levelId: number): TermLine[] {
  const label = levelId === 0 ? '导读' : `第 ${levelId} 关`;
  return [
    { text: `已进入${label}：${levelTitle}`, kind: 'out' },
    { text: '在下方输入命令完成左侧目标；也可点「建议命令」填入。', kind: 'out' },
  ];
}

function modeFromProfile(profile: SkillProfile | null): AppMode {
  if (!profile) return 'onboarding';
  return profile === 'beginner' ? 'level' : 'free';
}

function bootWorld(profile: SkillProfile | null, levelId: number) {
  if (profile !== 'beginner') return createEmptyWorld();
  const lv = getLevel(levelId) ?? LEVELS[0];
  return lv ? lv.startWorld() : createEmptyWorld();
}

function bootTerm(profile: SkillProfile | null, levelId: number): Record<UserId, TermLine[]> {
  if (profile !== 'beginner') return emptyHist();
  const lv = getLevel(levelId) ?? LEVELS[0];
  if (!lv) return emptyHist();
  return { alice: levelWelcome(lv.title, lv.id), bob: welcomeFor('bob') };
}

function levelBootExplanation(lv: LevelDef): Explanation {
  const title = `第 ${lv.id} 关 · ${lv.title}`;
  if (lv.intro) {
    return {
      title,
      summary: lv.intro.summary,
      detail: lv.intro.detail,
    };
  }
  return {
    title,
    summary: lv.story,
    detail: '完成左侧全部目标即可通关。命令执行后的讲解仍会显示在这里。',
    related: lv.suggestedCommands.slice(0, 3),
  };
}

function bootExplanation(profile: SkillProfile | null, levelId: number): Explanation | null {
  if (profile !== 'beginner') return null;
  const lv = getLevel(levelId) ?? LEVELS[0];
  if (!lv) return null;
  return levelBootExplanation(lv);
}

/** 提交图结构签名：判断命令是否改变了图 */
function graphSignature(w: WorldState): string {
  return JSON.stringify({
    ac: Object.keys(w.users.alice.commits).sort(),
    ab: w.users.alice.branches,
    ah: w.users.alice.head,
    bc: Object.keys(w.users.bob.commits).sort(),
    bb: w.users.bob.branches,
    bh: w.users.bob.head,
    remote: w.remoteBranches,
  });
}

/** 卡片目标完成后图上闪烁目标（可与 L0 同款样式） */
function resolveGraphFocus(level: LevelDef, index: number): GraphFlashFocus | null {
  const c = level.concepts?.[index];
  if (!c) return null;
  if (c.graphFocus) return c.graphFocus;
  const cmds = c.practice?.commands ?? [c.practice?.command ?? ''];
  const cmd = cmds.filter(Boolean).map((s) => s.toLowerCase()).join(' ');
  if (!cmd) return null;
  if (cmd.includes('status') || cmd.includes('log') || cmd === 'help') {
    // 纯观察命令：若同时含 switch/merge 等仍按动作闪
    if (!/switch|checkout|commit|branch|merge|reset|revert|rebase|push|pull|fetch/.test(cmd)) {
      return null;
    }
  }
  if (cmd.includes('checkout') || cmd.includes('switch')) {
    return cmd.includes('-b') || cmd.includes('-c') || cmd.includes(' main') || cmd.includes('checkout main')
      ? cmd.includes('-b') || cmd.includes('-c')
        ? 'branch'
        : 'head'
      : 'head';
  }
  if (cmd.includes('commit')) return 'commit';
  if (cmd.includes('branch') && !cmd.includes('-d') && !cmd.includes('-D')) {
    return 'branch';
  }
  // 协作命令：优先高亮远程 origin/* 区域
  if (cmd.includes('push') || cmd.includes('pull') || cmd.includes('fetch')) {
    return 'remote';
  }
  if (
    cmd.includes('merge') ||
    cmd.includes('reset') ||
    cmd.includes('revert') ||
    cmd.includes('rebase') ||
    cmd.includes('-d') ||
    cmd.includes('-D')
  ) {
    return 'latest';
  }
  return null;
}

export default function App() {
  const [progress, setProgress] = useState<LevelProgress>(() => loadProgress());
  const initialProfile = progress.profile;
  const initialLevelId = progress.currentLevelId;
  const [mode, setMode] = useState<AppMode>(() => modeFromProfile(initialProfile));
  const [world, setWorld] = useState(() => bootWorld(initialProfile, initialLevelId));
  /** 关卡初始世界：check 的 before 始终用它，避免后续命令把已完成目标冲掉 */
  const [levelStartWorld, setLevelStartWorld] = useState<WorldState | null>(() =>
    initialProfile === 'beginner' ? bootWorld(initialProfile, initialLevelId) : null,
  );
  const [termByUser, setTermByUser] = useState<Record<UserId, TermLine[]>>(() =>
    bootTerm(initialProfile, initialLevelId),
  );
  const [historyByUser, setHistoryByUser] = useState<Record<UserId, string[]>>(emptyHistories);
  const [input, setInput] = useState('');
  const [histIdx, setHistIdx] = useState(-1);
  const [explanation, setExplanation] = useState<Explanation | null>(() =>
    bootExplanation(initialProfile, initialLevelId),
  );
  const [highlights, setHighlights] = useState<Highlights | undefined>(undefined);
  const [levelLog, setLevelLog] = useState<LevelLogEntry[]>([]);
  const [checkResult, setCheckResult] = useState<LevelCheckResult | null>(null);
  const [readConcepts, setReadConcepts] = useState<string[]>([]);
  const [activeConcept, setActiveConcept] = useState<string | null>(null);
  const [chapterModalOpen, setChapterModalOpen] = useState(false);
  const [cardFlash, setCardFlash] = useState<GraphFlashFocus | null>(null);
  const prevObjectivesDone = useRef<boolean[]>([]);
  const wonRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const level = useMemo(() => getLevel(progress.currentLevelId) ?? LEVELS[0]!, [progress.currentLevelId]);
  const state = activeRepo(world);
  const userLabel = USER_META[world.activeUser].label;
  const remoteRefs = visibleRemoteRefs(world);
  const lines = termByUser[world.activeUser];
  const history = historyByUser[world.activeUser];
  const inLevel = mode === 'level';

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const appendTerm = useCallback((userId: UserId, extra: TermLine[]) => {
    setTermByUser((prev) => ({
      ...prev,
      [userId]: [...prev[userId], ...extra],
    }));
  }, []);

  const enterLevel = useCallback((id: number) => {
    const lv = getLevel(id);
    if (!lv) return;
    // 所有关卡均可直接进入
    wonRef.current = false;
    const start = lv.startWorld();
    setWorld(start);
    setLevelStartWorld(start);
    setMode('level');
    setLevelLog([]);
    setCheckResult(null);
    setReadConcepts([]);
    setActiveConcept(lv.concepts?.[0]?.id ?? null);
    setChapterModalOpen(false);
    setCardFlash(null);
    prevObjectivesDone.current = [];
    setExplanation(levelBootExplanation(lv));
    setHighlights(undefined);
    setInput('');
    setHistIdx(-1);
    setTermByUser((prev) => ({
      ...prev,
      alice: levelWelcome(lv.title, lv.id),
      bob: prev.bob,
    }));
    setHistoryByUser((prev) => ({ ...prev, alice: [] }));
    setProgress((prev) => {
      const next = { ...prev, currentLevelId: id };
      saveProgress(next);
      return next;
    });
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const enterFree = useCallback(() => {
    setMode('free');
    // 切到自由练习时清空提交图，避免残留关卡演示状态
    setWorld(createInitedEmptyWorld());
    setLevelStartWorld(null);
    setTermByUser(emptyHist());
    setHistoryByUser(emptyHistories());
    setHighlights(undefined);
    setCheckResult(null);
    setLevelLog([]);
    setReadConcepts([]);
    setActiveConcept(null);
    setCardFlash(null);
    prevObjectivesDone.current = [];
    setInput('');
    setHistIdx(-1);
    setExplanation({
      title: '自由练习',
      summary: '沙箱已清空。可任意练习；协作用 push / fetch / pull，顶栏可加载演示。',
      detail: '需要系统学习时，点顶栏「关卡学习」。',
      related: ['help', 'git status', 'git switch -c feature'],
    });
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const onChooseProfile = useCallback(
    (profile: SkillProfile) => {
      const next = withProfile(profile);
      setProgress(next);
      saveProgress(next);
      if (profile === 'beginner') {
        enterLevel(next.currentLevelId ?? LEVELS[0]!.id);
      } else {
        setMode('free');
        setWorld(createEmptyWorld());
        setLevelStartWorld(null);
        setTermByUser(emptyHist());
        setHistoryByUser(emptyHistories());
        setExplanation({
          title: '自由沙箱',
          summary: '已按「老手」进入空白沙箱。顶栏可加载演示或进入关卡复习。',
          related: ['help', 'git commit -m "..."', 'git switch -c feature'],
        });
      }
    },
    [enterLevel],
  );

  const run = useCallback(
    (raw: string) => {
      const cmd = raw.trim();
      if (!cmd) return;
      const fromUser = world.activeUser;
      const before = world;
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
      setWorld(result.world);
      if (result.ok) {
        setHighlights(result.highlights);
      } else {
        setHighlights(undefined);
      }
      setExplanation(result.explanation);
      setInput('');

      if (inLevel && (fromUser === 'alice' || level.allowMultiUser)) {
        const logEntry: LevelLogEntry = { input: cmd, ok: result.ok, user: fromUser };
        const nextLog = [...levelLog, logEntry];
        setLevelLog(nextLog);
        const check = level.check({
          before: levelStartWorld ?? before,
          after: result.world,
          log: nextLog,
          readConcepts,
        });
        setCheckResult(check);
        // 卡片目标达成且提交图有变化时，闪烁对应目标（若已配置 graphFocus）
        {
          const graphChanged = graphSignature(before) !== graphSignature(result.world);
          const prevDone = prevObjectivesDone.current;
          const newlyDoneIdx = check.objectives.findIndex(
            (o, i) => o.done && !prevDone[i],
          );
          prevObjectivesDone.current = check.objectives.map((o) => o.done);
          if (graphChanged && newlyDoneIdx >= 0) {
            const focus = resolveGraphFocus(level, newlyDoneIdx);
            if (focus) {
              setCardFlash(focus);
            }
          }
        }
        if (check.win && !wonRef.current) {
          wonRef.current = true;
          setProgress((prev) => {
            const marked = markCompleted(prev, level.id);
            saveProgress(marked);
            return marked;
          });
          setExplanation(level.winExplanation);
          appendTerm(fromUser, [
            {
              text:
                `✓ 第 ${level.id} 关完成：${level.title}`,
              kind: 'out',
            },
          ]);
        }
      }
    },
    [world, appendTerm, inLevel, levelLog, level, readConcepts, levelStartWorld],
  );

  const applyCheck = useCallback(
    (log: LevelLogEntry[], concepts: string[], afterWorld: typeof world) => {
      const check = level.check({
        before: levelStartWorld ?? afterWorld,
        after: afterWorld,
        log,
        readConcepts: concepts,
      });
      setCheckResult(check);
      if (check.win && !wonRef.current) {
        wonRef.current = true;
        setProgress((prev) => {
          const marked = markCompleted(prev, level.id);
          saveProgress(marked);
          return marked;
        });
        setExplanation(level.winExplanation);
        appendTerm('alice', [
          {
            text:
              level.id === 0
                ? `✓ 导读完成：${level.title}`
                : `✓ 第 ${level.id} 关完成：${level.title}`,
            kind: 'out',
          },
        ]);
      }
    },
    [level, appendTerm, levelStartWorld],
  );

  const onReadConcept = useCallback(
    (id: string) => {
      setActiveConcept(id);
      if (readConcepts.includes(id)) return;
      const next = [...readConcepts, id];
      setReadConcepts(next);
      applyCheck(levelLog, next, world);
    },
    [readConcepts, applyCheck, levelLog, world],
  );

  const onFocusConcept = useCallback((id: string) => {
    // L2：点概念卡演示；非 L0 也可点卡查看，但通关闪烁以 cardFlash 为准
    setActiveConcept(id);
    if (level.id !== 0) setCardFlash(null);
  }, [level.id]);

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
      [id]: [],
    }));
  }, [world.activeUser]);

  const onSwitchUser = useCallback(
    (id: UserId) => {
      if (id === world.activeUser) return;
      if (inLevel && id !== 'alice' && !level.allowMultiUser) {
        appendTerm(world.activeUser, [
          { text: '关卡模式请以 Alice 完成目标；协作练习请切到「自由练习」。', kind: 'err' },
        ]);
        return;
      }
      const result = switchUser(world, id);
      setWorld(result.world);
      appendTerm(id, [{ text: `当前用户：${USER_META[id].label}`, kind: 'out' }]);
      // 关卡判题依赖用户身份：顶栏切换也要写入日志
      if (inLevel) {
        setLevelLog((prev) => [
          ...prev,
          { input: `user ${id}`, ok: true, user: id },
        ]);
      }
      setExplanation(result.explanation);
      setHighlights(undefined);
      setHistIdx(-1);
      setInput('');
      inputRef.current?.focus();
    },
    [world, appendTerm, inLevel, level.allowMultiUser],
  );

  const onResetEmpty = useCallback(() => {
    setWorld(createEmptyWorld());
    setLevelStartWorld(null);
    setTermByUser(emptyHist());
    setHistoryByUser(emptyHistories());
    setExplanation(null);
    setHighlights(undefined);
    setInput('');
    setHistIdx(-1);
    setCheckResult(null);
    setLevelLog([]);
  }, []);

  const onLoadDemo = useCallback(() => {
    setWorld(createDemoWorld());
    setLevelStartWorld(null);
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

  const onSelectLevel = useCallback(
    (id: number) => {
      enterLevel(id);
    },
    [enterLevel],
  );

  const onResetLevel = useCallback(() => {
    enterLevel(level.id);
  }, [enterLevel, level.id]);

  const onNextLevel = useCallback((targetId: number) => {
    enterLevel(targetId);
  }, [enterLevel]);

  useEffect(() => {
    const el = bodyRef.current?.querySelector('.terminal-body');
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, world.activeUser]);

  if (mode === 'onboarding') {
    return <Onboarding onChoose={onChooseProfile} />;
  }

  const levelBadge = inLevel ? `L${level.id} · ${level.title}` : null;

  return (
    <div className="app">
      <TopBar
        activeUser={world.activeUser}
        mode={mode}
        profile={progress.profile}
        levelBadge={levelBadge}
        onSwitchUser={onSwitchUser}
        onResetEmpty={onResetEmpty}
        onLoadDemo={onLoadDemo}
        onEnterLevel={() => enterLevel(progress.currentLevelId ?? LEVELS[0]!.id)}
        onEnterFree={enterFree}
      />
      <div className="layout">
        {inLevel ? (
          <LevelPanel
            key={level.id}
            level={level}
            progress={progress}
            checkResult={checkResult}
            readConcepts={readConcepts}
            activeConcept={activeConcept}
            onSelectLevel={onSelectLevel}
            onFill={onFill}
            onResetLevel={onResetLevel}
        onNextLevel={onNextLevel}
            onEnterFree={enterFree}
            onReadConcept={onReadConcept}
            onFocusConcept={onFocusConcept}
            onOpenStory={() => setChapterModalOpen(true)}
          />
        ) : (
          <CheatsheetPanel onFill={onFill} />
        )}
        <main className="center" ref={bodyRef}>
          <CommitGraph
            state={state}
            remoteBranches={remoteRefs}
            remoteCommits={world.remoteCommits}
            userLabel={userLabel}
            highlights={highlights}
            onFill={onFill}
            demoFocus={
              inLevel && level.id === 2
                ? ((activeConcept as 'head' | 'branch' | 'commit' | 'latest' | 'remote') || null)
                : cardFlash
            }
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
      {inLevel && chapterModalOpen && (
        <ChapterLearnModal
          kicker={`第 ${level.id} 关`}
          title={level.title}
          intro={level.intro?.summary ?? level.story}
          introDetail={level.intro?.detail}
          onClose={() => setChapterModalOpen(false)}
        />
      )}
    </div>
  );
}
