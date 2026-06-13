import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WtmfmCard } from '../app/components/WtmfmCard'

const SAMPLE = {
  what_law_says: 'Massachusetts law requires the landlord to return the deposit within 30 days.',
  what_i_can_do: ['Send a written request', 'Request mediation', 'File in small claims court'],
  what_are_risks: ['Filing fees apply', 'Legal processes take time'],
  is_advice: false as const,
  disclaimer: 'This is information, not legal advice.',
}

describe('WtmfmCard', () => {
  it('renders what the law says section', () => {
    render(<WtmfmCard data={SAMPLE} />)
    expect(screen.getByTestId('wtmfm-what-law-says')).toBeTruthy()
    expect(screen.getByText(/requires the landlord/i)).toBeTruthy()
  })

  it('renders what I can do section with all options', () => {
    render(<WtmfmCard data={SAMPLE} />)
    expect(screen.getByTestId('wtmfm-what-i-can-do')).toBeTruthy()
    expect(screen.getByText(/Send a written request/i)).toBeTruthy()
    expect(screen.getByText(/Request mediation/i)).toBeTruthy()
    expect(screen.getByText(/File in small claims/i)).toBeTruthy()
  })

  it('renders what are the risks section', () => {
    render(<WtmfmCard data={SAMPLE} />)
    expect(screen.getByTestId('wtmfm-what-are-risks')).toBeTruthy()
    expect(screen.getByText(/Filing fees apply/i)).toBeTruthy()
  })

  it('renders the not-advice disclaimer', () => {
    render(<WtmfmCard data={SAMPLE} />)
    const disclaimer = screen.getByTestId('wtmfm-not-advice')
    expect(disclaimer).toBeTruthy()
    expect(disclaimer.textContent).toMatch(/not legal advice/i)
  })

  it('renders all three required sections (not just one)', () => {
    render(<WtmfmCard data={SAMPLE} />)
    expect(screen.getByTestId('wtmfm-what-law-says')).toBeTruthy()
    expect(screen.getByTestId('wtmfm-what-i-can-do')).toBeTruthy()
    expect(screen.getByTestId('wtmfm-what-are-risks')).toBeTruthy()
  })
})
