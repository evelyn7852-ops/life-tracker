# life-tracker — 项目上下文（每次会话自动载入）

个人生活追踪 PWA，Grace 的产品（定位已从自用升级为**可推广产品**，颜值=实用性）。

## 现状（2026-07-18，V1.7 上线）
- **线上**: https://evelyn7852-ops.github.io/life-tracker/ （GitHub Pages，push main 自动部署）
  ⚠️ 仓库必须保持 **public**——曾被改 private 导致 Pages 停用全站 404
- **IA**: 首页(纯封面 hero) / 记录(心情+录入+日历+今日) / 回顾(历史+周览+统计) / 规划(训练+旅行+学习三合一 segment)
- **主题**: 布达佩斯大饭店——Mendl's粉 #F5E3DF / 李子紫墨 #3D2C3C / 树莓 #A34E64 / 芥末金 #C99334 / 薄荷 #8FB39E / 画框卡(outline offset -5px) / 居中对称标题。图标=粉盒紫爪奶油双框
- **全局互动狗**: DogBanner 在 tabs 上方，随当日记录变状态，可点击互动（键盘可达）

## 技术栈与约定
- Vite + React + TS strict；单 css 文件 src/app.css（token 在 :root）；测试 vitest（`npm test` 单测 / `npm run test:int` 集成，须测试账号）
- Supabase 项目 "super AI" (ref jfrhisosjamjcjjkryyz, Singapore)：表 entries/summaries/trips/workouts/learning_items/learning_progress，全部 RLS "own rows"；建表 SQL 用户在 Dashboard SQL Editor 手跑（约定：text 不用 enum + if-not-exists，enum 残留曾致失败）
- Edge Functions: parse-entry(录入LLM兜底) / summarize(周月总结) / daily-image(Bing图+地点句,?fast=1两段式) / generate-workout(每日课表) / recommend-learning(周推荐,x-cron-secret 鉴权)。部署 `SUPABASE_ACCESS_TOKEN=<见.env> npx supabase functions deploy <name>`
- LLM 网关: `https://apihub.agnes-ai.com/v1`（**不是** api.agnes-ai.com），模型 agnes-2.0-flash，OpenAI 协议，密钥在 .env + Supabase secrets
- 核心教训：LLM 知道话题但会编 URL——链接一律服务端 HEAD 验证或搜索兜底（学习流/动作库先例）
- generate-workout 内联动作白名单须与 src/data/exercises.json 同步（generateWorkoutSync.test.ts 守卫）
- 秘密永不进 git：.env/.env.local gitignored；测试账号在 .env.local (VITE_TEST_EMAIL/PASSWORD)
- 工作流：spec 进 docs/superpowers/specs/ → 派 subagent 实施(TDD) → 独立 subagent 审查 → 375px 实测 → push；台账 .superpowers/sdd/progress.md

## 待办（按优先级）
1. pg_cron 周推荐 SQL 未跑（spec: docs/superpowers/specs/2026-07-17-v15d-auto-recommend-design.md，CRON_SECRET 在 .env）
2. ③b2 Web Push 推送（学习推荐到锁屏）
3. 运动 W2 跟练模式（逐组打卡+组间倒计时+wake lock）
4. 小账本：WeekView+StatsCard 重复 60d fetch；旅行 entry↔trip 关联闭环；2042 美国线预算重估；学习 id-gen lib/组件重复
