import type { Explanation, WorldState } from '../engine/types';

export type SkillProfile = 'beginner' | 'advanced';
export type AppMode = 'onboarding' | 'level' | 'free';

export interface LevelLogEntry {
  input: string;
  ok: boolean;
}

export interface LevelObjectiveState {
  id: string;
  label: string;
  done: boolean;
}

export interface LevelCheckResult {
  win: boolean;
  objectives: LevelObjectiveState[];
  feedback: string;
}

export interface LevelConcept {
  id: string;
  term: string;
  /** 列表里的一句话介绍 */
  teaser: string;
  /** 弹层正文（初学者友好） */
  body: string;
  /** 弹层里的要点列表 */
  tips?: string[];
}

export interface LevelCheckCtx {
  before: WorldState;
  after: WorldState;
  log: LevelLogEntry[];
  readConcepts?: string[];
}

export interface LevelDef {
  id: number;
  title: string;
  story: string;
  /** 展示用目标文案，与 check 中 objective id 顺序对应 */
  objectiveLabels: string[];
  startWorld: () => WorldState;
  hints: string[];
  suggestedCommands: string[];
  /** 可选：概念卡片（导读关用） */
  concepts?: LevelConcept[];
  /** 协作关：允许切换 Alice/Bob */
  allowMultiUser?: boolean;
  winExplanation: Explanation;
  check: (ctx: LevelCheckCtx) => LevelCheckResult;
}

export interface LevelProgress {
  profile: SkillProfile | null;
  completed: number[];
  currentLevelId: number;
}
