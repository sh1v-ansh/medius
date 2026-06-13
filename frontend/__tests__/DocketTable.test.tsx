import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DocketTable, sortByComposite, type CaseRow } from '../app/components/DocketTable'

function makeCase(overrides: Partial<CaseRow> & { composite?: number; case_id?: string }): CaseRow {
  const { composite = 50, case_id = crypto.randomUUID(), ...rest } = overrides
  return {
    case_id,
    type: 'housing',
    status: 'intake',
    created_at: new Date().toISOString(),
    parties: {
      initiator: { role: 'tenant', has_counsel: false },
      respondent: { role: 'landlord', has_counsel: false },
    },
    triage: {
      composite,
      scores: {
        urgency: 50,
        power_asymmetry: 50,
        violation_strength: 50,
        settlement_likelihood: 50,
      },
    },
    ...rest,
  }
}

// ── Sort tests ────────────────────────────────────────────────────────────────

describe('sortByComposite', () => {
  it('sorts cases by composite score descending', () => {
    const cases = [
      makeCase({ case_id: 'low', composite: 20 }),
      makeCase({ case_id: 'high', composite: 90 }),
      makeCase({ case_id: 'mid', composite: 55 }),
    ]
    const sorted = sortByComposite(cases)
    expect(sorted[0].case_id).toBe('high')
    expect(sorted[1].case_id).toBe('mid')
    expect(sorted[2].case_id).toBe('low')
  })

  it('puts cases without triage last', () => {
    const cases = [
      makeCase({ case_id: 'no-triage', triage: null }),
      makeCase({ case_id: 'has-triage', composite: 30 }),
    ]
    const sorted = sortByComposite(cases)
    expect(sorted[0].case_id).toBe('has-triage')
    expect(sorted[1].case_id).toBe('no-triage')
  })

  it('preserves equal-score order', () => {
    const cases = [
      makeCase({ case_id: 'a', composite: 60 }),
      makeCase({ case_id: 'b', composite: 60 }),
    ]
    const sorted = sortByComposite(cases)
    expect(sorted).toHaveLength(2)
    expect(sorted[0].triage?.composite).toBe(60)
  })
})

// ── Render tests ──────────────────────────────────────────────────────────────

describe('DocketTable render', () => {
  it('renders all rows sorted by composite desc', () => {
    const cases = [
      makeCase({ case_id: 'aaa-low-00000000', composite: 10 }),
      makeCase({ case_id: 'bbb-high-0000000', composite: 85 }),
    ]
    render(<DocketTable cases={cases} />)

    const rows = screen.getAllByRole('row')
    // rows[0] = header, rows[1] = first data row = highest composite
    expect(rows[1]).toHaveAttribute('data-testid', 'docket-row-bbb-high-0000000')
    expect(rows[2]).toHaveAttribute('data-testid', 'docket-row-aaa-low-00000000')
  })

  it('renders empty state when no cases', () => {
    render(<DocketTable cases={[]} />)
    expect(screen.getByText(/No cases in the docket/i)).toBeTruthy()
  })
})

// ── Asymmetry flag tests ──────────────────────────────────────────────────────

describe('AsymmetryFlag', () => {
  it('shows asymmetry flag when only one party has counsel', () => {
    const c = makeCase({
      case_id: 'asym-test-000000',
      parties: {
        initiator: { role: 'tenant', has_counsel: false },
        respondent: { role: 'landlord', has_counsel: true },
      },
    })
    render(<DocketTable cases={[c]} />)
    expect(screen.getByTestId('asymmetry-flag')).toBeTruthy()
  })

  it('does NOT show asymmetry flag when both parties lack counsel', () => {
    const c = makeCase({
      case_id: 'no-asym-test-000',
      parties: {
        initiator: { role: 'tenant', has_counsel: false },
        respondent: { role: 'landlord', has_counsel: false },
      },
    })
    render(<DocketTable cases={[c]} />)
    expect(screen.queryByTestId('asymmetry-flag')).toBeNull()
  })

  it('does NOT show asymmetry flag when both parties have counsel', () => {
    const c = makeCase({
      case_id: 'both-counsel-test',
      parties: {
        initiator: { role: 'tenant', has_counsel: true },
        respondent: { role: 'landlord', has_counsel: true },
      },
    })
    render(<DocketTable cases={[c]} />)
    expect(screen.queryByTestId('asymmetry-flag')).toBeNull()
  })

  it('shows asymmetry flag when initiator has counsel but respondent does not', () => {
    const c = makeCase({
      case_id: 'init-counsel-test',
      parties: {
        initiator: { role: 'tenant', has_counsel: true },
        respondent: { role: 'landlord', has_counsel: false },
      },
    })
    render(<DocketTable cases={[c]} />)
    expect(screen.getByTestId('asymmetry-flag')).toBeTruthy()
  })
})
