# V1.5 阶段③b1：每周自动推荐 AI 学习资源

> 拆自阶段③b。③b1 = cron + LLM 推荐入库（本期）；③b2 = Web Push 推送（下期）。
> 兑现用户最初需求：「有新的值得学习的 ai 课程也会自动推荐推送」的「自动推荐」半。

## 架构选择
- **Supabase Edge Function `recommend-learning` + pg_cron 每周触发**（不用 GitHub Actions cron）。
  理由：Edge Function 内可用平台注入的 `SUPABASE_SERVICE_ROLE_KEY`（免 RLS 限制、可为用户写入），密钥不出 Supabase；GitHub Actions 方案需把 service role key 放 GitHub secret，扩大密钥暴露面。
- 触发链：pg_cron（每周一 09:00 Asia/Shanghai = 01:00 UTC）→ `net.http_post` 调 Edge Function → 函数用 service role 给每个用户插推荐。

## 函数逻辑 `recommend-learning`
1. 鉴权：仅接受带 `x-cron-secret` 头且匹配 env `CRON_SECRET` 的请求（防公网乱调）。非法 → 401。
2. 取用户清单：service role 查 `auth.users`（本项目实际单用户，但按多用户写）。
3. 对每个用户：
   - 查该用户已有 `learning_items` 的 title+url（去重基准，取近 200 条）。
   - 调 LLM（复用 LLM_* env，同 summarize/parse-entry；20s 超时）：要求输出 2-3 条**当前值得学的 AI 资源**，严格 JSON `[{title,url,source,tag,note}]`；prompt 明确：不得编造不存在的资源/链接，宁可少给；给出已广为人知的官方文档/论文/课程；附上已有清单要求避重。
   - 服务端校验：JSON 解析失败/非数组 → 该用户跳过（不报错整体失败）；逐条白名单字段、title 必填、url 必须 http(s) 开头否则置 null、与已有 title 完全相同则丢弃；最多留 3 条。
   - 插入 `learning_items`，`added_by='auto'`、`status='待读'`。
4. 返回 `{inserted: N, users: M}`；任何单用户失败不影响其他用户。

## 瑞造风险（重点）
LLM 可能编造不存在的课程/死链。缓解：
- prompt 强制「只给你确信真实存在的、知名机构的资源；不确定就少给或不给」。
- UI 上 auto 项已有 🤖 推荐 标（③a 已实现），用户自行判断。
- 不做链接可达性校验（Edge Function 逐条 fetch 成本高、易误杀）；接受「可能有死链」，由用户删除。**此权衡明确记录**。

## SQL（用户跑）
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'weekly-learning-recommend',
  '0 1 * * 1',
  $$
  select net.http_post(
    url := 'https://jfrhisosjamjcjjkryyz.supabase.co/functions/v1/recommend-learning',
    headers := '{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb
  );
  $$
);
```
（`<CRON_SECRET>` 由 controller 生成后给用户；同值设为 Edge Function secret。）

## 验收
- 函数单测不可行（Deno）；客户端无改动。
- Controller 真调验证：带正确 secret → 返回 inserted≥0；带错 secret → 401；连调两次验证去重（第二次不应插入完全同名项）。
- 用户跑 SQL 后：`select * from cron.job` 可见任务；下周一自动跑（不等待验证，手动调即证明链路）。
- 推荐质量抽验：controller 人工看 3 条输出是否真实存在的知名资源（不可达/明显编造 → 调 prompt 重试）。
