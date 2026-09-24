import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { LEVELS } from '../levels/catalog';
import {
  STAGES,
  firstLevelOfNextStage,
  isLastLevelOfStage,
  nextLevelInStage,
  nextStageOf,
} from '../levels/stages';
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
  onNextLevel: (id: number) => void;
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
  const [openConceptIds, setOpenConceptIds] = useState<string[]>([]);
  const [revealedPractices, setRevealedPractices] = useState<string[]>([]);
  /** 默认展开当前关所在阶段，其余保持上次状态 */
  const [collapsedStages, setCollapsedStages] = useState<string[]>([]);
  const won = checkResult?.win ?? false;
  const nextInStage = nextLevelInStage(level.id, LEVELS);
  const lastOfStage = isLastLevelOfStage(level.id, LEVELS);
  const nextStage = lastOfStage ? nextStageOf(level.stageId) : null;
  const nextStageFirst = lastOfStage ? firstLevelOfNextStage(level.id, LEVELS) : null;
  const storyRef = useRef<HTMLButtonElement | null>(null);

  /** 阶段内关卡全部通关后自动收起，方便看到后面阶段 */
  useEffect(() => {
    setCollapsedStages((prev) => {
      let next = prev;
      for (const stage of STAGES) {
        const items = LEVELS.filter((l) => l.stageId === stage.id);
        if (items.length === 0) continue;
        const allDone = items.every((l) => progress.completed.includes(l.id));
        if (allDone && !next.includes(stage.id)) {
          next = [...next, stage.id];
        }
      }
      // 当前关所在阶段始终展开，便于对照目标
      if (next.includes(level.stageId)) {
        next = next.filter((id) => id !== level.stageId);
      }
      return next === prev ? prev : next;
    });
  }, [progress.completed, level.stageId, level.id]);

  /** 展开/收起后，把卡片上「点击点」对齐回鼠标所在屏幕位置，避免列表跳动 */
  const alignCardToPointer = (
    cardEl: HTMLElement | null,
    mouseY: number,
    anchorInCard: number,
  ) => {
    requestAnimationFrame(() => {
      const card = cardEl ?? null;
      if (!card) return;
      const wrap = card.closest('.level-scroll') as HTMLElement | null;
      if (!wrap) return;
      const rect = card.getBoundingClientRect();
      const h = Math.max(rect.height, 1);
      const anchor = Math.min(Math.max(anchorInCard, 0), h - 1);
      const currentY = rect.top + anchor;
      wrap.scrollTop += currentY - mouseY;
    });
  };

  const toggleConceptAt = (
    e: ReactMouseEvent<HTMLElement>,
    conceptId: string,
    nextOpen: boolean,
  ) => {
    const card = (e.currentTarget as HTMLElement).closest('.concept-card') as HTMLElement | null;
    const mouseY = e.clientY;
    let anchor = 12;
    if (card) {
      const rect = card.getBoundingClientRect();
      anchor = Math.min(Math.max(mouseY - rect.top, 0), Math.max(rect.height - 1, 0));
    }
    setOpenConceptIds((prev) => {
      if (nextOpen) return prev.includes(conceptId) ? prev : [...prev, conceptId];
      return prev.filter((id) => id !== conceptId);
    });
    if (nextOpen) onFocusConcept(conceptId);
    alignCardToPointer(card, mouseY, anchor);
  };

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
              L{level.id} · 共 {LEVELS.length} 关 · 已通关 {progress.completed.length}
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
          {/* 收起时只显示精简 story；详细 intro 在中央弹层中展示 */}
          <p className="level-story">{level.story}</p>
          <span className="level-open-hint">查看本关学习内容</span>
        </button>

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
        </section>

        {level.concepts && level.concepts.length > 0 && (
          <section className="level-block">
            <h4>本节内容</h4>
            <div className="level-concepts">
              {level.concepts.map((c, ci) => {
                const objDone = checkResult?.objectives[ci]?.done ?? false;
                const read = readConcepts.includes(c.id) || objDone;
                const active = activeConcept === c.id;
                const open = openConceptIds.includes(c.id);
                return (
                  <article
                    key={c.id}
                    data-concept={c.id}
                    className={`concept-card${read ? ' is-read' : ''}${active ? ' is-active' : ''}${open ? ' is-open' : ''}`}
                    onClick={(e) => {
                      const t = e.target as HTMLElement;
                      if (t.closest('button.chip, button.concept-practice-reveal, button.btn-mini')) {
                        return;
                      }
                      toggleConceptAt(e, c.id, !open);
                    }}
                  >
                    <button
                      type="button"
                      className="concept-card-head"
                      aria-expanded={open}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleConceptAt(e, c.id, !open);
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
                          <div className="concept-tips-block">
                            <p className="concept-tips-label">要点</p>
                            <ul className="concept-tips">
                              {c.tips.map((t) => (
                                <li key={t}>{t}</li>
                              ))}
                            </ul>
                          </div>
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
                                <div className="concept-practice-cmds">
                                  {(c.practice.commands?.length
                                    ? c.practice.commands
                                    : [c.practice.command]
                                  ).map((cmd) => (
                                    <button
                                      key={cmd}
                                      type="button"
                                      className="chip concept-practice-cmd"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onFill(cmd);
                                      }}
                                    >
                                      {cmd}
                                    </button>
                                  ))}
                                </div>
                                <p className="concept-practice-hint">
                                  {(c.practice.commands?.length ?? 1) > 1
                                    ? '两条命令都要执行：按顺序点击填入终端并回车'
                                    : '点击填入终端，回车执行'}
                                </p>
                              </>
                            )}
                          </div>
                        )}
                        {!c.practice && (
                          <button
                            type="button"
                            className={`btn-mini${read ? ' is-done' : ''}`}
                            disabled={read}
                            onClick={(e) => {
                              e.stopPropagation();
                              onReadConcept(c.id);
                            }}
                          >
                            {objDone ? '已达成' : read ? '已理解' : '标记已理解'}
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {won && (
          <section className="level-block">
            <div className="level-win-box">
              <p className="level-win-title">本关完成</p>
              <p className="level-win-summary">{level.winExplanation.summary}</p>
              <div className="level-win-actions">
                {nextInStage != null ? (
                  <button type="button" className="btn btn-primary" onClick={() => onNextLevel(nextInStage)}>
                    下一关
                  </button>
                ) : nextStageFirst != null ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => onNextLevel(nextStageFirst)}
                    title={nextStage ? nextStage.title : undefined}
                  >
                    进入下一阶段
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={onEnterFree}>
                    进入自由练习
                  </button>
                )}
                <button type="button" className="btn" onClick={onResetLevel}>
                  再练一次
                </button>
              </div>
            </div>
          </section>
        )}

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
          <h4>全部关卡</h4>
          {STAGES.map((stage) => {
            const items = LEVELS.filter((l) => l.stageId === stage.id);
            if (items.length === 0) return null;
            const collapsed = collapsedStages.includes(stage.id);
            return (
              <div key={stage.id} className={`level-stage${collapsed ? ' is-collapsed' : ''}`}>
                <button
                  type="button"
                  className="level-stage-head"
                  aria-expanded={!collapsed}
                  onClick={(e) => {
                    const card = (e.currentTarget as HTMLElement).closest(
                      '.level-stage',
                    ) as HTMLElement | null;
                    const mouseY = e.clientY;
                    let anchor = 12;
                    if (card) {
                      const rect = card.getBoundingClientRect();
                      anchor = Math.min(
                        Math.max(mouseY - rect.top, 0),
                        Math.max(rect.height - 1, 0),
                      );
                    }
                    setCollapsedStages((prev) =>
                      prev.includes(stage.id)
                        ? prev.filter((id) => id !== stage.id)
                        : [...prev, stage.id],
                    );
                    alignCardToPointer(card, mouseY, anchor);
                  }}
                >
                  <span className="level-stage-chev" aria-hidden>
                    {collapsed ? '▸' : '▾'}
                  </span>
                  <span className="level-stage-text">
                    <span className="level-stage-title">{stage.title}</span>
                    <span className="level-stage-sum">{stage.summary}</span>
                  </span>
                </button>
                {!collapsed && (
                  <ol className="level-list">
                    {items.map((l) => {
                      const done = progress.completed.includes(l.id);
                      const active = l.id === level.id;
                      return (
                        <li key={l.id}>
                          <button
                            type="button"
                            className={`level-item${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
                            onClick={(e) => {
                              e.preventDefault();
                              onSelectLevel(l.id);
                            }}
                          >
                            <span className="level-item-id">L{l.id}</span>
                            <span className="level-item-title">{l.title}</span>
                            <span className="level-item-state">
                              {done ? '✓' : active ? '进行中' : '可进入'}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            );
          })}
          <button type="button" className="btn" onClick={onResetLevel}>
            重置本关
          </button>
        </section>
      </div>
    </aside>
  );
}
