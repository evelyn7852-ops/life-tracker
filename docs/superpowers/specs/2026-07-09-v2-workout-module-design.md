# V2 运动模块：课表库 + 跟练模式 + 一键生成

> 设计三节已获用户批准 2026-07-09（课表来源=内置模板库+LLM 生成；动作演示=要点文字+B站/YouTube 外链；记录=跟练模式）。

## §1 内容与数据
- **动作库** `src/data/exercises.json`（~40 起步）：力量六大项 + Hyrox 八项 + 瑜伽序列常用体式。字段：{id, name, muscles[], cues[3-5], mistakes[1-3], videoUrl}
- **课表模板库** `src/data/workoutTemplates.json`：力量分化（推/拉/腿）、Hyrox 模拟、CrossFit AMRAP/EMOM/For Time、瑜伽流。字段：{id, name, style, blocks:[{exerciseId, sets, reps|duration|distance, restSec}]}
- **新表 `workouts`**（迁移 003）：计划实例 + 跟练记录 {id, user_id, date, template_id?, title, blocks jsonb, status: planned|in_progress|done, performed jsonb, created_at}；RLS 同 entries
- 练完自动写一条 entries workout 汇总（时间线/周览零改动兼容）

## §2 页面（第 5 tab「训练」）
- **今日课表**：当日 planned/in_progress 计划；空态 + 「一键生成」+「从库选」
- **跟练页**：逐动作逐组打卡，重量/次数预填上次实绩（查最近同动作 performed），组间休息倒计时（30/60/90s 可调，屏幕常亮 wake lock 尽力而为）
- **课表库**：模板浏览 → 排入某天；动作详情（要点/常见错误/视频外链）
- **手动调整**：计划内增删动作、改组次重量、换天

## §3 一键生成
- Edge Function `generate-workout`：输入 {direction: 力量|hyrox|瑜伽, recent: 最近2周 workout entries 摘要} → LLM（现网关）→ 输出课表草稿 JSON（严格字段白名单校验，同 parse-entry 模式）→ 前端可改后确认才落库。LLM 只出草稿不写库
- 饮食/运动建议：并入现有 AI 周总结的建议段强化（prompt 加入训练量/饮食模式维度），不单独立功能

## 分期
- W1：数据（动作库/模板库/003 迁移）+ 课表库页 + 手动排课 + 练完归档
- W2：跟练模式 + 休息计时
- W3：一键生成 + 周总结建议强化

## 验收
每期：TDD 单测 + tsc/build + 375px 实测；W1 结束即可用（手动流全通）。
