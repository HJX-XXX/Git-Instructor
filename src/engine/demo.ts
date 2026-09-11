import type { RepoState } from './types';

/** 空白仓库：类似 git init，main 尚无提交 */
export function createEmptyRepoState(): RepoState {
  return {
    commits: {},
    branches: {},
    head: { kind: 'branch', name: 'main' },
    workingFiles: [],
    dirty: false,
    commitSeq: 0,
  };
}

/** 可选演示仓库：main 上 3 个提交，用于快速观察历史图 */
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
