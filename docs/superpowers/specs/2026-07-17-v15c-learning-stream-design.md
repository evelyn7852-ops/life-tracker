# V1.5 阶段③a：活的学习流 + 学习进度云同步

> 拆自 V1.5 阶段③。③a = 视图 + 手动加 + 云进度（本期）；③b = 自动推荐 cron + Web Push（下期）。

## 动机
- 黑客松 8 周集训是**限时**的，练完页面即死；需要一个会生长的「学习流」承接「有新的值得学的 AI 资源就进来」。
- 现有勾选进度存 localStorage → **单设备**。用户 Mac 勾了手机看不到，是真实痛点。本期搬上云。

## 数据（迁移 005，用户跑 SQL）
```sql
create table if not exists public.learning_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  title text not null,
  url text,
  source text,
  tag text,
  status text not null default '待读',
  note text,
  added_by text not null default 'manual',
  created_at timestamptz not null default now()
);
alter table public.learning_items enable row level security;
drop policy if exists "own rows" on public.learning_items;
create policy "own rows" on public.learning_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists learning_items_user_status on public.learning_items (user_id, status);

create table if not exists public.learning_progress (
  user_id uuid not null default auth.uid() references auth.users(id),
  item_id text not null,
  done boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.learning_progress enable row level security;
drop policy if exists "own rows" on public.learning_progress;
create policy "own rows" on public.learning_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```
（status 用 text 不用 enum——trips 那次 enum 残留导致整段 SQL 中断，本项目统一 text + if-not-exists 可重复跑。）

## A. 学习流（新）
- 学习规划 overlay 分两段：**学习流**（新，默认）+ **集训存档**（现有黑客松 8 周，保留）。
- 学习流视图：待读/在读/已读 三态分段；条目卡显示 title/source/tag，url 可点开外链（target=_blank rel=noopener）。
- 手动加：「+ 加资源」表单（title 必填 / url / source / tag / note）。
- 状态切换：条目上三态切换按钮，写库。
- 删除：条目可删。
- added_by 'manual'|'auto'——本期只产 manual；③b 的 cron 产 auto，UI 对 auto 项显「🤖 推荐」小标（提前留位，本期无 auto 项也无害）。

## B. 集训进度云同步
- 现 LearningPlanView 勾选存 localStorage key `ai_bootcamp_progress_v3`，itemId `w{n}-{section}-{i}` / `setup-{i}` / `m{p}-{i}`。
- 改为写 `learning_progress` 表（item_id 沿用同一 id 方案，跨设备同步）。
- **一次性迁移**：首次打开集训存档时，若 localStorage 有进度且云端该用户无记录 → 把本地勾选批量写入云端，然后以云端为准。迁移幂等（已迁过不重复）。
- 迁移后 localStorage 不再作为真相源（可保留不清，避免误删）；UI 去掉「单设备限制/云同步待V1.5」提示，改为无提示（已云同步）。
- 离线时：写库失败不崩，提示「离线，稍后重试」（不做 outbox 队列，学习勾选不是高频刚需）。

## 验收
- 单测：learningRepo CRUD/状态切换、进度迁移幂等（本地有云端无→迁；云端已有→跳过）、学习流三态分组。
- 全量单测绿 + tsc + build + 375px 实测（加资源→状态流转→删；集训勾选跨刷新保持）。
- 用户跑 005 SQL 后由 controller 实测云同步。
