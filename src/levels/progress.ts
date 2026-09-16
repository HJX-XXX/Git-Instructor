import { LEVELS, getLevel } from './catalog';
import type { LevelProgress, SkillProfile } from './types';

const STORAGE_KEY = 'git-instructor:progress';

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
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw) as Partial<LevelProgress>;
    const completed = Array.isArray(parsed.completed)
      ? parsed.completed.filter((n) => typeof n === 'number')
      : [];
    const current =
      typeof parsed.currentLevelId === 'number' && getLevel(parsed.currentLevelId)
        ? parsed.currentLevelId
        : (LEVELS[0]?.id ?? 1);
    const profile =
      parsed.profile === 'beginner' || parsed.profile === 'advanced' ? parsed.profile : null;
    return { profile, completed: [...new Set(completed)], currentLevelId: current };
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

export function nextLevelId(
  currentId: number,
  _completed: number[],
  all: { id: number }[] = LEVELS,
): number | null {
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
