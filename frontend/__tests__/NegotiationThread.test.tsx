import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NegotiationThread } from '../app/components/NegotiationThread'

function makeDraftMsg(overrides = {}) {
  return {
    msg_id: 'draft-001',
    sender: 'initiator',
    original: 'You are a liar and I will sue you.',
    rewrite: 'I would like to discuss this concern with you.',
    content: '',
    tone: 'hostile',
    empathy_ack: 'It sounds like you are very frustrated — here is a calmer way to say it.',
    status: 'pending_approval' as const,
    ...overrides,
  }
}

function makeDeliveredMsg(overrides = {}) {
  return {
    msg_id: 'del-001',
    sender: 'initiator',
    original: 'I would like to discuss the deposit.',
    rewrite: 'I would like to discuss the deposit.',
    content: 'I would like to discuss the deposit.',
    tone: 'neutral',
    empathy_ack: '',
    status: 'delivered' as const,
    ...overrides,
  }
}

describe('NegotiationThread', () => {
  it('shows empty thread initially', () => {
    render(
      <NegotiationThread caseId="case-1" party="initiator" deliveredMessages={[]} />
    )
    expect(screen.getByText(/No messages yet/i)).toBeTruthy()
  })

  it('renders delivered messages in the thread', () => {
    const msg = makeDeliveredMsg()
    render(
      <NegotiationThread
        caseId="case-1"
        party="initiator"
        deliveredMessages={[msg]}
      />
    )
    expect(screen.getByTestId(`delivered-msg-${msg.msg_id}`)).toBeTruthy()
    expect(screen.getByText(/I would like to discuss the deposit/i)).toBeTruthy()
  })

  it('shows compose area before drafting', () => {
    render(
      <NegotiationThread caseId="case-1" party="initiator" deliveredMessages={[]} />
    )
    expect(screen.getByTestId('compose-area')).toBeTruthy()
    expect(screen.getByTestId('compose-input')).toBeTruthy()
    expect(screen.getByTestId('draft-btn')).toBeTruthy()
  })

  it('calls draftApi and shows draft review after clicking Get AI suggestion', async () => {
    const draft = makeDraftMsg()
    const mockDraftApi = vi.fn().mockResolvedValue(draft)

    render(
      <NegotiationThread
        caseId="case-1"
        party="initiator"
        deliveredMessages={[]}
        draftApi={mockDraftApi}
      />
    )

    fireEvent.change(screen.getByTestId('compose-input'), {
      target: { value: 'You are a liar and I will sue you.' },
    })
    fireEvent.click(screen.getByTestId('draft-btn'))

    await waitFor(() => expect(mockDraftApi).toHaveBeenCalledOnce())
    await waitFor(() => expect(screen.getByTestId('draft-review')).toBeTruthy())
  })

  it('shows original AND rewrite side-by-side in draft review', async () => {
    const draft = makeDraftMsg()
    const mockDraftApi = vi.fn().mockResolvedValue(draft)

    render(
      <NegotiationThread
        caseId="case-1"
        party="initiator"
        deliveredMessages={[]}
        draftApi={mockDraftApi}
      />
    )
    fireEvent.change(screen.getByTestId('compose-input'), { target: { value: 'hostile text' } })
    fireEvent.click(screen.getByTestId('draft-btn'))

    await waitFor(() => screen.getByTestId('draft-review'))
    expect(screen.getByTestId('choice-original')).toBeTruthy()
    expect(screen.getByTestId('choice-rewrite')).toBeTruthy()
    expect(screen.getByText(/You are a liar/i)).toBeTruthy()
    expect(screen.getByText(/I would like to discuss this concern/i)).toBeTruthy()
  })

  it('shows empathy_ack when tone is hostile', async () => {
    const draft = makeDraftMsg()
    const mockDraftApi = vi.fn().mockResolvedValue(draft)

    render(
      <NegotiationThread
        caseId="case-1"
        party="initiator"
        deliveredMessages={[]}
        draftApi={mockDraftApi}
      />
    )
    fireEvent.change(screen.getByTestId('compose-input'), { target: { value: 'hostile' } })
    fireEvent.click(screen.getByTestId('draft-btn'))

    await waitFor(() => screen.getByTestId('empathy-ack'))
    expect(screen.getByText(/frustrated/i)).toBeTruthy()
  })

  it('shows approve button in draft review', async () => {
    const draft = makeDraftMsg()
    const mockDraftApi = vi.fn().mockResolvedValue(draft)

    render(
      <NegotiationThread
        caseId="case-1"
        party="initiator"
        deliveredMessages={[]}
        draftApi={mockDraftApi}
      />
    )
    fireEvent.change(screen.getByTestId('compose-input'), { target: { value: 'hostile' } })
    fireEvent.click(screen.getByTestId('draft-btn'))

    await waitFor(() => screen.getByTestId('approve-btn'))
    expect(screen.getByTestId('approve-btn').textContent).toMatch(/Approve & send/i)
  })

  it('message absent from delivered thread before Approve is clicked', async () => {
    const draft = makeDraftMsg()
    const mockDraftApi = vi.fn().mockResolvedValue(draft)
    const mockApproveApi = vi.fn()

    render(
      <NegotiationThread
        caseId="case-1"
        party="initiator"
        deliveredMessages={[]}
        draftApi={mockDraftApi}
        approveApi={mockApproveApi}
      />
    )
    fireEvent.change(screen.getByTestId('compose-input'), { target: { value: 'hostile' } })
    fireEvent.click(screen.getByTestId('draft-btn'))

    await waitFor(() => screen.getByTestId('draft-review'))

    // The message content must NOT be in the delivered thread yet
    expect(screen.queryByTestId('delivered-msg-draft-001')).toBeNull()
    expect(mockApproveApi).not.toHaveBeenCalled()
  })

  it('calls approveApi and shows delivered message after Approve is clicked', async () => {
    const draft = makeDraftMsg()
    const approved = { ...draft, status: 'delivered' as const, content: draft.rewrite }
    const mockDraftApi = vi.fn().mockResolvedValue(draft)
    const mockApproveApi = vi.fn().mockResolvedValue(approved)
    const onApprove = vi.fn()

    render(
      <NegotiationThread
        caseId="case-1"
        party="initiator"
        deliveredMessages={[]}
        draftApi={mockDraftApi}
        approveApi={mockApproveApi}
        onApprove={onApprove}
      />
    )
    fireEvent.change(screen.getByTestId('compose-input'), { target: { value: 'hostile' } })
    fireEvent.click(screen.getByTestId('draft-btn'))

    await waitFor(() => screen.getByTestId('approve-btn'))
    fireEvent.click(screen.getByTestId('approve-btn'))

    await waitFor(() => expect(mockApproveApi).toHaveBeenCalledOnce())
    await waitFor(() => expect(onApprove).toHaveBeenCalledWith(approved))
  })
})

