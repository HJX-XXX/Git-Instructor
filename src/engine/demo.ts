import type { RepoState } from './types';

/** 预置演示仓库：main 上 3 个提交，HEAD 在 main */
export function createInitialDemoState(): RepoState {
  return {
    commits: {
      a11ce01: {
        id: 'a11ce01',
        parents: [],
        message: 'init: 项目初始化',
        createdAt: 1,
      },
      b22be02: {
        id: 'b22be02',
        parents: ['a11ce01'],
        message: 'feat: 添加 README',
        createdAt: 2,
      },
      c33cf03: {
        id: 'c33cf03',
        parents: ['b22be02'],
        message: 'feat: 搭建基础模块',
        createdAt: 3,
      },
    },
    branches: {
      main: 'c33cf03',
    },
    head: { kind: 'branch', name: 'main' },
    workingFiles: ['README.md', 'src/App.tsx'],
    dirty: false,
    commitSeq: 3,
  };
}
