# Git 可视化教学沙箱 · 产品文档

- 版本：v0.2（与实现同步）
- 更新日期：2026-09-24
- 形态：纯前端 Web 单页应用
- 面向：日常会用 Git、但想系统练命令行的 Java / 后端开发者
- 仓库：`git-viz-sandbox`（部署：GitHub Pages）

---

## 1. 一句话

在浏览器里输入 Git 命令，立刻看到提交图上的分支与指针怎么变；关卡课程手把手练命令，中文讲解说清「刚刚发生了什么」，速查方框随叫随到。

## 2. 背景与问题

| 现状 | 痛点 |
|------|------|
| 日常用 GUI / IDE 的 Git 面板 | 看不见命令对 DAG 的真实影响 |
| 需要时再搜博客 | 缺「随叫随到」的语句速查 |
| 在真实仓库里试命令 | 怕把分支搞乱，不敢 reset / rebase |

因此提供一个**可无限重置**的模拟环境：只改内存模型，不碰真实仓库。

## 3. 产品目标

1. **命令 → 图**：执行核心 Git 命令后，提交图更新，并高亮新建的 commit、移动的分支/HEAD。
2. **关卡驱动学习**：六阶段关卡体系，概念卡 + 实操通关，进度可持久化。
3. **提示方框**：左侧分类速查；右侧每次执行后的中文讲解。
4. **开箱即玩**：预置演示仓库与多用户协作场景，一键重置沙箱。
5. **安全**：全程模拟，永不执行真实 `git`。

**非目标**

- 真实文件工作区 / 与磁盘同步
- 交互式 rebase、tag、子模块、hook 等高级主题
- 账号系统、云端进度、排行榜
- Electron / 移动端深度适配（窄屏仅保证可滚动堆叠）

## 4. 用户与场景

**主用户**：后端开发，会提交代码，但对分支模型命令不熟。

**典型场景 A — 跟关卡走完 merge**

1. 在 `main` 上 commit 几次  
2. `git switch -c feature` 再 commit  
3. `git switch main` 后 `git merge feature`  
4. 观察：何时出现合并提交（双父节点），何时只是 fast-forward  

**典型场景 B — 敢用 reset**

1. 在错误分支上多 commit 了两次  
2. `git reset --soft HEAD~2` / `--hard HEAD~2`  
3. 对比：分支 tip 怎么回退，讲解框说明 soft / mixed / hard 的差别  

**典型场景 C — 看懂协作**

1. Alice `git push` 到 origin  
2. 切换 Bob，`git fetch` / `git pull`  
3. 体验 push 被拒时为什么要先拉再推  

**典型场景 D — 速查**

1. 左侧搜「删分支」  
2. 点击卡片填入终端  
3. 改参数后回车执行  

## 5. 功能范围

### 5.1 应用模式

| 模式 | 说明 |
|------|------|
| 新手引导（onboarding） | 选择技能档（入门 / 进阶），简短上手 |
| 关卡（level） | L1–L25 结构化课程，按目标实操通关 |
| 自由沙箱（free） | 不限命令的模拟仓库，可随时重置 |

技能档 `beginner` / `advanced` 影响引导节奏与默认进入路径；关卡内容本身一致。

### 5.2 命令集（模拟）

| 命令 | 说明 |
|------|------|
| `help` | 列出支持命令 |
| `git status` | 当前分支、工作区/暂存区状态、HEAD 指向 |
| `git log` / `--oneline` | 终端文本日志 |
| `git commit -m "<msg>"` | 在当前 tip 上新建提交（含暂存区语义） |
| `git branch <name>` | 在当前 tip 建分支 |
| `git branch -d` / `-D <name>` | 删分支；`-d` 拒绝未合并 tip |
| `git switch <name>` / `git checkout <name>` | 切换分支 |
| `git switch -c` / `git checkout -b <name>` | 新建并切换 |
| `git merge <name>` | FF；分叉且干净 → 双父 merge commit；分叉且 dirty → CONFLICT |
| `git reset --soft\|--mixed\|--hard HEAD~n` | 移动当前分支 tip，并按模式影响两区 |
| `git revert <hash>\|HEAD` | 生成反向提交 |
| `git rebase <branch>` / `git rebase origin/<branch>` | 把当前分支独有提交重放到目标 tip |
| `git push [-u] [branch]` | 推送到 origin；远程有未知提交时被拒 |
| `git fetch` | 只更新远程引用 |
| `git pull [branch]` | fetch + 合并（分叉时生成 merge commit） |
| `git remote` / `-v` | 查看远程 |
| `git init` | 新建空仓库 |
| `git clone [url]` | 从远程复制完整历史 |
| `git add` / `--all` / `-A` / `.` | 工作区 → 暂存区 |
| `git diff` / `--staged` | 看未暂存 / 已暂存差异 |
| `git restore` / `--staged` | 丢工作区改动 / 只撤暂存 |
| `git stash` / `pop` / `list` | 暂存现场与恢复 |
| `git cherry-pick <hash>` | 把单个提交复制到当前分支 |

