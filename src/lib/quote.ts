import quotesData from '../data/quotes.json'

export interface Quote { text: string; author: string }

const QUOTES = quotesData as Quote[]

/** 1-indexed day-of-year (Jan 1 = 1). */
export function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0)
  const diff = d.getTime() - start.getTime()
  return Math.floor(diff / 86400000)
}

export function quoteForDate(d: Date, quotes: Quote[]): Quote {
  if (quotes.length === 0) throw new Error('quotes 列表为空')
  return quotes[dayOfYear(d) % quotes.length]
}

export function todayQuote(d = new Date()): Quote {
  return quoteForDate(d, QUOTES)
}
