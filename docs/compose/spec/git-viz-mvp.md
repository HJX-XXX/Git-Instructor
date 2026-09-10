---
feature: git-viz-mvp
status: in-progress
updated: 2026-02-14
branch: feat/git-viz-mvp
commits: ef0a4bb..ef0a4bb
---

# Git 可视化教学沙箱（MVP）

## Report

## [S1] Problem

Java 后端开发者日常会用 Git GUI，但命令行能力不牢：看不清 `switch` / `merge` / `reset` / `rebase` 对分支图的真实影响，也缺少随叫随到的语句速查。需要一个**安全、可重置**的 Web 沙箱：输入 Git 命令后立刻看到 commit graph 上的分支/指针变化，并在旁侧用中文提示框解释「刚刚发生了什么」与常用语句。

## [S2] Design

### 产品形态

- 纯前端单页 Web 应用（Vite + React 18 + TypeScript），无后端。
- 自研 **模拟 Git 引擎**（内存数据结构），不执行真实 `git`，可任意重置。
- 界面语言：简体中文。

### 视觉方向（Style Anchor）

- **锚点**：Learn Git Branching 的「可玩教学图」+ Linear 式冷静工具栏。
- **气质**：工作台 / 实验台，而不是玩具；给后端同学的 IDE 旁工具感。
- **调色**：
  - 应用底 `#F5F6F8`，面板 `#FFFFFF`，墨色 `#111827`，次要字 `#6B7280`，描边 `#E5E7EB`
  - 终端条 `#0F172A` / 终端字 `#E2E8F0`
  - 强调（HEAD / 当前分支）`#F97316`
  - 提交节点 `#22C55E`，其它分支 `#8B5CF6`，远程占位 `#3B82F6`，危险操作 `#EF4444`
- **字体**：UI 用 `Inter, "PingFang SC", "Microsoft YaHei", system-ui`；命令/提交 ID 用 `"JetBrains Mono", ui-monospace, Consolas, monospace`。
- **布局**（≥1100px）：三栏——左 速查提示（280px）｜中 提交图 + 终端｜右 刚刚发生了什么（300px）。窄屏改为上下堆叠。
- **签名时刻**：
  1. 命令成功后，引用标签（分支名 / HEAD）滑动/淡入到新位置并轻脉冲；
  2. 新 commit 节点缩放进入；
  3. 右侧讲解框以短动画切换为该命令的中文解释。

### 领域模型（模拟引擎）

```ts
type CommitId = string; // 短 hash，如 "a1b2c3d"

interface Commit {
  id: CommitId;
  parents: CommitId[];      // merge 可有 2 个 parent
  message: string;
  createdAt: number;        // 单调递增即可
}

type Head =
  | { kind: "branch"; name: string }
  | { kind: "detached"; commitId: CommitId };

interface RepoState {
  commits: Record<CommitId, Commit>;
  branches: Record<string, CommitId>; // branch name -> tip
  head: Head;
  /** 装饰用工作区文件名，用于 status 文案 */
  workingFiles: string[];
  /** 是否有未提交改动（影响 status / commit 提示） */
  dirty: boolean;
}

interface CommandResult {
  ok: boolean;
  state: RepoState;           // 失败时为未变更的原 state
  stdout: string[];           // 终端可见输出（中文）
  explanation: Explanation;   // 右侧讲解
  highlights?: {
    createdCommits?: CommitId[];
    movedRefs?: string[];
    deletedRefs?: string[];
    newHead?: boolean;
  };
}

interface Explanation {
  title: string;      // 例：创建合并提交
  summary: string;    // 1–2 句发生了什么
  detail?: string;    // 可选：对比真实 git 的注意点
  related?: string[]; // 相关速查命令
}
```

- 引擎为纯函数：`applyCommand(state, input): CommandResult`。
- 引擎自带 `createInitialDemoState()`：已有 `main` 上 3 个提交，HEAD 指向 `main`，便于开箱即玩。
- 全局 `reset()` 恢复 demo 状态。

### 支持的命令（MVP）

