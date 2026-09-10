interface Props {
  branch: string;
  onReset: () => void;
  showHelp: boolean;
  onToggleHelp: () => void;
}

export function TopBar({ branch, onReset, showHelp, onToggleHelp }: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden />
        <div>
          <div className="brand-title">Git 可视化教学沙箱</div>
          <div className="brand-sub">输入命令 · 观察分支图 · 查看讲解</div>
        </div>
      </div>
      <div className="topbar-actions">
        <span className="branch-pill" title="当前分支">
          {branch}
        </span>
        <button type="button" className="btn" onClick={onToggleHelp}>
          {showHelp ? '收起说明' : '说明'}
        </button>
        <button type="button" className="btn btn-primary" onClick={onReset}>
          重置沙箱
        </button>
      </div>
    </header>
  );
}
