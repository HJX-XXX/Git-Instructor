import { useEffect } from 'react';

interface Props {
  title: string;
  kicker: string;
  intro: string;
  introDetail?: string;
  onClose: () => void;
}

/** 本章导读：只介绍学习目的，不展开概念卡全文 */
export function ChapterLearnModal({ title, kicker, intro, introDetail, onClose }: Props) {
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
          {introDetail && <p className="concept-modal-text">{introDetail}</p>}
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
