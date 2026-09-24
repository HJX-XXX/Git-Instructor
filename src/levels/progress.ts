import { LEVELS, getLevel } from './catalog';
import { firstLevelOfNextStage, isLastLevelOfStage, nextLevelInStage } from './stages';
import type { LevelProgress, SkillProfile } from './types';

const STORAGE_KEY = 'git-instructor:progress:v2';
const LEGACY_STORAGE_KEY = 'git-instructor:progress';

/** 旧目录按创建顺序编号；新目录按阶段学习顺序编号。 */
const LEGACY_LEVEL_IDS: Record<number, number> = {
  11: 25, 12: 11, 13: 12, 14: 13, 15: 20,
  16: 21, 17: 22, 18: 23, 19: 24, 20: 14,
  21: 15, 22: 16, 23: 17, 24: 18, 25: 19,
};

function migrateLevelId(id: number): number {
  return LEGACY_LEVEL_IDS[id] ?? id;
}

export function defaultProgress(): LevelProgress {
  return {
    profile: null,
    completed: [],
    currentLevelId: LEVELS[0]?.id ?? 0,
  };
}

export function loadProgress(): LevelProgress {
  if (typeof localStorage === 'undefined') return defaultProgress();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const raw = saved ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw) as Partial<LevelProgress>;
    const completed = Array.isArray(parsed.completed)
      ? parsed.completed
          .filter((n) => typeof n === 'number')
          .map((n) => saved == null ? migrateLevelId(n) : n)
          .filter((n) => Boolean(getLevel(n)))
      : [];
    const savedLevelId = typeof parsed.currentLevelId === 'number'
      ? saved == null ? migrateLevelId(parsed.currentLevelId) : parsed.currentLevelId
      : null;
    const current =
      savedLevelId != null && getLevel(savedLevelId)
        ? savedLevelId
        : (LEVELS[0]?.id ?? 1);
    const profile =
      parsed.profile === 'beginner' || parsed.profile === 'advanced' ? parsed.profile : null;
    const progress = { profile, completed: [...new Set(completed)], currentLevelId: current };
    if (saved == null) saveProgress(progress);
    return progress;
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(progress: LevelProgress): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function isLevelUnlocked(
  _levelId: number,
  _completed: number[],
  _all: { id: number }[] = LEVELS,
): boolean {
  // 所有关卡均可直接进入学习，不要求先通关上一关
  return true;
}

/** 学习路径上的下一关：阶段内下一关 → 下一阶段首关 → 全部学完为 null */
export function nextLevelId(
  currentId: number,
  _completed: number[],
  all: { id: number; stageId: string }[] = LEVELS,
): number | null {
  const inStage = nextLevelInStage(currentId, all);
  if (inStage != null) return inStage;
  if (isLastLevelOfStage(currentId, all)) {
    return firstLevelOfNextStage(currentId, all);
  }
  // 兜底：目录顺序下一关（兼容未挂 stage 的数据）
  const idx = all.findIndex((l) => l.id === currentId);
  if (idx < 0 || idx + 1 >= all.length) return null;
  return all[idx + 1]!.id;
}

export function markCompleted(progress: LevelProgress, levelId: number): LevelProgress {
  if (progress.completed.includes(levelId)) return progress;
  return { ...progress, completed: [...progress.completed, levelId] };
}

export function withProfile(profile: SkillProfile): LevelProgress {
  const base = loadProgress();
  return { ...base, profile, currentLevelId: base.currentLevelId || (LEVELS[0]?.id ?? 1) };
}
