# Life Tracker V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 手机优先 PWA：六域（饮食/运动/旅行/阅读/日记/AI学习）一句话快速记录 + 规则/LLM 解析 + 今日/历史/周览三视图，数据存 Supabase。

**Architecture:** Vite + React + TS 前端托管 GitHub Pages；本地规则解析器优先，Supabase Edge Function `parse-entry` 调第三方中转站（OpenAI 协议）兜底；单表 `entries`（JSONB 域字段）+ RLS；离线走 IndexedDB outbox。

**Tech Stack:** Vite 5, React 18, TypeScript (strict), @supabase/supabase-js v2, idb-keyval, vite-plugin-pwa, vitest + @testing-library/react + jsdom。

## Global Constraints

- 项目根：`/Users/grace_1/Projects/life-tracker`（git 已 init，spec 已提交）
- 运行时依赖只允许：`react`, `react-dom`, `@supabase/supabase-js`, `idb-keyval`
- TypeScript `strict: true`；UI 文案全中文；移动优先（375px 视口设计）
- 秘密永不进 git：`.env` 已 gitignored，持有 `LLM_API_KEY`、`LLM_BASE_URL=https://api.agnes-ai.com/api/v1`、`LLM_MODEL`（待定）
- LLM 协议：OpenAI-compatible `POST {base}/chat/completions`，`Authorization: Bearer`（已实测该网关路径与 auth 格式）
- **外部阻塞项**：① 用户重发有效 API key（当前 key 被网关拒绝）→ Task 12 前必须解决；② Task 6 需用户创建 Supabase 项目（免费档）
- Commit 规范：每 task 至少一 commit，msg 用 `feat:`/`test:`/`chore:` 前缀
- 域枚举六值固定：`food | workout | travel | reading | journal | learning`

---

### Task 1: 脚手架 + 测试环境

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/app.css`, `src/lib/smoke.test.ts`

**Interfaces:**
- Produces: 可跑的 dev server + `npm test`（vitest）绿。

- [ ] **Step 1: 脚手架**

```bash
cd /Users/grace_1/Projects/life-tracker
npm create vite@latest . -- --template react-ts
npm install
npm install @supabase/supabase-js idb-keyval
npm install -D vitest @testing-library/react @testing-library/user-event jsdom vite-plugin-pwa
```

注意：目录非空（docs/.env/.gitignore），create vite 会问是否覆盖 → 选 "Ignore files and continue"。之后确认 `.gitignore` 仍含 `.env`（vite 模板可能覆盖它，需手动合并回 `node_modules/`、`dist/`、`.env`、`.DS_Store` 四行）。

- [ ] **Step 2: vite.config.ts 配置 vitest + base path**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/life-tracker/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

`package.json` scripts 加：`"test": "vitest run", "test:watch": "vitest"`。

- [ ] **Step 3: 冒烟测试**

`src/lib/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 4: 运行验证**

Run: `npm test` → Expected: 1 passed。
Run: `npm run dev` → Expected: localhost:5173 出 Vite 默认页（手动开一眼即可，或 curl 200）。

- [ ] **Step 5: 清空模板 UI**

`src/App.tsx` 替换为：

```tsx
export default function App() {
  return <div className="app">Life Tracker</div>
}
```

`src/app.css` 替换为（删除模板 css，`src/main.tsx` 里只 import 这一个 css）：

```css
:root { --bg:#faf9f5; --card:#fff; --ink:#1a1a1a; --muted:#8a8578; --accent:#c15f3c; --line:#e8e4da; }
* { box-sizing:border-box; margin:0; }
body { background:var(--bg); color:var(--ink); font-family:-apple-system,'PingFang SC',sans-serif; }
.app { max-width:480px; margin:0 auto; min-height:100dvh; display:flex; flex-direction:column; }
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold vite react-ts + vitest"
```

---

### Task 2: 领域类型定义

**Files:**
- Create: `src/lib/types.ts`

**Interfaces:**
- Produces（后续所有 task 依赖，签名精确）：

```ts
export type Domain = 'food' | 'workout' | 'travel' | 'reading' | 'journal' | 'learning'
export type ParseSource = 'rule' | 'llm' | 'manual'

export interface SetGroup { exercise: string; weight_kg?: number; sets: number; reps: number }

export interface FoodData { meal: '早' | '午' | '晚' | '加餐'; items: string[] }
export interface WorkoutData { type: string; duration_min?: number; sets?: SetGroup[] }
export interface ReadingData { title: string; pages?: number; minutes?: number }
export interface LearningData { course: string; topic?: string; minutes?: number }
export interface JournalData { mood?: string }
export interface TravelData { place: string; note?: string }

export type EntryData = FoodData | WorkoutData | ReadingData | LearningData | JournalData | TravelData

export interface Entry {
  id: string
  ts: string            // ISO
  domain: Domain
  raw_text: string
  data: EntryData
  parse_source: ParseSource
  tags: string[]
}

export type NewEntry = Omit<Entry, 'id'>

export interface ParseResult { domain: Domain; data: EntryData }

export const DOMAIN_LABEL: Record<Domain, string> = {
  food: '饮食', workout: '运动', travel: '旅行',
  reading: '阅读', journal: '日记', learning: '学习',
}
export const ALL_DOMAINS: Domain[] = ['food','workout','travel','reading','journal','learning']
```

备注：`SetGroup` 用 `{sets, reps}` 表示「5x5」，比 spec 中展开数组更实用；spec 意图不变（V2 训练模块复用）。

- [ ] **Step 1: 写入上述文件原文**
- [ ] **Step 2: `npx tsc --noEmit` 通过**
- [ ] **Step 3: Commit** `git add -A && git commit -m "feat: domain types"`

---

### Task 3: 规则解析器 — food / workout

**Files:**
- Create: `src/lib/parser.ts`
- Test: `src/lib/parser.test.ts`

**Interfaces:**
- Consumes: `types.ts` 全部
- Produces: `export function parseEntry(text: string): ParseResult | null`（null = 规则解不出，走 LLM/手动）

- [ ] **Step 1: 写失败测试（food + workout）**

