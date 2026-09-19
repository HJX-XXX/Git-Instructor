import { useEffect } from 'react';
import type { LevelConcept } from '../levels/types';

interface Props {
  concept: LevelConcept;
  read: boolean;
  onClose: () => void;
  onMarkRead: () => void;
  onHighlight: () => void;
}

export function ConceptModal({ concept, read, onClose, onMarkRead, onHighlight }: Props) {
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
        className="concept-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="concept-modal-title"
      >
        <header className="concept-modal-head">
          <div>
            <div className="concept-modal-kicker">本节学习内容</div>
            <h2 id="concept-modal-title">{concept.term}</h2>
          </div>
          <button type="button" className="btn-mini" onClick={onClose}>
            关闭
          </button>
        </header>
        <div className="concept-modal-body">
          <p className="concept-modal-lead">{concept.teaser}</p>
          <p className="concept-modal-text">{concept.body}</p>
          {concept.tips && concept.tips.length > 0 && (
            <div className="concept-tips-block">
              <p className="concept-tips-label">要点</p>
              <ul className="concept-modal-tips">
                {concept.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <footer className="concept-modal-foot">
          <button
            type="button"
            className="btn"
            onClick={() => {
              onHighlight();
            }}
          >
            在提交图上高亮
          </button>
          <button
            type="button"
            className={`btn btn-primary${read ? ' is-done' : ''}`}
            disabled={read}
            onClick={onMarkRead}
          >
            {read ? '已理解' : '我已理解'}
          </button>
        </footer>
      </div>
    </div>
  );
}
