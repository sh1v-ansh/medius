'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createCase, submitNarrative } from '../lib/api'

type SttState = 'idle' | 'listening' | 'processing' | 'done'

const FAKE_STT_SAMPLES = [
  "I moved out on April 15th and it has now been over 60 days and I still have not received my $2,400 security deposit back. My landlord claims there was damage but never sent me an itemized list. I sent written notice asking for the deposit but got no response.",
  "My landlord has been ignoring my repair requests for two months. The heating system broke down in January and I sent a written notice on January 8th. It is now mid-March and nothing has been fixed. The temperature has dropped below safe levels multiple times.",
  "I received a verbal notice to leave from my landlord last Tuesday. He said I have two weeks to vacate but never provided anything in writing. My lease runs through September and I have always paid rent on time. I believe this is retaliation for reporting a code violation.",
  "My landlord raised my rent by $500 per month with only one week of written notice. My lease says rent can only increase with 30 days notice. I have been a tenant for three years with no late payments and no complaints against me.",
]

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

  const [myRole, setMyRole] = useState<PartyRole>(roleParam === 'respondent' ? 'landlord' : 'tenant')
  const [myLang, setMyLang] = useState('en')
  const [theirLang, setTheirLang] = useState('en')
  const [creatingCase, setCreatingCase] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [caseId, setCaseId] = useState<string | null>(null)

  // Step 3 — free-form narrative
  const [narrative, setNarrative] = useState('')
  const [submittingNarrative, setSubmittingNarrative] = useState(false)
  const [narrativeError, setNarrativeError] = useState<string | null>(null)
  const [sttState, setSttState] = useState<SttState>('idle')
  const sttTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Step 4
  const [copied, setCopied] = useState(false)

  const theirRole: PartyRole = myRole === 'tenant' ? 'landlord' : 'tenant'

  useEffect(() => () => { if (sttTimer.current) clearTimeout(sttTimer.current) }, [])

  async function handleCreateCase() {
    setCreatingCase(true)
    setCreateError(null)
    try {
      const data = await createCase(myRole, myLang, theirRole, theirLang)
      setCaseId(data.case_id)
      setStep(3)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create case. Please try again.')
    } finally {
      setCreatingCase(false)
    }
  }

  async function handleSubmitNarrative() {
    if (!caseId || !narrative.trim()) return
    setSubmittingNarrative(true)
    setNarrativeError(null)
    try {
      await submitNarrative(caseId, 'initiator', narrative.trim(), myLang)
      setStep(4)
    } catch (e) {
      setNarrativeError(e instanceof Error ? e.message : 'Failed to submit. Please try again.')
    } finally {
      setSubmittingNarrative(false)
    }
  }

  function handleMicClick() {
    if (sttState !== 'idle') return
    setSttState('listening')
    sttTimer.current = setTimeout(() => {
      setSttState('processing')
      setTimeout(() => {
        const sample = FAKE_STT_SAMPLES[Math.floor(Math.random() * FAKE_STT_SAMPLES.length)]
        setNarrative((prev) => prev ? prev + '\n\n' + sample : sample)
        setSttState('done')
        setTimeout(() => setSttState('idle'), 1500)
      }, 1200)
    }, 2800)
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
            {step === 3 && 'Your statement'}
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

        {/* Step 3: Free-form narrative */}
        {step === 3 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                Tell us your side of the story
              </h1>
              <p className="text-sm text-gray-500">
                Speak or type in your own words — as {myLang !== 'en' ? 'your language' : 'plain English'} as you like.
                The more detail you give, the better the AI analysis will be.
              </p>
            </div>

            {/* Prompts */}
            <div className="grid grid-cols-2 gap-2">
              {[
                '📅 When did this happen?',
                '💰 Dollar amounts involved?',
                '📝 Was anything in writing?',
                '🔔 Did you give or receive notice?',
              ].map((p) => (
                <div key={p} className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-600 border border-slate-100">
                  {p}
                </div>
              ))}
            </div>

            {/* STT + textarea */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleMicClick}
                  disabled={sttState !== 'idle' && sttState !== 'done'}
                  className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    sttState === 'listening' ? 'bg-red-500 text-white shadow-lg shadow-red-200' :
                    sttState === 'processing' ? 'bg-amber-500 text-white' :
                    sttState === 'done' ? 'bg-emerald-500 text-white' :
                    'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {sttState === 'listening' && (
                    <span className="absolute inset-0 rounded-xl animate-ping bg-red-400 opacity-40" />
                  )}
                  <span className="relative">
                    {sttState === 'idle' && '🎙'}
                    {sttState === 'listening' && '⏺'}
                    {sttState === 'processing' && '⏳'}
                    {sttState === 'done' && '✓'}
                  </span>
                  <span className="relative">
                    {sttState === 'idle' && 'Speak your story'}
                    {sttState === 'listening' && 'Listening…'}
                    {sttState === 'processing' && 'Transcribing…'}
                    {sttState === 'done' && 'Added!'}
                  </span>
                </button>
                <span className="text-xs text-slate-400">Works in 10+ languages</span>
              </div>

              <textarea
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                placeholder={`Describe what happened in your own words. For example:\n\n"I moved out on April 15th and it's been 60 days and my landlord hasn't returned my $2,400 security deposit. They claimed there was damage but never sent me an itemized list…"`}
                rows={9}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 leading-relaxed"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {narrative.trim().split(/\s+/).filter(Boolean).length} words
                  {narrative.trim().split(/\s+/).filter(Boolean).length < 30 && narrative.trim().length > 0
                    ? ' — more detail helps the AI' : ''}
                </span>
                <span className="text-xs text-slate-400">Your name and address are removed before analysis.</span>
              </div>
            </div>

            {narrativeError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {narrativeError}
              </div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(2)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-sm hover:bg-slate-50 transition-colors">
                ← Back
              </button>
              <button
                type="button"
                onClick={handleSubmitNarrative}
                disabled={narrative.trim().length < 20 || submittingNarrative}
                className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submittingNarrative ? (
                  <><Spinner /> Submitting…</>
                ) : (
                  'Submit my statement →'
                )}
              </button>
            </div>
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
                They can submit their own statement and respond in their language.
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
