import type { StageDef } from './types';

export const STAGES: StageDef[] = [
  {
    id: 's1',
    title: '阶段一 · 基础入门',
    summary: '认识 HEAD / 提交 / 分支，并会用 status、log 查看仓库。',
  },
  {
    id: 's2',
    title: '阶段二 · 分支与合并',
    summary: '建分支、切换、分叉，以及 Fast-forward 与双父 merge。',
  },
  {
    id: 's3',
    title: '阶段三 · 回退与协作',
    summary: '用 reset 拨回指针；用 push / pull 做最简协作。',
  },
  {
    id: 's4',
    title: '阶段四 · 历史整形',
    summary: 'revert 撤销、rebase 线性化、cherry-pick 摘取提交。',
  },
  {
    id: 's5',
    title: '阶段五 · 远程与分支管理',
    summary: 'fetch 与 pull、push 被拒、pull 合并、删除分支与 rebase origin。',
  },
  {
    id: 's6',
    title: '阶段六 · 工作区与暂存区',
    summary: '两区概念、add / diff / restore / stash，以及 soft·mixed·hard 对两区的影响。',
  },
];

export function stageOf(stageId: string): StageDef {
  return STAGES.find((s) => s.id === stageId) ?? STAGES[0]!;
}

export function levelsInStage(stageId: string, levels: { id: number; stageId: string }[]) {
  return levels.filter((l) => l.stageId === stageId);
}

export function nextStageOf(stageId: string): StageDef | null {
  const i = STAGES.findIndex((s) => s.id === stageId);
  if (i < 0 || i + 1 >= STAGES.length) return null;
  return STAGES[i + 1]!;
}

/** 阶段内按目录顺序的下一关；已是最末则 null */
export function nextLevelInStage(
  levelId: number,
  levels: { id: number; stageId: string }[],
): number | null {
  const cur = levels.find((l) => l.id === levelId);
  if (!cur) return null;
  const items = levelsInStage(cur.stageId, levels);
  const i = items.findIndex((l) => l.id === levelId);
  if (i < 0 || i + 1 >= items.length) return null;
  return items[i + 1]!.id;
}

/** 该关是否为本阶段最后一关 */
export function isLastLevelOfStage(
  levelId: number,
  levels: { id: number; stageId: string }[],
): boolean {
  const cur = levels.find((l) => l.id === levelId);
  if (!cur) return false;
  const items = levelsInStage(cur.stageId, levels);
  return items.length > 0 && items[items.length - 1]!.id === levelId;
}

/** 下一阶段的第一关；没有下一阶段则 null */
export function firstLevelOfNextStage(
  levelId: number,
  levels: { id: number; stageId: string }[],
): number | null {
  const cur = levels.find((l) => l.id === levelId);
  if (!cur) return null;
  const stage = nextStageOf(cur.stageId);
  if (!stage) return null;
  return levelsInStage(stage.id, levels)[0]?.id ?? null;
}
