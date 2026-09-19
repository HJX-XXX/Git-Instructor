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
  checkLevel9,
  checkLevel10,
  checkLevel11,
  checkLevel12,
  checkLevel13,
  checkLevel14,
  checkLevel15,
  checkLevel16,
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

/** 两笔错误提交，便于 soft / hard 各退一步 */
function startL9(): WorldState {
  return mustRun(createDemoWorld(), [
    'git commit -m "oops: 多写了一笔"',
    'git commit -m "oops: 又多写了一笔"',
  ]);
}

/** 一笔待撤销的提交 */
function startL10(): WorldState {
  return mustRun(createDemoWorld(), ['git commit -m "bad: 需要撤销这笔"']);
}

/** L12：Alice 已 commit 未 push；Bob 与远程同在旧 tip */
function startL12(): WorldState {
  return mustRun(createDemoWorld(), ['git commit -m "alice: 待发布"']);
}

/** L13：Alice 本地有未推提交；Bob 已推送另一笔，远程领先 */
function startL13(): WorldState {
  let w = mustRun(createDemoWorld(), ['git commit -m "alice: 本地未推"']);
  w = applyWorldCommand(w, 'user bob').world;
  w = mustRun(w, [
    'git commit -m "bob: 已推远程"',
    'git push origin main',
  ]);
  w = applyWorldCommand(w, 'user alice').world;
  return w;
}

/** L14：远程已有 Alice 提交；Bob 在旧 tip，需先本地 commit 再 pull */
function startL14(): WorldState {
  let w = mustRun(createDemoWorld(), [
    'git commit -m "alice: 已推到远程"',
    'git push origin main',
  ]);
  w = applyWorldCommand(w, 'user bob').world;
  return w;
}

/** L15：feature 已合入；hotfix 有未合并提交 */
function startL15(): WorldState {
  return mustRun(createDemoWorld(), [
    'git switch -c feature',
    'git commit -m "feat: 已完成"',
    'git switch main',
    'git merge feature',
    'git switch -c hotfix',
    'git commit -m "wip: 未合并的工作"',
    'git switch main',
  ]);
}

/** L16：Bob 本地有提交；远程已由 Alice 推进 */
function startL16(): WorldState {
  let w = mustRun(createDemoWorld(), ['git commit -m "alice: 远程新提交"']);
  w = mustRun(w, ['git push origin main']);
  w = applyWorldCommand(w, 'user bob').world;
  w = mustRun(w, ['git commit -m "bob: 本地工作"']);
  return w;
}

