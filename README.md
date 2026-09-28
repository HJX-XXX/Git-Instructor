# Git 可视化教学沙箱

面向后端开发者的 Git 命令行教学 Web 应用：输入命令，立刻看到提交图上的分支与 HEAD 变化，并附中文讲解与速查提示。纯前端内存模拟，不执行真实 Git，也不会读写你的仓库。

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开终端提示的本地地址即可。首次进入会走新手引导，可选「入门 / 进阶」技能档，之后进入关卡模式或自由沙箱。

## 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发服务器 |
| `npm test` | 单元测试（Vitest） |
| `npm run lint` | Oxlint |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run preview` | 预览生产构建 |

## 功能概览

- **三种模式**：新手引导 → 关卡学习（L1–L25）→ 自由沙箱
- **提交图**：SVG 节点/分支/HEAD/远程引用，命令后高亮变化
- **关卡体系**：6 阶段课程，概念卡 + 实操通关检查 + 进度持久化
- **终端沙箱**：命令历史（↑/↓）、错误中文提示、非法命令不改状态
- **速查方框**：分类过滤，一键填入终端
- **讲解栏**：每次执行后解释「刚刚发生了什么」
- **多用户协作**：Alice / Bob 双模拟用户，演示 push / pull 协作闭环

## 课程结构

| 阶段 | 关卡 | 内容 |
|------|------|------|
| 一 · 基础入门 | L1–L4 | init / clone、HEAD·提交·分支、第一次提交、status / log |
| 二 · 分支与合并 | L5–L8 | 建分支、切换并提交、Fast-forward、双父 merge |
| 三 · 回退与协作 | L9–L10 | reset 回退、push 与 pull |
| 四 · 历史整形 | L11–L14 | reset 抹历史、revert、rebase、cherry-pick |
| 五 · 远程与分支管理 | L15–L19 | fetch 与 pull、push 被拒、pull 合并、删分支、rebase origin |
| 六 · 工作区与暂存区 | L20–L25 | 两区模型、add / commit、diff、restore、stash、soft·mixed·hard |

## 支持的命令

`help` · `git status` · `git log` / `--oneline` · `git commit -m` · `git branch` / `-d` / `-D` · `git switch` / `-c` · `git checkout` / `-b` · `git merge` · `git reset --soft|--mixed|--hard HEAD~n` · `git revert` · `git rebase`（含 `origin/<分支>`）· `git push`（含 `-u`）· `git fetch` · `git pull` · `git remote` · `git init` · `git clone` · `git add` · `git diff` / `--staged` · `git restore` / `--staged` · `git stash` / `pop` / `list` · `git cherry-pick`

输入可省略前缀 `git `。引擎为教学用简化模型，与真实 Git 的差异会在讲解栏中标明。

## 文档

- 产品文档：`docs/product/PRD.md`
- 实现规格：`docs/compose/spec/git-viz-mvp.md`

## 许可证

本项目采用 [MIT License](LICENSE) 开源。你可以自由使用、修改、分发和商用，只需保留版权与许可声明。