`src/lib/parser.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseEntry } from './parser'
import type { FoodData, WorkoutData } from './types'

describe('parseEntry: food', () => {
  it('午餐 + 多个食物', () => {
    const r = parseEntry('午餐 鸡胸肉沙拉 黑咖啡')!
    expect(r.domain).toBe('food')
    const d = r.data as FoodData
    expect(d.meal).toBe('午')
    expect(d.items).toEqual(['鸡胸肉沙拉', '黑咖啡'])
  })
  it('早饭同义词', () => {
    expect((parseEntry('早饭 燕麦')!.data as FoodData).meal).toBe('早')
  })
  it('加餐', () => {
    expect((parseEntry('加餐 蛋白棒')!.data as FoodData).meal).toBe('加餐')
  })
})

describe('parseEntry: workout', () => {
  it('瑜伽45分钟', () => {
    const r = parseEntry('瑜伽45分钟')!
    expect(r.domain).toBe('workout')
    const d = r.data as WorkoutData
    expect(d.type).toBe('瑜伽')
    expect(d.duration_min).toBe(45)
  })
  it('小时换算', () => {
    expect((parseEntry('跑步1小时')!.data as WorkoutData).duration_min).toBe(60)
  })
  it('力量句式 卧推40kg 5x5', () => {
    const d = parseEntry('卧推40kg 5x5')!.data as WorkoutData
    expect(d.type).toBe('力量')
    expect(d.sets).toEqual([{ exercise: '卧推', weight_kg: 40, sets: 5, reps: 5 }])
  })
  it('多组动作', () => {
    const d = parseEntry('力量 深蹲60kg 3x8 硬拉80kg 3x5')!.data as WorkoutData
    expect(d.sets).toHaveLength(2)
    expect(d.sets![1]).toEqual({ exercise: '硬拉', weight_kg: 80, sets: 3, reps: 5 })
  })
  it('hyrox 大小写', () => {
    expect((parseEntry('Hyrox 60分钟')!.data as WorkoutData).type).toBe('hyrox')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/parser.test.ts` → Expected: FAIL（parser.ts 不存在）。

- [ ] **Step 3: 实现**

`src/lib/parser.ts`:

```ts
import type { Domain, EntryData, FoodData, ParseResult, SetGroup, WorkoutData } from './types'

const MEAL_MAP: Record<string, FoodData['meal']> = {
  早餐: '早', 早饭: '早', 午餐: '午', 午饭: '午', 中饭: '午',
  晚餐: '晚', 晚饭: '晚', 加餐: '加餐', 零食: '加餐',
}

const WORKOUT_TYPES = ['瑜伽', '力量', '跑步', 'hyrox', 'crossfit', '健身', '游泳', '骑行', '徒步', '训练']

const DURATION_RE = /(\d+(?:\.\d+)?)\s*(分钟|min|小时|h)/i
const SETS_RE = /([一-龥a-zA-Z]+?)\s*(\d+(?:\.\d+)?)\s*kg\s*(\d+)\s*[x×X]\s*(\d+)/g

function splitTokens(s: string): string[] {
  return s.split(/[\s,，、]+/).filter(Boolean)
}

function parseDuration(text: string): number | undefined {
  const m = text.match(DURATION_RE)
  if (!m) return undefined
  const n = parseFloat(m[1])
  return /小时|h/i.test(m[2]) ? Math.round(n * 60) : Math.round(n)
}

function parseFood(text: string): ParseResult | null {
  for (const [kw, meal] of Object.entries(MEAL_MAP)) {
    if (text.includes(kw)) {
      const items = splitTokens(text.replace(kw, ''))
      return { domain: 'food', data: { meal, items } }
    }
  }
  return null
}

function parseSets(text: string): SetGroup[] {
  const out: SetGroup[] = []
  for (const m of text.matchAll(SETS_RE)) {
    out.push({ exercise: m[1], weight_kg: parseFloat(m[2]), sets: parseInt(m[3]), reps: parseInt(m[4]) })
  }
  return out
}

function parseWorkout(text: string): ParseResult | null {
  const lower = text.toLowerCase()
  const type = WORKOUT_TYPES.find((t) => lower.includes(t))
  const sets = parseSets(text)
  if (!type && sets.length === 0) return null
  const data: WorkoutData = { type: type ?? '力量' }
  if (sets.length > 0) { data.sets = sets; if (!type || type === '训练') data.type = '力量' }
  const dur = parseDuration(text)
  if (dur !== undefined) data.duration_min = dur
  return { domain: 'workout', data }
}

export function parseEntry(text: string): ParseResult | null {
  const t = text.trim()
  if (!t) return null
  return parseFood(t) ?? parseWorkout(t) ?? parseRest(t)
}

// parseRest 在 Task 4 实现；本 task 先占位返回 null
function parseRest(_t: string): ParseResult | null {
  return null
}
```

注意 `data.type` 逻辑：显式类型词优先；只有 sets 句式时 type 为「力量」。

- [ ] **Step 4: 跑测试通过**

Run: `npx vitest run src/lib/parser.test.ts` → Expected: 9 passed。

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: rule parser food/workout"`

---

### Task 4: 规则解析器 — reading / learning / travel / journal

**Files:**
- Modify: `src/lib/parser.ts`（替换 parseRest 占位）
- Test: `src/lib/parser.test.ts`（追加）

**Interfaces:**
- Produces: `parseEntry` 六域完整覆盖；解不出返回 null。

- [ ] **Step 1: 追加失败测试**

```ts
import type { ReadingData, LearningData, TravelData } from './types'

describe('parseEntry: 其余四域', () => {
  it('读书 + 页数', () => {
    const r = parseEntry('读 纳瓦尔宝典 30页')!
    expect(r.domain).toBe('reading')
    const d = r.data as ReadingData
    expect(d.title).toBe('纳瓦尔宝典')
    expect(d.pages).toBe(30)
  })
  it('阅读 + 分钟', () => {
    const d = parseEntry('阅读 尽头的回忆 40分钟')!.data as ReadingData
    expect(d.title).toBe('尽头的回忆')
    expect(d.minutes).toBe(40)
  })
  it('学习课程', () => {
    const r = parseEntry('学 MCP开发 90分钟')!
    expect(r.domain).toBe('learning')
    const d = r.data as LearningData
    expect(d.course).toBe('MCP开发')
    expect(d.minutes).toBe(90)
  })
  it('旅行到达', () => {
    const r = parseEntry('到达 清迈')!
    expect(r.domain).toBe('travel')
    expect((r.data as TravelData).place).toBe('清迈')
  })
  it('日记前缀', () => {
    expect(parseEntry('日记 今天很累但值得')!.domain).toBe('journal')
  })
  it('解不出返回 null', () => {
    expect(parseEntry('嗯')).toBeNull()
    expect(parseEntry('')).toBeNull()
  })
  it('午餐优先于学(含学字食物句)', () => {
    expect(parseEntry('午餐 学校食堂 鸡腿饭')!.domain).toBe('food')
  })
})
```

- [ ] **Step 2: 确认新增 FAIL**（`npx vitest run src/lib/parser.test.ts`）

- [ ] **Step 3: 实现 parseRest 替换占位**

