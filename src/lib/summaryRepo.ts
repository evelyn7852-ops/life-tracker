import { supabase } from './supabase'

export type PeriodType = 'week' | 'month'

export interface Summary {
  id: string
  period_type: PeriodType
  period_start: string
  content: string
  created_at: string
}

export async function getSummary(periodType: PeriodType, periodStart: string): Promise<Summary | null> {
  const { data, error } = await supabase
    .from('summaries')
    .select('id, period_type, period_start, content, created_at')
    .eq('period_type', periodType)
    .eq('period_start', periodStart)
    .maybeSingle()
  if (error) throw error
  return (data as Summary | null) ?? null
}

export async function generateSummary(periodType: PeriodType, periodStart: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('summarize', {
    body: { period_type: periodType, period_start: periodStart },
  })
  if (error) throw error
  if (typeof data?.content !== 'string' || !data.content) throw new Error('总结生成失败')
  return data.content
}
