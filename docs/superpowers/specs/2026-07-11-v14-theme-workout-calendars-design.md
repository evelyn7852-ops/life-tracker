# V1.4：多巴胺蓝主题 + 训练模块调整 + 旅行/学习日历

> 用户反馈 2026-07-11 晚批，三批执行。

## A. 视觉
- **首页图直角**：.home-image 去 border-radius（16px→0）
- **全站色系与图标一致**：蓝色系多巴胺配色，略淡。
  - `--accent: #c15f3c` → `#2B5CE6`（克莱因蓝提亮一档，主交互色）
  - `--klein: #002FA5` 保留（图标/兜底底色）
  - 背景 `--bg: #faf9f5` → `#f6f8fe`（极淡蓝白）；卡片仍白；`--line: #e3e8f8`
  - 域点多巴胺淡色系：food `#FFB020` / workout `#2B5CE6` / travel `#00B8D9` / reading `#9B51E0` / journal `#7A869A` / learning `#36B37E`
  - 周览条/chip/按钮/高亮全部随 --accent 走（现有 CSS 变量体系，改 :root 即可 + 少量硬编码色排查）
- **每日一句单行完整**：Edge Function prompt 改 ≤18 字；客户端 .home-quote-text 单行（white-space:nowrap + font-size clamp(12px,4vw,15px) + 超长省略兜底）；语录兜底库同样单行处理（超 18 字的语录仍会截断——保留换行例外：兜底语录允许两行，AI 句子强制一行）

## B. 训练
- **去瑜伽**：workoutTemplates.json 删瑜伽流×2；exercises.json 瑜伽体式保留数据但动作库 UI 不展示瑜伽分类（数据无害，减少 churn）——或直接删，实施者择低风险路径并报告
- **动作库分板块折叠**：按 category（力量/Hyrox）分组 accordion，默认全收起，点开展开该板块动作列表
- **一键生成（W3 提前）**：Edge Function `generate-workout`
  - 输入 {direction: 'hyrox'|'crossfit'|'力量', date, recent: 最近14天 workout entries/workouts 摘要}
  - Prompt 要求：每天不同训练类型/动作组合（避开 recent 里近 3 天练过的主动作）、输出严格 JSON {title, blocks:[{exerciseId, sets, reps, restSec} | {exerciseId, duration_sec|distance_m, restSec}]}，exerciseId 必须来自随 prompt 附上的动作库 id 清单（白名单校验，无效 id 剔除）
  - UI：今日计划空态 +「生成 Hyrox」「生成 CrossFit」「生成力量」三按钮 → 草稿进入现有可编辑排课界面（增删动作/改组次）→ 确认才落库。手动调整/删除/增加沿用 W1 的编辑列表
  - 复用 LLM_* secrets；失败给中文提示不落库

## C. 旅行 + 学习日历
- **旅行**：.superpowers/travel-canonical.json → src/data/travelPlan.json（152 trips 入 repo）。新视图入口：训练 tab 旁不再加 tab（已 5 个），放**首页日历下方「规划」区**：两个卡片入口「旅行规划」「学习规划」→ 全屏 overlay
  - 旅行规划视图：按年分组列表（2026-2065），每年显示行程卡（时段/目的地/天数/预算/状态），当前年置顶展开，其余年折叠；status done 打 ✓
  - 首页月历上：当月有旅行计划的日期段不标（V1.4 不做日级映射——数据只有"五一/十一"粒度，硬映射会瑞造具体日期；在旅行视图顶部说明粒度）
- **学习**：ai-hackathon dashboard 的 DATA 数组（8 周 Phase1-4，含 localStorage 进度）→ src/data/learningPlan.json。学习规划视图：Phase→周折叠列表，周卡显示 title/theme/learn/build/ship 条目 + 可勾选完成（进度存 Supabase 新表？不——V1.4 轻量：进度写 entries domain=learning tags:['hackathon',itemId] 太绕；直接 localStorage 同 dashboard 的 key 格式迁移，说明单设备限制，云同步列 V1.5）——实施者按此执行
- 原 dashboard 的勾选进度（ai_bootcamp_progress_v3）如在她 Mac 浏览器里，无法自动迁移；视图首次打开提示可手动补勾

## 验收
- 每批：全量单测绿 + tsc + build + 375px 实测；A 批换色后跑一遍全 tab 目检硬编码残色
- generate-workout 真调验证 3 次（hyrox/crossfit/力量 各一）+ 白名单校验单测
