import { describe, it, expect, beforeEach } from 'vitest'
import learningPlanData from '../data/learningPlan.json'
import {
  flattenMastery, flattenSetup, flattenWeekSection, loadProgress, saveProgress, toggleProgress,
  PROGRESS_KEY, type LearningPlanData,
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

describe('原 dashboard 真实数据 id 契约（云同步/勾选迁移依赖这套 id 不变）', () => {
  const data = learningPlanData as LearningPlanData

  it('setup-0 对应真实 setup 清单第一条', () => {
    expect(flattenSetup(data.setup)[0].id).toBe('setup-0')
  })

  it('w1-learn-0 对应第 1 周 learn 第一条', () => {
    const week1 = data.phases[0].weeks[0]
    expect(week1.n).toBe(1)
    expect(flattenWeekSection(week1.n, 'learn', week1.learn)[0].id).toBe('w1-learn-0')
  })

  it('m1-0 对应 Phase 1 掌握度自查第一条', () => {
    const phase1 = data.phases[0]
    expect(phase1.p).toBe(1)
    expect(flattenMastery(phase1.p, phase1.takeaways)[0].id).toBe('m1-0')
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