export const LEVELS: LevelDef[] = [
  {
    id: 0,
    stageId: 's1',
    title: '认识 HEAD、提交与分支',
    story: '认识 Git 三件套：HEAD、提交、分支，以及它们之间的指向关系。',
    intro: {
      summary:
        'Git 是分布式版本控制工具：用提交保存历史快照，用分支并行推进工作，用 HEAD 标明你当前在哪条线上。',
      detail:
        '本章在演示提交图上搞清三件事：HEAD 指向当前分支；分支指向该分支最新提交；只有 HEAD 所指分支会因 commit 前进。随后你将亲手切换分支、新建分支，并完成一次提交。',
    },
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
    stageId: 's1',
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
    stageId: 's1',
    title: '看懂仓库状态',
    story: '用 status / log 只读查看仓库：你在哪条分支、工作区干不干净、历史怎么长出来。',
    intro: {
      summary:
        'status 看「现在在哪」：当前分支、HEAD、以及工作区是否干净。log 看「从哪来」：这条分支上的提交历史。',
      detail:
        '什么是「工作区」？\n\n工作区（working tree）= 你正在编辑的那些文件，也就是项目目录里能看到的内容。\n\n可以和提交历史这样区分：\n- 提交（commit）：已经存档的快照，画在提交图上的圆点\n- 工作区：尚未存档、正在改的文件\n\nstatus 里的「工作区」：\n- 干净：文件和当前提交一致，没有待提交的改动\n- 有改动：你改过文件但还没 commit（本沙箱用简化标记模拟）\n\n本关只读观察，不要改分支。',
    },
    objectiveLabels: ['执行过 git status', '执行过 git log --oneline', '仓库仍有 main 提交'],
    startWorld: () => createDemoWorld(),
    concepts: [
      {
        id: 'status',
        term: '1 · status 查状态',
        teaser: '现在在哪条分支？工作区干不干净？',
        body:
          '命令\ngit status\n\nstatus 回答三件事\n1. 当前分支是哪条（如 main）\n2. HEAD 指向哪里\n3. 工作区是否干净\n\n什么是「工作区」？\n工作区 = 你正在编辑的文件（项目目录里能看到的内容）。\n它和「已经提交的历史」是两回事：\n- 提交：图上的圆点，已存档\n- 工作区：还没 commit 的改动\n\n「干净」是什么意思？\n工作区干净 = 当前文件和最新提交一致，没有待提交改动。\n有改动 = 文件被改过，但还没记成提交。\n\n本关\nstatus 是只读命令，不会改提交图。\n沙箱里默认显示工作区干净。',
        tips: [
          '先 status 再做危险操作，能避免很多误操作',
          '重点看「当前分支」和「工作区」两处',
          '动手前 status，动手后 log，是好习惯',
        ],
        practice: {
          label: '执行只读命令，查看当前仓库状态',
          command: 'git status',
        },
      },
      {
        id: 'log',
        term: '2 · log 看历史',
        teaser: '这条分支是怎么长出来的？',
        body:
          '命令\ngit log --oneline\n\nlog 做什么\n按祖先链列出提交，回答「从哪来」。\n\n怎么读\n- --oneline：一个提交一行\n- 一般含短 hash 与提交说明\n- 新提交在上（或在前）\n\n和图对照\n中间提交图上的圆点，和 log 里的行是对应的。\n\n和 status 的分工\n- status：现在在哪、工作区如何\n- log：这条分支有哪些提交',
        tips: ['只读命令', '和提交图对照着看', '本关不要切换或删除分支'],
        practice: {
          label: '用简洁格式查看提交历史',
          command: 'git log --oneline',
        },
      },
      {
        id: 'keep-main',
        term: '3 · 只观察，不改图',
        teaser: '本关只看不改：main 上仍有演示提交即可。',
        body:
          '本关约束\n- 只执行 status、log 这类只读命令\n- 不要 switch、branch -d、reset\n- 确认 main 上仍有演示提交即可通关\n\n若误操作\n点「重置本关」即可恢复到本关起点。',
        tips: ['只读命令不会移动分支指针', '目标：看懂 status / log 在说什么', '下一关再动手建分支'],
        practice: {
          label: '再确认一次当前状态（只读）',
          command: 'git status',
        },
      },
    ],
    hints: [
      '按卡片顺序：先 status，再 log --oneline。',
      'status 里「工作区」= 正在编辑、尚未提交的文件是否干净。',
      '第三张卡是约束：本关不要改分支，只观察。',
    ],
    suggestedCommands: ['git status', 'git log --oneline'],
    winExplanation: {
      title: '通关：会查状态和历史了',
      summary:
        'status 回答「当前分支是什么、工作区是否干净、HEAD 指向谁」；log 回答「这条分支是怎么长出来的」。',
      detail:
        '工作区（working tree）\n= 你正在编辑、尚未 commit 的文件。\n干净：与最新提交一致\n有改动：改过但还没提交（沙箱用简化标记模拟）\n\n以后做 merge / reset 之前，先 status + log，能避免很多误操作。',
      related: ['git branch feature', 'git commit -m "feat: x"'],
    },
    check: ({ before, after, log }) => checkLevel2(before, after, log),
  },
  {
    id: 3,
    stageId: 's2',
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
    stageId: 's2',
    title: '切换分支并提交',
    story: '学习切换分支后提交，观察历史如何分叉。',
    objectiveLabels: [
      '已把 HEAD 指向 feature，并在其上提交',
      'feature 上有 main 没有的提交',
      '已 switch main，并在其后执行 log 确认 main 未前进',
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
          '此时还不能用 log 证明 main 没动（log 显示的是当前分支历史）',
        ],
        practice: {
          label: '在 feature 上创建一笔提交',
          command: 'git commit -m "feat: 在 feature 上的改动"',
        },
      },
      {
        id: 'main-unmoved',
        term: '3 · main 不应移动',
        teaser: '先切到 main，再用 log 确认它还停在原提交。',
        body:
          '注意：git log 显示的是「当前分支」的历史。\n若还站在 feature 上就执行 log，看到的是 feature 的提交，无法证明 main 没动。\n\n正确观察步骤：\n1. git switch main（把 HEAD 指向 main）\n2. git log --oneline（看 main 的历史）\n3. 对照：main 最新提交应仍是切换前的那个，没有多出 feature 上的新圆点\n\n只有当前分支会前进；main 未动，说明刚才的 commit 与 main 无关。',
        tips: [
          '先 git switch main，再 git log --oneline',
          '对照图上 main 标签是否还在原圆点',
          '若 main 动了，可点「重置本关」',
        ],
        practice: {
          label: '切到 main，并用 log 确认 main 未前进',
          command: 'git switch main',
          commands: ['git switch main', 'git log --oneline'],
        },
      },
    ],
    hints: [
      '第一张卡：把 HEAD 指向 feature。',
      '第二张卡：在 feature 上 commit。',
      '第三张卡：先 switch main，再 log，确认 main 没动。',
    ],
    suggestedCommands: [
      'git switch -c feature',
      'git commit -m "feat: 在 feature 上的改动"',
      'git switch main',
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
    stageId: 's2',
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
        teaser: '合并前确认：HEAD 在 main 上（本关起点已是 main）。',
        body:
          'merge 推进的是当前分支。要让 main 前进，必须确保 HEAD 指向 main，再执行合并。本关进入时 HEAD 已在 main，用 status 确认即可。',
        tips: [
          '起点里 HEAD 已在 main 上',
          '起点中 main 已落后 feature（feature 多一笔提交）',
          'merge 推进的是当前分支，必须站在 main 上合并 feature',
        ],
        practice: {
          label: '确认 HEAD 在 main 上',
          command: 'git status',
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
      '起点里 HEAD 已在 main；先 status 确认，再 merge feature。',
      '第二张卡：在 main 上执行 merge feature。',
      '第三张卡：确认没有新圆点。',
    ],
    suggestedCommands: ['git status', 'git merge feature', 'git log --oneline'],
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
    stageId: 's2',
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
          '用 log 看是否出现两条线上的提交',
          'feature 的提交已成为 main 的祖先，可删 feature',
          '双父节点表示：main 已同时包含两边的历史',
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
      summary: 'merge commit 同时保留两边的提交，main 从此可以追溯到 feature 的全部历史。',
      detail: '真实 Git 在同文件冲突时会停下；本沙箱工作区干净时直接生成节点。',
      related: ['git log --oneline', 'git branch -d feature'],
    },
    check: ({ before, after, log }) => checkLevel6(before, after, log),
  },
  {
    id: 7,
    stageId: 's3',
    title: '用 reset 回退',
    story: '学习 git reset：把当前分支指针拨回更早的提交。',
    objectiveLabels: [
      '已查看当前提交历史',
      'main 最新提交已回退到上一个提交',
      '已执行 status 确认 HEAD 仍在 main',
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
      'git status',
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
    stageId: 's3',
    title: '协作：push 与 pull',
    story: '学习 push / pull：本地提交如何发布到远程并被他人同步。',
    objectiveLabels: [
      'Alice 已创建一笔提交',
      '远程 origin/main 已更新（已 push）',
      'Bob 已 pull 并与远程一致',
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
        graphFocus: 'commit',
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
        graphFocus: 'remote',
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
        graphFocus: 'remote',
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
    check: ({ before, after, log }) => checkLevel8(before, after, log),
  },
  {
    id: 9,
    stageId: 's4',
    title: 'soft 与 hard 对比',
    story: '两种 reset 都会拨回指针；差别在于改动是否一起丢掉。',
    intro: {
      summary: '用 status 对照 soft 与 hard：改动还在，还是工作区已干净。',
      detail:
        '三种 reset 都会移动当前分支的指针（例如从最新提交拨回上一个）。\n\n可以记成三档：\nsoft：指针回去，改动还在（相当于还在暂存区，可再 commit）\nmixed（默认）：指针回去，改动回到工作区、变成未暂存\nhard：指针回去，工作区也强制对齐目标提交，未提交的改动会丢\n\n本沙箱用 status 里的「工作区是否干净」来模拟：\nsoft 后会显示仍有改动，hard 后变干净。',
    },
    objectiveLabels: [
      '已查看当前提交历史',
      '已用 soft reset 回退一步',
      'soft 后执行 git status（对照仍有改动）',
      '已用 hard reset 再回退一步',
      'hard 后执行 git status（对照工作区干净）',
    ],
    startWorld: startL9,
    concepts: [
      {
        id: 'see-two-oops',
        term: '1 · 先看历史',
        teaser: '看清两笔错误提交再动手。',
        body:
          '做什么\n用 log 看清当前 main 上最近两笔提交。\n\n为什么\n回退前要确认「现在在哪、要丢哪一笔」。\n\n预期现象\n- 新提交在上（或在前）\n- 两笔说明里都带 oops\n- 它们下面应还有正常提交',
        tips: ['log 只读，不会改图', '可点「显示命令」', '记住最终要退回到的目标提交'],
        practice: { label: '查看提交历史', command: 'git log --oneline' },
      },
      {
        id: 'soft-reset',
        term: '2 · soft：只动指针',
        teaser: 'soft 拨回一步，改动还在。',
        body:
          '命令\ngit reset --soft HEAD~1\n\n做什么\n只把 main 的分支指针从最新 oops 拨回上一个提交。\n\n不做什么\n不丢掉「还没提交的改动」。\n\n怎么验证\n下一步执行 git status，应看到仍有改动。',
        tips: [
          'main 上少了一笔 oops',
          'HEAD 仍在 main，reset 不切换分支',
          '适用：提交说明写错，退回去再 commit',
        ],
        practice: { label: 'soft 回退 HEAD~1', command: 'git reset --soft HEAD~1' },
        graphFocus: 'tip',
      },
      {
        id: 'status-after-soft',
        term: '3 · soft 后看 status',
        teaser: 'status 对照：工作区仍有改动。',
        body:
          '命令\ngit status\n\n请重点看「工作区」这一行\nsoft 后应显示：工作区有未提交改动（教学模拟）\n\n含义\n指针回去了，但改动还在，可以继续 commit。\n\n请记住这句\nsoft → 仍有改动\n（稍后 hard 之后会变成「干净」，两相对照）',
        tips: ['这一步只读', '不改提交图', '把这句话和 hard 后的 status 对比记下来'],
        practice: { label: 'soft 后查看状态', command: 'git status' },
      },
      {
        id: 'hard-reset',
        term: '4 · hard：指针 + 工作区',
        teaser: 'hard 再拨一步，工作区也清掉。',
        body:
          '命令\ngit reset --hard HEAD~1\n\n做什么\n1. 分支指针再拨回一步\n2. 工作区强制对齐目标提交\n\n结果\n未提交的改动会被丢掉（沙箱里表现为 status 变干净）。\n\n提醒\n- 已 push 的公共历史一般改用 revert\n- hard 要谨慎，本地试验后再用',
        tips: ['main 再少一笔 oops', '最终停在两笔 oops 之前', '下一步再用 status 验证'],
        practice: { label: 'hard 再回退 HEAD~1', command: 'git reset --hard HEAD~1' },
        graphFocus: 'tip',
      },
      {
        id: 'status-after-hard',
        term: '5 · hard 后看 status',
        teaser: '再 status：工作区已干净。',
        body:
          '命令\ngit status\n\n请重点看「工作区」这一行\nhard 后应显示：工作区干净\n\n和 soft 对照着记\n\nsoft  → 指针回去，改动还在（仍有未提交改动）\nmixed → 指针回去，改动变成未暂存（默认）\nhard  → 指针回去，工作区也对齐（干净）\n\n共同点\n三种 reset 都会移动当前分支指针。',
        tips: ['hard 后：干净', 'soft 后：仍有改动', '差别只在暂存区/工作区如何处理'],
        practice: { label: 'hard 后查看状态', command: 'git status' },
      },
    ],
    hints: [
      '顺序：log → soft → status（仍有改动）→ hard → status（干净）。',
      '两次 status 是本关重点：用文案差别记住 soft / hard。',
      '沙箱没有真实文件，对照 status 文案即可。',
    ],
    suggestedCommands: [
      'git log --oneline',
      'git reset --soft HEAD~1',
      'git status',
      'git reset --hard HEAD~1',
      'git status',
    ],
    winExplanation: {
      title: '通关：用 status 分清 soft 与 hard',
      summary:
        '两种 reset 都会把分支指针拨回；soft 后 status 仍有改动，hard 后 status 变干净——这就是工作区是否被一起对齐。',
      detail:
        '对照表：\n--soft 只动分支指针，改动留在暂存区\n--mixed（默认）指针回去，改动回到工作区未暂存\n--hard 指针和工作区一起对齐，会丢未提交改动\n\n公共分支上已分享的提交优先 git revert。',
      related: ['git status', 'git revert HEAD', 'git log --oneline'],
    },
    check: ({ before, after, log }) => checkLevel9(before, after, log),
  },
  {
    id: 10,
    stageId: 's4',
    title: 'revert 撤销提交',
    story: '学习 revert：不改写历史，而是追加一笔抵消提交。',
    objectiveLabels: [
      '已查看当前提交历史',
      '已 revert 当前提交（生成抵消提交）',
      '原提交仍在历史中可追溯',
    ],
    startWorld: startL10,
    concepts: [
      {
        id: 'see-bad',
        term: '1 · 先看历史',
        teaser: '看清要撤销的那一笔。',
        body: 'revert 会新增提交来抵消内容，动手前确认目标。',
        tips: ['注意最新提交说明', '不要用 reset 抹掉', 'log 只读'],
        practice: { label: '查看提交历史', command: 'git log --oneline' },
      },
      {
        id: 'do-revert',
        term: '2 · 执行 revert',
        teaser: '生成说明以 Revert 开头的新提交。',
        body:
          'revert 不删除原提交，而是在当前分支的最新提交之上追加一笔反向提交。',
        tips: ['图上会多一个圆点', '原提交仍在', '与 reset 对比'],
        practice: { label: '撤销当前提交', command: 'git revert HEAD' },
      },
      {
        id: 'still-there',
        term: '3 · 原提交仍可追溯',
        teaser: '用 log 确认历史仍向前，原提交还在。',
        body: '从 main 的最新提交往回看，应仍能看到被撤销的那一笔。',
        tips: ['历史未被抹掉', '这就是 revert 与 reset 的关键差别', '适合已推送的提交'],
        practice: { label: '再查看一次历史', command: 'git log --oneline' },
      },
    ],
    hints: ['第一张卡 log。', '第二张卡 revert HEAD。', '第三张卡再 log 确认。'],
    suggestedCommands: ['git log --oneline', 'git revert HEAD', 'git log --oneline'],
    winExplanation: {
      title: '通关：revert 不改写历史',
      summary: 'revert 追加抵消提交；reset 把分支指针拨回。',
      detail: '公共分支上优先 revert，避免 force push。',
      related: ['git reset --soft HEAD~1', 'git log --oneline'],
    },
    check: ({ before, after, log }) => checkLevel10(before, after, log),
  },
  {
    id: 11,
    stageId: 's4',
    title: 'rebase 线性化',
    story: '学习 rebase：把 feature 的独有提交接到 main 之上。',
    objectiveLabels: [
      'HEAD 在 feature 上',
      '已把 feature rebase 到 main 之上',
      '用 log 确认历史更线性（无双父）',
    ],
    startWorld: startL6,
    concepts: [
      {
        id: 'on-feat',
        term: '1 · 在 feature 上',
        teaser: 'rebase 的是当前分支，先让 HEAD 指向 feature。',
        body: '当前分支的独有提交会被重放到目标分支的最新提交之上。',
        tips: ['HEAD 应在 feature', 'main 先有独有提交', '观察分叉'],
        practice: { label: 'HEAD 指向 feature', command: 'git switch feature' },
      },
      {
        id: 'do-rebase',
        term: '2 · rebase main',
        teaser: '把 feature 接到 main 之上。',
        body: 'rebase 后，feature 的提交会接在 main 最新提交之后，图更接近一条直线。',
        tips: ['不是 merge 双父', '公共历史只保留一份', '共享分支慎用'],
        practice: { label: '变基到 main', command: 'git rebase main' },
      },
      {
        id: 'see-linear',
        term: '3 · 观察线性历史',
        teaser: '用 log 对照：没有双父节点。',
        body: '与 merge 对比：rebase 重写的是当前分支的独有提交。',
        tips: [
          'feature 的最新提交应只有一个父提交（没有双父节点）',
          '从 feature 应能追溯到 main 的最新提交',
          '历史更接近一条直线，这就是「线性化」',
        ],
        practice: { label: '查看历史', command: 'git log --oneline' },
      },
    ],
    hints: ['第一张卡切到 feature。', '第二张卡 rebase main。', '第三张卡 log。'],
    suggestedCommands: ['git switch feature', 'git rebase main', 'git log --oneline'],
    winExplanation: {
      title: '通关：rebase',
      summary: 'rebase 把当前分支的独有提交，重放到目标分支的最新提交之上，历史更线性。',
      detail: '不要对已推送且他人在用的分支 rebase。',
      related: ['git merge main', 'git log --oneline'],
    },
    check: ({ before, after, log }) => checkLevel11(before, after, log),
  },
  {
    id: 12,
    stageId: 's5',
    title: 'fetch 与 pull',
    story: '区分 fetch 与 pull：fetch 只更新远程引用，pull 才合入本地。',
    objectiveLabels: [
      'Alice 已 commit 并 push 到 origin',
      'Bob 已 fetch（本地 main 未自动变）',
      'Bob 已 pull 并与远程一致',
    ],
    startWorld: startL12,
    allowMultiUser: true,
    concepts: [
      {
        id: 'alice-publish',
        term: '1 · Alice 发布',
        teaser: '起点里 Alice 已有一笔未推送提交；请先 push 到 origin。',
        body: '本关起点：Alice 已 commit、尚未 push；Bob 本地 main 仍停在远程更新前的位置。',
        tips: ['顶栏确认 Alice', 'push 后远程 main 前进', 'Bob 看不到自动更新'],
        practice: { label: '确认已 push（若尚未则 push）', command: 'git push origin main' },
        graphFocus: 'remote',
      },
      {
        id: 'bob-fetch',
        term: '2 · Bob fetch',
        teaser: '只下载远程引用，不合并进本地 main。',
        body: 'fetch 后 origin/main 会更新，Bob 本地 main 仍可以停在原来的位置。',
        tips: ['切到 Bob', '先 fetch 再观察', '本地分支不会自动变'],
        practice: { label: 'Bob 执行 fetch', command: 'git fetch' },
        graphFocus: 'remote',
      },
      {
        id: 'bob-pull-sync',
        term: '3 · Bob pull',
        teaser: '把远程更新合入本地 main。',
        body: 'pull = 下载并合并。完成后 Bob 的 main 应与 origin 一致。',
        tips: ['仍在 Bob', 'pull 会改本地 main', '对比 fetch'],
        practice: { label: 'Bob 执行 pull', command: 'git pull' },
        graphFocus: 'remote',
      },
    ],
    hints: ['Alice：先 push。', 'Bob：fetch。', 'Bob：pull。'],
    suggestedCommands: ['git push origin main', 'user bob', 'git fetch', 'git pull'],
    winExplanation: {
      title: '通关：fetch ≠ pull',
      summary: 'fetch 更新远程跟踪引用；pull = fetch + 合并到当前分支。',
      detail: '想先看远程再决定是否合并时，用 fetch。',
      related: ['git fetch', 'git log --oneline', 'git remote -v'],
    },
    check: ({ before, after, log }) => checkLevel12(before, after, log),
  },
  {
    id: 13,
    stageId: 's5',
    title: 'push 被拒绝',
    story: '远程已领先时 push 会失败；先 pull 再 push。',
    objectiveLabels: [
      '以 Alice 尝试 push（预期被拒绝）',
      '已 pull 同步远程',
      '再次 push 成功，远程与 Alice 一致',
    ],
    startWorld: startL13,
    allowMultiUser: true,
    concepts: [
      {
        id: 'try-push',
        term: '1 · 尝试 push',
        teaser: 'Alice 本地与远程已分叉，直接 push 会被拒。',
        body: '非快进 push 会覆盖他人提交，因此被拒绝。这是协作保护。',
        tips: ['顶栏 Alice', '观察终端报错', '不要 force push'],
        practice: { label: 'Alice 执行 push', command: 'git push origin main' },
        graphFocus: 'remote',
      },
      {
        id: 'do-pull',
        term: '2 · pull 同步',
        teaser: '先把远程领先提交合下来。',
        body: 'pull 后本地包含双方历史，才能安全 push。',
        tips: ['仍在 Alice', '可能产生 merge 或 FF', '再看 log'],
        practice: { label: 'Alice 执行 pull', command: 'git pull' },
        graphFocus: 'remote',
      },
      {
        id: 'push-again',
        term: '3 · 再次 push',
        teaser: '同步后 push 应成功。',
        body: '远程与 Alice 一致后，协作闭环完成。',
        tips: ['再次 push', '远程 main 与 Alice 相同', '禁止 force'],
        practice: { label: '再次 push', command: 'git push origin main' },
        graphFocus: 'remote',
      },
    ],
    hints: ['Alice push 应失败。', 'Alice pull。', '再 push。'],
    suggestedCommands: ['git push origin main', 'git pull', 'git push origin main'],
    winExplanation: {
      title: '通关：push 保护',
      summary: '远程领先时非快进 push 会被拒；先 pull 再 push。',
      detail: '生产环境永远不要对共享分支 force push。',
      related: ['git pull', 'git log --oneline'],
    },
    check: ({ before, after, log }) => checkLevel13(before, after, log),
  },
  {
    id: 14,
    stageId: 's5',
    title: 'pull 产生合并',
    story: '双方各自提交后 pull，可能生成双父 merge 提交。',
    objectiveLabels: [
      'Bob 本地已有自己的提交',
      'pull 后 main 是双父 merge 提交',
      '该提交能追溯到 Alice 已推送的提交',
    ],
    startWorld: startL14,
    allowMultiUser: true,
    concepts: [
      {
        id: 'bob-commit',
        term: '1 · Bob 本地提交',
        teaser: 'Bob 在本地旧提交上先记一笔，与远程分叉。',
        body: '远程已有 Alice 的提交；Bob 本地再 commit 就会分叉，为 pull 合并做准备。',
        tips: ['顶栏 Bob', '先 commit', '此时不要直接 push'],
        practice: { label: 'Bob 创建本地提交（若尚未）', command: 'git commit -m "bob: 仅在本地"' },
      },
      {
        id: 'bob-pull-merge',
        term: '2 · pull 合并',
        teaser: 'pull 会把远程合进本地，可能生成双父节点。',
        body: '与 FF 不同：双方都有独有提交时，会出现 merge commit。',
        tips: ['执行 pull', '观察新圆点两条父边', '这就是协作合并'],
        practice: { label: 'Bob 执行 pull', command: 'git pull' },
        graphFocus: 'remote',
      },
      {
        id: 'see-both',
        term: '3 · 含双方历史',
        teaser: '从 Bob 的 main 能追溯到远程提交。',
        body: 'merge commit 同时记录两边历史。',
        tips: [
          '用 log 对照',
          '从 Bob 的 main 应能追溯到远程最新提交',
          '之后可 push 分享合并结果',
        ],
        practice: { label: '查看历史', command: 'git log --oneline' },
      },
    ],
    hints: ['Bob 先 commit。', '再 pull。', 'log 观察双父。'],
    suggestedCommands: ['git commit -m "bob: 仅在本地"', 'git pull', 'git log --oneline'],
    winExplanation: {
      title: '通关：pull 合并',
      summary: '本地与远程都前进时，pull 会做合并，可能出现 merge commit。',
      detail: '也可以选择 rebase 本地提交到 origin 之上（进阶）。',
      related: ['git rebase origin/main', 'git push origin main'],
    },
    check: ({ before, after, log }) => checkLevel14(before, after, log),
  },
  {
    id: 15,
    stageId: 's5',
    title: '删除分支',
    story: '学习 -d 与 -D：已合并可安全删，未合并需强制删。',
    objectiveLabels: [
      '已删除已合并的 feature（-d）',
      '未合并分支 -d 被拒绝',
      '用 -D 强制删除 hotfix',
    ],
    startWorld: startL15,
    concepts: [
      {
        id: 'del-merged',
        term: '1 · 删除已合并分支',
        teaser: 'feature 已进 main，可用 -d 安全删除。',
        body: 'git branch -d 只删已合并分支，避免误删未并入的工作。',
        tips: [
          'feature 已并入 main，与 main 指向同一提交',
          '执行 -d 删除',
          '图上 feature 标签会消失',
        ],
        practice: { label: '删除 feature', command: 'git branch -d feature' },
      },
      {
        id: 'del-unmerged-fail',
        term: '2 · -d 拒绝未合并',
        teaser: 'hotfix 上有未合并提交，直接 -d 会被拒绝。',
        body: '分支上还有 main 没有的提交时，直接 -d 会失败，用来保护未合并的工作。',
        tips: ['图上 hotfix 领先 main', '尝试 -d', '阅读拒绝原因'],
        practice: { label: '尝试删除未合并的 hotfix', command: 'git branch -d hotfix' },
      },
      {
        id: 'force-del',
        term: '3 · -D 强制删除',
        teaser: '确认不要后可用 -D 强制删。',
        body: '-D 不检查是否合并。确认提交已无用再执行。',
        tips: ['顶栏确认不要 hotfix 工作', '再 -D', '图上 hotfix 消失'],
        practice: { label: '强制删除 hotfix', command: 'git branch -D hotfix' },
      },
    ],
    hints: [
      '第一张卡 -d 删 feature。',
      '第二张卡 -d hotfix（应失败，因有未合并提交）。',
      '第三张卡 -D hotfix。',
    ],
    suggestedCommands: [
      'git branch -d feature',
      'git branch -d hotfix',
      'git branch -D hotfix',
    ],
    winExplanation: {
      title: '通关：删分支',
      summary: '-d 保护未合并工作；-D 强制删除。',
      detail: '删分支只删名字，提交对象可能仍在直到无引用。',
      related: ['git log --oneline', 'git branch'],
    },
    check: ({ before, after, log }) => checkLevel15(before, after, log),
  },
  {
    id: 16,
    stageId: 's5',
    title: 'rebase 到 origin',
    story: '协作中把本地提交 rebase 到 origin/main，保持线性。',
    objectiveLabels: [
      '已 fetch 远程更新',
      '已 rebase 到 origin/main',
      'log 显示本地提交接在远程之上且线性',
    ],
    startWorld: startL16,
    allowMultiUser: true,
    concepts: [
      {
        id: 'fetch-origin',
        term: '1 · fetch 远程',
        teaser: '先更新 origin/main 跟踪引用。',
        body: 'Bob 本地有提交，远程也有新提交。先 fetch 再 rebase。',
        tips: ['顶栏 Bob', '执行 fetch', 'origin/main 前进'],
        practice: { label: 'Bob 执行 fetch', command: 'git fetch' },
        graphFocus: 'remote',
      },
      {
        id: 'rebase-origin',
        term: '2 · rebase origin/main',
        teaser: '把本地独有提交，接到远程最新提交之上。',
        body: '协作中可用 rebase 保持线性，而不是 merge 出双父。',
        tips: [
          '只 rebase「还没推送、只有本地有」的提交；已经 push 的历史不要再改写',
          '目标分支写 origin/main（远程跟踪分支）',
          '完成后图上：本地提交应接在远程最新提交之上',
        ],
        practice: { label: '变基到远程', command: 'git rebase origin/main' },
      },
      {
        id: 'see-on-top',
        term: '3 · 观察线性结果',
        teaser: 'log：本地提交在远程之上且无双父。',
        body: '完成后可再 push，把线性历史发布出去。',
        tips: ['log 对照', '单父', '可 push 分享'],
        practice: { label: '查看历史', command: 'git log --oneline' },
      },
    ],
    hints: ['Bob：fetch。', 'Bob：rebase origin/main。', 'log 确认。'],
    suggestedCommands: ['git fetch', 'git rebase origin/main', 'git log --oneline'],
    winExplanation: {
      title: '通关：rebase origin',
      summary: '先 fetch 再 rebase origin/分支，可把本地工作接在最新远程历史之上。',
      detail: '强推（force push）在协作分支上仍应避免。',
      related: ['git push origin main', 'git log --oneline'],
    },
    check: ({ before, after, log }) => checkLevel16(before, after, log),
  },
];

export function getLevel(id: number): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function maxLevelId(): number {
  return LEVELS[LEVELS.length - 1]?.id ?? 1;
}
