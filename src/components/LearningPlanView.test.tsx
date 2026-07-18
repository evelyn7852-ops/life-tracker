import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LearningPlanView } from './LearningPlanView'
import { PROGRESS_KEY } from '../lib/learningPlan'
import type { LearningItemRow } from '../lib/learningRepo'

const listItemsMock = vi.fn()
const insertItemMock = vi.fn()
const updateItemMock = vi.fn()
const deleteItemMock = vi.fn()
const listProgressRowsMock = vi.fn()
const setProgressMock = vi.fn()
const migrateLocalProgressIfEmptyMock = vi.fn()

vi.mock('../lib/learningRepo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/learningRepo')>()
  return {
    ...actual,
    listItems: (...a: unknown[]) => listItemsMock(...a),
    insertItem: (...a: unknown[]) => insertItemMock(...a),
    updateItem: (...a: unknown[]) => updateItemMock(...a),
    deleteItem: (...a: unknown[]) => deleteItemMock(...a),
    listProgressRows: (...a: unknown[]) => listProgressRowsMock(...a),
    setProgress: (...a: unknown[]) => setProgressMock(...a),
    migrateLocalProgressIfEmpty: (...a: unknown[]) => migrateLocalProgressIfEmptyMock(...a),
  }
})

function itemRow(overrides: Partial<LearningItemRow> = {}): LearningItemRow {
  return {
    id: 'i1', title: '学习资源A', url: 'http://example.com/a', source: '来源A', tag: '标签A',
    status: '待读', note: null, added_by: 'manual', created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
  listItemsMock.mockReset().mockResolvedValue([])
  insertItemMock.mockReset()
  updateItemMock.mockReset()
  deleteItemMock.mockReset()
  listProgressRowsMock.mockReset().mockResolvedValue([])
  setProgressMock.mockReset().mockResolvedValue(undefined)
  migrateLocalProgressIfEmptyMock.mockReset().mockResolvedValue(undefined)
})

async function switchToArchive() {
  await userEvent.click(screen.getByText('集训存档'))
}

describe('LearningPlanView 外层：标题 + 分段', () => {
  it('渲染标题，默认展示学习流分段（无单设备提示）', async () => {
    render(<LearningPlanView />)
    expect(screen.getByText('学习规划')).toBeTruthy()
    expect(screen.getByText('学习流').closest('button')).toHaveProperty('className', expect.stringContaining('on'))
    expect(screen.queryByText(/云同步待 V1.5/)).toBeFalsy()
    await waitFor(() => expect(listItemsMock).toHaveBeenCalled())
  })

  it('切到集训存档分段：第 1 周默认展开', async () => {
    render(<LearningPlanView />)
    await switchToArchive()
    expect(await screen.findByText(/打地基 \+ 写问题陈述/)).toBeTruthy()
  })

  it('集训存档：点击第 2 周展开该周内容', async () => {
    render(<LearningPlanView />)
    await switchToArchive()
    await screen.findByText(/打地基 \+ 写问题陈述/)
    await userEvent.click(screen.getByText(/第2周/).closest('button')!)
    expect(screen.getByText(/Cowork 上手/)).toBeTruthy()
  })
})

