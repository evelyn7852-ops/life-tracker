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

/**
 * fromTs/toTs 是客户端本地时区计算的 ISO 边界 — 服务端直接用于 entries 查询，
 * 避免把 period_start ('YYYY-MM-DD') 当 UTC 午夜解析导致 UTC+8 下前 8 小时错归到上一周期。
 * period_start 仅作 summaries 表的缓存键。
 */
export async function generateSummary(periodType: PeriodType, periodStart: string, fromTs: string, toTs: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('summarize', {
    body: { period_type: periodType, period_start: periodStart, from_ts: fromTs, to_ts: toTs },
  })
  if (error) throw error
  if (typeof data?.content !== 'string' || !data.content) throw new Error('总结生成失败')
  return data.content
}
