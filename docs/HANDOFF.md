# Life Tracker 交接说明

> 面向接手的任何开发者（不限定 AI 工具或人工），读完能独立开发、部署、排障。
> 更新于 2026-07-19（V1.8）。产品负责人：Grace。

## 这是什么

个人生活追踪 PWA：饮食/运动/旅行/阅读/日记/学习六域快速记录 + AI 解析 + 周月总结 + 旅行规划（2026-2065）+ 学习流（含每周 AI 推荐）+ 训练课表（Hyrox/CrossFit/力量一键生成）。定位为可推广产品，视觉是布达佩斯大饭店风（粉/紫/画框）。

- **线上**：https://evelyn7852-ops.github.io/life-tracker/
- **仓库**：github.com/evelyn7852-ops/life-tracker（⚠️ 必须保持 public，私有会自动停用 GitHub Pages → 全站 404）

## 技术栈一览

| 层 | 选型 | 说明 |
|---|---|---|
| 前端 | Vite + React + TypeScript(strict) | 单 CSS 文件 `src/app.css`，设计 token 全在 `:root` |
| PWA | vite-plugin-pwa | manifest + SW 自动生成 |
| 后端 | Supabase（项目名 super AI，区域新加坡） | Postgres + Auth + Edge Functions |
| LLM | agnes-ai 中转站 | base URL `https://apihub.agnes-ai.com/v1`（⚠️ 不是 api.agnes-ai.com，那是死域名）；模型 `agnes-2.0-flash`；OpenAI 协议，仅认 Bearer |
| 部署 | GitHub Actions → GitHub Pages | push main 自动构建部署，`.github/workflows/deploy.yml` |

## 本地起步

```bash
npm install
npm run dev          # localhost:5173
npm test             # 单元测试（vitest）
npm run test:int     # 集成测试（打真 Supabase，需 .env.local）
npx tsc -b           # 类型检查
npx vite build       # 生产构建
```

需要两个本地文件（均已 gitignore，找 Grace 要值）：
- `.env`：`LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` / `SUPABASE_ACCESS_TOKEN`（部署函数用）/ `CRON_SECRET`
- `.env.local`：`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`（publishable key，本可公开）/ `VITE_TEST_EMAIL` / `VITE_TEST_PASSWORD`（测试账号）

## 数据模型（Supabase，全表 RLS "own rows"）

| 表 | 用途 |
|---|---|
| `entries` | 六域记录主表：ts/domain/raw_text/data(jsonb)/parse_source/tags |
| `summaries` | AI 周月总结缓存，(user_id, period_type, period_start) 唯一 |
| `trips` | 旅行规划 152 程种子 + 用户增改，seed_key 幂等 |
| `workouts` | 训练计划实例与完成状态 |
| `learning_items` | 学习流条目（manual/auto），status 待读/在读/已读 |
| `learning_progress` | 黑客松集训勾选进度（item_id 如 w1-learn-0） |

约定：**建表 SQL 用 text 不用 enum**、全部 `if not exists` / `drop policy if exists`（可重复跑）——历史上 enum 残留曾让整段 SQL 中断。迁移文件在 `supabase/migrations/`，实际执行方式是把 SQL 贴进 Supabase Dashboard → SQL Editor 跑。

## Edge Functions（`supabase/functions/`）

| 函数 | 职责 | 要点 |
|---|---|---|
| `parse-entry` | 录入一句话的 LLM 兜底解析 | 字段名白名单清洗（含嵌套 sets[]） |
| `summarize` | 周/月 AI 总结 | 边界时间由客户端传（时区安全），period_start 仅作缓存键 |
| `daily-image` | Bing 每日一图代理 + 地点化句子 | `?fast=1` 跳过 LLM 秒回图（两段式加载）；`?debug=1` 暴露错误 |
| `generate-workout` | 每日课表生成 | 动作 id 白名单**内联副本**，必须与 `src/data/exercises.json` 同步（有 `generateWorkoutSync.test.ts` 守卫） |
| `recommend-learning` | 每周学习推荐 | 需 `x-cron-secret` 头；URL 服务端 HEAD 验证，验不过置 null（前端给搜索按钮） |

部署：`SUPABASE_ACCESS_TOKEN=<token> npx supabase functions deploy <name>`
密钥：`npx supabase secrets set KEY=value`（LLM_*、CRON_SECRET 已设）

## 三条用血换来的教训

1. **LLM 知道话题但会编 URL**。任何让模型给链接的地方：要么服务端验证（HEAD），要么给搜索链接（B站/Google 按标题搜），绝不直出模型给的 URL。动作库和学习流都是这么做的。
2. **CORS 预检**：Edge Function 的 `Access-Control-Allow-Headers` 必须含 `authorization, x-client-info, apikey, content-type`——supabase-js 的 invoke 会带后两个，少了预检就挂（curl 测不出来，浏览器才炸）。
3. **repo 改私有 = 网站消失**。GitHub 免费档私有仓不提供 Pages。恢复：改回 public + `gh api repos/<owner>/life-tracker/pages -X POST -f build_type=workflow`。

## 代码结构速览

```
src/
  components/   视图组件（HomeView 封面 / MoodHeader+QuickInput+CalendarView+TodayView 记录页
                / ReviewView(历史+周览) / PlanView(训练+旅行+学习) / DogBanner 全局互动狗）
  lib/          纯逻辑：parser(规则解析) entriesRepo/tripRepo/workoutRepo/learningRepo(数据层)
                stats(streak/统计) almanac(节气节日) outbox(离线队列) dailyImage quote
  data/         静态数据：exercises/workoutTemplates/travelPlan/learningPlan/quotes
docs/superpowers/specs/   每个版本的设计规约（含被钉死的设计决策与理由）
.superpowers/sdd/progress.md   开发台账（每版做了什么、遗留什么）
```

## 工作流约定（如何加功能）

1. 写 spec 到 `docs/superpowers/specs/`（设计决策写死，不留模糊）
2. TDD：先测试后实现；改边界（时区/日期/白名单）必须有锚点测试
3. 改完跑全量：`npm test` + `npx tsc -b` + `npx vite build`
4. 375px 视口手测关键流（登录→记录→各 tab）
5. push main 即部署；CI 绿 + 线上 200 才算完
6. 台账 `progress.md` 记一笔（做了什么、遗留什么）

## 当前遗留（按优先级）

1. **pg_cron 未开**：每周推荐目前手动触发。SQL 在 spec `2026-07-17-v15d-auto-recommend-design.md`，把 `<CRON_SECRET>` 换成 .env 里的值后在 SQL Editor 跑
2. Web Push 推送（学习推荐到锁屏）——未开工
3. 运动 W2 跟练模式（逐组打卡+组间倒计时）——spec 有分期规划
4. 小优化账本：周览页 WeekView+StatsCard 重复拉 60 天数据；旅行记录与 trip 的关联闭环；2042 美国线预算重估

## 联系与账号

- Supabase/GitHub 账号归 Grace（evelyn7852-ops）；测试账号见 .env.local
- 所有历史设计决策（为什么这么做）都在 specs 目录里，动大结构前先读对应 spec