| 命令 | 行为摘要 |
|------|----------|
| `help` / `git help` | 列出支持命令 |
| `git status` | 读 `head` / dirty / workingFiles，不改图 |
| `git commit -m "<msg>"` | 在 HEAD tip 上新 commit（HEAD 分支 tip 前进） |
| `git branch <name>` | 在当前 tip 建分支 |
| `git branch -d\|-D <name>` | 删除分支（`-d` 拒绝未合并到当前分支的 tip） |
| `git switch <name>` / `git checkout <name>` | 切换分支 |
| `git switch -c <name>` / `git checkout -b <name>` | 新建并切换 |
| `git merge <name>` | fast-forward 或双 parent merge commit；already up to date / 冲突文案（MVP 不做手动解决） |
| `git reset --soft\|--mixed\|--hard HEAD~<n>` | 移动当前分支 tip；--hard 清 dirty |
| `git revert <hash>\|HEAD` | 反向 commit |
| `git rebase <branch>` | 线性 rebase：把当前分支独有 commit 重放到目标 tip |
| `git log` / `git log --oneline` | 终端文本日志，不改图 |

解析规则：

- 输入可省略前缀 `git `。
- 支持引号消息；未知子命令返回 `ok:false` + 友好中文错误。
- hash 匹配支持短前缀唯一匹配。

### 图布局

- 对可达 commit 做拓扑排序（按 createdAt + parent 链），自上而下时间轴（新提交在上，与常见 Git GUI 一致可改为新下——**固定为新提交在上方**）。
- 每个 commit 一列 lane 尽量少交叉；merge parent 用曲线连到节点。
- 分支标签画在 tip 右侧；`HEAD` 用强调色徽标。

### UI 组件结构

```
src/
  engine/
    types.ts
    hash.ts
    parse.ts
    apply.ts
    demo.ts
    layout.ts
  data/
    cheatsheet.ts
  components/
    AppShell.tsx
    CommitGraph.tsx
    RefLabels.tsx
    TerminalPanel.tsx
    CheatsheetPanel.tsx
    ExplanationPanel.tsx
    TopBar.tsx
  App.tsx
  index.css
```

### 交互流

1. 用户在终端输入命令回车（或点击速查中的「填入」按钮）。
2. `applyCommand` 返回结果；成功则整树替换 state，失败保留原 state。
3. 图根据 `highlights` 脉冲；终端追加 stdout；右侧显示 explanation。
4. 顶栏「重置沙箱」一键回到 demo 状态。

### 错误与边界

- 空命令、仅 `git`、未知命令 → 中文错误提示，state 不变。
- 删除当前分支、merge 自己、reset 到不存在的提交 → 明确拒绝。
- `rebase` 无独有提交 → “Current branch is up to date”。
- 不实现：remote/fetch/pull/push、stash、cherry-pick、interactive rebase、真实文件暂存区。

## [S3] Out of Scope

- 真实 Git 执行、文件系统、远程仓库
- 关卡式课程与进度系统
- 多语言 i18n
- PWA / Electron 打包
- 用户自定义初始仓库导入

## Tasks

- [x] T1: 应用壳与设计 token — acceptance: 三栏布局与中文 UI 骨架可渲染，含重置按钮（covers: S2 视觉/布局）
- [x] T2: 模拟引擎类型与哈希/解析 — acceptance: 可解析 MVP 命令字符串为结构化指令；短 hash 前缀唯一匹配单测通过（covers: S2 领域模型/解析）
- [x] T3: applyCommand 全命令实现 — acceptance: 对 commit/branch/switch/merge/reset/revert/rebase/status/log 的核心路径有单测且通过（covers: S2 支持的命令）
- [x] T4: demo 状态与重置 — acceptance: 初始有 main×3 提交；重置后与初始 state 深等（covers: S2 demo）
- [x] T5: 图布局算法 — acceptance: 给定 demo 与 merge 后状态，节点 y 递增、lane 分配稳定，单测通过（covers: S2 图布局）
- [x] T6: CommitGraph SVG 组件 — acceptance: 渲染节点、父边、分支标签与 HEAD，应用 highlights 动画 class（covers: S2 签名时刻/组件）
- [x] T7: 终端面板与命令流 — acceptance: 回车执行、历史上下、错误不改 state，stdout 追加（covers: S2 交互流）
- [x] T8: 速查提示方框 — acceptance: 分类展示命令卡片，点击填入终端；过滤可用（covers: S2 交互流/cheatsheet）
- [x] T9: 讲解面板 — acceptance: 每次命令后展示 title/summary/detail/related（covers: S2 签名时刻）
- [x] T10: 构建与质量门禁 — acceptance: `npm run lint`、`npm test`、`npm run build` 全绿（covers: S2/S3 验证边界）
