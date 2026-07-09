import type { ParseResult } from './types'

export async function llmParse(_text: string): Promise<ParseResult> {
  throw new Error('LLM 解析尚未接通（Task 12）')
}