```ts
const PAGES_RE = /(\d+)\s*页/

function stripDurationAndPages(s: string): string {
  return s.replace(DURATION_RE, '').replace(PAGES_RE, '').trim()
}

function parseRest(t: string): ParseResult | null {
  // reading
  const readM = t.match(/^(?:读|阅读|看书)\s*(.*)$/)
  if (readM) {
    const body = readM[1]
    const title = splitTokens(stripDurationAndPages(body)).join(' ')
    if (title) {
      const data: EntryData = { title }
      const pages = body.match(PAGES_RE); if (pages) (data as ReadingData).pages = parseInt(pages[1])
      const min = parseDuration(body); if (min !== undefined) (data as ReadingData).minutes = min
      return { domain: 'reading', data }
    }
  }
  // learning
  const learnM = t.match(/^(?:学习|学|上课)\s*(.*)$/)
  if (learnM) {
    const body = learnM[1]
    const course = splitTokens(stripDurationAndPages(body)).join(' ')
    if (course) {
      const data: LearningData = { course }
      const min = parseDuration(body); if (min !== undefined) data.minutes = min
      return { domain: 'learning', data }
    }
  }
  // travel
  const travelM = t.match(/^(?:到达|抵达|出发去?|飞往|去了)\s*(.+)$/)
  if (travelM) {
    return { domain: 'travel', data: { place: splitTokens(travelM[1])[0], note: splitTokens(travelM[1]).slice(1).join(' ') || undefined } as TravelData }
  }
  // journal
  if (/^(?:日记|随想|感想)/.test(t)) return { domain: 'journal', data: {} }
  return null
}
```

顶部 import 补 `ReadingData, LearningData, TravelData`。

- [ ] **Step 4: 全量测试通过**（Expected: 16 passed）
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: rule parser all six domains"`

---

### Task 5: Supabase 项目 + schema + client

**Files:**
- Create: `supabase/migrations/001_entries.sql`, `src/lib/supabase.ts`, `.env.local`（gitignored，vite 自动忽略需确认 `.gitignore` 加 `.env.local`）

**Interfaces:**
- Produces: `export const supabase: SupabaseClient`；数据库表 `entries` 可用。

**⚠️ USER GATE：需要用户操作** — 到 https://supabase.com 免费注册，新建项目（区域选 Singapore 离沪最近），把 `Project URL` 和 `anon public key`（Settings → API）发给执行者。没有这两个值本 task 无法完成。

- [ ] **Step 1: SQL migration**

`supabase/migrations/001_entries.sql`:

```sql
create type domain_t as enum ('food','workout','travel','reading','journal','learning');
create type parse_source_t as enum ('rule','llm','manual');

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  ts timestamptz not null default now(),
  domain domain_t not null,
  raw_text text not null,
  data jsonb not null default '{}'::jsonb,
  parse_source parse_source_t not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.entries enable row level security;

create policy "own rows" on public.entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index entries_user_ts on public.entries (user_id, ts desc);
```

在 Supabase Dashboard → SQL Editor 里粘贴执行（V1 不引入 supabase CLI 本地栈，Edge Function 部署时才装 CLI）。Expected: success, no rows returned。

- [ ] **Step 2: client 封装**

`.env.local`:

```
VITE_SUPABASE_URL=<用户提供>
VITE_SUPABASE_ANON_KEY=<用户提供>
```

`src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
```

`.gitignore` 追加 `.env.local`。

- [ ] **Step 3: 连通冒烟**

临时脚本 `node --experimental-strip-types` 不稳，直接用 vitest 集成测试标记 skip-by-default：

`src/lib/supabase.int.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { supabase } from './supabase'

// 集成测试：需要 .env.local + 网络。CI/日常 npm test 排除（见下）。
describe('supabase connectivity', () => {
  it('anon 能连上（未登录查询返回空数组而非网络错）', async () => {
    const { data, error } = await supabase.from('entries').select('id').limit(1)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })
})
```

`vite.config.ts` 的 test 块加 `exclude: ['**/node_modules/**', '**/*.int.test.ts']`，另加 script `"test:int": "vitest run --exclude '' src/lib/supabase.int.test.ts"`（vitest CLI 传 `--exclude ''` 覆盖不便时改用 `vitest run -c vitest.int.config.ts`，执行者按当时 vitest 版本行为调整，验收标准=两条命令都能按预期跑）。

Run: `npm run test:int` → Expected: 1 passed（RLS 拦截未登录读，返回空集不报错）。

- [ ] **Step 4: Commit** `git add -A && git commit -m "feat: supabase schema + client"`（确认 `git status` 无 .env.local）

---

### Task 6: 登录界面（email + password）

**Files:**
- Create: `src/components/AuthGate.tsx`
- Modify: `src/App.tsx`, `src/app.css`

**Interfaces:**
- Consumes: `supabase`
- Produces: `<AuthGate>{children}</AuthGate>` — 未登录渲染登录表单，已登录渲染 children。

**USER GATE：** Supabase Dashboard → Authentication → Providers → Email：关闭 "Confirm email"（单用户个人 app，免邮件确认流程）。

- [ ] **Step 1: 实现**

`src/components/AuthGate.tsx`:

```tsx
import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) return null
  if (session) return <>{children}</>

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error?.message.includes('Invalid login credentials')) {
      const { error: e2 } = await supabase.auth.signUp({ email, password })
      setMsg(e2 ? e2.message : '已注册并登录')
    } else if (error) setMsg(error.message)
  }

  return (
    <div className="auth">
      <h1>Life Tracker</h1>
      <input type="email" placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={signIn}>登录 / 注册</button>
      {msg && <p className="muted">{msg}</p>}
    </div>
  )
}
```

`src/App.tsx`:

```tsx
import { AuthGate } from './components/AuthGate'

export default function App() {
  return (
    <AuthGate>
      <div className="app">已登录</div>
    </AuthGate>
  )
}
```

`src/app.css` 追加:

```css
.auth { max-width:320px; margin:30dvh auto 0; display:flex; flex-direction:column; gap:12px; padding:0 16px; }
.auth input, .auth button { padding:12px; border:1px solid var(--line); border-radius:10px; font-size:16px; }
.auth button { background:var(--accent); color:#fff; border:none; }
.muted { color:var(--muted); font-size:13px; }
```

- [ ] **Step 2: 手动验证** dev server 上注册一个账号 → 刷新仍保持登录（localStorage session）。Expected: 显示「已登录」。
- [ ] **Step 3: Commit** `git add -A && git commit -m "feat: auth gate"`

---

### Task 7: entries 数据仓库（CRUD）

**Files:**
- Create: `src/lib/entriesRepo.ts`
- Test: `src/lib/entriesRepo.int.test.ts`（集成，走真实 Supabase + 测试账号登录）

**Interfaces:**
- Consumes: `supabase`, `Entry`, `NewEntry`, `Domain`
- Produces:

```ts
export async function insertEntry(draft: NewEntry): Promise<Entry>
export async function updateEntry(id: string, patch: Partial<NewEntry>): Promise<Entry>
export async function deleteEntry(id: string): Promise<void>
export interface ListOpts { fromTs?: string; toTs?: string; domain?: Domain; limit?: number; beforeTs?: string }
export async function listEntries(opts?: ListOpts): Promise<Entry[]>  // ts desc
```

