'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  createCase,
  getNextQuestion,
  submitAnswer,
  finishIntake,
  type Question,
} from '../lib/api'

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

type PartyRole = 'tenant' | 'landlord'

function Spinner() {
  return (
    <svg
      className="animate-spin h-5 w-5 text-blue-600"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

function StartPageInner() {
  const searchParams = useSearchParams()
  const roleParam = searchParams.get('role')

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  // Step 1 state
  const [myRole, setMyRole] = useState<PartyRole>(
    roleParam === 'respondent' ? 'landlord' : 'tenant',
  )
  const [myLang, setMyLang] = useState('en')

  // Step 2 state
  const [theirLang, setTheirLang] = useState('en')
  const [creatingCase, setCreatingCase] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Step 3 state (intake)
  const [caseId, setCaseId] = useState<string | null>(null)
  const [party, setParty] = useState<'initiator' | 'respondent'>('initiator')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [question, setQuestion] = useState<Question | null>(null)
  const [questionDone, setQuestionDone] = useState(false)
  const [questionLoading, setQuestionLoading] = useState(false)
  const [questionError, setQuestionError] = useState<string | null>(null)
  const [questionNum, setQuestionNum] = useState(0)
  const [shortAnswerText, setShortAnswerText] = useState('')
  const [finishingIntake, setFinishingIntake] = useState(false)

  // Copy state for step 4
  const [copied, setCopied] = useState(false)

  const theirRole: PartyRole = myRole === 'tenant' ? 'landlord' : 'tenant'

  async function handleCreateCase() {
    setCreatingCase(true)
    setCreateError(null)
    try {
      const initiatorRole = myRole
      const respondentRole = theirRole
      const data = await createCase(initiatorRole, myLang, respondentRole, theirLang)
      setCaseId(data.case_id)
      setParty('initiator')
      setStep(3)
      loadNextQuestion({}, myLang, data.case_id, 'initiator')
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create case. Please try again.')
    } finally {
      setCreatingCase(false)
    }
  }

  async function loadNextQuestion(
    currentAnswers: Record<string, string>,
    lang: string,
    id: string,
    partyName: string,
  ) {
    setQuestionLoading(true)
    setQuestionError(null)
    try {
      const result = await getNextQuestion(id, partyName, currentAnswers, lang)
      setQuestionDone(result.done)
      setQuestion(result.question ?? null)
      if (result.done) {
        handleFinishIntake(id, partyName)
      }
    } catch {
      setQuestionError('Could not load next question. Please try again.')
    } finally {
      setQuestionLoading(false)
    }
  }

  async function handleAnswer(value: string) {
    if (!question || !caseId) return
    const qId = question.id
    const updated = { ...answers, [qId]: value }
    setAnswers(updated)
    setShortAnswerText('')
    setQuestionNum((n) => n + 1)
    try {
      await submitAnswer(caseId, party, qId, value)
    } catch {
      // non-fatal; backend may also read from next-question answers
    }
    loadNextQuestion(updated, myLang, caseId, party)
  }

  async function handleFinishIntake(id: string, partyName: string) {
    setFinishingIntake(true)
    try {
      await finishIntake(id, partyName)
    } catch {
      // non-fatal
    } finally {
      setFinishingIntake(false)
      setStep(4)
    }
  }

  function handleCopyLink() {
    if (!caseId) return
    const url = `${window.location.origin}/cases/${caseId}?party=respondent`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const respondentShareUrl = caseId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/cases/${caseId}?party=respondent`
    : ''

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            {([1, 2, 3, 4] as const).map((s) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    step >= s
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {s < step ? '✓' : s}
                </div>
                {s < 4 && (
                  <div
                    className={`flex-1 h-1 rounded transition-colors ${
                      step > s ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 text-center">
            {step === 1 && 'Your role'}
            {step === 2 && 'Other party'}
            {step === 3 && 'Intake questions'}
            {step === 4 && 'Case created'}
          </p>
        </div>

        {/* Step 1: Who are you? */}
        {step === 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                Who are you in this dispute?
              </h1>
              <p className="text-sm text-gray-500">Select your role to get started.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setMyRole('tenant')}
                className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-colors text-left ${
                  myRole === 'tenant'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                <span className="text-4xl">🏠</span>
                <div>
                  <p className="font-semibold text-gray-900">Tenant</p>
                  <p className="text-xs text-gray-500 mt-0.5">I rent from someone</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMyRole('landlord')}
                className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-colors text-left ${
                  myRole === 'landlord'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                <span className="text-4xl">🏗️</span>
                <div>
                  <p className="font-semibold text-gray-900">Landlord</p>
                  <p className="text-xs text-gray-500 mt-0.5">Someone rents from me</p>
                </div>
              </button>
            </div>

            <div>
              <label htmlFor="my-lang" className="block text-sm font-medium text-gray-700 mb-1">
                Preferred language
              </label>
              <select
                id="my-lang"
                value={myLang}
                onChange={(e) => setMyLang(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 2: Other party */}
        {step === 2 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                Tell us about the other party
              </h1>
              <p className="text-sm text-gray-500">
                The other party is the{' '}
                <span className="font-medium text-gray-700">{theirRole}</span>. You can invite
                them to respond after your case is created.
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center gap-4">
              <span className="text-3xl">{theirRole === 'tenant' ? '🏠' : '🏗️'}</span>
              <div>
                <p className="font-semibold text-gray-900 capitalize">{theirRole}</p>
                <p className="text-xs text-gray-500">Auto-assigned based on your role</p>
              </div>
            </div>

            <div>
              <label htmlFor="their-lang" className="block text-sm font-medium text-gray-700 mb-1">
                Their preferred language (if known)
              </label>
              <select
                id="their-lang"
                value={theirLang}
                onChange={(e) => setTheirLang(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <strong>Sharing:</strong> After creating your case, you&apos;ll get a link to share with
              your {theirRole}. They can answer questions on their own and respond in their language.
            </div>

            {createError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {createError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 text-sm hover:bg-gray-50 transition-colors"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleCreateCase}
                disabled={creatingCase}
                className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {creatingCase ? (
                  <>
                    <Spinner />
                    Creating your case…
                  </>
                ) : (
                  'Create my case →'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Intake questions */}
        {step === 3 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                Answer a few questions
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min((questionNum / 10) * 100, 95)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {questionNum} / ~10
                </span>
              </div>
            </div>

            {questionLoading || finishingIntake ? (
              <div className="flex items-center gap-3 py-8 justify-center text-gray-500">
                <Spinner />
                <span className="text-sm">
                  {finishingIntake ? 'Finishing intake…' : 'Loading question…'}
                </span>
              </div>
            ) : questionError ? (
              <div className="space-y-3">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {questionError}
                </div>
                <button
                  type="button"
                  onClick={() => loadNextQuestion(answers, myLang, caseId!, party)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  Try again
                </button>
              </div>
            ) : questionDone ? (
              <div className="text-center py-8 space-y-3">
                <div className="text-5xl">✅</div>
                <p className="text-green-700 font-semibold">Intake complete. Thank you!</p>
                <p className="text-sm text-gray-500">Setting up your case…</p>
              </div>
            ) : question ? (
              <div className="space-y-4">
                <p className="text-base font-medium text-gray-800 leading-relaxed">
                  {question.text}
                </p>
                {question.original_text && question.original_text !== question.text && (
                  <p className="text-xs text-gray-400 italic">({question.original_text})</p>
                )}

                {question.type === 'yes_no' && (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleAnswer('yes')}
                      className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-medium text-sm hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAnswer('no')}
                      className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-medium text-sm hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      No
                    </button>
                  </div>
                )}

                {question.type === 'choice' && question.choices && (
                  <div className="space-y-2">
                    {question.choices.map((choice, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() =>
                          handleAnswer(
                            question.original_choices ? question.original_choices[i] : choice,
                          )
                        }
                        className="w-full text-left px-4 py-3 rounded-xl border-2 border-gray-200 text-sm text-gray-700 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                )}

                {question.type === 'short_answer' && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (shortAnswerText.trim()) handleAnswer(shortAnswerText.trim())
                    }}
                    className="space-y-3"
                  >
                    <input
                      type="text"
                      value={shortAnswerText}
                      onChange={(e) => setShortAnswerText(e.target.value)}
                      placeholder="Your answer…"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <button
                      type="submit"
                      disabled={!shortAnswerText.trim()}
                      className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      Next →
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                Preparing questions…
              </div>
            )}
          </div>
        )}

        {/* Step 4: Case ready */}
        {step === 4 && caseId && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6 text-center">
            <div className="space-y-2">
              <div className="text-6xl">✅</div>
              <h1 className="text-2xl font-bold text-gray-900">Your case is ready!</h1>
              <p className="text-sm text-gray-500">
                Case ID:{' '}
                <span className="font-mono font-medium text-gray-700">
                  {caseId.slice(0, 8)}…
                </span>
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-left space-y-3">
              <p className="text-sm font-semibold text-blue-900">
                Share this link with your {theirRole}:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={respondentShareUrl}
                  className="flex-1 bg-white border border-blue-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    copied
                      ? 'bg-green-600 text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
              </div>
              <p className="text-xs text-blue-700">
                They can answer their own intake questions and respond in their language.
              </p>
            </div>

            <Link
              href={`/cases/${caseId}?party=initiator`}
              className="block w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors text-center"
            >
              Go to my case →
            </Link>

            <Link href="/" className="block text-sm text-gray-400 hover:text-gray-600">
              ← Back to Medius home
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}

export default function StartPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-500">Loading…</p>
        </main>
      }
    >
      <StartPageInner />
    </Suspense>
  )
}
