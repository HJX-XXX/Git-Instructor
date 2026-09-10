# Git 可视化教学沙箱

面向后端开发者的 Git 命令行教学 Web 应用：输入命令，立刻看到提交图上的分支与 HEAD 变化，并附中文讲解与速查提示。

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开终端提示的本地地址即可。预置演示仓库（`main` × 3 commits），顶栏可一键重置。

## 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发服务器 |
| `npm test` | 单元测试（Vitest） |
| `npm run lint` | Oxlint |
| `npm run build` | 类型检查 + 生产构建 |

## 支持的命令

`help` · `git status` · `git commit -m` · `git branch` / `-d` / `-D` · `git switch` / `-c` · `git checkout` / `-b` · `git merge` · `git reset --soft|--mixed|--hard HEAD~n` · `git revert` · `git rebase` · `git log`

引擎为纯前端内存模拟，不会执行真实 Git，也不会读写你的仓库。

## 文档

- 产品文档：`docs/product/PRD.md`
- 实现规格：`docs/compose/spec/git-viz-mvp.md`
