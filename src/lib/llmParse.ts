import { supabase } from './supabase'
import { ALL_DOMAINS, type EntryData, type ParseResult } from './types'

export async function llmParse(text: string): Promise<ParseResult> {
  const { data, error } = await supabase.functions.invoke('parse-entry', { body: { raw_text: text } })
  if (error) throw error
  if (!data || !ALL_DOMAINS.includes(data.domain)) throw new Error('LLM 返回无效')
  return { domain: data.domain, data: (data.data ?? {}) as EntryData }
}
