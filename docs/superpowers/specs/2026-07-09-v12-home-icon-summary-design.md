# V1.2：首页每日一句 + 克莱因蓝图标 + AI 周/月总结

> 用户批准 2026-07-09（批次顺序：本批 → 运动模块）。

## ① App 图标
- 克莱因蓝底 `#002FA5` + 白色狗脚印（掌垫 1 大 + 趾垫 4 小），圆角由系统裁
- 产出：icon-192.png / icon-512.png / apple-touch-icon.png (180)
- manifest theme_color/background_color 同步克莱因蓝

## ② 首页 HomeView（新 tab 首位，默认落点）
- 大日期（7月9日 周四）+ 走时（分钟级，复用 MoodHeader 逻辑）
- 每日一图：Bing 每日一图，经新 Edge Function `daily-image` 代理（浏览器直取有 CORS 墙）；函数回 {url, copyright}，客户端 <img> 直载 Bing CDN；离线/失败降级为克莱因蓝纯色底
- 每日一句：内置语录库 `src/data/quotes.json`（首批 90 条精选——用户批准：确保出处真实优先于数量，后续分批扩充、每批过出处校验；文学/哲学/生活向，中文为主），按 dayOfYear 轮换；卡片式排版（图上文下，单向历感）
- 心情行从 MoodHeader 迁到首页；记录 tab 顶部保留日期时钟不留 emoji（避免重复）
- tab 变四个：首页 / 记录（今日+录入）/ 历史 / 周览

## ③ AI 周/月总结
- 新表 `summaries`：{id, user_id, period_type: 'week'|'month', period_start: date, content: text, created_at}，RLS 同 entries
- 新 Edge Function `summarize`：输入 period_type+period_start → 服务端查该用户期间 entries（service role 不行，用请求者 JWT 直查，RLS 天然限权）→ LLM（现网关）生成：各域数据点、模式观察、下周期建议，全中文 ≤300 字 → 存 summaries 表 → 返回
- UI：周览页底部「AI 本周总结」按钮（已有缓存直接展示 + 可重新生成）；周览页加「本月」入口同逻辑
- 定时推送不在本期（Web Push 基建另立项）

## 验收
- 单测：quotes 轮换函数、summary UI 状态分支；全量绿；tsc/build 过
- Edge Functions 部署后真调验证
- 375px 实测：首页视觉、tab 流转、总结生成
