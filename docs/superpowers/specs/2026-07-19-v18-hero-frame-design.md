# V1.8：玻璃画框封面 + 文字下移 + 句子加载修复 + Headspace 心情脸 + 狗方向修复

> 用户反馈 2026-07-19。

## A. 封面重构（图带液态毛玻璃框，文字下移）
- hero 图从满幅出血改为**带框画卡**：左右留 16px、顶部 safe-area+12px，border-radius 20px，高 ~52vh
- **液态毛玻璃框**（用户点名要的效果，purposeful glassmorphism）：图内侧一圈玻璃环——
  `position:absolute; inset:0; border:10px solid rgba(255,255,255,.30); backdrop-filter: blur(10px) saturate(1.2); border-radius:inherit; pointer-events:none`
  （blur 作用在图边缘上=毛玻璃画框）+ 外圈 1px 奶油细线。降级：不支持 backdrop-filter 时纯半透明白框
- 图上**不再叠字**：scrim/overlay 删除
- **文字块下移**到图下方的粉底空区（原光秃秃区域）：垂直居中排——日期 30px/800 居中李子紫、时钟 12px、一句话 15px、copyright 11px muted。区域 flex-grow 居中，狗条以上
- 心情行不回首页（保持 V1.7 IA：记录页）

## B. 句子加载顺序修复（bug）
- 现象：打开先显示古诗词，几秒后跳成图相关句——两段式加载空档被 fallback 填了
- 修：句子位三态 `loading | ai | fallback`
  - 缓存命中（含句）→ 直接 ai
  - fast 段回来、full 在途 → **loading：句子位显示占位**（细淡「…」或空，不显示古诗词）
  - full 回来有句 → ai；full 回来无句/失败 → 这时才 fallback 古诗词
- 日期/时钟不受影响始终即时显示

## C. Headspace 风心情脸
- 6 个内联 SVG 圆脸替换 emoji 展示（**存库值不变**，仍是 😊😐😮‍💨🥳😢🤒 字符串——向后兼容，只换渲染）
- 风格：实心圆底 + 极简五官（弧线眼/嘴），一情绪一低饱和底色（布达佩斯谱系：😊芥末金/😐藕灰/😮‍💨薄荷/🥳树莓/😢湖蓝绿/🤒藕紫），五官线条统一李子紫，线宽一致
- 尺寸 36px，选中态：外圈 2px 树莓环 + 底色加深一档；未选中 opacity .75
- 时间线/日详情里显示 mood 的地方仍可用 emoji 字符（范围限心情选择行），历史数据显示不变

## D. 狗行走方向修复（bug）
- 现象：狗会「倒着走」——面朝方向与位移方向不同步
- 事实：🐕 emoji 本体面朝**左**。位移向左段（X 递减）→ 不翻转；位移向右段（X 递增）→ scaleX(-1)
- 修 walk keyframes：翻转与位移分段严格绑定（在折返点同帧切换），确保任何时刻脸朝行进方向；嗅地/bob 子 transform 不干扰翻转层（分层 span）

## 验收
- 全量单测绿（HomeView 结构/句子三态测试、MoodFace 渲染+选中映射测试、狗方向 keyframe 结构测试可行则加）
- tsc/build；375px 实测：玻璃框质感、下方文字区不再空秃、冷启动句子位无古诗词闪现（先占位后出句）、心情脸选中流转、狗左右走均脸朝前
- 对比度：日期李子紫 on 粉底 ≥4.5:1（#3D2C3C on #F5E3DF ≈ 10:1 过）