输入可省略前缀 `git `。错误命令返回中文说明，**不修改图状态**。

### 5.3 提交图

- 时间轴：新提交在上  
- 节点：圆形 commit，颜色区分；merge 显示双父连线  
- 标签：分支名贴在 tip 旁；HEAD 用橙色强调；远程引用独立显示  
- 动画：新节点进入、引用标签移动并短脉冲；关卡达成后目标元素闪烁提示  

### 5.4 关卡体系

**六阶段 · L1–L25**

| 阶段 | 关卡 | 内容 |
|------|------|------|
| 一 · 基础入门 | L1–L4 | init / clone、HEAD·提交·分支、第一次提交、status / log |
| 二 · 分支与合并 | L5–L8 | 建分支、切换并提交、Fast-forward、双父 merge |
| 三 · 回退与协作 | L9–L10 | reset 回退、push 与 pull |
| 四 · 历史整形 | L11–L14 | reset 抹历史、revert、rebase、cherry-pick |
| 五 · 远程与分支管理 | L15–L19 | fetch 与 pull、push 被拒、pull 合并、删分支、rebase origin |
| 六 · 工作区与暂存区 | L20–L25 | 两区模型、add / commit、diff、restore、stash、soft·mixed·hard |

**关卡要素**

- 目标列表（objective）：按顺序展示，完成后打勾  
- 概念卡（concept）：术语 + 弹窗正文 + 可填入终端的实操命令  
- 提示（hints）与建议命令（suggestedCommands）  
- 通关检查（check）：对比 before/after 世界状态 + 命令日志  
- 通关讲解（winExplanation）  

**进度**

- `localStorage` 持久化：技能档、已通关列表、当前关卡  
- 关卡全部开放可进；阶段内可跳转，通关后自动推进  

**多用户**

- 协作关卡允许顶栏切换 Alice / Bob  
- 命令日志记录执行者，push / pull 场景分别操作两个用户的本地视图  

### 5.5 提示与讲解

**左栏 · 速查方框**

- 分类：查询 / 提交 / 分支 / 切换 / 合并与变基 / 回退 / 协作  
- 卡片：语法、一句话用途、「填入终端」按钮  
- 支持关键词过滤  

**右栏 · 刚刚发生了什么**

- 标题（例：「创建合并提交」）  
- 摘要 1–2 句  
- 细节：与真实 Git 对照时的注意点  
- 相关命令：可点击跳到速查  

### 5.6 顶栏

- 产品名  
- 当前模式 / 关卡标识  
- 模拟用户切换（协作关卡）  
- 「重置沙箱」  
- 简短使用说明入口  

## 6. 交互流程

```text
输入命令 → 解析
    ├─ 非法 → 终端红字提示，图不变
    └─ 合法 → applyCommand
              ├─ 成功 → 替换仓库状态 → 图动画 → 讲解框更新 → 终端 stdout
              └─ 业务拒绝（如删当前分支）→ 中文拒绝原因，图不变
关卡模式下，每次成功执行后追加通关检查 → 目标勾选 / 通关反馈
```

键盘：终端内 `Enter` 执行；`↑` / `↓` 浏览历史。

## 7. 界面结构（桌面优先）

