import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LeaseAnalysis } from '../app/components/LeaseAnalysis'

const mockData = {
  demo_mode: true,
  demo_notice: 'Showing sample lease for demonstration.',
  key_terms: {
    monthly_rent: '$2000',
    security_deposit: '$4000',
    pets: 'Not permitted',
  },
  issues: [
    {
      id: 'waive_habitability',
      severity: 'illegal' as const,
      flag: 'Waiver of implied warranty of habitability',
      plain: 'You cannot sign away your right to a liveable apartment.',
      remedy: 'This clause is void. You retain all habitability rights.',
      statute: 'MGL_111_127L',
      statute_title: 'Implied warranty of habitability',
      statute_text: 'Every landlord shall maintain premises in a habitable condition.',
    },
    {
      id: 'high_late_fee',
      severity: 'concerning' as const,
      flag: 'Potentially excessive late fee',
      plain: 'Late fees above 5% may be challenged.',
      remedy: 'Challenge under MGL c.93A.',
      statute: 'MGL_186_15B',
      statute_title: 'Security deposits',
      statute_text: '',
    },
  ],
  missing_disclosures: [
    {
      id: 'lead_paint',
      name: 'Lead paint disclosure',
      statute: 'MGL_186_28',
      statute_title: 'Lead paint disclosure',
      plain: 'Required for pre-1978 units.',
    },
  ],
  summary: { red_flags: 1, yellow_flags: 1, missing_disclosures: 1 },
  not_considered: 'Local ordinances and federal law were not analyzed.',
  is_advice: false,
}

describe('LeaseAnalysis', () => {
  it('renders demo banner when demo_mode is true', () => {
    render(<LeaseAnalysis data={mockData} />)
    expect(screen.getByTestId('demo-banner')).toBeTruthy()
    expect(screen.getByText(/Demo mode/i)).toBeTruthy()
  })

  it('renders score bar with correct counts', () => {
    render(<LeaseAnalysis data={mockData} />)
    expect(screen.getByTestId('red-count').textContent).toBe('1')
    expect(screen.getByTestId('yellow-count').textContent).toBe('1')
    expect(screen.getByTestId('missing-count').textContent).toBe('1')
  })

  it('renders key terms', () => {
    render(<LeaseAnalysis data={mockData} />)
    expect(screen.getByTestId('key-terms')).toBeTruthy()
    expect(screen.getByText('$2000')).toBeTruthy()
    expect(screen.getByText('$4000')).toBeTruthy()
  })

  it('renders illegal clause with Illegal clause badge', () => {
    render(<LeaseAnalysis data={mockData} />)
    expect(screen.getByTestId('issue-waive_habitability')).toBeTruthy()
    expect(screen.getAllByText(/Illegal clause/i).length).toBeGreaterThan(0)
    expect(screen.getByText('Waiver of implied warranty of habitability')).toBeTruthy()
  })

  it('renders concerning clause', () => {
    render(<LeaseAnalysis data={mockData} />)
    expect(screen.getByTestId('issue-high_late_fee')).toBeTruthy()
    expect(screen.getAllByText(/Concerning/i).length).toBeGreaterThan(0)
  })

  it('renders missing disclosures', () => {
    render(<LeaseAnalysis data={mockData} />)
    expect(screen.getByTestId('disclosure-lead_paint')).toBeTruthy()
    expect(screen.getByText('Lead paint disclosure')).toBeTruthy()
  })

  it('renders not-legal-advice disclaimer', () => {
    render(<LeaseAnalysis data={mockData} />)
    expect(screen.getByTestId('disclaimer')).toBeTruthy()
    expect(screen.getByText(/Not legal advice/i)).toBeTruthy()
  })
})
