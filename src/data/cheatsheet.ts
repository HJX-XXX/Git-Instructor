export interface CheatItem {
  id: string;
  category: string;
  title: string;
  syntax: string;
  summary: string;
  fill?: string;
  keywords: string[];
}

export const CHEAT_CATEGORIES = [
  '查询',
  '提交',
  '分支',
  '切换',
  '合并与变基',
  '回退',
  '协作',
] as const;

export const CHEATSHEET: CheatItem[] = [
  {
    id: 'help',
    category: '查询',
    title: '查看支持命令',
    syntax: 'help',
    summary: '列出本沙箱已实现的教学命令。',
    fill: 'help',
    keywords: ['帮助', 'help', '命令列表'],
  },
  {
    id: 'status',
    category: '查询',
    title: '查看状态',
    syntax: 'git status',
    summary: '查看当前分支、HEAD 与工作区是否干净（不改图）。',
    fill: 'git status',
    keywords: ['status', '状态', '工作区'],
  },
  {
    id: 'log',
    category: '查询',
    title: '查看日志',
    syntax: 'git log --oneline',
    summary: '按祖先链列出当前 HEAD 的提交历史。',
    fill: 'git log --oneline',
    keywords: ['log', '日志', '历史', 'oneline'],
  },
  {
    id: 'commit',
    category: '提交',
    title: '创建提交',
    syntax: 'git commit -m "<msg>"',
    summary: '在当前最新提交上新建一笔提交，并让分支前进。',
    fill: 'git commit -m "feat: 新功能"',
    keywords: ['commit', '提交', '-m'],
  },
  {
    id: 'branch',
    category: '分支',
    title: '创建分支',
    syntax: 'git branch <name>',
    summary: '在当前最新提交上建立新分支指针，不切换 HEAD。',
    fill: 'git branch feature',
    keywords: ['branch', '分支', '新建'],
  },
  {
    id: 'branch-del',
    category: '分支',
    title: '删除分支',
    syntax: 'git branch -d <name>',
    summary: '-d 只删已合并分支；未合并时 -d 拒绝，需 -D 强制删除。',
    fill: 'git branch -d feature',
    keywords: ['branch -d', '删除分支', '强制删除'],
  },
  {
    id: 'switch',
    category: '切换',
    title: '切换分支',
    syntax: 'git switch <name>',
    summary: '让 HEAD 指向已有分支（现代写法）。',
    fill: 'git switch main',
    keywords: ['switch', '切换'],
  },
  {
    id: 'checkout',
    category: '切换',
    title: '切换分支（checkout）',
    syntax: 'git checkout <name>',
    summary: '经典写法，与 switch 等价：把 HEAD 指到该分支。',
    fill: 'git checkout main',
    keywords: ['checkout', '切换', '经典'],
  },
  {
    id: 'switch-c',
    category: '切换',
    title: '新建并切换',
    syntax: 'git switch -c <name>',
    summary: '从当前最新提交创建分支并切换过去。',
    fill: 'git switch -c feature',
    keywords: ['switch -c', '新建切换'],
  },
  {
    id: 'checkout-b',
    category: '切换',
    title: '新建并切换（checkout -b）',
    syntax: 'git checkout -b <name>',
    summary: '经典写法，与 switch -c 等价。',
    fill: 'git checkout -b feature',
    keywords: ['checkout -b', '新建切换', '经典'],
  },
  {
    id: 'merge',
    category: '合并与变基',
    title: '合并分支',
    syntax: 'git merge <name>',
    summary: '把目标分支合入当前分支：能 FF 则 FF，否则产生双父合并提交。',
    fill: 'git merge feature',
    keywords: ['merge', '合并', 'fast-forward'],
  },
  {
    id: 'rebase',
    category: '合并与变基',
    title: '变基',
    syntax: 'git rebase <branch>',
    summary: '把当前分支独有提交重放到目标分支最新提交之上；也可 git rebase origin/<远程分支>。',
    fill: 'git rebase main',
    keywords: ['rebase', '变基', '重放', 'origin'],
  },
  {
    id: 'rebase-origin',
    category: '合并与变基',
    title: '变基到远程分支',
    syntax: 'git rebase origin/<branch>',
    summary: '先 fetch 后把本地提交重放到远程跟踪分支之上（协作里常见）。',
    fill: 'git rebase origin/main',
    keywords: ['rebase origin', '变基远程', 'origin rebase'],
  },
  {
    id: 'reset',
    category: '回退',
    title: '重置（改历史）',
    syntax: 'git reset --hard HEAD~1',
    summary: '移动当前分支指针；--hard 同时清掉工作区标记。',
    fill: 'git reset --hard HEAD~1',
    keywords: ['reset', '回退', '撤销', 'soft', 'hard'],
  },
  {
    id: 'revert',
    category: '回退',
    title: '反做提交',
    syntax: 'git revert HEAD',
    summary: '追加一个抵消提交，不改写既有历史。',
    fill: 'git revert HEAD',
    keywords: ['revert', '反做', '抵消'],
  },
  {
    id: 'push',
    category: '协作',
    title: '推送分支',
    syntax: 'git push origin <branch>',
    summary: '把本地分支发布到共享远程；只有能快进（远程没有你本地没有的提交）时才成功，否则会被拒。',
    fill: 'git push origin main',
    keywords: ['push', '推送', '远程', 'origin'],
  },
  {
    id: 'fetch',
    category: '协作',
    title: '获取远程',
    syntax: 'git fetch',
    summary: '下载 origin 上的提交与 origin/* 引用，不自动合并。',
    fill: 'git fetch',
    keywords: ['fetch', '获取', '远程'],
  },
  {
    id: 'pull',
    category: '协作',
    title: '拉取并合并',
    syntax: 'git pull',
    summary: 'fetch + merge，把远程更新合进当前分支。',
    fill: 'git pull',
    keywords: ['pull', '拉取', '同步'],
  },
  {
    id: 'remote',
    category: '协作',
    title: '查看远程',
    syntax: 'git remote -v',
    summary: '查看共享远程 origin 与当前远程分支。',
    fill: 'git remote -v',
    keywords: ['remote', '远程', 'origin'],
  },
  {
    id: 'user-switch',
    category: '协作',
    title: '切换模拟用户',
    syntax: 'user alice | user bob',
    summary: '切换到另一名用户的本地仓库（也可用顶栏按钮）。',
    fill: 'user bob',
    keywords: ['user', '用户', 'alice', 'bob', '切换用户'],
  },
];

export function filterCheats(query: string): CheatItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return CHEATSHEET;
  return CHEATSHEET.filter((item) => {
    const blob = [item.title, item.syntax, item.summary, item.category, ...item.keywords]
      .join(' ')
      .toLowerCase();
    return blob.includes(q);
  });
}
