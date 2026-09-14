import {
  applyWorldCommand,
  createConceptDemoWorld,
  createDemoWorld,
  createEmptyWorld,
} from '../engine/world';
import type { WorldState } from '../engine/types';
import {
  checkLevel0,
  checkLevel1,
  checkLevel2,
  checkLevel3,
  checkLevel4,
  checkLevel5,
  checkLevel6,
  checkLevel7,
  checkLevel8,
} from './checks';
import type { LevelDef } from './types';

function mustRun(world: WorldState, cmds: string[]): WorldState {
  let w = world;
  for (const c of cmds) {
    const r = applyWorldCommand(w, c);
    if (!r.ok) throw new Error(`level start failed: ${c} → ${r.stdout.join(' | ')}`);
    w = r.world;
  }
  return w;
}

/** main 落后 feature：feature 多一笔，HEAD 在 main */
function startL5(): WorldState {
  return mustRun(createDemoWorld(), [
    'git switch -c feature',
    'git commit -m "feat: feature 独有改动"',
    'git switch main',
  ]);
}

/** 双方各自有提交 */
function startL6(): WorldState {
  return mustRun(createDemoWorld(), [
    'git switch -c feature',
    'git commit -m "feat: feature 改动"',
    'git switch main',
    'git commit -m "fix: main 改动"',
  ]);
}

/** main 上多一个待回退的提交 */
function startL7(): WorldState {
  return mustRun(createDemoWorld(), ['git commit -m "oops: 提交错了"']);
}

/** 协作：双方与远程共享同一 base main */
function startL8(): WorldState {
  return createDemoWorld();
}

