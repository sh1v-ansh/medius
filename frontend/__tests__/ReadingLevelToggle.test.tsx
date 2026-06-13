import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReadingLevelToggle } from '../app/components/ReadingLevelToggle'

const LEVELS = {
  simple: 'This is the simple explanation in plain language.',
  standard: 'This is the standard explanation with statute names.',
  full: 'RETRIEVED STATUTES (verbatim): MGL_186_15B — full text here.',
}

describe('ReadingLevelToggle', () => {
  it('defaults to Simple level', () => {
    render(<ReadingLevelToggle levels={LEVELS} />)
    const content = screen.getByTestId('level-content-simple')
    expect(content.textContent).toContain('simple explanation')
  })

  it('renders all three level buttons', () => {
    render(<ReadingLevelToggle levels={LEVELS} />)
    expect(screen.getByTestId('level-btn-simple')).toBeTruthy()
    expect(screen.getByTestId('level-btn-standard')).toBeTruthy()
    expect(screen.getByTestId('level-btn-full')).toBeTruthy()
  })

  it('switches to Standard when Standard button is clicked', () => {
    render(<ReadingLevelToggle levels={LEVELS} />)
    fireEvent.click(screen.getByTestId('level-btn-standard'))
    expect(screen.getByTestId('level-content-standard').textContent).toContain('standard explanation')
    expect(screen.queryByTestId('level-content-simple')).toBeNull()
  })

  it('switches to Full when Full button is clicked', () => {
    render(<ReadingLevelToggle levels={LEVELS} />)
    fireEvent.click(screen.getByTestId('level-btn-full'))
    expect(screen.getByTestId('level-content-full').textContent).toContain('RETRIEVED STATUTES')
  })

  it('switches back to Simple after visiting Full', () => {
    render(<ReadingLevelToggle levels={LEVELS} />)
    fireEvent.click(screen.getByTestId('level-btn-full'))
    fireEvent.click(screen.getByTestId('level-btn-simple'))
    expect(screen.getByTestId('level-content-simple').textContent).toContain('simple explanation')
  })

  it('simple button is aria-pressed=true by default', () => {
    render(<ReadingLevelToggle levels={LEVELS} />)
    const btn = screen.getByTestId('level-btn-simple')
    expect(btn.getAttribute('aria-pressed')).toBe('true')
  })

  it('standard button becomes aria-pressed=true after click', () => {
    render(<ReadingLevelToggle levels={LEVELS} />)
    const btn = screen.getByTestId('level-btn-standard')
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('level-btn-simple').getAttribute('aria-pressed')).toBe('false')
  })

  it('accepts a defaultLevel override', () => {
    render(<ReadingLevelToggle levels={LEVELS} defaultLevel="full" />)
    expect(screen.getByTestId('level-content-full').textContent).toContain('RETRIEVED STATUTES')
    expect(screen.getByTestId('level-btn-full').getAttribute('aria-pressed')).toBe('true')
  })
})
