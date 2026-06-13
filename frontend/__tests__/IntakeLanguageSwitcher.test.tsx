import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IntakeLanguageSwitcher } from '../app/components/IntakeLanguageSwitcher'

const mockQuestionEN = {
  done: false,
  question: {
    id: 'q_dispute_type',
    text: 'What is your dispute mainly about?',
    type: 'choice',
    choices: ['Security deposit', 'Eviction / notice to leave', 'Other'],
  },
}

const mockQuestionES = {
  done: false,
  question: {
    id: 'q_dispute_type',
    text: '¿De qué trata principalmente su disputa?',
    type: 'choice',
    choices: ['Depósito de seguridad', 'Desalojo', 'Otro'],
    original_text: 'What is your dispute mainly about?',
    original_choices: ['Security deposit', 'Eviction / notice to leave', 'Other'],
  },
}

const mockQuestionAR = {
  done: false,
  question: {
    id: 'q_dispute_type',
    text: 'ما هو موضوع نزاعك بشكل رئيسي؟',
    type: 'choice',
    choices: ['وديعة الأمان', 'إخلاء', 'أخرى'],
    original_text: 'What is your dispute mainly about?',
    original_choices: ['Security deposit', 'Eviction / notice to leave', 'Other'],
  },
}

describe('IntakeLanguageSwitcher', () => {
  it('renders intake questions in English (default)', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockQuestionEN)
    render(
      <IntakeLanguageSwitcher caseId="case-1" party="initiator" fetchNextQuestion={fetchFn} />
    )
    await waitFor(() => screen.getByTestId('question-text'))
    expect(screen.getByText('What is your dispute mainly about?')).toBeTruthy()
    expect(screen.getByText('Security deposit')).toBeTruthy()
  })

  it('renders intake questions in selected language (mock)', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockQuestionES)
    render(
      <IntakeLanguageSwitcher caseId="case-1" party="initiator" fetchNextQuestion={fetchFn} />
    )
    // Switch language to Spanish
    fireEvent.change(screen.getByTestId('lang-select'), { target: { value: 'es' } })
    await waitFor(() => screen.getByTestId('question-text'))
    expect(screen.getByText('¿De qué trata principalmente su disputa?')).toBeTruthy()
    expect(screen.getByTestId('original-text')).toBeTruthy()
  })

  it('language selector has multiple language options', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockQuestionEN)
    render(
      <IntakeLanguageSwitcher caseId="case-1" party="initiator" fetchNextQuestion={fetchFn} />
    )
    const select = screen.getByTestId('lang-select') as HTMLSelectElement
    expect(select.options.length).toBeGreaterThan(2)
  })

  it('applies RTL direction when Arabic is selected', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockQuestionAR)
    render(
      <IntakeLanguageSwitcher caseId="case-1" party="initiator" fetchNextQuestion={fetchFn} />
    )
    fireEvent.change(screen.getByTestId('lang-select'), { target: { value: 'ar' } })
    await waitFor(() => screen.getByTestId('intake-form'))
    expect(screen.getByTestId('intake-form').getAttribute('dir')).toBe('rtl')
  })

  it('calls fetchNextQuestion with the selected lang', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockQuestionES)
    render(
      <IntakeLanguageSwitcher caseId="case-1" party="initiator" fetchNextQuestion={fetchFn} />
    )
    fireEvent.change(screen.getByTestId('lang-select'), { target: { value: 'es' } })
    await waitFor(() => expect(fetchFn).toHaveBeenCalledWith('case-1', 'initiator', {}, 'es'))
  })
})
