# Life Tracker — V1 设计文档

日期：2026-07-08
状态：已批准（brainstorming 逐节确认）

## 1. 目标与范围

个人生活追踪 web app，手机优先。解决核心痛点：饮食/运动/旅行/阅读/日记/AI学习的记录散落各地，无法实时追踪、无法一处阅览更新。

**V1 范围（唯一目标）：全域快速记录 + 时间线阅览。**

明确不做（V2+）：
- 旧计划导入（前置条件：三版旅行规划互相矛盾，需先人工合并出唯一真相源）
- 训练模块全功能（课表库、动作演示，类训记/Hyrox/CrossFit）
- 计划引擎（旅行提前 → 连锁自动重排）
- AI 课程定期扫描 + 推荐推送

## 2. 架构

```
手机/Mac 浏览器
   │
   ▼
PWA（Vite + React + TypeScript）— GitHub Pages 托管
   │
   ├── 本地规则解析器（纯前端，零成本，即时）
   │
   ▼
Supabase 免费档
   ├── Postgres：entries 单表
   ├── Auth：email 登录，单用户，RLS 按 user_id 隔离
   └── Edge Function `parse-entry`：调 LLM 兜底解析
        （用户提供第三方中转站 key；LLM_API_KEY / LLM_BASE_URL / LLM_MODEL
        存 Supabase secret，永不进前端；协议按 OpenAI-compatible 适配，
        base URL 与模型名为部署时配置项）
```

- 项目目录 `~/Projects/life-tracker`，git 管理
- PWA：manifest + service worker，手机加主屏图标即类原生体验
- V2 扩展路径已预留：pg_cron + Edge Function 跑定时任务（课程扫描/推送），架构不变

## 3. 数据模型

单表 `entries`，六域共用，域差异放 JSONB：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | RLS 隔离 |
| `ts` | timestamptz | 事件发生时间，可回补 |
| `domain` | enum | food / workout / travel / reading / journal / learning |
| `raw_text` | text | 原始输入，永久保留，支持重解析 |
| `data` | jsonb | 域专属字段，约定见下 |
| `parse_source` | enum | rule / llm / manual |
| `tags` | text[] | 自由标签 |
| `created_at` / `updated_at` | timestamptz | |

`data` 各域 V1 约定：

- **food**: `{meal: "早"|"午"|"晚"|"加餐", items: string[]}`
- **workout**: `{type: "yoga"|"力量"|"跑步"|"hyrox"|string, duration_min?: number, sets?: [{exercise: string, weight_kg?: number, reps: number}]}` — sets 结构 V2 训练模块直接复用
- **reading**: `{title: string, pages?: number, minutes?: number}`
- **learning**: `{course: string, topic?: string, minutes?: number}`
- **journal**: `{mood?: string}`（正文即 raw_text）
- **travel**: `{place: string, note?: string}`

## 4. 录入流

打开 app 即输入框，零导航。

1. 输入一句话（「瑜伽45分钟」「午餐 鸡胸肉沙拉」「卧推40kg 5x5」）
2. 本地规则解析 → 即时预览卡：域标签 + 字段 chips，点 chip 可改
3. 规则解不出 → 「AI 解析」按钮走 Edge Function（Haiku）；或手选域直接存原文
4. 确认保存。`ts` 默认现在，可改
5. 离线：写 IndexedDB outbox，联网自动上传。单用户 last-write-wins

规则解析器 V1 覆盖（写死、可单测）：
- 域关键词词典：早餐/午餐/晚餐/加餐 → food；瑜伽/力量/跑步/hyrox/训练 → workout；读/阅读 → reading；学/课 → learning；日记/随想 → journal；到达/出发/旅行 → travel
- 时长正则：`(\d+)\s*(分钟|min|小时|h)`
- 力量句式：`动作 数字kg 数字x数字`（如「卧推 40kg 5x5」）

## 5. 视图（V1 三个）

- **今日**：当天记录时间倒序卡片流，顶部六域打卡点
- **历史**：无限滚动时间线 + 域过滤 chips + 日期跳转
- **周览**：本周各域次数条 + 连续 streak（深度统计留 V2）

所有卡片可编辑/删除。

## 6. 错误处理

- 解析链降级：规则 → LLM（5s 超时）→ 手动。任何一环失败不丢输入
- Edge Function 失败/无网：存原文标「未解析」，支持后续批量重解
- 离线 outbox：网络恢复自动重试，指数退避

## 7. 测试

- vitest：规则解析器每条规则 + 边界句式单测
- 数据层：对真实 Supabase 免费项目跑集成冒烟（增删改查 + RLS）
- 上线前：webapp-testing 以手机视口（375px）跑完整录入→阅览流程

## 8. 已知约束与风险

- Supabase 免费档 7 天无活动暂停项目（日用不触发；长期不用需手动恢复）
- LLM 解析走用户提供的第三方中转站 key（已置于本地 .env，gitignored）；中转站稳定性不受我们控制，解析链已有手动降级兜底。key 曾出现在聊天记录中，建议项目稳定后轮换
- GitHub Pages 免费档要求 repo 公开。可接受：前端代码无秘密（Supabase anon key 设计上可公开，数据由 RLS 保护）；若坚持私有 repo，改用 Vercel 免费托管，架构不变

## 9. 已定决策记录

| 决策 | 选择 |
|---|---|
| 后端 | Supabase 免费档 |
| V1 范围 | 仅全域快速记录 |
| 录入方式 | 一句话 + 自动结构化（可展开表单） |
| 解析引擎 | 规则为主 + LLM（Haiku）兜底 |
| 前端 | Vite + React + TS，PWA，GitHub Pages |