describe('NegotiationThread — machine translation (Phase 10)', () => {
  function makeTranslatedMsg(senderLang = 'es') {
    return {
      msg_id: 'trans-001',
      sender: 'respondent',
      original: 'Resolvamos este asunto.',
      rewrite: 'Resolvamos este asunto.',
      content: 'Resolvamos este asunto.',
      tone: 'neutral',
      empathy_ack: '',
      status: 'delivered' as const,
      is_machine_translation: true,
      translation: 'Let us resolve this matter.',
      sender_lang: senderLang,
    }
  }

  it('translated messages are labeled "machine translation"', () => {
    render(
      <NegotiationThread
        caseId="case-1"
        party="initiator"
        deliveredMessages={[makeTranslatedMsg()]}
      />
    )
    expect(screen.getByTestId('machine-translation-label')).toBeTruthy()
    expect(screen.getByText('machine translation')).toBeTruthy()
  })

  it('shows translated content and original in machine-translation block', () => {
    render(
      <NegotiationThread
        caseId="case-1"
        party="initiator"
        deliveredMessages={[makeTranslatedMsg()]}
      />
    )
    expect(screen.getByText('Let us resolve this matter.')).toBeTruthy()
    expect(screen.getByText('Resolvamos este asunto.')).toBeTruthy()
  })

  it('applies RTL direction for Arabic sender', () => {
    render(
      <NegotiationThread
        caseId="case-1"
        party="initiator"
        deliveredMessages={[makeTranslatedMsg('ar')]}
      />
    )
    const block = screen.getByTestId('machine-translation-block')
    expect(block.getAttribute('dir')).toBe('rtl')
  })

  it('non-translated messages have no machine-translation label', () => {
    const plain = makeDeliveredMsg()
    render(
      <NegotiationThread caseId="case-1" party="initiator" deliveredMessages={[plain]} />
    )
    expect(screen.queryByTestId('machine-translation-label')).toBeNull()
  })
})
