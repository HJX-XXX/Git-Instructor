import type { SkillProfile } from '../levels/types';

interface Props {
  onChoose: (profile: SkillProfile) => void;
}

export function Onboarding({ onChoose }: Props) {
  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-label="选择学习路径">
      <div className="onboarding-card">
        <div className="onboarding-brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <h1>Git Instructor</h1>
            <p>在浏览器里练命令行，立刻看到提交图怎么变</p>
          </div>
        </div>
        <h2 className="onboarding-q">你对 Git 的了解程度是？</h2>
        <p className="onboarding-sub">之后可在顶栏随时切换「关卡学习 / 自由练习」。</p>
        <div className="onboarding-choices">
          <button
            type="button"
            className="choice-card choice-beginner"
            onClick={() => onChoose('beginner')}
          >
            <span className="choice-badge">推荐</span>
            <span className="choice-title">我是新手</span>
            <span className="choice-desc">
              从概念导读开始，按关卡学 commit、分支与 HEAD。完成后进入自由沙箱。
            </span>
            <span className="choice-meta">导读 + 8 关 · 约 25 分钟</span>
          </button>
          <button
            type="button"
            className="choice-card choice-advanced"
            onClick={() => onChoose('advanced')}
          >
            <span className="choice-title">我已经会一些</span>
            <span className="choice-desc">
              直接进入自由沙箱：可加载双人演示，练习 merge / reset / push / pull。
            </span>
            <span className="choice-meta">需要时仍可从顶栏进入关卡</span>
          </button>
        </div>
      </div>
    </div>
  );
}
