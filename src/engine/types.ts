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

export interface Highlights {
  createdCommits?: CommitId[];
  movedRefs?: string[];
  deletedRefs?: string[];
  newHead?: boolean;
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
  | { type: 'unknown'; raw: string; hint: string };
