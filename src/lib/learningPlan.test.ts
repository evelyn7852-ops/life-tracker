import { describe, it, expect, beforeEach } from 'vitest'
import {
  flattenMastery, flattenSetup, flattenWeekSection, loadProgress, saveProgress, toggleProgress,
  PROGRESS_KEY,
} from './learningPlan'

describe('flattenSetup', () => {
  it('生成 setup-{i} 形式 id，与原 dashboard 一致', () => {
    const items = flattenSetup(['a', 'b', 'c'])
    expect(items.map((i) => i.id)).toEqual(['setup-0', 'setup-1', 'setup-2'])
    expect(items[1].label).toBe('b')
  })
})

describe('flattenWeekSection', () => {
  it('生成 w{n}-{section}-{i} 形式 id', () => {
    const items = flattenWeekSection(3, 'learn', [{ t: 'x', pill: 'free', link: 'http://a' }, { t: 'y' }])
    expect(items.map((i) => i.id)).toEqual(['w3-learn-0', 'w3-learn-1'])
    expect(items[0].label).toBe('x')
    expect(items[0].link).toBe('http://a')
  })

  it('build/ship section 同样规则', () => {
    expect(flattenWeekSection(7, 'ship', [{ t: 'z' }]).map((i) => i.id)).toEqual(['w7-ship-0'])
  })
})

describe('flattenMastery', () => {
  it('生成 m{phaseP}-{i} 形式 id', () => {
    const items = flattenMastery(2, ['t1', 't2'])
    expect(items.map((i) => i.id)).toEqual(['m2-0', 'm2-1'])
  })
})

describe('progress persistence (localStorage)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('key 为 ai_bootcamp_progress_v3，与原 dashboard 一致', () => {
    expect(PROGRESS_KEY).toBe('ai_bootcamp_progress_v3')
  })

  it('loadProgress 在空 localStorage 下返回空对象', () => {
    expect(loadProgress()).toEqual({})
  })

  it('saveProgress 后 loadProgress 能读回（round-trip）', () => {
    saveProgress({ 'setup-0': true, 'w1-learn-0': false })
    expect(loadProgress()).toEqual({ 'setup-0': true, 'w1-learn-0': false })
  })

  it('toggleProgress 翻转指定 id 并落盘', () => {
    let state = loadProgress()
    state = toggleProgress(state, 'setup-0')
    expect(state['setup-0']).toBe(true)
    expect(loadProgress()['setup-0']).toBe(true)
    state = toggleProgress(state, 'setup-0')
    expect(state['setup-0']).toBe(false)
    expect(loadProgress()['setup-0']).toBe(false)
  })
})
