# V1.6 UI 质感大改：沉浸式首页 + 4 tab + 卡片体系 + 狗动画自然化

> 用户批准 2026-07-18（沉浸式叠字 hero、4 tab 合并、卡片重做）。设计规约按 impeccable product register 钉死，实施不得自由发挥。

## 设计 token（app.css :root 补充）
```css
--ease-out: cubic-bezier(.22,.61,.36,1);
--dur: 180ms;               /* 状态转换标准时长 150-250ms 区间 */
--radius-card: 16px;
--radius-btn: 12px;
--shadow-card: 0 1px 3px rgba(20,40,120,.07);
--scrim: linear-gradient(180deg, rgba(0,10,40,0) 38%, rgba(0,10,40,.62) 100%);
/* z-index 语义梯：content 1 / dog 5 / sticky 10 / tabs 10 / overlay-backdrop 20 / sheet 21 */
```

## A. 沉浸式首页 Hero
- 首屏：每日大图 `height: clamp(340px, 56vh, 480px)`，全宽出血（顶到视口顶，含 safe-area-top 内衬），object-fit cover
- 底部渐黑遮罩（--scrim），叠字全白：
  - 日期大字 `2026年7月18日 周六`（26px/700）
  - 地点化句子（14px，rgba 白 .92，单行省略）
  - copyright（10px，rgba 白 .6）
- 心情 emoji 行紧贴 hero 下方（bg 上，不叠图）
- 无图兜底：克莱因蓝底 + 同样式叠字（读性不降）
- 时钟保留（叠字内日期旁或下，11px 白）
- Hero 之下依序：日历（标题行加「本月」节奏感）→ 统计卡 → 规划卡 → （狗条全局不动）
- 语录兜底（无 AI 句时）：句子位显示语录正文（同白字叠图），出处小字

## B. 底部导航 5→4
- tabs：首页 / 记录 / 回顾 / 训练
- 「回顾」= 新 ReviewView 容器：顶部 segment chips（历史 | 周览，样式同训练页子 tab——一致组件语汇），内部复用现有 HistoryView / WeekView 组件不动逻辑；active-gating 传递正确（只有可见 segment fetch）
- tab 图标可选（不强制；如加，用 SF Symbols 风格线性 emoji/svg 统一，不混风格）

## C. 卡片体系统一（全站）
- 所有卡：radius var(--radius-card)、border 1px var(--line)、shadow var(--shadow-card)、padding 14-16px；**禁止**嵌套卡、禁止 side-stripe 彩边
- 分区标题统一：13px/600/muted，上间距 20 下 8（节奏感靠间距差，不靠更多框）
- 按钮两级：主按钮（accent 填充/白字/radius --radius-btn/高 40px）；次按钮（描边 chip）。QuickInput 保存、生成三键、summary 生成、trip 存删、学习流加资源——全部归一
- 状态齐全：所有可点元素 hover(:active)/focus-visible（2px accent 外环）/disabled(.5 透明) 
- 转场统一 var(--dur) var(--ease-out)；prefers-reduced-motion 全部退化为即时
- 训练页三个子块（今日计划/课表库/动作库）卡片同规约；动作库手风琴标题行 44px 高触控
- 空态文案配小图形（emoji 即可），不再是孤零一行字

## D. 狗动画自然化
- 走路：translateX 匀速（linear，全宽 8-12s），配步态 bob（translateY ±1px 交替，320ms/步）；到边缘 scaleX 翻转折返，不瞬移
- 状态切换：先淡出 240ms → 换姿态 → 淡入（不跳变）
- 偶发行为：走路中随机停下 1.5s「嗅地」（微低头旋转 -8°）再继续
- 打盹：趴姿 + 💤 缓慢上浮循环；吃：骨头 🦴 在嘴前小幅跳动；挠痒：快速小幅 rotate 抖动 600ms×3
- 权重联动逻辑不变（今日活动偏置保留）
- reduced-motion：静态趴姿

## 验收
- 全量单测绿（App tab 数、ReviewView 新测、HomeView hero 结构测试更新）；tsc/build
- 375px 实测：hero 叠字对比度（白字过 4.5:1 于遮罩上）、四 tab 流转、回顾双 segment、卡片一致性目检、狗走路折返自然
- 深浅内容图上白字均可读（遮罩兜底）；无横向滚动
