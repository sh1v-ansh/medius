'use client'

import { useState, useEffect } from 'react'

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'zh', label: '中文' },
  { code: 'ar', label: 'العربية' },
  { code: 'ja', label: '日本語' },
  { code: 'pt', label: 'Português' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'ru', label: 'Русский' },
]

const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur'])

interface Question {
  id: string
  text: string
  type: string
  choices?: string[]
  original_text?: string
  original_choices?: string[]
}

interface IntakeLanguageSwitcherProps {
  caseId: string
  party: 'initiator' | 'respondent'
  fetchNextQuestion?: (
    caseId: string,
    party: string,
    answers: Record<string, string>,
    lang: string
  ) => Promise<{ done: boolean; question: Question | null }>
}

const defaultFetchNextQuestion = async (
  caseId: string,
  party: string,
  answers: Record<string, string>,
  lang: string
) => {
  const res = await fetch(`/api/cases/${caseId}/intake/next`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ party, answers, lang }),
  })
  if (!res.ok) throw new Error('Failed to fetch next question')
  return res.json()
}

export function IntakeLanguageSwitcher({
  caseId,
  party,
  fetchNextQuestion = defaultFetchNextQuestion,
}: IntakeLanguageSwitcherProps) {
  const [lang, setLang] = useState('en')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [question, setQuestion] = useState<Question | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRTL = RTL_LANGS.has(lang)

  async function loadNext(currentAnswers: Record<string, string>, currentLang: string) {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchNextQuestion(caseId, party, currentAnswers, currentLang)
      setDone(result.done)
      setQuestion(result.question)
    } catch {
      setError('Could not load question.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNext(answers, lang)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  function handleAnswer(value: string) {
    if (!question) return
    const updated = { ...answers, [question.id]: value }
    setAnswers(updated)
    loadNext(updated, lang)
  }

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'} data-testid="intake-form">
      {/* Language selector */}
      <div className="flex items-center gap-2">
        <label htmlFor="lang-select" className="text-sm font-medium text-gray-700">
          Language:
        </label>
        <select
          id="lang-select"
          value={lang}
          onChange={(e) => {
            setLang(e.target.value)
            setAnswers({})
            setDone(false)
          }}
          data-testid="lang-select"
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-gray-400" data-testid="loading">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {done && (
        <p className="text-sm text-green-700 font-medium" data-testid="intake-done">
          Intake complete. Thank you.
        </p>
      )}

      {!done && question && !loading && (
        <div className="space-y-3" data-testid="question-block">
          <p className="text-base font-medium text-gray-800" data-testid="question-text">
            {question.text}
          </p>
          {question.original_text && (
            <p className="text-xs text-gray-400 italic" data-testid="original-text">
              ({question.original_text})
            </p>
          )}

          {question.type === 'choice' && question.choices && (
            <div className="space-y-1" data-testid="choices">
              {question.choices.map((choice, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleAnswer(
                    question.original_choices ? question.original_choices[i] : choice
                  )}
                  className="block w-full text-left px-3 py-2 rounded border border-gray-200 text-sm hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  data-testid={`choice-${i}`}
                >
                  {choice}
                </button>
              ))}
            </div>
          )}

          {(question.type === 'short_answer' || question.type === 'yes_no') && (
            <div className="flex gap-2">
              {question.type === 'yes_no' ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleAnswer('yes')}
                    className="px-4 py-2 rounded border border-gray-300 text-sm hover:bg-blue-50"
                    data-testid="yes-btn"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAnswer('no')}
                    className="px-4 py-2 rounded border border-gray-300 text-sm hover:bg-blue-50"
                    data-testid="no-btn"
                  >
                    No
                  </button>
                </>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    const val = (e.currentTarget.elements.namedItem('answer') as HTMLInputElement).value
                    if (val.trim()) handleAnswer(val.trim())
                  }}
                  className="flex gap-2 w-full"
                >
                  <input
                    name="answer"
                    type="text"
                    className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm"
                    data-testid="text-input"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm"
                    data-testid="submit-answer"
                  >
                    Next
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
