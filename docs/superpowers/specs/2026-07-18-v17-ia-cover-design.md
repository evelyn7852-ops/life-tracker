# V1.7：纯封面首页 + 记录页装日历 + 规划 tab 三合一 + 可互动小狗

> 用户反馈 2026-07-18 晚。IA 重排。

## A. 首页 = 纯封面
- 只保留：hero 大图（占满更高，clamp(60vh, 68vh, 560px)）+ 叠字
- 叠字放大：日期 34px/800，一句话 16px，时钟 12px，copyright 10px 不变
- **移除**：心情行、本季 banner、「本月」节标、日历、统计卡、规划区——全部撤出首页
- 心情行迁往记录页顶部（不消失）；本季 banner 迁往记录页（日历上方）
- 首页滚动：内容只有一屏封面，不滚（除狗条外无其他元素）

## B. 记录页（page2）= 心情 + 录入 + 日历 + 今日
- 顺序：MoodHeader（日期时钟+心情行回归）→ QuickInput → 本季计划 banner（如有）→ 日历（CalendarView，含日详情）→ 今日时间线（TodayView）
- 统计卡（StatsCard）也迁到记录页（日历下方）——或周览已有 streak 条，避免重复：**统计卡迁往回顾-周览 segment 顶部**（周览已有 week-stats-strip，二者合并为一个卡，不留两份）
- 日历的 active-gating 改绑记录 tab

## C. 规划 tab（三合一，替换原训练 tab）
- tabs：首页 / 记录 / 回顾 / 规划
- 规划 tab 内 segment chips（同回顾样式）：训练 | 旅行 | 学习
  - 训练 = 现 TrainView 全量（内部三段不变）
  - 旅行 = TravelPlanView 内容**内嵌**（不再是 overlay；去掉 ✕，直接作为 segment 内容渲染）
  - 学习 = LearningPlanView 内容内嵌（同上）
- 首页规划两卡删除；overlay 模式组件保留兼容或重构为内嵌均可（实施者选低风险路径，报告说明）
- active-gating：只有当前 segment fetch

## D. 可互动小狗
- 狗条 pointer-events 从 none 改为：狗本体可点（条其余区域仍穿透）
- 点击 → 随机互动反应（≥3 种）：跳一下+❤️冒出、原地转圈、开心摇尾+「汪」字气泡（500ms 淡出）；互动打断当前状态，播完回归状态机
- 连点彩蛋：3 秒内点 3 次 → 打滚（rotate 360 慢速）
- 互动纯前端，不写库；reduced-motion 下点击只弹 ❤️ 静态 600ms
- 触控区 ≥44px（狗 24px 加 padding 补足）

## 验收
- 全量单测绿（App/HomeView/ReviewView/TrainView 结构测试更新；PlanTab 新测；狗互动 fake-timer 测）
- tsc/build；375px 实测：封面一屏、记录页流、规划三 segment、狗点击反应
- 原有功能零丢失（心情/统计/本季banner 均有新家）

## E. 布达佩斯大饭店主题（用户 2026-07-18 追加；定位升级为「可推广产品」，颜值=实用性）
配色 token（钉死，Committed 策略——粉色承载表面）：
```css
--bg:#F5E3DF;        /* Mendl's 粉底 */
--card:#FDF6F1;      /* 奶油卡面 */
--ink:#3D2C3C;       /* 李子紫墨 */
--muted:#8E7183;     /* 藕紫 */
--accent:#A34E64;    /* 树莓红——主按钮/选中态（白字对比 ≥4.5:1） */
--gold:#C99334;      /* 芥末金——streak🔥/高亮（深字可读） */
--mint:#8FB39E;      /* 薄荷——done/成功态 */
--line:#E7C9C4;      /* 干粉细线 */
--klein 废弃 → hero 兜底底色改 --ink 李子紫 */
```
- **画框卡**（韦斯签名框中框）：卡片 border 1px var(--line) + `outline:1px solid var(--line); outline-offset:-5px` 内描线；投影撤销或极淡（画框感>浮起感）
- **对称**：分区标题居中、letter-spacing .06em；封面日期居中排版
- 域点色转谱：food 芥末 #C99334 / workout 树莓 #A34E64 / travel 湖蓝绿 #5E9291 / reading 紫 #7E5A8C / journal 藕灰 #9C8B95 / learning 苔绿 #7C9A62
- tab 栏：奶油底、树莓选中；theme-color meta + manifest 同步 #F5E3DF/#3D2C3C
- **图标重绘**：Mendl's 粉底 (#F5C9CF 系) + 李子紫狗爪 + 奶油细线画框（192/512/apple-touch/favicon 全套）
- 对比度硬指标：正文 ink-on-card ≥4.5:1、按钮白字-on-树莓 ≥4.5:1、muted 仅限辅助文字（≥3:1 on card）