describe('学习流：列表 + 状态分组', () => {
  it('按 待读/在读/已读 分组展示，条目显示 title/source/tag', async () => {
    listItemsMock.mockResolvedValue([
      itemRow({ id: 'a', status: '待读' }),
      itemRow({ id: 'b', status: '已读', title: '资源B' }),
    ])
    render(<LearningPlanView />)
    expect(await screen.findByText('学习资源A')).toBeTruthy()
    expect(screen.getByText('资源B')).toBeTruthy()
    expect(screen.getAllByText(/来源A · 标签A/).length).toBe(2)
  })

  it('url 外链使用 target=_blank rel=noopener noreferrer', async () => {
    listItemsMock.mockResolvedValue([itemRow()])
    render(<LearningPlanView />)
    const link = await screen.findByText('打开链接')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link.getAttribute('href')).toBe('http://example.com/a')
  })

  it('有 url 时不显示「搜索」，只显示「打开链接」', async () => {
    listItemsMock.mockResolvedValue([itemRow()])
    render(<LearningPlanView />)
    expect(await screen.findByText('打开链接')).toBeTruthy()
    expect(screen.queryByText('搜索')).toBeFalsy()
  })

  it('url 为 null 时降级为「搜索」入口，指向 title + source 的 Google 搜索', async () => {
    listItemsMock.mockResolvedValue([
      itemRow({ url: null, title: 'MCP 规范', source: 'Anthropic', added_by: 'auto' }),
    ])
    render(<LearningPlanView />)
    const link = await screen.findByText('搜索')
    expect(screen.queryByText('打开链接')).toBeFalsy()
    expect(link.getAttribute('href')).toBe(
      `https://www.google.com/search?q=${encodeURIComponent('MCP 规范 Anthropic')}`,
    )
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('url 与 source 均为 null 时，搜索词只用 title（不含 null 字样）', async () => {
    listItemsMock.mockResolvedValue([itemRow({ url: null, source: null, title: '只有标题' })])
    render(<LearningPlanView />)
    const link = await screen.findByText('搜索')
    expect(link.getAttribute('href')).toBe(
      `https://www.google.com/search?q=${encodeURIComponent('只有标题')}`,
    )
  })

  it('added_by 为 auto 的条目显示 🤖 推荐 标', async () => {
    listItemsMock.mockResolvedValue([itemRow({ added_by: 'auto' })])
    render(<LearningPlanView />)
    expect(await screen.findByText(/🤖 推荐/)).toBeTruthy()
  })

  it('manual 条目不显示 🤖 推荐 标', async () => {
    listItemsMock.mockResolvedValue([itemRow({ added_by: 'manual' })])
    render(<LearningPlanView />)
    await screen.findByText('学习资源A')
    expect(screen.queryByText(/🤖 推荐/)).toBeFalsy()
  })
})

describe('学习流：状态切换 + 删除', () => {
  it('点击「在读」调用 updateItem 切换状态', async () => {
    listItemsMock.mockResolvedValue([itemRow({ status: '待读' })])
    updateItemMock.mockResolvedValue(itemRow({ status: '在读' }))
    render(<LearningPlanView />)
    await screen.findByText('学习资源A')
    await userEvent.click(screen.getByText('在读'))
    await waitFor(() => expect(updateItemMock).toHaveBeenCalledWith('i1', { status: '在读' }))
  })

  it('点击删并确认调用 deleteItem', async () => {
    listItemsMock.mockResolvedValue([itemRow()])
    deleteItemMock.mockResolvedValue(undefined)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<LearningPlanView />)
    await screen.findByText('学习资源A')
    await userEvent.click(screen.getByText('删'))
    await waitFor(() => expect(deleteItemMock).toHaveBeenCalledWith('i1'))
    confirmSpy.mockRestore()
  })

  it('取消确认框不调用 deleteItem', async () => {
    listItemsMock.mockResolvedValue([itemRow()])
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<LearningPlanView />)
    await screen.findByText('学习资源A')
    await userEvent.click(screen.getByText('删'))
    expect(deleteItemMock).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})

describe('学习流：+ 加资源', () => {
  it('填写必填标题后保存，调用 insertItem', async () => {
    insertItemMock.mockResolvedValue(itemRow({ id: 'new-1' }))
    render(<LearningPlanView />)
    await waitFor(() => expect(listItemsMock).toHaveBeenCalled())
    await userEvent.click(screen.getByText('+ 加资源'))
    await userEvent.type(screen.getByPlaceholderText('标题（必填）'), '新资源')
    await userEvent.click(screen.getByText('存'))
    await waitFor(() => expect(insertItemMock).toHaveBeenCalledWith(expect.objectContaining({ title: '新资源' })))
  })

  it('不填标题点存不调用 insertItem', async () => {
    render(<LearningPlanView />)
    await waitFor(() => expect(listItemsMock).toHaveBeenCalled())
    await userEvent.click(screen.getByText('+ 加资源'))
    await userEvent.click(screen.getByText('存'))
    expect(insertItemMock).not.toHaveBeenCalled()
  })
})

describe('集训存档：进度云同步', () => {
  it('打开时先跑一次性迁移（用本地 localStorage 进度），再拉取云端进度渲染勾选', async () => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ 'setup-0': true }))
    listProgressRowsMock.mockResolvedValue([{ item_id: 'setup-0', done: true }])
    render(<LearningPlanView />)
    await switchToArchive()
    await waitFor(() => expect(migrateLocalProgressIfEmptyMock).toHaveBeenCalledWith({ 'setup-0': true }))
    expect(listProgressRowsMock).toHaveBeenCalled()

    await userEvent.click(screen.getByText('环境搭建清单').closest('button')!)
    const checkbox = screen.getAllByRole('checkbox')[0]
    await waitFor(() => expect(checkbox).toHaveProperty('checked', true))
  })

  it('勾选一条集训条目 → 调用 setProgress 写云端', async () => {
    render(<LearningPlanView />)
    await switchToArchive()
    await screen.findByText(/打地基 \+ 写问题陈述/)
    const checkbox = screen.getAllByRole('checkbox')[0]
    await userEvent.click(checkbox)
    await waitFor(() => expect(setProgressMock).toHaveBeenCalledWith(expect.any(String), true))
  })

  it('写云端失败时回滚勾选并显示「离线，稍后重试」', async () => {
    setProgressMock.mockRejectedValue(new Error('offline'))
    render(<LearningPlanView />)
    await switchToArchive()
    await screen.findByText(/打地基 \+ 写问题陈述/)
    const checkbox = screen.getAllByRole('checkbox')[0] as HTMLInputElement
    await userEvent.click(checkbox)
    expect(await screen.findByText('离线，稍后重试')).toBeTruthy()
    await waitFor(() => expect(checkbox.checked).toBe(false))
  })
})