- [ ] **Step 1: 写集成测试（失败）**

`src/lib/entriesRepo.int.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { supabase } from './supabase'
import { insertEntry, updateEntry, deleteEntry, listEntries } from './entriesRepo'
import type { NewEntry } from './types'

// 需要 .env.local 里加 TEST_EMAIL / TEST_PASSWORD（Task 6 注册的账号）
const draft: NewEntry = {
  ts: new Date().toISOString(),
  domain: 'workout',
  raw_text: '瑜伽45分钟',
  data: { type: '瑜伽', duration_min: 45 },
  parse_source: 'rule',
  tags: [],
}

let createdId: string

beforeAll(async () => {
  const { error } = await supabase.auth.signInWithPassword({
    email: import.meta.env.VITE_TEST_EMAIL,
    password: import.meta.env.VITE_TEST_PASSWORD,
  })
  if (error) throw error
})

afterAll(async () => {
  if (createdId) await deleteEntry(createdId).catch(() => {})
})

describe('entriesRepo CRUD', () => {
  it('insert 返回带 id 的完整行', async () => {
    const e = await insertEntry(draft)
    createdId = e.id
    expect(e.id).toBeTruthy()
    expect(e.domain).toBe('workout')
  })
  it('list 能查到且按 ts desc', async () => {
    const rows = await listEntries({ limit: 5 })
    expect(rows.some((r) => r.id === createdId)).toBe(true)
  })
  it('domain 过滤', async () => {
    const rows = await listEntries({ domain: 'food', limit: 50 })
    expect(rows.every((r) => r.domain === 'food')).toBe(true)
  })
  it('update 改字段', async () => {
    const e = await updateEntry(createdId, { tags: ['am'] })
    expect(e.tags).toEqual(['am'])
  })
  it('delete 后查不到', async () => {
    await deleteEntry(createdId)
    const rows = await listEntries({ limit: 50 })
    expect(rows.some((r) => r.id === createdId)).toBe(false)
    createdId = ''
  })
})
```

`.env.local` 追加 `VITE_TEST_EMAIL` / `VITE_TEST_PASSWORD`。

- [ ] **Step 2: 确认 FAIL**（entriesRepo 不存在）
- [ ] **Step 3: 实现**

`src/lib/entriesRepo.ts`:

```ts
import { supabase } from './supabase'
import type { Domain, Entry, NewEntry } from './types'

const COLS = 'id, ts, domain, raw_text, data, parse_source, tags'

export interface ListOpts { fromTs?: string; toTs?: string; domain?: Domain; limit?: number; beforeTs?: string }

export async function insertEntry(draft: NewEntry): Promise<Entry> {
  const { data, error } = await supabase.from('entries').insert(draft).select(COLS).single()
  if (error) throw error
  return data as Entry
}

export async function updateEntry(id: string, patch: Partial<NewEntry>): Promise<Entry> {
  const { data, error } = await supabase.from('entries')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id).select(COLS).single()
  if (error) throw error
  return data as Entry
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('entries').delete().eq('id', id)
  if (error) throw error
}

export async function listEntries(opts: ListOpts = {}): Promise<Entry[]> {
  let q = supabase.from('entries').select(COLS).order('ts', { ascending: false })
  if (opts.fromTs) q = q.gte('ts', opts.fromTs)
  if (opts.toTs) q = q.lt('ts', opts.toTs)
  if (opts.domain) q = q.eq('domain', opts.domain)
  if (opts.beforeTs) q = q.lt('ts', opts.beforeTs)
  q = q.limit(opts.limit ?? 50)
  const { data, error } = await q
  if (error) throw error
  return data as Entry[]
}
```

- [ ] **Step 4: 集成测试通过**（`npm run test:int` → 5 passed + Task 5 那条）
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: entries repo CRUD"`

---

### Task 8: 离线 outbox

**Files:**
- Create: `src/lib/outbox.ts`
- Test: `src/lib/outbox.test.ts`（单元，mock idb-keyval 与 repo）

**Interfaces:**
- Consumes: `NewEntry`, `insertEntry`
- Produces:

```ts
export async function queueEntry(draft: NewEntry): Promise<void>
export async function pendingCount(): Promise<number>
export async function flushOutbox(): Promise<number>  // 返回成功上传条数
export async function saveEntry(draft: NewEntry): Promise<'synced' | 'queued'>  // 在线直存，失败入队
```

- [ ] **Step 1: 失败测试**

`src/lib/outbox.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = new Map<string, unknown>()
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (k: string) => store.get(k)),
  set: vi.fn(async (k: string, v: unknown) => { store.set(k, v) }),
}))
const insertMock = vi.fn()
vi.mock('./entriesRepo', () => ({ insertEntry: (d: unknown) => insertMock(d) }))

import { queueEntry, pendingCount, flushOutbox, saveEntry } from './outbox'
import type { NewEntry } from './types'

const draft: NewEntry = {
  ts: '2026-07-08T12:00:00Z', domain: 'food', raw_text: '午餐 沙拉',
  data: { meal: '午', items: ['沙拉'] }, parse_source: 'rule', tags: [],
}

beforeEach(() => { store.clear(); insertMock.mockReset() })

describe('outbox', () => {
  it('queue + count', async () => {
    await queueEntry(draft)
    expect(await pendingCount()).toBe(1)
  })
  it('flush 成功清空', async () => {
    insertMock.mockResolvedValue({})
    await queueEntry(draft); await queueEntry(draft)
    expect(await flushOutbox()).toBe(2)
    expect(await pendingCount()).toBe(0)
  })
  it('flush 失败保留剩余', async () => {
    insertMock.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('net'))
    await queueEntry(draft); await queueEntry(draft)
    expect(await flushOutbox()).toBe(1)
    expect(await pendingCount()).toBe(1)
  })
  it('saveEntry 在线直存', async () => {
    insertMock.mockResolvedValue({})
    expect(await saveEntry(draft)).toBe('synced')
    expect(await pendingCount()).toBe(0)
  })
  it('saveEntry 失败入队', async () => {
    insertMock.mockRejectedValue(new Error('offline'))
    expect(await saveEntry(draft)).toBe('queued')
    expect(await pendingCount()).toBe(1)
  })
})
```

- [ ] **Step 2: 确认 FAIL**
- [ ] **Step 3: 实现**

`src/lib/outbox.ts`:

