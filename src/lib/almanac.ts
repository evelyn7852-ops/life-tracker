export interface AlmanacEvent { name: string; emoji: string }

// ---- 24 节气：寿星公式（高健，1900-2100 年内误差 ≤1 天）----
// 每个节气相对 1900-01-06 02:05（下面 base 已按此“伪 UTC”表达本地北京时间）的分钟偏移量
const TERM_NAMES = [
  '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑',
  '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
] as const

const TERM_OFFSETS = [
  0, 21208, 42467, 63836, 85337, 107014, 128867, 150921,
  173149, 195551, 218072, 240693, 263343, 285989, 308563, 331033,
  353350, 375494, 397447, 419210, 440795, 462224, 483532, 504758,
]

const TERM_EMOJI: Record<string, string> = {
  小寒: '❄️', 大寒: '☃️', 立春: '🌱', 雨水: '🌧️', 惊蛰: '🐛', 春分: '🌷',
  清明: '🌸', 谷雨: '🌾', 立夏: '🌿', 小满: '🌾', 芒种: '🌾', 夏至: '☀️',
  小暑: '🔥', 大暑: '🥵', 立秋: '🍂', 处暑: '🍁', 白露: '💧', 秋分: '🌾',
  寒露: '🍁', 霜降: '🍂', 立冬: '⛄', 小雪: '❄️', 大雪: '❄️', 冬至: '🧧',
}

const TERM_EPOCH_MS = Date.UTC(1900, 0, 6, 2, 5, 0)
const TERM_YEAR_MS = 31556925974.7

function solarTermsForYear(year: number): Map<string, string> {
  const map = new Map<string, string>()
  for (let n = 0; n < TERM_NAMES.length; n++) {
    const d = new Date(TERM_EPOCH_MS + TERM_YEAR_MS * (year - 1900) + TERM_OFFSETS[n] * 60000)
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    map.set(`${mm}-${dd}`, TERM_NAMES[n])
  }
  return map
}

function mdKey(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getSolarTerm(date: Date): AlmanacEvent | null {
  const name = solarTermsForYear(date.getFullYear()).get(mdKey(date))
  return name ? { name, emoji: TERM_EMOJI[name] } : null
}

// ---- 阳历节日 ----
const FIXED_HOLIDAYS: Record<string, AlmanacEvent> = {
  '01-01': { name: '元旦', emoji: '🎉' },
  '02-14': { name: '情人节', emoji: '💕' },
  '03-08': { name: '妇女节', emoji: '🌷' },
  '05-01': { name: '劳动节', emoji: '💪' },
  '06-01': { name: '儿童节', emoji: '🎈' },
  '10-01': { name: '国庆节', emoji: '🇨🇳' },
  '12-24': { name: '平安夜', emoji: '🎄' },
  '12-25': { name: '圣诞节', emoji: '🎄' },
}

// ---- 农历节日（2026-2030 内置查表，公历日期已核对）----
// 来源：nongli114.com 逐年逐节日核对（春节另与 holidays-calendar.net / yinetcn.com 交叉核对）
const LUNAR_HOLIDAYS: Record<number, Record<string, AlmanacEvent>> = {
  2026: {
    '02-17': { name: '春节', emoji: '🧧' },
    '03-03': { name: '元宵节', emoji: '🏮' },
    '06-19': { name: '端午节', emoji: '🐉' },
    '08-19': { name: '七夕节', emoji: '💑' },
    '09-25': { name: '中秋节', emoji: '🌕' },
    '10-18': { name: '重阳节', emoji: '🍂' },
  },
  2027: {
    '02-06': { name: '春节', emoji: '🧧' },
    '02-20': { name: '元宵节', emoji: '🏮' },
    '06-09': { name: '端午节', emoji: '🐉' },
    '08-08': { name: '七夕节', emoji: '💑' },
    '09-15': { name: '中秋节', emoji: '🌕' },
    '10-08': { name: '重阳节', emoji: '🍂' },
  },
  2028: {
    '01-26': { name: '春节', emoji: '🧧' },
    '02-09': { name: '元宵节', emoji: '🏮' },
    '05-28': { name: '端午节', emoji: '🐉' },
    '08-26': { name: '七夕节', emoji: '💑' },
    '10-03': { name: '中秋节', emoji: '🌕' },
    '10-26': { name: '重阳节', emoji: '🍂' },
  },
  2029: {
    '02-13': { name: '春节', emoji: '🧧' },
    '02-27': { name: '元宵节', emoji: '🏮' },
    '06-16': { name: '端午节', emoji: '🐉' },
    '08-16': { name: '七夕节', emoji: '💑' },
    '09-22': { name: '中秋节', emoji: '🌕' },
    '10-16': { name: '重阳节', emoji: '🍂' },
  },
  2030: {
    '02-03': { name: '春节', emoji: '🧧' },
    '02-17': { name: '元宵节', emoji: '🏮' },
    '06-05': { name: '端午节', emoji: '🐉' },
    '08-05': { name: '七夕节', emoji: '💑' },
    '09-12': { name: '中秋节', emoji: '🌕' },
    '10-05': { name: '重阳节', emoji: '🍂' },
  },
}

export function getHoliday(date: Date): AlmanacEvent | null {
  const key = mdKey(date)
  const lunar = LUNAR_HOLIDAYS[date.getFullYear()]?.[key]
  if (lunar) return lunar
  return FIXED_HOLIDAYS[key] ?? null
}

/** 节日优先，其次节气；都没有则 null。 */
export function getAlmanacEvent(date: Date): AlmanacEvent | null {
  return getHoliday(date) ?? getSolarTerm(date)
}
