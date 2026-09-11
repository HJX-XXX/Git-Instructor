export type CommitId = string;

export interface Commit {
  id: CommitId;
  parents: CommitId[];
  message: string;
  createdAt: number;
}

export type Head =
  | { kind: 'branch'; name: string }
  | { kind: 'detached'; commitId: CommitId };

export interface RepoState {
  commits: Record<CommitId, Commit>;
  branches: Record<string, CommitId>;
  head: Head;
  workingFiles: string[];
  dirty: boolean;
  /** 用于生成稳定短 hash 的计数器 */
  commitSeq: number;
}

export type UserId = 'alice' | 'bob';

export interface WorldState {
  activeUser: UserId;
  users: Record<UserId, RepoState>;
  /** 共享远程仓库：分支名 → tip */
  remoteBranches: Record<string, CommitId>;
  /** 远程上的提交对象 */
  remoteCommits: Record<CommitId, Commit>;
}

export interface WorldCommandResult {
  ok: boolean;
  world: WorldState;
  stdout: string[];
  explanation: Explanation;
  highlights?: Highlights;
  /** 仅当切换用户时设置 */
  switchedUser?: UserId;
}

export interface Highlights {
  createdCommits?: CommitId[];
  movedRefs?: string[];
  deletedRefs?: string[];
  newHead?: boolean;
  /** 远程相关引用（origin/main 等） */
  remoteRefs?: string[];
}

export interface Explanation {
  title: string;
  summary: string;
  detail?: string;
  related?: string[];
}

export interface CommandResult {
  ok: boolean;
  state: RepoState;
  stdout: string[];
  explanation: Explanation;
  highlights?: Highlights;
}

export type ResetMode = 'soft' | 'mixed' | 'hard';

export type ParsedCommand =
  | { type: 'help' }
  | { type: 'status' }
  | { type: 'log'; oneline: boolean }
  | { type: 'commit'; message: string }
  | { type: 'branch_create'; name: string }
  | { type: 'branch_delete'; name: string; force: boolean }
  | { type: 'switch'; name: string; create: boolean }
  | { type: 'merge'; name: string }
  | { type: 'reset'; mode: ResetMode; steps: number }
  | { type: 'revert'; target: string }
  | { type: 'rebase'; target: string }
  | { type: 'push'; branch?: string; setUpstream: boolean }
  | { type: 'fetch' }
  | { type: 'pull'; branch?: string }
  | { type: 'remote_list' }
  | { type: 'unknown'; raw: string; hint: string };
