import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuditPanel } from '../app/components/AuditPanel'

const ENTRIES = [
  {
    case_id: 'case-1',
    actor: 'ai',
    action: 'briefing_initiator',
    ai_suggestion: { levels_keys: ['simple', 'standard', 'full'], citations_count: 3 },
    human_decision: null,
    timestamp: '2024-03-01T12:00:00',
  },
  {
    case_id: 'case-1',
    actor: 'human',
    action: 'message_approve',
    ai_suggestion: 'I would like to discuss this calmly.',
    human_decision: { choice: 'rewrite', final_text: 'I would like to discuss this calmly.' },
    timestamp: '2024-03-01T12:05:00',
  },
]

describe('AuditPanel', () => {
  it('renders all audit entries', () => {
    render(<AuditPanel entries={ENTRIES} caseId="case-1" />)
    const entryEls = screen.getAllByTestId('audit-entry')
    expect(entryEls).toHaveLength(2)
  })

  it('renders action names', () => {
    render(<AuditPanel entries={ENTRIES} caseId="case-1" />)
    expect(screen.getByText('briefing_initiator')).toBeTruthy()
    expect(screen.getByText('message_approve')).toBeTruthy()
  })

  it('renders ai_suggestion for AI entries', () => {
    render(<AuditPanel entries={ENTRIES} caseId="case-1" />)
    const aiSuggestions = screen.getAllByTestId('audit-ai-suggestion')
    expect(aiSuggestions.length).toBeGreaterThan(0)
    // First entry has ai_suggestion as object
    expect(aiSuggestions[0].textContent).toContain('citations_count')
  })

  it('renders human_decision for human entries', () => {
    render(<AuditPanel entries={ENTRIES} caseId="case-1" />)
    const humanDecisions = screen.getAllByTestId('audit-human-decision')
    expect(humanDecisions.length).toBeGreaterThan(0)
    expect(humanDecisions[0].textContent).toContain('rewrite')
  })

  it('renders flag for human review button on each entry', () => {
    render(<AuditPanel entries={ENTRIES} caseId="case-1" />)
    const flagBtns = screen.getAllByTestId('flag-for-review')
    expect(flagBtns).toHaveLength(2)
  })

  it('renders export audit log button', () => {
    render(<AuditPanel entries={ENTRIES} caseId="case-1" />)
    expect(screen.getByTestId('export-audit')).toBeTruthy()
  })

  it('renders empty state when no entries', () => {
    render(<AuditPanel entries={[]} caseId="case-1" />)
    expect(screen.getByText(/No audit entries yet/i)).toBeTruthy()
  })
})
