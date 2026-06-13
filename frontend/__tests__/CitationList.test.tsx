import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CitationList } from '../app/components/CitationList'

const CITATIONS = [
  {
    statute_id: 'MGL_186_15B_return',
    statute_text: 'The lessor shall, within thirty days after the termination of the tenancy, return to the tenant the security deposit.',
    source: 'MGL',
  },
  {
    statute_id: 'MGL_186_15B',
    statute_text: 'No lessor may require a security deposit exceeding the amount of first month\'s rent.',
    source: 'MGL',
  },
]

describe('CitationList', () => {
  it('renders citation IDs', () => {
    render(<CitationList citations={CITATIONS} />)
    expect(screen.getByTestId('citation-MGL_186_15B_return')).toBeTruthy()
    expect(screen.getByTestId('citation-MGL_186_15B')).toBeTruthy()
  })

  it('does not show statute text initially (collapsed)', () => {
    render(<CitationList citations={CITATIONS} />)
    expect(screen.queryByTestId('citation-text-MGL_186_15B_return')).toBeNull()
  })

  it('shows statute text when expanded — no bare citation', () => {
    render(<CitationList citations={CITATIONS} />)
    const btn = screen.getByTestId('citation-MGL_186_15B_return').querySelector('button')!
    fireEvent.click(btn)
    const textEl = screen.getByTestId('citation-text-MGL_186_15B_return')
    expect(textEl.textContent).toContain('thirty days')
  })

  it('renders not_considered note when provided', () => {
    render(<CitationList citations={CITATIONS} notConsidered="Other laws may apply." />)
    expect(screen.getByTestId('not-considered-note')).toBeTruthy()
    expect(screen.getByText(/Other laws may apply/i)).toBeTruthy()
  })

  it('renders nothing when citations array is empty', () => {
    const { container } = render(<CitationList citations={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
