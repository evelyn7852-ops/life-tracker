/** §C Headspace 风心情脸：6 个内联 SVG 圆脸，key = 存库用的 emoji 字符本身（向后兼容，只换渲染，
 * 不改存库值）。实心圆底 + 极简五官（弧线眼/嘴），一情绪一低饱和底色（布达佩斯谱系），
 * 五官线条统一李子紫、线宽一致。 */

export interface MoodStyle {
  /** 未选中态底色（低饱和）。 */
  base: string
  /** 选中态底色（同色系加深一档）。 */
  dark: string
  /** aria-label 用中文标签。 */
  label: string
}

export const MOOD_STYLES: Record<string, MoodStyle> = {
  '😊': { base: '#E3C77E', dark: '#D4B15C', label: '开心' },
  '😐': { base: '#D9C7CE', dark: '#C7AEB7', label: '平静' },
  '😮‍💨': { base: '#B9D3C2', dark: '#9FC0AC', label: '疲惫' },
  '🥳': { base: '#D9A9B5', dark: '#C98B9B', label: '兴奋' },
  '😢': { base: '#A9C9C8', dark: '#8EB6B4', label: '难过' },
  '🤒': { base: '#C7B7D1', dark: '#B39FC0', label: '生病' },
}

const LINE = 'var(--ink)'
const STROKE_WIDTH = 2.2

/** 五官：按情绪画不同弧线组合，线宽/描边风格统一，只有形状变化。 */
function Face({ mood }: { mood: string }) {
  const stroke = { stroke: LINE, strokeWidth: STROKE_WIDTH, strokeLinecap: 'round' as const, fill: 'none' }
  switch (mood) {
    case '😊': // 开心：弯弯笑眼 + 上扬大笑弧
      return (
        <>
          <path d="M11 15 Q13 12 15 15" {...stroke} />
          <path d="M21 15 Q23 12 25 15" {...stroke} />
          <path d="M11 21 Q18 28 25 21" {...stroke} />
        </>
      )
    case '😐': // 平静：平直眼线 + 一条水平嘴线
      return (
        <>
          <line x1="11" y1="15" x2="15" y2="15" {...stroke} />
          <line x1="21" y1="15" x2="25" y2="15" {...stroke} />
          <line x1="13" y1="23" x2="23" y2="23" {...stroke} />
        </>
      )
    case '😮‍💨': // 疲惫（叹气）：低垂眼 + 小圆嘴 + 一缕呼出气线
      return (
        <>
          <path d="M11 16 Q13 18 15 16" {...stroke} />
          <path d="M21 16 Q23 18 25 16" {...stroke} />
          <circle cx="18" cy="23" r="2" {...stroke} />
          <path d="M27 22 Q31 22 33 20" {...stroke} strokeDasharray="1 3" />
        </>
      )
    case '🥳': // 兴奋：圆睁大眼 + 张口大笑 + 两颗庆祝星火
      return (
        <>
          <circle cx="13" cy="15" r="2" fill={LINE} />
          <circle cx="23" cy="15" r="2" fill={LINE} />
          <path d="M11 21 Q18 29 25 21 Q18 25 11 21 Z" fill={LINE} />
          <path d="M8 9 L9.5 11.5 M28 9 L26.5 11.5" {...stroke} />
        </>
      )
    case '😢': // 难过：下垂眉眼 + 下弯嘴 + 一滴泪
      return (
        <>
          <path d="M11 16 Q13 14 15 16" {...stroke} />
          <path d="M21 16 Q23 14 25 16" {...stroke} />
          <path d="M12 25 Q18 20 24 25" {...stroke} />
          <path d="M25 17 Q27 20 25 22 Q23 20 25 17 Z" fill={LINE} />
        </>
      )
    case '🤒': // 生病：X 形眼 + 波浪嘴（不适感）
      return (
        <>
          <path d="M11 14 L15 18 M15 14 L11 18" {...stroke} />
          <path d="M21 14 L25 18 M25 14 L21 18" {...stroke} />
          <path d="M12 24 Q15 21 18 24 Q21 27 24 24" {...stroke} />
        </>
      )
    default:
      return null
  }
}

export function MoodFace({ mood, selected = false }: { mood: string; selected?: boolean }) {
  const style = MOOD_STYLES[mood]
  if (!style) return null
  return (
    <svg
      className={`mood-face ${selected ? 'mood-face-selected' : ''}`}
      width="36"
      height="36"
      viewBox="0 0 36 36"
      role="img"
      aria-label={style.label}
    >
      <circle cx="18" cy="18" r="14" fill={selected ? style.dark : style.base} opacity={selected ? 1 : 0.75} />
      {selected && <circle cx="18" cy="18" r="16" fill="none" stroke="var(--accent)" strokeWidth="2" />}
      <Face mood={mood} />
    </svg>
  )
}
