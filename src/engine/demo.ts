import type { RepoState } from './types';

/** 未 init 的空白工作区：提交图完全为空 */
export function createUninitializedRepoState(): RepoState {
  return {
    commits: {},
    branches: {},
    head: { kind: 'branch', name: 'main' },
    workingFiles: [],
    dirty: false,
    staged: false,
    stash: [],
    initialized: false,
    commitSeq: 0,
  };
}

/** 已 init 的空仓库：main 尚无提交，图上只有 git init 锚点 */
export function createEmptyRepoState(): RepoState {
  return {
    commits: {},
    branches: {},
    head: { kind: 'branch', name: 'main' },
    workingFiles: [],
    dirty: false,
    staged: false,
    stash: [],
    initialized: true,
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
    staged: false,
    stash: [],
    initialized: true,
    commitSeq: 3,
  };
}

/** 关卡 0 概念演示：main 与 feature 分叉，便于看清分支标签 */
export function createConceptDemoRepo(): RepoState {
  return {
    commits: {
      a11ce01: {
        id: 'a11ce01',
        parents: [],
        message: 'init: 初始化',
        createdAt: 1,
      },
      b22be02: {
        id: 'b22be02',
        parents: ['a11ce01'],
        message: 'feat: 功能 A',
        createdAt: 2,
      },
      c33cf03: {
        id: 'c33cf03',
        parents: ['b22be02'],
        message: 'fix: 修复 B',
        createdAt: 3,
      },
      d44ee04: {
        id: 'd44ee04',
        parents: ['a11ce01'],
        message: 'feat: 实验功能',
        createdAt: 4,
      },
    },
    branches: {
      main: 'c33cf03',
      feature: 'd44ee04',
    },
    head: { kind: 'branch', name: 'main' },
    workingFiles: [],
    dirty: false,
    staged: false,
    stash: [],
    initialized: true,
    commitSeq: 4,
  };
}
