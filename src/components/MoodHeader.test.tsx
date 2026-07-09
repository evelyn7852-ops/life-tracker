import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MoodHeader } from './MoodHeader'

describe('MoodHeader', () => {
  it('渲染日期时钟文案', async () => {
    render(<MoodHeader />)
    expect(await screen.findByText(/月.*日.*周.*:/)).toBeTruthy()
  })
})
