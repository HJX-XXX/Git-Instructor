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
    story: '认识 Git 三件套：HEAD、提交、分支，以及它们之间的指向关系。',
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
          'HEAD 是 Git 的一个特殊指针（引用），通常指向「当前分支名」，而不是直接指向某个提交。链路是：HEAD → 当前分支 → 该分支最新提交。请把 HEAD 改为指向 feature，之后的 commit 会记在 feature 上。',
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
          '提交是历史上的存档点，图上每个圆点都是一次提交。HEAD 指向 feature 后，再创建一条说明为「这是我的提交」的提交，feature 的最新提交会更新。',
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
      summary: '你已分清：HEAD 指向当前分支，分支指向最新提交，commit 只推进当前分支。',
      detail:
        '本关练了：把 HEAD 指到 feature、新建 hotfix、并完成一条说明为「这是我的提交」的提交。切换改 HEAD 指向；建分支只是贴名字。',
      related: ['git switch main', 'git log --oneline', 'git branch'],
    },
    check: ({ after, log }) => checkLevel0(after, log),
  },
  {
    id: 1,
    title: '第一次提交',
    story: '学习 git commit：在空仓库中创建第一次提交。',
    objectiveLabels: ['在 main 上产生至少 1 个提交'],
    startWorld: () => createEmptyWorld(),
    concepts: [
      {
        id: 'first-commit',
        term: '1 · 第一次 commit',
        teaser: '空仓库还没有任何圆点。给 main 记下第一条存档。',
        body:
          '提交会给当前历史加一个存档点。空仓库执行提交后，图上 init 上方会出现第一个圆点，并挂在 main 上。提交必须写一句说明。',
        tips: [
          '当前 HEAD 指向 main，这次提交会记在 main 上',
          '说明写在引号里，内容随意',
          '提交成功后，图上新圆点会闪烁提示',
        ],
        practice: {
          label: '在 main 上创建第一次提交（说明随意）',
          command: 'git commit -m "init: 第一次提交"',
        },
      },
    ],
    hints: [
      '提交需要写一句说明信息。',
      '完成后看中间提交图：init 上方会出现第一个圆点，并贴着 main。',
      '不需要切换分支，本关就记在 main 上。',
    ],
    suggestedCommands: ['git status', 'git commit -m "init: 第一次提交"', 'git log --oneline'],
    winExplanation: {
      title: '通关：你创建了第一个提交',
      summary: 'main 从「尚无提交」变成指向新 commit。HEAD 一直指向 main，所以这个提交记在 main 的历史里。',
      detail: '真实项目里，commit 之前通常还有 git add 把改动放进暂存区；本沙箱用 commit 直接代表一次记录。',
      related: ['git log --oneline', 'git status'],
    },
    check: ({ before, after }) => checkLevel1(before, after),
  },
  {
    id: 2,
    title: '看懂仓库状态',
    story: '学习两条只读命令：git status 查看状态，git log 查看历史。',
    objectiveLabels: ['执行过 git status', '执行过 git log --oneline', '仓库仍有 main 提交'],
    startWorld: () => createDemoWorld(),
    concepts: [
      {
        id: 'status',
        term: '1 · status 查状态',
        teaser: '先问一句：我现在在哪个分支？工作区干不干净？',
        body:
          'status 回答「现在站在哪」：当前分支名、HEAD 指向、工作区是否干净。它只读，不会改提交图。',
        tips: [
          '先 status 再做危险操作，能避免很多误操作',
          '关注「当前分支」一行',
          '本沙箱工作区默认干净',
        ],
        practice: {
          label: '执行只读命令，查看当前仓库状态',
          command: 'git status',
        },
      },
      {
        id: 'log',
        term: '2 · log 看历史',
        teaser: '再问一句：这条分支是怎么长出来的？',
        body:
          'log 按祖先链列出提交。--oneline 每个提交一行，方便对照图上的圆点与说明。',
        tips: [
          '新提交在上（或在前）',
          '每行一般包含短 hash 与提交说明',
          '与中间提交图对照着看',
        ],
        practice: {
          label: '用简洁格式查看提交历史',
          command: 'git log --oneline',
        },
      },
      {
        id: 'keep-main',
        term: '3 · 不要改图',
        teaser: '本关只观察。确认 main 上仍有演示提交即可。',
        body:
          'status 与 log 都是只读命令。不要切换、删除分支，也不要 reset。看完输出即可通关。',
        tips: [
          '只读命令不会移动分支指针',
          '若误操作，可点「重置本关」',
          '习惯：动手前 status，动手后 log',
        ],
        practice: {
          label: '再确认一次当前状态（只读）',
          command: 'git status',
        },
      },
    ],
    hints: [
      '按卡片顺序：先 status，再 log --oneline。',
      '第三张卡是约束：本关不要改分支，只观察。',
      '两条都成功执行后即可通关。',
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
    story: '学习 git branch：创建分支指针，且不切换 HEAD。',
    objectiveLabels: [
      '创建分支 feature',
      'HEAD 仍在 main 上（没有 switch 过去）',
      'feature 与 main 指向同一提交',
    ],
    startWorld: () => createDemoWorld(),
    concepts: [
      {
        id: 'create-branch',
        term: '1 · 建分支不切换',
        teaser: '在当前位置给最新提交再贴一个名字 feature。',
        body:
          '只创建分支指针，不修改 HEAD。创建后 feature 与 main 指向同一个圆点，还没有分叉。',
        tips: [
          '成功后同一圆点会同时挂 main 和 feature',
          'HEAD 仍指向 main',
          '本关不要切换到 feature',
        ],
        practice: {
          label: '创建分支 feature（不要切换）',
          command: 'git branch feature',
        },
      },
      {
        id: 'stay-main',
        term: '2 · HEAD 仍在 main',
        teaser: '建完分支后确认没有切换过去。',
        body:
          '本关要的是「只建标签，HEAD 仍指向 main」。用 status 确认当前分支仍是 main。',
        tips: [
          '若已误切换，可再切回 main',
          'status 是只读的',
          '观察后再对照目标列表',
        ],
        practice: {
          label: '确认 HEAD 仍指向 main',
          command: 'git status',
        },
      },
      {
        id: 'same-tip',
        term: '3 · 两分支尚未分叉',
        teaser: '观察：feature 与 main 指向同一提交。',
        body:
          '刚创建的分支与当前分支最新提交相同，说明还没有各自 commit。图上会提示它们指向同一提交。',
        tips: [
          '同一圆点上可以挂多个分支名',
          '分叉要等某一边再 commit',
          '下一关会在 feature 上提交',
        ],
        practice: {
          label: '用 log 对照历史（只读）',
          command: 'git log --oneline',
        },
      },
    ],
    hints: [
      '第一张卡：只创建 feature，不要切换。',
      '第二张卡：确认 HEAD 仍在 main。',
      '第三张卡：观察两分支尚未分叉。',
    ],
    suggestedCommands: ['git branch feature', 'git status', 'git log --oneline'],
    winExplanation: {
      title: '通关：分支只是指针',
      summary: 'feature 和 main 指到同一个提交，说明还没有分叉。你仍在 main 上，下一次 commit 只会推动 main。',
      detail: '要让 feature「变长」：先让 HEAD 指向 feature（或创建并切换），再 commit。下一关就会练这个。',
      related: [
        'git switch feature',
        'git switch -c feature',
        'git commit -m "feat: 在 feature 上改动"',
      ],
    },
    check: ({ before, after, log }) => checkLevel3(before, after, log),
  },
  {
    id: 4,
    title: '切换分支并提交',
    story: '学习切换分支后提交，观察历史如何分叉。',
    objectiveLabels: [
      'HEAD 在 feature 上',
      'feature 上至少有 1 个 main 没有的提交',
      'main 最新提交未变',
    ],
    startWorld: () => createDemoWorld(),
    concepts: [
      {
        id: 'switch-feature',
        term: '1 · HEAD 指向 feature',
        teaser: '让 HEAD 从 main 指向 feature（可新建并切换）。',
        body:
          '切换分支只是改 HEAD 的指向。HEAD 指向 feature 后，接下来的 commit 会记在 feature 上。',
        tips: [
          '可一步创建并切换，也可先建再切',
          '切换不创建提交',
          '看图：橙色 HEAD 应指向 feature',
        ],
        practice: {
          label: '创建 feature 并让 HEAD 指向它',
          command: 'git switch -c feature',
        },
      },
      {
        id: 'commit-on-feature',
        term: '2 · 在 feature 上提交',
        teaser: '在 feature 上记一笔，让 feature 比 main 多一个圆点。',
        body:
          'commit 推进的是 HEAD 所指向的分支。HEAD 在 feature 上时，只有 feature 前进，产生分叉。',
        tips: [
          '说明随意写',
          '图上 feature 标签上方会多一个点',
          'main 应停在原处',
        ],
        practice: {
          label: '在 feature 上创建一笔提交',
          command: 'git commit -m "feat: 在 feature 上的改动"',
        },
      },
      {
        id: 'main-unmoved',
        term: '3 · main 不应移动',
        teaser: '对照图：main 的最新提交不能变。',
        body:
          '只有当前分支会前进。若 main 也动了，说明提交时 HEAD 指错了分支，或误操作了其它命令。',
        tips: [
          '对比提交前后的 main 标签位置',
          '若 main 动了，可重置本关',
          '这就是分叉的形状',
        ],
        practice: {
          label: '用 log 观察分叉后的历史',
          command: 'git log --oneline',
        },
      },
    ],
    hints: [
      '第一张卡：把 HEAD 指向 feature。',
      '第二张卡：在 feature 上 commit。',
      '第三张卡：确认 main 没有动。',
    ],
    suggestedCommands: [
      'git switch -c feature',
      'git commit -m "feat: 在 feature 上的改动"',
      'git log --oneline',
    ],
    winExplanation: {
      title: '通关：只有当前分支会前进',
      summary: 'HEAD 在 feature 上，所以 commit 推动的是 feature；main 的指针没变。',
      detail: '下一步若要合回 main：让 HEAD 指向 main 后 merge feature。',
      related: ['git switch main', 'git merge feature'],
    },
    check: ({ before, after, log }) => checkLevel4(before, after, log),
  },
  {
    id: 5,
    title: 'Fast-forward 合并',
    story: '学习 Fast-forward 合并：无分叉时 merge 只前移指针。',
    objectiveLabels: [
      '在 main 上完成合并',
      'main 已快进到 feature 的最新提交（FF）',
      '没有产生双父 merge 提交',
    ],
    startWorld: startL5,
    concepts: [
      {
        id: 'to-main',
        term: '1 · HEAD 指向 main',
        teaser: '合并要发生在 main 上，先把 HEAD 切回 main。',
        body:
          'merge 推进的是当前分支。要让 main 前进，必须先让 HEAD 指向 main，再执行合并。',
        tips: [
          '当前可能在 feature 上',
          '切换不改提交内容',
          '切回后看橙色 HEAD 指向 main',
        ],
        practice: {
          label: '把 HEAD 切回 main',
          command: 'git switch main',
        },
      },
      {
        id: 'merge-ff',
        term: '2 · merge feature',
        teaser: '在 main 上合并 feature。因为 main 没有独有提交，会快进。',
        body:
          '当当前分支没有分叉时，merge 只是把当前分支指针挪到目标分支的最新提交，历史保持线性，不产生新圆点。',
        tips: [
          '输出里应有 Fast-forward',
          '合并后 main 与 feature 指到同一点',
          '这叫快进合并（FF）',
        ],
        practice: {
          label: '在 main 上合并 feature',
          command: 'git merge feature',
        },
      },
      {
        id: 'no-merge-commit',
        term: '3 · 没有新圆点',
        teaser: '观察：这次 merge 没有生成双父节点。',
        body:
          '快进合并不会新增 merge commit。用 log 对照：历史仍是直线。',
        tips: [
          '对比合并前后提交数量',
          '下一关会练分叉后的双父合并',
          '图上 main 与 feature 应重合',
        ],
        practice: {
          label: '查看合并后的历史',
          command: 'git log --oneline',
        },
      },
    ],
    hints: [
      '第一张卡：切回 main。',
      '第二张卡：执行合并。',
      '第三张卡：确认没有新圆点。',
    ],
    suggestedCommands: ['git switch main', 'git merge feature', 'git log --oneline'],
    winExplanation: {
      title: '通关：Fast-forward',
      summary: '当前分支没有分叉时，merge 只是把分支指针挪到目标分支的最新提交，历史保持线性。',
      detail: '若要强制生成合并节点，可用 git merge --no-ff（本沙箱未实现）。',
      related: ['git log --oneline', 'git switch -c hotfix'],
    },
    check: ({ before, after, log }) => checkLevel5(before, after, log),
  },
  {
    id: 6,
    title: '生成合并提交',
    story: '学习生成 merge commit：分叉合并后出现双父节点。',
    objectiveLabels: [
      'HEAD 在 main 上',
      'main 最新提交是双父 merge 提交',
      '该提交能追溯到 feature',
    ],
    startWorld: startL6,
    concepts: [
      {
        id: 'on-main',
        term: '1 · HEAD 在 main',
        teaser: '要把 feature 收回 main，先确认 HEAD 指向 main。',
        body:
          '分叉后的合并会生成新的 merge commit，挂在当前分支上。当前分支应是 main。',
        tips: [
          '若在 feature 上，先切回 main',
          'merge 推进当前分支',
          '观察 main 与 feature 已各自有提交',
        ],
        practice: {
          label: '确认 HEAD 在 main 上',
          command: 'git status',
        },
      },
      {
        id: 'do-merge',
        term: '2 · 执行 merge',
        teaser: '在 main 上合并 feature，生成双父圆点。',
        body:
          '当双方都有独有提交时，merge 会创建同时有两个父提交的新节点，把两条线收成一条。',
        tips: [
          '图上新圆点会有两条父边',
          '这就是 merge commit',
          '与上一关的 FF 对比',
        ],
        practice: {
          label: '在 main 上合并 feature',
          command: 'git merge feature',
        },
      },
      {
        id: 'trace-feature',
        term: '3 · 能追溯到 feature',
        teaser: '从 main 最新提交能追溯到 feature 的提交。',
        body:
          'merge commit 的其中一个父提交来自 feature，所以 feature 历史被完整保留在 main 的祖先链里。',
        tips: [
          '用 log 看是否出现两条线的提交',
          '之后可删除已合并的 feature',
          '这是集成的关键形状',
        ],
        practice: {
          label: '查看合并后的历史',
          command: 'git log --oneline',
        },
      },
    ],
    hints: [
      '第一张卡：在 main 上。',
      '第二张卡：执行 merge。',
      '第三张卡：确认能追溯到 feature。',
    ],
    suggestedCommands: ['git switch main', 'git merge feature', 'git log --oneline'],
    winExplanation: {
      title: '通关：双父合并节点',
      summary: 'merge commit 同时记录两边历史，是理解冲突与集成的关键形状。',
      detail: '真实 Git 在同文件冲突时会停下；本沙箱工作区干净时直接生成节点。',
      related: ['git log --oneline', 'git branch -d feature'],
    },
    check: ({ before, after, log }) => checkLevel6(before, after, log),
  },
  {
    id: 7,
    title: '用 reset 回退',
    story: '学习 git reset：把当前分支指针拨回更早的提交。',
    objectiveLabels: [
      'main 最新提交已回退到上一个提交',
      'HEAD 仍在 main 上',
      '回退目标正确（HEAD~1 的父提交）',
    ],
    startWorld: startL7,
    concepts: [
      {
        id: 'see-history',
        term: '1 · 先看历史',
        teaser: '回退前先看清当前最新提交是什么。',
        body:
          'reset 会改写分支指针，动手前用 log 确认要丢掉哪一笔，以及它的上一个提交是什么。',
        tips: [
          '新提交在上',
          '记住错误提交下面那个点',
          'log 只读',
        ],
        practice: {
          label: '查看当前提交历史',
          command: 'git log --oneline',
        },
      },
      {
        id: 'do-reset',
        term: '2 · 回退一步',
        teaser: '把 main 最新提交拨回它的父提交。',
        body:
          'reset 会把当前分支指针移回更早的提交。HEAD~1 表示当前提交的父提交。本沙箱可用 --soft 或 --hard。',
        tips: [
          '回退后 main 应指回更早的圆点',
          '错误提交不再被 main 引用',
          '分享过的提交一般改用 revert',
        ],
        practice: {
          label: '把 main 回退一步（HEAD~1）',
          command: 'git reset --hard HEAD~1',
        },
      },
      {
        id: 'still-on-main',
        term: '3 · 仍在 main',
        teaser: 'reset 改的是当前分支，HEAD 应仍在 main。',
        body:
          'reset 移动的是 HEAD 所指向分支的指针，不会切换分支。用 status 确认仍在 main。',
        tips: [
          'HEAD 仍指向 main',
          'main 最新提交已变化',
          '若指错分支，重置本关',
        ],
        practice: {
          label: '确认 HEAD 仍在 main',
          command: 'git status',
        },
      },
    ],
    hints: [
      '第一张卡：先 log 看清。',
      '第二张卡：执行 reset 回退。',
      '第三张卡：确认仍在 main。',
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
    check: ({ before, after, log }) => checkLevel7(before, after, log),
  },
  {
    id: 8,
    title: '协作：push 与 pull',
    story: '学习 push / pull：本地提交如何发布到远程并被他人同步。',
    objectiveLabels: [
      '远程 origin/main 已更新',
      'Bob 本地已有该提交',
      'Bob 的 main 与远程一致',
    ],
    startWorld: startL8,
    allowMultiUser: true,
    concepts: [
      {
        id: 'alice-commit-push',
        term: '1 · Alice 提交并发布',
        teaser: '以 Alice 创建一笔提交，再发布到远程。',
        body:
          '本地 commit 只写在自己的仓库。要让别人看到，需要 push 到共享远程 origin。',
        tips: [
          '先确认顶栏是 Alice',
          'commit 说明随意',
          'push 之后 origin/main 会更新',
        ],
        practice: {
          label: '以 Alice 提交一笔共享改动',
          command: 'git commit -m "alice: 共享改动"',
        },
      },
      {
        id: 'alice-push',
        term: '2 · push 到 origin',
        teaser: '把 Alice 的 main 发布到远程。',
        body:
          'push 把本地分支的最新提交上传到 origin。其它人不会自动看到，必须再 fetch/pull。',
        tips: [
          '仍在 Alice 身份下执行',
          '成功后远程 main 会前进',
          '禁止对共享分支 force push',
        ],
        practice: {
          label: '把 main 发布到远程',
          command: 'git push origin main',
        },
      },
      {
        id: 'bob-pull',
        term: '3 · Bob 同步',
        teaser: '切到 Bob，拉取远程更新。',
        body:
          '切换用户后 Bob 的本地仓库是独立的。用 pull 把 origin 的更新合并到自己的 main。',
        tips: [
          '先在顶栏切到 Bob',
          'pull = 下载远程并合并',
          '完成后两人 main 应一致',
        ],
        practice: {
          label: '以 Bob 拉取远程更新',
          command: 'git pull',
        },
      },
    ],
    hints: [
      '第一张卡：Alice commit。',
      '第二张卡：Alice push。',
      '第三张卡：切到 Bob 后 pull。',
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
