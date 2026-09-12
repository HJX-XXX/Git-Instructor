import type { UserId } from '../engine/types';
import type { AppMode, SkillProfile } from '../levels/types';
import { USER_IDS, USER_META } from '../engine/world';

interface Props {
  activeUser: UserId;
  mode: AppMode;
  profile: SkillProfile | null;
  levelBadge?: string | null;
  onSwitchUser: (id: UserId) => void;
  onResetEmpty: () => void;
  onLoadDemo: () => void;
  onEnterLevel: () => void;
  onEnterFree: () => void;
  onShowOnboarding?: () => void;
}

export function TopBar({
  activeUser,
  mode,
  profile,
  levelBadge,
  onSwitchUser,
  onResetEmpty,
  onLoadDemo,
  onEnterLevel,
  onEnterFree,
}: Props) {
  const inLevel = mode === 'level';
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden />
        <div className="brand-title">Git Instructor</div>
        {levelBadge && <span className="level-badge">{levelBadge}</span>}
      </div>
      <div className="topbar-actions">
        <div className="mode-switch" role="group" aria-label="学习模式">
          <button
            type="button"
            className={`mode-btn${inLevel ? ' is-active' : ''}`}
            onClick={onEnterLevel}
          >
            关卡学习
          </button>
          <button
            type="button"
            className={`mode-btn${!inLevel && mode === 'free' ? ' is-active' : ''}`}
            onClick={onEnterFree}
          >
            自由练习
          </button>
        </div>
        {profile === 'beginner' && inLevel && (
          <span className="profile-chip">新手路径</span>
        )}
        <div
          className="user-switch-wrap"
          title="人物切换：Alice / Bob 各有独立本地仓库与终端；共享远程 origin"
        >
          <span className="user-switch-label">
            <span className="user-switch-icon" aria-hidden>
              ⇄
            </span>
            人物切换
          </span>
          <div className="user-switch" role="group" aria-label="切换模拟用户">
            {USER_IDS.map((id) => {
              const meta = USER_META[id];
              const active = id === activeUser;
              return (
                <button
                  key={id}
                  type="button"
                  className={`user-btn${active ? ' is-active' : ''}`}
                  style={
                    active
                      ? { background: meta.color, borderColor: meta.color, color: '#fff' }
                      : undefined
                  }
                  onClick={() => onSwitchUser(id)}
                  title={`切换到 ${meta.label}（独立本地仓库与终端）`}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
        {!inLevel && (
          <>
            <button type="button" className="btn" onClick={onLoadDemo} title="两人相同的 main 历史">
              加载演示
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onResetEmpty}
              title="两人都清空"
            >
              重置空白
            </button>
          </>
        )}
      </div>
    </header>
  );
}
