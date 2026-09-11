import type { UserId } from '../engine/types';
import { USER_IDS, USER_META } from '../engine/world';

interface Props {
  branch: string;
  commitCount: number;
  activeUser: UserId;
  onSwitchUser: (id: UserId) => void;
  onResetEmpty: () => void;
  onLoadDemo: () => void;
  showHelp: boolean;
  onToggleHelp: () => void;
}

export function TopBar({
  branch,
  commitCount,
  activeUser,
  onSwitchUser,
  onResetEmpty,
  onLoadDemo,
  showHelp,
  onToggleHelp,
}: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden />
        <div>
          <div className="brand-title">Git 可视化教学沙箱</div>
          <div className="brand-sub">
            双用户协作 · {commitCount} 个本地提交 · {branch}
          </div>
        </div>
      </div>
      <div className="topbar-actions">
        <div className="user-switch" role="group" aria-label="切换模拟用户">
          {USER_IDS.map((id) => {
            const meta = USER_META[id];
            const active = id === activeUser;
            return (
              <button
                key={id}
                type="button"
                className={`user-btn${active ? ' is-active' : ''}`}
                style={active ? { background: meta.color, borderColor: meta.color, color: '#fff' } : undefined}
                onClick={() => onSwitchUser(id)}
                title={`${meta.label} 的本地仓库`}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
        <button type="button" className="btn" onClick={onToggleHelp}>
          {showHelp ? '收起说明' : '说明'}
        </button>
        <button type="button" className="btn" onClick={onLoadDemo} title="两人相同的 main 历史">
          加载演示
        </button>
        <button type="button" className="btn btn-primary" onClick={onResetEmpty} title="两人都清空">
          重置空白
        </button>
      </div>
    </header>
  );
}
