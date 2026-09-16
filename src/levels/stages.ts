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
    summary: 'soft / hard 对比、revert 撤销、rebase 线性化。',
  },
  {
    id: 's5',
    title: '阶段五 · 远程与分支管理',
    summary: 'fetch 与 pull、push 被拒、pull 合并、删除分支与 rebase origin。',
  },
];

export function stageOf(stageId: string): StageDef {
  return STAGES.find((s) => s.id === stageId) ?? STAGES[0]!;
}

export function levelsInStage(stageId: string, levels: { id: number; stageId: string }[]) {
  return levels.filter((l) => l.stageId === stageId);
}
