# V1.5b：全局小狗（贴底部导航）+ 首页压缩 + 狗随记录联动（阶段④提前）

> 用户反馈 2026-07-11：首页滑动太长；狗埋在首页底部无法跟随/联动。合并解决。

## A. 狗全局化
- DogBanner 从 HomeView 移出 → App.tsx 全局渲染，**固定在底部 tab 栏正上方**，每个 tab 都可见。窄条 ~44px。
- 布局：`.dog-banner` 改 position:fixed，bottom = tab 栏高度（含 safe-area-inset）；`.main` 的 padding-bottom 增大以清开「tab 栏 + 狗条」两层，各 tab 内容不被遮。狗条自身 pointer-events:none，但有 bg（var(--bg)）让内容干净滚过其下。
- 移除 HomeView 里的 `<DogBanner />`。

## B. 狗随当日记录联动（阶段④核心，提前做）
- App 层查当日 entries 的域集合（listEntries 今日范围，随 refreshKey 刷新），传给 DogBanner。
- 状态权重按当日活动：记了 food→吃🦴 偏多、workout→跑 偏多、reading→趴着看书、learning→同看书、一天没记→睡💤 偏多、当日 mood=😢→安慰/依偎状。仍保留随机切换，只是**偏向**今日活动（不是硬绑定，避免呆板）。
- 无记录或查询失败 → 默认随机（现有行为），不崩。
- prefers-reduced-motion 仍走静态。

## C. 首页压缩
- 每日图 aspect-ratio 4/3 → 16/9（或 max-height 上限），省一大截竖向空间。
- 收紧首页各块间距（mood/quote/calendar/stats/plan 之间的 margin），首屏能看到 图+日期+心情+一句话，日历紧随其下。
- 规划两卡（旅行/学习）保持，位置不变。

## 验收
- 全量单测绿（DogBanner 移位后 App/HomeView 测试相应调整；狗联动状态权重加单测：给定当日域集合→状态偏向）。tsc/build 通。
- 375px 实测：① 每个 tab 底部都有狗、不遮内容 ② 首页明显变短、首屏信息完整 ③ 记一笔 food 后狗偏向吃 ④ 深色/reduced-motion 正常。
- 纯前端，无迁移无部署。
