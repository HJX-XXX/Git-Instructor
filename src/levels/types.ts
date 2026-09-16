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
  /** 实操提示：一点即可填入终端的命令 */
  practice?: {
    label: string;
    command: string;
  };
}

export interface LevelCheckCtx {
  before: WorldState;
  after: WorldState;
  log: LevelLogEntry[];
  readConcepts?: string[];
}

export interface LevelDef {
  id: number;
  /** 所属阶段 id，与 STAGES 对应 */
  stageId: string;
  title: string;
  /** 左栏关卡说明：一句话学习内容 */
  story: string;
  /** 进关时右栏导读（可选，未配置时用 story） */
  intro?: {
    summary: string;
    detail?: string;
  };
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

export interface StageDef {
  id: string;
  title: string;
  summary: string;
}

export interface LevelProgress {
  profile: SkillProfile | null;
  completed: number[];
  currentLevelId: number;
}
