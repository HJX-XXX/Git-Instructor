import { useEffect, useRef, useState } from 'react';
import { LEVELS } from '../levels/catalog';
import { isLevelUnlocked } from '../levels/progress';
import type { LevelCheckResult, LevelDef, LevelProgress } from '../levels/types';

interface Props {
  level: LevelDef;
  progress: LevelProgress;
  checkResult: LevelCheckResult | null;
  readConcepts: string[];
  activeConcept: string | null;
  onSelectLevel: (id: number) => void;
  onFill: (cmd: string) => void;
  onResetLevel: () => void;
  onNextLevel: () => void;
  onEnterFree: () => void;
  onReadConcept: (id: string) => void;
  onFocusConcept: (id: string) => void;
  onOpenStory: () => void;
}

export function LevelPanel({
  level,
  progress,
  checkResult,
  readConcepts,
  activeConcept,
  onSelectLevel,
  onFill,
  onResetLevel,
  onNextLevel,
  onEnterFree,
  onReadConcept,
  onFocusConcept,
  onOpenStory,
}: Props) {
  const [openHints, setOpenHints] = useState<number[]>([]);
  const [openConceptId, setOpenConceptId] = useState<string | null>(null);
  const [revealedPractices, setRevealedPractices] = useState<string[]>([]);
  const won = checkResult?.win ?? false;
  const hasNext = LEVELS.some((l) => l.id === level.id + 1);
  const storyRef = useRef<HTMLButtonElement | null>(null);

  // 切换关卡时让关卡说明闪烁，提醒用户阅读
  useEffect(() => {
    const el = storyRef.current;
    if (!el) return;
    el.classList.remove('is-flash');
    void el.offsetWidth;
    el.classList.add('is-flash');
    const t = window.setTimeout(() => el.classList.remove('is-flash'), 3400);
    return () => window.clearTimeout(t);
  }, [level.id]);

  return (
    <aside className="panel level-panel">
      <header className="panel-head">
        <div className="panel-head-row">
          <div>
            <h2>关卡学习</h2>
            <p>
              L{level.id} / {LEVELS.length} · 已通关 {progress.completed.length}
            </p>
          </div>
          <button type="button" className="btn-mini" onClick={onEnterFree}>
            自由练习
          </button>
        </div>
      </header>

      <div className="level-scroll">
        <button
          type="button"
          className="level-current level-current-btn"
          ref={storyRef}
          onClick={onOpenStory}
        >
          <div className="level-kicker">{level.id === 0 ? '导读' : `第 ${level.id} 关`}</div>
          <h3 className="level-title">{level.title}</h3>
          <p className="level-story">{level.story}</p>
          <span className="level-open-hint">点开看本章完整说明</span>
        </button>

        {level.concepts && level.concepts.length > 0 && (
          <section className="level-block">
            <h4>本节内容</h4>
            <div className="level-concepts">
              {level.concepts.map((c, ci) => {
                const objDone = checkResult?.objectives[ci]?.done ?? false;
                const read = readConcepts.includes(c.id) || objDone;
                const active = activeConcept === c.id;
                const open = openConceptId === c.id;
                const toggleConcept = () => {
                  const next = open ? null : c.id;
                  setOpenConceptId(next);
                  if (next) onFocusConcept(c.id);
                };
                return (
                  <article
                    key={c.id}
                    data-concept={c.id}
                    className={`concept-card${read ? ' is-read' : ''}${active ? ' is-active' : ''}${open ? ' is-open' : ''}`}
                    onClick={() => {
                      if (open) setOpenConceptId(null);
                    }}
                  >
                    <button
                      type="button"
                      className="concept-card-head"
                      aria-expanded={open}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleConcept();
                      }}
                    >
                      <span className="concept-chev" aria-hidden>
                        {open ? '▾' : '▸'}
                      </span>
                      <span className="concept-toggle-text">
                        <span className="concept-term">{c.term}</span>
                        <span className="concept-teaser">{c.teaser}</span>
                      </span>
                      {read && (
                        <span className="concept-done-tag">{objDone ? '已完成' : '已懂'}</span>
                      )}
                    </button>
                    {open && (
                      <div className="concept-panel">
                        <p className="concept-body">{c.body}</p>
                        {c.tips && c.tips.length > 0 && (
                          <ul className="concept-tips">
                            {c.tips.map((t) => (
                              <li key={t}>{t}</li>
                            ))}
                          </ul>
                        )}
                        {c.practice && (
                          <div className="concept-practice">
                            <p className="concept-practice-label">{c.practice.label}</p>
                            {!revealedPractices.includes(c.id) ? (
                              <button
                                type="button"
                                className="btn-mini concept-practice-reveal"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRevealedPractices((prev) =>
                                    prev.includes(c.id) ? prev : [...prev, c.id],
                                  );
                                }}
                              >
                                想不起来了？显示命令
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="chip concept-practice-cmd"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onFill(c.practice!.command);
                                  }}
                                >
                                  {c.practice.command}
                                </button>
                                <p className="concept-practice-hint">点击填入终端，回车执行</p>
                              </>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          className={`btn-mini${read ? ' is-done' : ''}`}
                          disabled={read}
                          onClick={(e) => {
                            e.stopPropagation();
                            onReadConcept(c.id);
                          }}
                        >
                          {objDone ? '命令已通过' : read ? '已理解' : '标记已理解'}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <section className="level-block">
          <h4>目标</h4>
          <ul className="level-objectives">
            {(checkResult?.objectives ?? level.objectiveLabels.map((label, i) => ({
              id: String(i + 1),
              label,
              done: false,
            }))).map((o) => (
              <li key={o.id} className={o.done ? 'is-done' : undefined}>
                <span className="obj-mark" aria-hidden>
                  {o.done ? '✓' : '○'}
                </span>
                <span>{o.label}</span>
              </li>
            ))}
          </ul>
          {checkResult && !won && (
            <p className="level-feedback">{checkResult.feedback}</p>
          )}
          {won && (
            <div className="level-win-box">
              <p className="level-win-title">本关完成</p>
              <p className="level-win-summary">{level.winExplanation.summary}</p>
              <div className="level-win-actions">
                {hasNext && (
                  <button type="button" className="btn btn-primary" onClick={onNextLevel}>
                    下一关
                  </button>
                )}
                {!hasNext && (
                  <button type="button" className="btn btn-primary" onClick={onEnterFree}>
                    进入自由练习
                  </button>
                )}
                <button type="button" className="btn" onClick={onResetLevel}>
                  再练一次
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="level-block">
          <h4>建议命令</h4>
          <div className="level-cmds">
            {level.suggestedCommands.map((cmd) => (
              <button key={cmd} type="button" className="chip" onClick={() => onFill(cmd)}>
                {cmd}
              </button>
            ))}
          </div>
        </section>

        <section className="level-block">
          <h4>提示</h4>
          <div className="level-hints">
            {level.hints.map((h, i) => {
              const open = openHints.includes(i);
              return (
                <button
                  key={h}
                  type="button"
                  className={`hint-row${open ? ' is-open' : ''}`}
                  onClick={() => {
                    setOpenHints((prev) =>
                      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i],
                    );
                  }}
                >
                  <span className="hint-label">提示 {i + 1}</span>
                  <span className="hint-body">{open ? h : '点击展开'}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="level-block">
          <h4>全部关卡</h4>
          <ol className="level-list">
            {LEVELS.map((l) => {
              const unlocked = isLevelUnlocked(l.id, progress.completed);
              const done = progress.completed.includes(l.id);
              const active = l.id === level.id;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    className={`level-item${active ? ' is-active' : ''}${done ? ' is-done' : ''}${
                      unlocked ? '' : ' is-locked'
                    }`}
                    disabled={!unlocked}
                    onClick={() => onSelectLevel(l.id)}
                  >
                    <span className="level-item-id">L{l.id}</span>
                    <span className="level-item-title">{l.title}</span>
                    <span className="level-item-state">
                      {done ? '✓' : unlocked ? (active ? '进行中' : '可进入') : '锁定'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <button type="button" className="btn" onClick={onResetLevel}>
            重置本关
          </button>
        </section>
      </div>
    </aside>
  );
}