```text
┌──────────────────────────────────────────────────────────┐
│  Git 可视化教学沙箱        [用户] [关卡] [重置沙箱]        │
├────────────┬─────────────────────────────┬───────────────┤
│  速查/关卡 │        提交图（SVG）         │  讲解 / 目标   │
│  搜索框    │                             │               │
│  分类卡片  │                             │  标题/摘要/细节 │
│  或关卡列表│                             │  相关命令      │
│            ├─────────────────────────────┤               │
│            │  终端（深色条）              │               │
│            │  历史输出 + 输入行           │               │
└────────────┴─────────────────────────────┴───────────────┘
```

- 最低目标宽度约 1100px；更窄时：图上、终端中、速查/讲解改为下方页签或堆叠。  
- 配色：浅色工作台底 `#F5F6F8`，白卡片，终端深蓝黑；HEAD/强调橙 `#F97316`；commit 绿 `#22C55E`。  
- 字体：UI 系统无衬线 + 中文黑体；命令与 hash 等宽。

## 8. 技术方案

| 项 | 选型 |
|----|------|
| 框架 | React 19 + TypeScript + Vite 8 |
| Git | 自研内存模拟引擎（纯函数） |
| 状态 | React `useState`（不引入 Redux） |
| 图 | 自研布局 + SVG |
| 测试 | Vitest：解析器 + `applyCommand` + 布局 + 关卡检查 |
| 质量门禁 | Oxlint + `tsc -b` |
| 部署 | GitHub Actions → GitHub Pages |

**目录结构**

```text
src/
├── engine/     # 内存 Git 引擎：parse / apply / world / layout / hash
├── levels/     # 关卡目录、通关检查、阶段、进度
├── components/ # TopBar / CommitGraph / Terminal / LevelPanel / 讲解&速查
├── data/       # 速查卡片数据
└── App.tsx     # onboarding / level / free 三模式编排
```

**仓库状态模型**

- `commits`: id → { parents, message }  
- `branches`: 名 → tip id  
- `head`: 分支 或 游离 commit  
- 工作区文件列表、暂存区、dirty 标记（服务 status / add / restore / stash）  
- `WorldState`：多仓库 + 多用户（alice / bob）+ 远程引用  

## 9. 验收标准

1. 打开页面可走完新手引导，进入关卡或自由沙箱。  
2. 能完成「建分支 → 提交 → 切回 → merge」，图与讲解正确。  
3. `reset --hard/soft`、`revert`、`rebase` 行为与讲解符合语义。  
4. `add` / `diff` / `restore` / `stash` 体现工作区与暂存区差别。  
5. `push` / `fetch` / `pull` 协作闭环可在 Alice/Bob 间走通。  
6. 非法命令不改状态；重置后与初始状态一致。  
7. 关卡目标检查准确，通关后进度持久化。  
8. 速查可过滤、可填入终端。  
9. `npm run lint` / `npm test` / `npm run build` 通过。

## 10. 当前状态与技术债

| 项 | 状态 |
|----|------|
| MVP 命令集 + 提交图 + 速查 + 讲解 | ✅ 已完成 |
| 关卡体系 L1–L25 六阶段 | ✅ 已完成 |
| 工作区 / 暂存区 / stash / cherry-pick | ✅ 已完成 |
| 远程协作（push / fetch / pull / rebase origin） | ✅ 已完成 |
| 单元测试（71+）与构建门禁 | ✅ 全绿 |
| PRD 与实现文档同步 | ✅ 本版 |

**已知债**

- `levels/catalog.ts` / `levels/checks.ts` 体量大，宜拆关或数据化配置  
- `App.tsx` 三模式编排偏厚  
- Oxlint 存在少量 `set-state-in-effect` 警告  

## 11. 后续可迭代

- interactive rebase、tag、stash 进阶场景  
- 双栏对比「你的操作 vs 推荐操作」  
- 导出当前图 / 会话回放  
- 关卡练习错题回顾  
- 更完善的移动端布局  

---

## 请你重点检查

1. **课程范围**是否匹配目标用户（是否要加 tag / interactive rebase）  
2. **关卡顺序**与阶段划分是否符合教学直觉  
3. **验收标准**是否有遗漏  