```ts
import { get, set } from 'idb-keyval'
import { insertEntry } from './entriesRepo'
import type { NewEntry } from './types'

const KEY = 'outbox_v1'

async function read(): Promise<NewEntry[]> {
  return ((await get(KEY)) as NewEntry[] | undefined) ?? []
}

export async function queueEntry(draft: NewEntry): Promise<void> {
  const q = await read()
  q.push(draft)
  await set(KEY, q)
}

export async function pendingCount(): Promise<number> {
  return (await read()).length
}

export async function flushOutbox(): Promise<number> {
  const q = await read()
  const remain: NewEntry[] = []
  let ok = 0
  for (const d of q) {
    try { await insertEntry(d); ok++ } catch { remain.push(d) }
  }
  await set(KEY, remain)
  return ok
}

export async function saveEntry(draft: NewEntry): Promise<'synced' | 'queued'> {
  try { await insertEntry(draft); return 'synced' }
  catch { await queueEntry(draft); return 'queued' }
}
```

- [ ] **Step 4: 测试通过**（5 passed）
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: offline outbox"`

---

### Task 9: 快速录入组件

**Files:**
- Create: `src/components/QuickInput.tsx`
- Test: `src/components/QuickInput.test.tsx`
- Modify: `src/app.css`

**Interfaces:**
- Consumes: `parseEntry`, `saveEntry`, `flushOutbox`, types
- Produces: `<QuickInput onSaved={() => void} />` — 顶部固定输入区。内部状态机：`idle → previewing(ParseResult|null) → saving`。

- [ ] **Step 1: 失败测试（RTL，mock outbox）**

`src/components/QuickInput.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const saveMock = vi.fn().mockResolvedValue('synced')
vi.mock('../lib/outbox', () => ({ saveEntry: (d: unknown) => saveMock(d) }))

import { QuickInput } from './QuickInput'

describe('QuickInput', () => {
  it('输入可解析句 → 出预览域标签', async () => {
    render(<QuickInput onSaved={() => {}} />)
    await userEvent.type(screen.getByPlaceholderText('记一笔…'), '瑜伽45分钟')
    expect(await screen.findByText('运动')).toBeTruthy()
    expect(screen.getByText(/45.*分钟/)).toBeTruthy()
  })
  it('确认保存调用 saveEntry 且带解析数据', async () => {
    const onSaved = vi.fn()
    render(<QuickInput onSaved={onSaved} />)
    await userEvent.type(screen.getByPlaceholderText('记一笔…'), '瑜伽45分钟')
    await userEvent.click(screen.getByText('保存'))
    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'workout', raw_text: '瑜伽45分钟', parse_source: 'rule',
    }))
    expect(onSaved).toHaveBeenCalled()
  })
  it('解不出 → 显示手动选域按钮组', async () => {
    render(<QuickInput onSaved={() => {}} />)
    await userEvent.type(screen.getByPlaceholderText('记一笔…'), '嗯嗯嗯')
    expect(await screen.findByText('AI 解析')).toBeTruthy()
    expect(screen.getByText('日记')).toBeTruthy() // 六域手选 chips
  })
})
```

- [ ] **Step 2: 确认 FAIL**
- [ ] **Step 3: 实现**

`src/components/QuickInput.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { parseEntry } from '../lib/parser'
import { saveEntry } from '../lib/outbox'
import { ALL_DOMAINS, DOMAIN_LABEL, type Domain, type NewEntry, type ParseResult } from '../lib/types'
import { llmParse } from '../lib/llmParse'

function summarize(r: ParseResult): string {
  const d = r.data as Record<string, unknown>
  const parts: string[] = []
  if (d.meal) parts.push(`${d.meal}餐`)
  if (Array.isArray(d.items)) parts.push((d.items as string[]).join('、'))
  if (d.type) parts.push(String(d.type))
  if (d.duration_min) parts.push(`${d.duration_min} 分钟`)
  if (Array.isArray(d.sets)) parts.push((d.sets as { exercise: string; weight_kg?: number; sets: number; reps: number }[]).map((s) => `${s.exercise} ${s.weight_kg ?? ''}kg ${s.sets}x${s.reps}`).join('；'))
  if (d.title) parts.push(String(d.title))
  if (d.pages) parts.push(`${d.pages} 页`)
  if (d.course) parts.push(String(d.course))
  if (d.minutes) parts.push(`${d.minutes} 分钟`)
  if (d.place) parts.push(String(d.place))
  return parts.join(' · ')
}

export function QuickInput({ onSaved }: { onSaved: () => void }) {
  const [text, setText] = useState('')
  const [llmResult, setLlmResult] = useState<ParseResult | null>(null)
  const [llmBusy, setLlmBusy] = useState(false)
  const [status, setStatus] = useState('')

  const ruleResult = useMemo(() => parseEntry(text), [text])
  const result = ruleResult ?? llmResult

  const save = async (r: ParseResult | null, manualDomain?: Domain) => {
    const draft: NewEntry = {
      ts: new Date().toISOString(),
      domain: r?.domain ?? manualDomain!,
      raw_text: text.trim(),
      data: r?.data ?? {},
      parse_source: r ? (ruleResult ? 'rule' : 'llm') : 'manual',
      tags: [],
    }
    const outcome = await saveEntry(draft)
    setStatus(outcome === 'synced' ? '已保存' : '已离线暂存')
    setText(''); setLlmResult(null)
    onSaved()
    setTimeout(() => setStatus(''), 2000)
  }

  const runLlm = async () => {
    setLlmBusy(true)
    try { setLlmResult(await llmParse(text)) }
    catch { setStatus('AI 解析失败，可手选域保存') }
    finally { setLlmBusy(false) }
  }

  return (
    <div className="qi">
      <input
        placeholder="记一笔…" value={text} enterKeyHint="done"
        onChange={(e) => { setText(e.target.value); setLlmResult(null) }}
      />
      {text.trim() && result && (
        <div className="qi-preview">
          <span className="chip chip-domain">{DOMAIN_LABEL[result.domain]}</span>
          <span className="qi-summary">{summarize(result)}</span>
          <button onClick={() => save(result)}>保存</button>
        </div>
      )}
      {text.trim() && !result && (
        <div className="qi-preview">
          <button onClick={runLlm} disabled={llmBusy}>{llmBusy ? '解析中…' : 'AI 解析'}</button>
          {ALL_DOMAINS.map((d) => (
            <button key={d} className="chip" onClick={() => save(null, d)}>{DOMAIN_LABEL[d]}</button>
          ))}
        </div>
      )}
      {status && <p className="muted">{status}</p>}
    </div>
  )
}
```

`src/lib/llmParse.ts` 本 task 先建占位（Task 12 实现真调用），保证编译通过：

```ts
import type { ParseResult } from './types'

export async function llmParse(_text: string): Promise<ParseResult> {
  throw new Error('LLM 解析尚未接通（Task 12）')
}
```

`src/app.css` 追加:

