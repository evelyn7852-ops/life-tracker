import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MoodFace, MOOD_STYLES } from './MoodFace'

const MOODS = ['😊', '😐', '😮‍💨', '🥳', '😢', '🤒']

describe('MoodFace（§C Headspace 风心情脸）', () => {
  it('6 个心情各有对应的样式映射（key = 存库用的 emoji 字符本身）', () => {
    MOODS.forEach((m) => expect(MOOD_STYLES[m]).toBeTruthy())
    expect(Object.keys(MOOD_STYLES).length).toBe(6)
  })

  it('6 个心情均能渲染出 SVG 圆脸', () => {
    MOODS.forEach((mood) => {
      const { container } = render(<MoodFace mood={mood} />)
      const svg = container.querySelector('svg.mood-face')
      expect(svg).toBeTruthy()
      expect(svg?.querySelector('circle')).toBeTruthy()
    })
  })

  it('每个心情的 aria-label 是对应的中文标签', () => {
    const expected: Record<string, string> = {
      '😊': '开心', '😐': '平静', '😮‍💨': '疲惫', '🥳': '兴奋', '😢': '难过', '🤒': '生病',
    }
    MOODS.forEach((mood) => {
      const { container } = render(<MoodFace mood={mood} />)
      expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe(expected[mood])
    })
  })

  it('未选中态：opacity .75，无外圈环', () => {
    const { container } = render(<MoodFace mood="😊" selected={false} />)
    const svg = container.querySelector('svg')
    expect(svg?.className.baseVal).not.toContain('mood-face-selected')
    const circles = container.querySelectorAll('circle')
    // 只有底色圆，没有额外的选中环
    expect(circles[0].getAttribute('opacity')).toBe('0.75')
  })

  it('选中态：外圈 2px 树莓环 class + 底色圆 opacity 恢复满值', () => {
    const { container } = render(<MoodFace mood="😊" selected />)
    const svg = container.querySelector('svg')
    expect(svg?.className.baseVal).toContain('mood-face-selected')
    const circles = container.querySelectorAll('circle')
    expect(circles[0].getAttribute('opacity')).toBe('1')
    expect(circles.length).toBeGreaterThanOrEqual(2) // 底色圆 + 选中环
  })

  it('未知 mood 字符 → 不渲染（防御）', () => {
    const { container } = render(<MoodFace mood="👽" />)
    expect(container.querySelector('svg')).toBeNull()
  })
})
