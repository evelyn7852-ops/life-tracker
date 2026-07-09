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