```css
.qi { position:sticky; top:0; background:var(--bg); padding:12px 16px; border-bottom:1px solid var(--line); z-index:10; }
.qi input { width:100%; padding:12px 14px; font-size:16px; border:1px solid var(--line); border-radius:12px; }
.qi-preview { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:8px; }
.chip { padding:4px 10px; border-radius:999px; border:1px solid var(--line); background:var(--card); font-size:13px; }
.chip-domain { background:var(--accent); color:#fff; border:none; }
.qi-summary { font-size:13px; color:var(--muted); flex:1; }
.qi-preview button:not(.chip) { padding:6px 16px; border:none; border-radius:10px; background:var(--accent); color:#fff; }
```

- [ ] **Step 4: 测试通过**（3 passed）
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: quick input with parse preview"`

---

### Task 10: 今日视图 + 记录卡（编辑/删除）

**Files:**
- Create: `src/components/EntryCard.tsx`, `src/components/TodayView.tsx`
- Modify: `src/App.tsx`, `src/app.css`

**Interfaces:**
- Consumes: `listEntries`, `updateEntry`, `deleteEntry`, `QuickInput`
- Produces:
  - `<EntryCard entry={Entry} onChanged={() => void} />` — 展示 + 长按/点开编辑 raw_text、删除
  - `<TodayView refreshKey={number} />` — 当天记录流 + 六域打卡点

- [ ] **Step 1: 实现 EntryCard**

`src/components/EntryCard.tsx`:

```tsx
import { useState } from 'react'
import { deleteEntry, updateEntry } from '../lib/entriesRepo'
import { parseEntry } from '../lib/parser'
import { DOMAIN_LABEL, type Entry } from '../lib/types'

export function EntryCard({ entry, onChanged }: { entry: Entry; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(entry.raw_text)

  const time = new Date(entry.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

  const saveEdit = async () => {
    const r = parseEntry(text)
    await updateEntry(entry.id, r
      ? { raw_text: text, domain: r.domain, data: r.data, parse_source: 'rule' }
      : { raw_text: text })
    setEditing(false); onChanged()
  }

  const remove = async () => {
    if (confirm('删除这条记录？')) { await deleteEntry(entry.id); onChanged() }
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className={`dot dot-${entry.domain}`} />
        <span className="card-domain">{DOMAIN_LABEL[entry.domain]}</span>
        <span className="card-time">{time}</span>
      </div>
      {editing ? (
        <div className="card-edit">
          <input value={text} onChange={(e) => setText(e.target.value)} />
          <button onClick={saveEdit}>存</button>
          <button onClick={() => setEditing(false)}>取消</button>
        </div>
      ) : (
        <p className="card-text" onClick={() => setEditing(true)}>{entry.raw_text}</p>
      )}
      <button className="card-del" onClick={remove}>删</button>
    </div>
  )
}
```

- [ ] **Step 2: 实现 TodayView**

`src/components/TodayView.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { listEntries } from '../lib/entriesRepo'
import { ALL_DOMAINS, DOMAIN_LABEL, type Entry } from '../lib/types'
import { EntryCard } from './EntryCard'

function dayRange(d = new Date()): { fromTs: string; toTs: string } {
  const start = new Date(d); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(end.getDate() + 1)
  return { fromTs: start.toISOString(), toTs: end.toISOString() }
}

export function TodayView({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<Entry[]>([])
  const load = useCallback(async () => {
    setRows(await listEntries({ ...dayRange(), limit: 100 }))
  }, [])
  useEffect(() => { load() }, [load, refreshKey])

  const done = new Set(rows.map((r) => r.domain))
  return (
    <div className="view">
      <div className="day-dots">
        {ALL_DOMAINS.map((d) => (
          <span key={d} className={`day-dot ${done.has(d) ? `dot-${d} on` : ''}`} title={DOMAIN_LABEL[d]}>
            {DOMAIN_LABEL[d]}
          </span>
        ))}
      </div>
      {rows.length === 0 && <p className="muted empty">今天还没记录</p>}
      {rows.map((e) => <EntryCard key={e.id} entry={e} onChanged={load} />)}
    </div>
  )
}
```

- [ ] **Step 3: App 组装（tab 骨架，历史/周览下个 task 填）**

`src/App.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { AuthGate } from './components/AuthGate'
import { QuickInput } from './components/QuickInput'
import { TodayView } from './components/TodayView'
import { flushOutbox } from './lib/outbox'

type Tab = 'today' | 'history' | 'week'

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [refreshKey, setRefreshKey] = useState(0)
  const bump = () => setRefreshKey((k) => k + 1)

  useEffect(() => {
    flushOutbox().then((n) => { if (n > 0) bump() })
    const onOnline = () => flushOutbox().then((n) => { if (n > 0) bump() })
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  return (
    <AuthGate>
      <div className="app">
        <QuickInput onSaved={bump} />
        <main className="main">
          {tab === 'today' && <TodayView refreshKey={refreshKey} />}
          {tab === 'history' && <p className="muted empty">历史（Task 11）</p>}
          {tab === 'week' && <p className="muted empty">周览（Task 11）</p>}
        </main>
        <nav className="tabs">
          {(['today', 'history', 'week'] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {{ today: '今日', history: '历史', week: '周览' }[t]}
            </button>
          ))}
        </nav>
      </div>
    </AuthGate>
  )
}
```

`src/app.css` 追加:

```css
.main { flex:1; overflow-y:auto; padding:12px 16px 72px; }
.view { display:flex; flex-direction:column; gap:10px; }
.tabs { position:fixed; bottom:0; left:0; right:0; max-width:480px; margin:0 auto; display:flex; background:var(--card); border-top:1px solid var(--line); padding-bottom:env(safe-area-inset-bottom); }
.tabs button { flex:1; padding:14px 0; border:none; background:none; font-size:14px; color:var(--muted); }
.tabs button.on { color:var(--accent); font-weight:600; }
.card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:12px 14px; position:relative; }
.card-head { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--muted); margin-bottom:6px; }
.card-text { font-size:15px; }
.card-edit { display:flex; gap:6px; }
.card-edit input { flex:1; padding:8px; border:1px solid var(--line); border-radius:8px; }
.card-del { position:absolute; right:10px; bottom:10px; border:none; background:none; color:var(--muted); font-size:12px; }
.dot { width:8px; height:8px; border-radius:50%; display:inline-block; }
.dot-food{background:#d97706}.dot-workout{background:#c15f3c}.dot-travel{background:#0e7490}
.dot-reading{background:#7c3aed}.dot-journal{background:#64748b}.dot-learning{background:#15803d}
.day-dots { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:4px; }
.day-dot { font-size:12px; padding:4px 10px; border-radius:999px; border:1px dashed var(--line); color:var(--muted); }
.day-dot.on { border-style:solid; color:var(--ink); }
.empty { text-align:center; padding:32px 0; }
```

- [ ] **Step 4: 手动验证** dev server：录「瑜伽45分钟」→ 预览 → 保存 → 今日流出现卡片，运动打卡点亮起；编辑、删除各试一次。
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: today view + entry card + app shell"`

