import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const updateEntryMock = vi.fn().mockResolvedValue({})
const deleteEntryMock = vi.fn().mockResolvedValue(undefined)
vi.mock('../lib/entriesRepo', () => ({
  updateEntry: (id: string, patch: unknown) => updateEntryMock(id, patch),
  deleteEntry: (id: string) => deleteEntryMock(id),
}))

import { EntryCard } from './EntryCard'

const entry = {
  id: 'e1', ts: '2026-07-09T10:00:00Z', domain: 'journal' as const,
  raw_text: '心情不错', data: { mood: '😊' }, parse_source: 'manual' as const, tags: [],
}

describe('EntryCard', () => {
  it('默认渲染删除按钮，文本可点击编辑', () => {
    render(<EntryCard entry={entry} onChanged={() => {}} />)
    expect(screen.getByText('删')).toBeTruthy()
  })

  it('readOnly=true → 不渲染删除按钮', () => {
    render(<EntryCard entry={entry} onChanged={() => {}} readOnly />)
    expect(screen.queryByText('删')).toBeNull()
  })

  it('readOnly=true → 点击文本不进入编辑态', async () => {
    render(<EntryCard entry={entry} onChanged={() => {}} readOnly />)
    await userEvent.click(screen.getByText('心情不错'))
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('非 readOnly → 点击文本进入编辑态', async () => {
    render(<EntryCard entry={entry} onChanged={() => {}} />)
    await userEvent.click(screen.getByText('心情不错'))
    expect(screen.queryByRole('textbox')).toBeTruthy()
  })
})
