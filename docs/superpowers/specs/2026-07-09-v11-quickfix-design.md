# V1.1 快改：触控手感 + 顶部日期/心情头

> 用户批准 2026-07-09。范围小，单轮实施。

## A. Tab 切换即时化
- App.tsx 三视图常驻挂载，CSS display 切显隐（不再 unmount/refetch）
- TodayView/HistoryView/WeekView 各加 loading 态：首拉进行中显示「加载中…」，不再闪「没有记录」

## B. 触控手感
- 全局 button/可点元素：`touch-action:manipulation`、`-webkit-tap-highlight-color:transparent`
- `:active` 反馈（opacity .6）
- 「删」按钮触控区扩到 ≥44px（padding 扩 + 视觉不变）

## C. 顶部头（MoodHeader 组件）
- 录入框上方：`7月9日 周四 10:24`（每 30s 走时）+ emoji 行 😊😐😮‍💨🥳😢🤒
- 心情落库：journal 域 `data.mood`，一天一条：今日已有 mood 条 → updateEntry 改之；无 → saveEntry 新建（raw_text = `心情 <emoji>`，parse_source manual）
- 今日已选 emoji 高亮；重点即改

## 验收
- 单测：MoodHeader 日期渲染 + 点击 insert/update 分支（mock repo）；全量单测绿
- tsc clean、vite build OK
- 375px 实测：tab 秒切、按钮有按压反馈、心情打卡入时间线