---

### Task 11: 历史视图 + 周览

**Files:**
- Create: `src/components/HistoryView.tsx`, `src/components/WeekView.tsx`
- Modify: `src/App.tsx`（换掉两个占位行）, `src/app.css`

**Interfaces:**
- Consumes: `listEntries`, `EntryCard`, types
- Produces: `<HistoryView refreshKey={number} />`（域过滤 + 加载更多）、`<WeekView refreshKey={number} />`（本周计数条 + streak）

- [ ] **Step 1: HistoryView**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { listEntries } from '../lib/entriesRepo'
import { ALL_DOMAINS, DOMAIN_LABEL, type Domain, type Entry } from '../lib/types'
import { EntryCard } from './EntryCard'

const PAGE = 30

export function HistoryView({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<Entry[]>([])
  const [domain, setDomain] = useState<Domain | undefined>()
  const [done, setDone] = useState(false)

  const load = useCallback(async (reset: boolean, before?: string) => {
    const batch = await listEntries({ domain, limit: PAGE, beforeTs: before })
    setDone(batch.length < PAGE)
    setRows((prev) => reset ? batch : [...prev, ...batch])
  }, [domain])

  useEffect(() => { load(true) }, [load, refreshKey])

  let lastDay = ''
  return (
    <div className="view">
      <div className="day-dots">
        <button className={`day-dot ${!domain ? 'on' : ''}`} onClick={() => setDomain(undefined)}>全部</button>
        {ALL_DOMAINS.map((d) => (
          <button key={d} className={`day-dot ${domain === d ? 'on' : ''}`} onClick={() => setDomain(d)}>
            {DOMAIN_LABEL[d]}
          </button>
        ))}
      </div>
      {rows.map((e) => {
        const day = new Date(e.ts).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
        const header = day !== lastDay ? <h3 className="day-header">{day}</h3> : null
        lastDay = day
        return (
          <div key={e.id}>
            {header}
            <EntryCard entry={e} onChanged={() => load(true)} />
          </div>
        )
      })}
      {!done && rows.length > 0 && (
        <button className="more" onClick={() => load(false, rows[rows.length - 1].ts)}>加载更多</button>
      )}
      {rows.length === 0 && <p className="muted empty">没有记录</p>}
    </div>
  )
}
```

- [ ] **Step 2: WeekView**

```tsx
import { useEffect, useState } from 'react'
import { listEntries } from '../lib/entriesRepo'
import { ALL_DOMAINS, DOMAIN_LABEL, type Entry } from '../lib/types'

function weekStart(): Date {
  const d = new Date(); const day = (d.getDay() + 6) % 7 // 周一起
  d.setDate(d.getDate() - day); d.setHours(0, 0, 0, 0); return d
}

export function WeekView({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<Entry[]>([])
  useEffect(() => {
    listEntries({ fromTs: weekStart().toISOString(), limit: 500 }).then(setRows)
  }, [refreshKey])

  const counts = ALL_DOMAINS.map((d) => ({ d, n: rows.filter((r) => r.domain === d).length }))
  const max = Math.max(1, ...counts.map((c) => c.n))
  const days = new Set(rows.map((r) => new Date(r.ts).toDateString()))

  return (
    <div className="view">
      <p className="muted">本周记录 {rows.length} 条 · 活跃 {days.size} 天</p>
      {counts.map(({ d, n }) => (
        <div key={d} className="bar-row">
          <span className="bar-label">{DOMAIN_LABEL[d]}</span>
          <div className="bar-track"><div className={`bar dot-${d}`} style={{ width: `${(n / max) * 100}%` }} /></div>
          <span className="bar-n">{n}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: App.tsx 两个占位行替换为 `<HistoryView refreshKey={refreshKey} />` / `<WeekView refreshKey={refreshKey} />`，补 import。css 追加：**

```css
.day-header { font-size:13px; color:var(--muted); margin:12px 0 6px; font-weight:500; }
.more { margin:8px auto; padding:8px 24px; border:1px solid var(--line); border-radius:999px; background:var(--card); }
.bar-row { display:flex; align-items:center; gap:10px; }
.bar-label { width:36px; font-size:13px; }
.bar-track { flex:1; height:14px; background:var(--card); border-radius:7px; overflow:hidden; }
.bar { height:100%; border-radius:7px; }
.bar-n { width:24px; text-align:right; font-size:13px; color:var(--muted); }
```

- [ ] **Step 4: 手动验证**：造几条跨日/跨域数据，历史分日分组正确、过滤正确、加载更多正确；周览条形与计数一致。
- [ ] **Step 5: 全量单测仍绿**（`npm test`）
- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: history + week views"`

---

### Task 12: Edge Function `parse-entry` + LLM 接通

**⚠️ 阻塞项：需要有效 API key。** 开工前先验证（新 key 由用户提供后替换 .env）：

```bash
KEY=$(grep '^LLM_API_KEY=' .env | cut -d= -f2)
curl -sS -H "Authorization: Bearer $KEY" https://api.agnes-ai.com/api/v1/models
```

Expected: 返回模型列表 JSON（非 `invalid or expired token`）。从列表选便宜模型（优先 `claude-haiku-*` / `gpt-4o-mini` 类），写入 `.env` 的 `LLM_MODEL`。

**Files:**
- Create: `supabase/functions/parse-entry/index.ts`
- Modify: `src/lib/llmParse.ts`（替换占位）

**Interfaces:**
- Consumes: Supabase Auth JWT（函数默认校验）；`LLM_API_KEY/LLM_BASE_URL/LLM_MODEL` secrets
- Produces: `POST /functions/v1/parse-entry {raw_text} → {domain, data}`；前端 `llmParse(text): Promise<ParseResult>`

- [ ] **Step 1: Edge Function**

`supabase/functions/parse-entry/index.ts`:

```ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const SYSTEM = `你把一句中文生活记录解析成 JSON。输出格式：{"domain":"food|workout|travel|reading|journal|learning","data":{...}}
data 字段约定：food:{meal:"早|午|晚|加餐",items:[]} workout:{type,duration_min?,sets?:[{exercise,weight_kg?,sets,reps}]} reading:{title,pages?,minutes?} learning:{course,topic?,minutes?} journal:{mood?} travel:{place,note?}
只输出 JSON，不要解释。`

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const { raw_text } = await req.json()
  if (!raw_text) return new Response(JSON.stringify({ error: 'raw_text required' }), { status: 400, headers: cors })

  const resp = await fetch(`${Deno.env.get('LLM_BASE_URL')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('LLM_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: Deno.env.get('LLM_MODEL'),
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: raw_text },
      ],
      max_tokens: 300,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(5000),
  })
  if (!resp.ok) return new Response(JSON.stringify({ error: `llm ${resp.status}` }), { status: 502, headers: cors })

  const body = await resp.json()
  const content: string = body.choices[0].message.content
  const jsonStr = content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1)
  return new Response(jsonStr, { headers: { ...cors, 'Content-Type': 'application/json' } })
})
```

- [ ] **Step 2: 部署 + secrets**

```bash
npm install -D supabase
npx supabase login          # 浏览器授权（USER GATE：需用户点确认）
npx supabase link --project-ref <项目ref，dashboard URL 里的子域>
npx supabase secrets set LLM_API_KEY=<key> LLM_BASE_URL=https://api.agnes-ai.com/api/v1 LLM_MODEL=<选定模型>
npx supabase functions deploy parse-entry
```

- [ ] **Step 3: curl 真调验证**

```bash
curl -sS -X POST "https://<项目ref>.supabase.co/functions/v1/parse-entry" \
  -H "Authorization: Bearer <anon key>" -H "Content-Type: application/json" \
  -d '{"raw_text":"和朋友吃了顿很棒的omakase庆祝项目上线"}'
```

Expected: `{"domain":"food","data":{...}}` 或类似合理 JSON。

- [ ] **Step 4: 前端接通（替换 llmParse 占位）**

`src/lib/llmParse.ts`:

```ts
import { supabase } from './supabase'
import type { Domain, EntryData, ParseResult } from './types'

const DOMAINS: Domain[] = ['food', 'workout', 'travel', 'reading', 'journal', 'learning']

export async function llmParse(text: string): Promise<ParseResult> {
  const { data, error } = await supabase.functions.invoke('parse-entry', { body: { raw_text: text } })
  if (error) throw error
  if (!data || !DOMAINS.includes(data.domain)) throw new Error('LLM 返回无效')
  return { domain: data.domain as Domain, data: (data.data ?? {}) as EntryData }
}
```

- [ ] **Step 5: 端到端手测**：输入「和朋友吃了顿omakase」→ 点「AI 解析」→ 预览出饮食域 → 保存成功。断网时保存 → 显示「已离线暂存」→ 恢复网络自动同步。
- [ ] **Step 6: 单测全绿后 Commit** `git add -A && git commit -m "feat: LLM fallback via edge function"`

---

### Task 13: PWA + 部署 + 手机视口验收

**Files:**
- Modify: `vite.config.ts`, `index.html`
- Create: `public/icon-192.png`, `public/icon-512.png`, `.github/workflows/deploy.yml`

**Interfaces:**
- Produces: GitHub Pages 上可用的 PWA，手机加主屏。

- [ ] **Step 1: PWA 插件配置**

`vite.config.ts` plugins 加：

```ts
import { VitePWA } from 'vite-plugin-pwa'
// plugins: [react(), VitePWA({
//   registerType: 'autoUpdate',
//   manifest: {
//     name: 'Life Tracker', short_name: 'Life', lang: 'zh-CN',
//     start_url: '/life-tracker/', display: 'standalone',
//     background_color: '#faf9f5', theme_color: '#c15f3c',
//     icons: [
//       { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
//       { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
//     ],
//   },
// })]
```

（执行时取消注释合入真实 plugins 数组。）icons 用脚本生成纯色圆角占位（ImageMagick：`magick -size 512x512 xc:'#c15f3c' public/icon-512.png` 及 192 版本；无 magick 则用 sips 或任意方式，验收=文件存在且 manifest 校验通过）。

`index.html` `<head>` 加 `<meta name="theme-color" content="#c15f3c" />`，`<title>Life Tracker</title>`。

- [ ] **Step 2: 建 GitHub repo + Pages workflow**

```bash
gh repo create life-tracker --private --source . --push
```

注意：**私有 repo 的 GitHub Pages 需要付费档**（spec §8 已记）。两条路（执行时问用户选）：a) repo 公开（前端无秘密，安全）→ Pages 免费；b) 保持私有 → 部署改 Vercel（`npx vercel`，免费支持私有）。默认推荐 a。

`.github/workflows/deploy.yml`（选 a 时）:

```yaml
name: deploy
on: { push: { branches: [main] } }
permissions: { contents: read, pages: write, id-token: write }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ vars.VITE_SUPABASE_ANON_KEY }}
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: '${{ steps.deployment.outputs.page_url }}' }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

