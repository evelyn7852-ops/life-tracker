import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const cssPath = join(dirname(fileURLToPath(import.meta.url)), 'app.css')
const css = readFileSync(cssPath, 'utf-8')

/** §D 狗行走方向：🐕 emoji 本体面朝左，位移向左（X 递减）不翻转、位移向右（X 递增）scaleX(-1)。
 * CSS keyframes 不易在 jsdom 里跑真实动画断言，改为直接解析源文件校验翻转/位移分段是否严格绑定。 */
describe('app.css §D dog-run keyframes：翻转与位移方向严格绑定', () => {
  function keyframeBlock(name: string): string {
    const m = css.match(new RegExp(`@keyframes ${name}\\s*{([\\s\\S]*?)\\n}`))
    if (!m) throw new Error(`keyframes ${name} not found`)
    return m[1]
  }

  function stepsOf(block: string): { pct: string; left: string; scale: string }[] {
    const re = /(\d+%)\s*{\s*left:\s*([\d.]+%);\s*transform:\s*scaleX\((-?1)\);\s*}/g
    const steps: { pct: string; left: string; scale: string }[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(block))) steps.push({ pct: m[1], left: m[2], scale: m[3] })
    return steps
  }

  it('dog-run keyframes 共 5 个关键帧', () => {
    const steps = stepsOf(keyframeBlock('dog-run'))
    expect(steps.length).toBe(5)
  })

  it('位移向右（4%→84%，0%~45%）全程 scaleX(-1)：脸朝右，与位移方向一致', () => {
    const steps = stepsOf(keyframeBlock('dog-run'))
    const start = steps.find((s) => s.pct === '0%')!
    const beforeTurn = steps.find((s) => s.pct === '45%')!
    expect(parseFloat(start.left)).toBeLessThan(parseFloat(beforeTurn.left)) // 确认这段确实是「向右」
    expect(start.scale).toBe('-1')
    expect(beforeTurn.scale).toBe('-1')
  })

  it('位移向左（84%→4%，50%~95%）全程 scaleX(1)：脸朝左（天然朝向），不翻转', () => {
    const steps = stepsOf(keyframeBlock('dog-run'))
    const afterTurn = steps.find((s) => s.pct === '50%')!
    const beforeEnd = steps.find((s) => s.pct === '95%')!
    expect(parseFloat(afterTurn.left)).toBeGreaterThan(parseFloat(beforeEnd.left)) // 确认这段确实是「向左」
    expect(afterTurn.scale).toBe('1')
    expect(beforeEnd.scale).toBe('1')
  })

  it('翻转严格在折返点同帧切换：45%→50%（右转左）与 95%→100%（左转右，循环衔接）', () => {
    const steps = stepsOf(keyframeBlock('dog-run'))
    const at45 = steps.find((s) => s.pct === '45%')!
    const at50 = steps.find((s) => s.pct === '50%')!
    const at95 = steps.find((s) => s.pct === '95%')!
    const at100 = steps.find((s) => s.pct === '100%')!
    // 折返点位置不变（同一帧内只切朝向，不切位置）
    expect(at45.left).toBe(at50.left)
    expect(at95.left).toBe(at100.left)
    // 朝向确实在这两处切换
    expect(at45.scale).not.toBe(at50.scale)
    expect(at95.scale).not.toBe(at100.scale)
    // 100% 与 0% 朝向一致，循环无缝衔接
    expect(at100.scale).toBe(steps.find((s) => s.pct === '0%')!.scale)
  })
})
