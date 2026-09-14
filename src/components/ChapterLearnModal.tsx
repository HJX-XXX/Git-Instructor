import { useEffect } from 'react';
import type { LevelConcept } from '../levels/types';

interface Props {
  title: string;
  kicker: string;
  intro: string;
  concepts: LevelConcept[];
  onClose: () => void;
  onOpenConcept: (id: string) => void;
}

/** 导读卡片点开后：屏幕中央展示本章完整学习内容 */
export function ChapterLearnModal({
  title,
  kicker,
  intro,
  concepts,
  onClose,
  onOpenConcept,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="concept-modal-root" role="presentation">
      <button
        type="button"
        className="concept-modal-backdrop"
        aria-label="关闭"
        onClick={onClose}
      />
      <div
        className="concept-modal concept-modal-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chapter-modal-title"
      >
        <header className="concept-modal-head">
          <div>
            <div className="concept-modal-kicker">{kicker}</div>
            <h2 id="chapter-modal-title">{title}</h2>
          </div>
          <button type="button" className="btn-mini" onClick={onClose}>
            关闭
          </button>
        </header>
        <div className="concept-modal-body">
          <p className="concept-modal-lead">{intro}</p>
          {concepts.map((c) => (
            <section key={c.id} className="chapter-section">
              <h3 className="chapter-term">{c.term}</h3>
              <p className="chapter-teaser">{c.teaser}</p>
              <p className="concept-modal-text">{c.body}</p>
              {c.tips && c.tips.length > 0 && (
                <ul className="concept-modal-tips">
                  {c.tips.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
              {c.practice && (
                <p className="chapter-practice">
                  实操目标：{c.practice.label}（命令可在卡内「显示命令」后查看）
                </p>
              )}
              <button
                type="button"
                className="btn-mini chapter-goto"
                onClick={() => onOpenConcept(c.id)}
              >
                在提交图上高亮
              </button>
            </section>
          ))}
        </div>
        <footer className="concept-modal-foot">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            开始练习
          </button>
        </footer>
      </div>
    </div>
  );
}