repo Settings → Pages → Source 选 GitHub Actions；repo Variables 加 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`（anon key 本可公开，用 Variables 即可）。

- [ ] **Step 3: 手机视口全流程验收（webapp-testing skill）**

375px 视口跑：登录 → 录「午餐 鸡胸肉沙拉」规则解析保存 → 录一句规则解不出的走 AI 解析 → 今日流两卡 + 打卡点 → 历史过滤 → 周览计数 → 编辑 → 删除。全部通过为验收。

- [ ] **Step 4: 真机验收**：手机浏览器开 Pages URL，登录，加主屏，录一条。Expected: 手机与 Mac 数据互通。

- [ ] **Step 5: Commit + push** `git add -A && git commit -m "feat: PWA + pages deploy" && git push`

---

## 外部依赖清单（执行者遇到即向用户要，不要猜）

| 依赖 | 需要什么 | 阻塞哪个 task |
|---|---|---|
| Supabase 账号 | 用户注册 + 建项目，给 URL + anon key | Task 5 |
| Supabase 邮箱确认开关 | 用户在 dashboard 关闭 Confirm email | Task 6 |
| 有效 LLM key | 用户到 platform.agnes-ai.com 重新生成（当前 key 被拒） | Task 12 |
| supabase login | 用户浏览器授权一次 | Task 12 |
| Pages 公开与否 | 用户选：repo 公开走 Pages / 私有走 Vercel | Task 13 |

## Self-Review 记录

- Spec 覆盖：架构✓ 数据模型✓（SetGroup 表示法微调已注明）录入流✓（规则→LLM→手动降级、离线 outbox、ts 可回补——**注意：V1 录入 ts 固定 now()，「可改时间回补」通过编辑卡片实现不了 ts 修改，已列入下方 Gap** ）视图✓ 错误处理✓ 测试✓
- **Gap 一处**：spec §4「ts 默认现在，可改」。V1 简化：QuickInput 不带时间选择器（保持零导航速度），回补靠 EntryCard 编辑——但 EntryCard 目前只改 raw_text。补救：Task 10 的 saveEdit 已够 V1 用，ts 编辑推 V1.1；已与整体 YAGNI 原则一致，spec 该行在执行时视为「V1.1」。执行者不要擅自加时间选择器。
- 占位符扫描：llmParse 占位是**计划内跨 task 接口**（Task 9 建、Task 12 换），非漏项。无 TBD/TODO。
- 类型一致性：`ParseResult/NewEntry/SetGroup` 全链路核对过；`saveEntry` 返回 `'synced'|'queued'` 在 Task 8 定义、Task 9 消费一致；`refreshKey` prop 三视图签名一致。