export const LEVELS: LevelDef[] = [
  {
    id: 0,
    title: '认识 HEAD、提交与分支',
    story:
      '对照中间提交图：底部 a11ce01「init: 初始化」，main 线在 b22be02、c33cf03（HEAD 当前在 main），另有 feature 线在 d44ee04。请把 HEAD 切到 feature，再新建 hotfix，并完成一条提交。',
    objectiveLabels: [
      '把 HEAD 指向 feature',
      '提交说明为「这是我的提交」的 commit',
      '创建分支 hotfix',
    ],
    startWorld: () => createConceptDemoWorld(),
    concepts: [
      {
        id: 'head',
        term: '1 · HEAD',
        teaser: '看图：橙色 HEAD 现在指向 main。把 HEAD 改为指向 feature。',
        body:
          'HEAD 是 Git 的一个特殊指针（引用），通常指向「当前分支名」，而不是直接指向某个提交。链路是：HEAD → 当前分支 → 该分支最新提交（分支名所指的那个圆点）。当前图上：HEAD → main → c33cf03「fix: 修复 B」；feature 最新提交是 d44ee04「feat: 实验功能」。请把 HEAD 改为指向 feature，之后的 commit 会记在 feature 上。',
        tips: [
          '橙色 HEAD 箭头指向谁，谁就是当前分支',
          'commit 只会推进 HEAD 所指向的那条分支',
          '切换分支只改 HEAD 的指向，不会新建提交',
        ],
        practice: {
          label: '把 HEAD 从 main 改为指向 feature',
          command: 'git switch feature',
        },
      },
      {
        id: 'commit',
        term: '2 · 提交 · commit',
        teaser:
          '图上每个绿/彩圆点都是一次提交。HEAD 指到 feature 后，再记一条说明为「这是我的提交」的提交。',
        body:
          '提交是历史上的存档点。这张演示图已有：a11ce01「init: 初始化」→（main 线）b22be02「feat: 功能 A」→ c33cf03「fix: 修复 B」；feature 从 a11ce01 分出到 d44ee04「feat: 实验功能」。HEAD 指向 feature 后，再创建一条说明为「这是我的提交」的提交，会在 d44ee04 上方多出一个新圆点，feature 标签跟着前进。',
        tips: [
          '一个圆点 = 一次 commit；右侧「本地分支」列会跟着该分支最新提交挪动',
          '提交需要写说明信息',
          '只有 HEAD 指向的分支会前进——请先完成「HEAD」卡',
        ],
        practice: {
          label: '提交一条说明为「这是我的提交」的记录',
          command: 'git commit -m "这是我的提交"',
        },
      },
      {
        id: 'branch',
        term: '3 · 分支 · branch',
        teaser:
          '图右侧已有 main 分支和 feature 分支。请再新建一个名为 hotfix 的分支。',
        body:
          '分支是贴在某个提交上的名字，不是另一份仓库。右侧「本地分支」列里已有 main 和 feature。请新建分支 hotfix：刚创建时它和你当前所在分支的最新提交是同一个圆点。',
        tips: [
          'main、feature 是标签名；hotfix 也会是标签名',
          '新建分支不会立刻改 HEAD 的指向',
          '在分支上 commit，只有这个名字会往前挪',
        ],
        practice: {
          label: '在当前位置创建新分支 hotfix',
          command: 'git branch hotfix',
        },
      },
    ],
    hints: [
      '建议顺序：先完成「HEAD」卡把 HEAD 指到 feature → 再「分支」建 hotfix → 最后提交「这是我的提交」。',
      '图上的 feature 是演示分支，请把 HEAD 切到它；hotfix 另建，不要删 feature。',
      '先自己在终端想命令并执行；实在想不起来，再点卡内「显示命令」。',
    ],
    suggestedCommands: [
      'git switch feature',
      'git branch hotfix',
      'git commit -m "这是我的提交"',
      'git status',
      'git log --oneline',
    ],
    winExplanation: {
      title: '导读完成',
      summary: '你已亲手：把 HEAD 切到 feature、新建 hotfix、并提交「这是我的提交」。',
      detail:
        '对照原图：HEAD 应指向 feature；若提交在 feature 上完成，feature 会在 d44ee04 之上多一「这是我的提交」；hotfix 是新建的名字。switch 改 HEAD 指向；commit 只推进当前分支。',
      related: ['git switch main', 'git log --oneline', 'git branch'],
    },
    check: ({ after, log }) => checkLevel0(after, log),
  },
  {
    id: 1,
    title: '第一次提交',
    story: '仓库已 git init（图底部灰色锚点），HEAD 在 main 上，但还没有任何提交。用 git commit 创建第一个提交，图上会出现一个圆点。',
    objectiveLabels: ['在 main 上产生至少 1 个提交', 'HEAD 仍指向 main'],
    startWorld: () => createEmptyWorld(),
    hints: [
      '提交需要说明信息，格式是 git commit -m "说明文字"。',
      '引号里的内容随意写，例如 init: 第一次提交。',
      '完成后看中间提交图：init 上方会出现第一个绿色圆点，并贴着 main 标签。',
    ],
    suggestedCommands: ['git status', 'git commit -m "init: 第一次提交"', 'git log --oneline'],
    winExplanation: {
      title: '通关：你创建了第一个提交',
      summary: 'main 从「尚无提交」变成指向新 commit。HEAD 一直站在 main 上，所以这个提交记在 main 的历史里。',
      detail: '真实项目里，commit 之前通常还有 git add 把改动放进暂存区；本沙箱用 commit 直接代表一次记录。',
      related: ['git log --oneline', 'git status'],
    },
    check: ({ before, after }) => checkLevel1(before, after),
  },
  {
    id: 2,
    title: '看懂仓库状态',
    story: '仓库里已有几条历史。学会用 status 看「现在在哪」，用 log 看「从哪来」——这两条命令只读，不会改图。',
    objectiveLabels: ['执行过 git status', '执行过 git log --oneline', '仓库仍有 main 提交'],
    startWorld: () => createDemoWorld(),
    hints: [
      'git status：当前分支、是否干净、HEAD 指向。',
      'git log --oneline：每个提交一行，新提交在上（或在前）。',
      '两条都成功执行后即可通关；随便看几眼输出没关系。',
    ],
    suggestedCommands: ['git status', 'git log --oneline'],
    winExplanation: {
      title: '通关：会查状态和历史了',
      summary: 'status 回答「当前分支是什么、工作区是否干净、HEAD 指向谁」；log 回答「这条分支是怎么长出来的」。',
      detail: '以后做 merge / reset 之前，先 status + log，能避免很多误操作。',
      related: ['git branch feature', 'git commit -m "feat: x"'],
    },
    check: ({ before, after, log }) => checkLevel2(before, after, log),
  },
  {
    id: 3,
    title: '创建分支（先不切换 HEAD）',
    story: '分支只是一个指向提交的标签。用 git branch 可以在当前位置贴一个新名字，而不切换过去。',
    objectiveLabels: [
      '创建分支 feature',
      'HEAD 仍在 main 上（没有 switch 过去）',
      'feature 与 main 指向同一提交',
    ],
    startWorld: () => createDemoWorld(),
    hints: [
      '命令：git branch feature（没有 -c，所以不会切换）。',
      '成功后图上同一圆点会同时挂 main 和 feature。',
      '千万不要 git switch feature，本关要的是「只建标签，HEAD 仍指向 main」。',
    ],
    suggestedCommands: ['git branch feature', 'git status', 'git log --oneline'],
    winExplanation: {
      title: '通关：分支只是指针',
      summary: 'feature 和 main 指到同一个提交，说明还没有分叉。你仍在 main 上，下一次 commit 只会推动 main。',
      detail: '要让 feature「变长」：先 git switch feature（或 git switch -c），再 commit。下一关就会练这个。',
      related: [
        'git switch feature',
        'git switch -c feature',
        'git commit -m "feat: 在 feature 上改动"',
      ],
    },
    check: ({ before, after }) => checkLevel3(before, after),
  },
  {
    id: 4,
    title: '切换分支并提交',
    story: 'HEAD 指向 feature 后再 commit，只有 feature 会前进，main 停在原处——这就是分叉。',
    objectiveLabels: [
      'HEAD 在 feature 上',
      'feature 上至少有 1 个 main 没有的提交',
      'main 最新提交未变',
    ],
    startWorld: () => createDemoWorld(),
    hints: [
      'git switch -c feature 一步建好并让 HEAD 指向它；或先 branch 再 switch。',
      '在 feature 上 git commit -m "feat: ..."。',
      '看图：feature 标签上方多了一个点，main 没动。',
    ],
    suggestedCommands: [
      'git switch -c feature',
      'git commit -m "feat: 在 feature 上的改动"',
      'git log --oneline',
    ],
    winExplanation: {
      title: '通关：只有当前分支会前进',
      summary: 'HEAD 在 feature 上，所以 commit 推动的是 feature；main 的指针没变。',
      detail: '下一步若要合回 main：switch main 后 merge feature。',
      related: ['git switch main', 'git merge feature'],
    },
    check: ({ before, after }) => checkLevel4(before, after),
  },
  {
    id: 5,
    title: 'Fast-forward 合并',
    story: 'main 没有独有提交，feature 领先。在 main 上 merge，指针直接前移，不产生新圆点。',
    objectiveLabels: [
      '在 main 上完成合并',
      'main 已快进到 feature 的最新提交（FF）',
      '没有产生双父 merge 提交',
    ],
    startWorld: startL5,
    hints: [
      'git switch main',
      'git merge feature',
      '输出里应有 Fast-forward；图上 main 与 feature 指到同一点。',
    ],
    suggestedCommands: ['git switch main', 'git merge feature', 'git log --oneline'],
    winExplanation: {
      title: '通关：Fast-forward',
      summary: '当前分支没有分叉时，merge 只是把分支指针挪到目标分支的最新提交，历史保持线性。',
      detail: '若要强制生成合并节点，可用 git merge --no-ff（本沙箱未实现）。',
      related: ['git log --oneline', 'git switch -c hotfix'],
    },
    check: ({ before, after }) => checkLevel5(before, after),
  },
  {
    id: 6,
    title: '生成合并提交',
    story: '双方各自有提交，历史分叉。在 main 上 merge，会生成双父节点，把两条线收成一条。',
    objectiveLabels: [
      'HEAD 在 main 上',
      'main 最新提交是双父 merge 提交',
      '该提交能追溯到 feature',
    ],
    startWorld: startL6,
    hints: [
      'git switch main（若还不在 main）',
      'git merge feature',
      '图上 main 的新圆点会有两条父边。',
    ],
    suggestedCommands: ['git switch main', 'git merge feature', 'git log --oneline'],
    winExplanation: {
      title: '通关：双父合并节点',
      summary: 'merge commit 同时记录两边历史，是理解冲突与集成的关键形状。',
      detail: '真实 Git 在同文件冲突时会停下；本沙箱工作区干净时直接生成节点。',
      related: ['git log --oneline', 'git branch -d feature'],
    },
    check: ({ before, after }) => checkLevel6(before, after),
  },
  {
    id: 7,
    title: '用 reset 回退',
    story: 'main 上多了一个错误提交。用 reset 把分支指针往回拨一步（HEAD~1）。',
    objectiveLabels: [
      'main 最新提交已回退到上一个提交',
      'HEAD 仍在 main 上',
      '回退目标正确（HEAD~1 的父提交）',
    ],
    startWorld: startL7,
    hints: [
      '先 git log --oneline 看清当前最新提交。',
      'git reset --hard HEAD~1（或 --soft / --mixed）。',
      '回退后 main 应指回「搭建基础模块」那一点。',
    ],
    suggestedCommands: [
      'git log --oneline',
      'git reset --hard HEAD~1',
      'git reset --soft HEAD~1',
    ],
    winExplanation: {
      title: '通关：reset 会改历史指针',
      summary: 'reset 把当前分支指针拨回更早的祖先提交；旧提交对象可能仍在，直到无人引用被回收。',
      detail: 'soft 保留改动标记；hard 同时清掉工作区标记。分享过的提交一般改用 revert。',
      related: ['git revert HEAD', 'git log --oneline'],
    },
    check: ({ before, after }) => checkLevel7(before, after),
  },
  {
    id: 8,
    title: '协作：push 与 pull',
    story: 'Alice 与 Bob 各有本地仓库，共用远程 origin。Alice 提交并 push，Bob pull 后才能看到。',
    objectiveLabels: [
      '远程 origin/main 已更新',
      'Bob 本地已有该提交',
      'Bob 的 main 与远程一致',
    ],
    startWorld: startL8,
    allowMultiUser: true,
    hints: [
      '以 Alice：git commit -m "..." → git push origin main',
      '顶栏切到 Bob',
      'Bob：git pull',
    ],
    suggestedCommands: [
      'git commit -m "alice: 共享改动"',
      'git push origin main',
      'user bob',
      'git pull',
    ],
    winExplanation: {
      title: '通关：协作闭环',
      summary: 'push 把本地发布到 origin；另一人 fetch/pull 才会同步。不会自动出现在对方仓库。',
      detail: '生产环境禁止对共享分支 force push；非快进 push 会被拒绝。',
      related: ['git fetch', 'git remote -v', 'user alice'],
    },
    check: ({ before, after }) => checkLevel8(before, after),
  },
];

export function getLevel(id: number): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function maxLevelId(): number {
  return LEVELS[LEVELS.length - 1]?.id ?? 1;
}
