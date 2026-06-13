'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { WtmfmCard } from '../../components/WtmfmCard'
import { ReadingLevelToggle } from '../../components/ReadingLevelToggle'
import { CitationList } from '../../components/CitationList'
import { AuditPanel } from '../../components/AuditPanel'
import { NegotiationThread } from '../../components/NegotiationThread'
import { SharedRealityRange } from '../../components/SharedRealityRange'
import { TalkToHuman } from '../../components/trust/TalkToHuman'
import { AiBadge } from '../../components/trust/AiBadge'
import { LeaseAnalysis } from '../../components/LeaseAnalysis'
import {
  getCase,
  getAudit,
  getMessages,
  getBriefing,
  getSteelman,
  getSharedReality,
  getCommonGround,
  escalate,
  settlementDraft,
  analyzeLeaseEndpoint,
  type CaseData,
  type AuditEntry,
  type Message,
  type BriefingResult,
  type SteelmanResult,
  type SharedRealityResult,
  type CommonGroundResult,
  type EscalationResult,
  type SettlementResult,
  type LeaseAnalysisResult,
} from '../../lib/api'

type TabId = 'briefing' | 'negotiate' | 'lease' | 'full'
type PartyParam = 'initiator' | 'respondent' | 'neutral'

const STATUS_COLORS: Record<string, string> = {
  intake: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  informed: 'bg-blue-100 text-blue-700 border-blue-200',
  negotiating: 'bg-purple-100 text-purple-700 border-purple-200',
  escalated: 'bg-red-100 text-red-700 border-red-200',
  settled: 'bg-green-100 text-green-700 border-green-200',
}

function Spinner({ small }: { small?: boolean }) {
  return (
    <svg
      className={`animate-spin ${small ? 'h-4 w-4' : 'h-5 w-5'} text-blue-600`}
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

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700 border-gray-200'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${cls}`}>
      {status}
    </span>
  )
}

function ActionButton({
  onClick,
  loading,
  disabled,
  children,
  variant = 'primary',
}: {
  onClick: () => void
  loading?: boolean
  disabled?: boolean
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'danger'
}) {
  const base =
    'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50'
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]}`}
    >
      {loading && <Spinner small />}
      {children}
    </button>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
      {message}
    </div>
  )
}

function BriefingTab({
  caseId,
  party,
  briefing,
  onBriefingLoaded,
}: {
  caseId: string
  party: string
  briefing: BriefingResult | undefined
  onBriefingLoaded: (result: BriefingResult) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const result = await getBriefing(caseId, party)
      onBriefingLoaded(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate briefing.')
    } finally {
      setLoading(false)
    }
  }

  if (!briefing) {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center space-y-4">
          <div className="text-4xl">⚖️</div>
          <div>
            <h3 className="font-semibold text-blue-900 text-lg">Get your legal briefing</h3>
            <p className="text-sm text-blue-700 mt-1">
              We&apos;ll explain your rights in plain language with real Massachusetts statute citations.
            </p>
          </div>
          {error && <ErrorBox message={error} />}
          <ActionButton onClick={handleGenerate} loading={loading}>
            {loading ? 'Generating…' : 'Generate my legal briefing'}
          </ActionButton>
        </div>
        <p className="text-xs text-gray-400 text-center">
          This is information, not legal advice. A human mediator reviews all case decisions.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <AiBadge />
      {briefing.what_this_means && <WtmfmCard data={briefing.what_this_means} />}
      <ReadingLevelToggle levels={briefing.levels} defaultLevel="simple" />
      <CitationList citations={briefing.citations} notConsidered={briefing.not_considered} />
    </div>
  )
}

function NegotiateTab({
  caseId,
  party,
  deliveredMessages,
  onApprove,
  sharedReality,
  onSharedRealityLoaded,
}: {
  caseId: string
  party: 'initiator' | 'respondent'
  deliveredMessages: Message[]
  onApprove: (msg: Message) => void
  sharedReality: SharedRealityResult | undefined
  onSharedRealityLoaded: (result: SharedRealityResult) => void
}) {
  const [srLoading, setSrLoading] = useState(false)
  const [srError, setSrError] = useState<string | null>(null)

  async function handleCalcRange() {
    setSrLoading(true)
    setSrError(null)
    try {
      const result = await getSharedReality(caseId)
      onSharedRealityLoaded(result)
    } catch (e) {
      setSrError(e instanceof Error ? e.message : 'Failed to calculate range.')
    } finally {
      setSrLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Shared reality range */}
      {sharedReality ? (
        <SharedRealityRange data={sharedReality} />
      ) : (
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-700">Damage range (shared view)</p>
            <p className="text-xs text-gray-500 mt-0.5">
              A negotiation anchor both parties see — not a prediction.
            </p>
          </div>
          {srError && <ErrorBox message={srError} />}
          <ActionButton onClick={handleCalcRange} loading={srLoading} variant="secondary">
            {srLoading ? 'Calculating…' : 'Calculate damage range'}
          </ActionButton>
        </div>
      )}

      {/* Negotiation thread */}
      <div className="shadow-sm border border-gray-200 rounded-xl p-5 bg-white">
        <NegotiationThread
          caseId={caseId}
          party={party}
          deliveredMessages={deliveredMessages}
          onApprove={onApprove}
        />
      </div>
    </div>
  )
}

function LeaseTab({
  caseId,
  leaseAnalysis,
  onLeaseLoaded,
}: {
  caseId: string
  leaseAnalysis: LeaseAnalysisResult | undefined
  onLeaseLoaded: (result: LeaseAnalysisResult) => void
}) {
  const [uploadLoading, setUploadLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDemoLease() {
    setDemoLoading(true)
    setError(null)
    try {
      const result = await analyzeLeaseEndpoint(caseId)
      onLeaseLoaded(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to analyse lease.')
    } finally {
      setDemoLoading(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadLoading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const uploadRes = await fetch(`/api/cases/${caseId}/intake/upload-doc`, {
        method: 'POST',
        body: form,
      })
      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.statusText}`)
      const result = await analyzeLeaseEndpoint(caseId)
      onLeaseLoaded(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to upload and analyse lease.')
    } finally {
      setUploadLoading(false)
    }
  }

  if (leaseAnalysis) {
    return <LeaseAnalysis data={leaseAnalysis} />
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Upload option */}
        <label
          className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
            uploadLoading
              ? 'border-blue-300 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
          }`}
        >
          {uploadLoading ? (
            <Spinner />
          ) : (
            <span className="text-3xl">📄</span>
          )}
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-800">Upload lease photo</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {uploadLoading ? 'Uploading and analysing…' : 'JPG, PNG, or PDF'}
            </p>
          </div>
          <input
            type="file"
            accept="image/*,.pdf"
            className="sr-only"
            onChange={handleFileUpload}
            disabled={uploadLoading || demoLoading}
          />
        </label>

        {/* Demo option */}
        <button
          type="button"
          onClick={handleDemoLease}
          disabled={demoLoading || uploadLoading}
          className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50 text-center"
        >
          {demoLoading ? <Spinner /> : <span className="text-3xl">🔍</span>}
          <div>
            <p className="text-sm font-semibold text-gray-800">Use demo lease (sample)</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {demoLoading ? 'Analysing…' : 'Try with a sample Massachusetts lease'}
            </p>
          </div>
        </button>
      </div>

      {error && <ErrorBox message={error} />}

      <p className="text-xs text-gray-400 text-center">
        We remove your personal details before analysis. Not legal advice.
      </p>
    </div>
  )
}

function FullCaseTab({
  caseId,
  caseData,
  steelman,
  sharedReality,
  commonGround,
  audit,
  onSteelmanLoaded,
  onSharedRealityLoaded,
  onCommonGroundLoaded,
  onEscalated,
}: {
  caseId: string
  caseData: CaseData | null
  steelman: SteelmanResult | undefined
  sharedReality: SharedRealityResult | undefined
  commonGround: CommonGroundResult | undefined
  audit: AuditEntry[]
  onSteelmanLoaded: (r: SteelmanResult) => void
  onSharedRealityLoaded: (r: SharedRealityResult) => void
  onCommonGroundLoaded: (r: CommonGroundResult) => void
  onEscalated: (r: EscalationResult) => void
}) {
  const [steelmanLoading, setSteelmanLoading] = useState(false)
  const [steelmanError, setSteelmanError] = useState<string | null>(null)
  const [srLoading, setSrLoading] = useState(false)
  const [srError, setSrError] = useState<string | null>(null)
  const [cgLoading, setCgLoading] = useState(false)
  const [cgError, setCgError] = useState<string | null>(null)
  const [escLoading, setEscLoading] = useState(false)
  const [escError, setEscError] = useState<string | null>(null)
  const [settlementLoading, setSettlementLoading] = useState(false)
  const [settlementError, setSettlementError] = useState<string | null>(null)
  const [settlement, setSettlement] = useState<SettlementResult | null>(
    caseData?.settlement ?? null,
  )
  const [agreedTermsInput, setAgreedTermsInput] = useState('')

  const isEscalated = caseData?.status === 'escalated'

  async function handleSteelman() {
    setSteelmanLoading(true)
    setSteelmanError(null)
    try {
      const r = await getSteelman(caseId)
      onSteelmanLoaded(r)
    } catch (e) {
      setSteelmanError(e instanceof Error ? e.message : 'Failed to generate steelman.')
    } finally {
      setSteelmanLoading(false)
    }
  }

  async function handleSharedReality() {
    setSrLoading(true)
    setSrError(null)
    try {
      const r = await getSharedReality(caseId)
      onSharedRealityLoaded(r)
    } catch (e) {
      setSrError(e instanceof Error ? e.message : 'Failed to calculate range.')
    } finally {
      setSrLoading(false)
    }
  }

  async function handleCommonGround() {
    setCgLoading(true)
    setCgError(null)
    try {
      const r = await getCommonGround(caseId)
      onCommonGroundLoaded(r)
    } catch (e) {
      setCgError(e instanceof Error ? e.message : 'Failed to find common ground.')
    } finally {
      setCgLoading(false)
    }
  }

  async function handleEscalate() {
    setEscLoading(true)
    setEscError(null)
    try {
      const r = await escalate(caseId)
      onEscalated(r)
    } catch (e) {
      setEscError(e instanceof Error ? e.message : 'Failed to escalate.')
    } finally {
      setEscLoading(false)
    }
  }

  async function handleSettlement() {
    setSettlementLoading(true)
    setSettlementError(null)
    try {
      const terms = agreedTermsInput
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean)
      const r = await settlementDraft(caseId, terms, true)
      setSettlement(r)
    } catch (e) {
      setSettlementError(e instanceof Error ? e.message : 'Failed to draft settlement.')
    } finally {
      setSettlementLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Steelman arguments */}
      <section className="shadow-sm border border-gray-200 rounded-xl p-5 bg-white space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Strongest arguments (steelman)</h3>
          {!steelman && (
            <ActionButton onClick={handleSteelman} loading={steelmanLoading} variant="secondary">
              {steelmanLoading ? 'Generating…' : 'Generate steelman arguments'}
            </ActionButton>
          )}
        </div>
        {steelmanError && <ErrorBox message={steelmanError} />}
        {steelman ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(['initiator', 'respondent'] as const).map((p) => {
              const arg = steelman[`${p}_argument`]
              if (!arg) return null
              return (
                <div key={p} className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{p}</p>
                  <AiBadge />
                  <ReadingLevelToggle levels={arg.levels} defaultLevel="simple" />
                  <CitationList citations={arg.citations} />
                </div>
              )
            })}
          </div>
        ) : (
          !steelmanLoading && (
            <p className="text-sm text-gray-400">
              Generate the steelman arguments to see the strongest case for each side.
            </p>
          )
        )}
      </section>

      {/* Shared reality range */}
      <section className="shadow-sm border border-gray-200 rounded-xl p-5 bg-white space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Damage range (shared view)</h3>
          {!sharedReality && (
            <ActionButton onClick={handleSharedReality} loading={srLoading} variant="secondary">
              {srLoading ? 'Calculating…' : 'Calculate damage range'}
            </ActionButton>
          )}
        </div>
        {srError && <ErrorBox message={srError} />}
        {sharedReality ? (
          <SharedRealityRange data={sharedReality} />
        ) : (
          !srLoading && (
            <p className="text-sm text-gray-400">
              Calculate the statutory range to give both parties a shared anchor.
            </p>
          )
        )}
      </section>

      {/* Common ground */}
      <section className="shadow-sm border border-gray-200 rounded-xl p-5 bg-white space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Common ground</h3>
          {!commonGround && (
            <ActionButton onClick={handleCommonGround} loading={cgLoading} variant="secondary">
              {cgLoading ? 'Analysing…' : 'Find common ground'}
            </ActionButton>
          )}
        </div>
        {cgError && <ErrorBox message={cgError} />}
        {commonGround ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-green-700 uppercase mb-2">Agreed</p>
              {commonGround.agreed.length > 0 ? (
                <ul className="space-y-1">
                  {commonGround.agreed.map((item, i) => (
                    <li key={i} className="text-sm text-gray-700 flex gap-2">
                      <span className="text-green-500">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">None identified</p>
              )}
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-red-700 uppercase mb-2">Disputed</p>
              {commonGround.disputed.length > 0 ? (
                <ul className="space-y-1">
                  {commonGround.disputed.map((item, i) => (
                    <li key={i} className="text-sm text-gray-700 flex gap-2">
                      <span className="text-red-400">✗</span>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">None identified</p>
              )}
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-blue-700 uppercase mb-2">Suggestions</p>
              {commonGround.suggestions.length > 0 ? (
                <ul className="space-y-1">
                  {commonGround.suggestions.map((item, i) => (
                    <li key={i} className="text-sm text-gray-700 flex gap-2">
                      <span className="text-blue-400">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">None identified</p>
              )}
            </div>
          </div>
        ) : (
          !cgLoading && (
            <p className="text-sm text-gray-400">
              Find common ground to identify agreed points and suggest a path forward.
            </p>
          )
        )}
      </section>

      {/* Settlement draft */}
      <section className="shadow-sm border border-gray-200 rounded-xl p-5 bg-white space-y-4">
        <h3 className="font-semibold text-gray-800">Settlement draft</h3>
        {settlement ? (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-green-700 uppercase mb-2">
                Draft settlement text
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{settlement.draft_text}</p>
            </div>
            {settlement.human_approved && (
              <p className="text-xs text-green-600 font-medium">✓ Human approved</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label
                htmlFor="agreed-terms"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Agreed terms (one per line)
              </label>
              <textarea
                id="agreed-terms"
                rows={4}
                value={agreedTermsInput}
                onChange={(e) => setAgreedTermsInput(e.target.value)}
                placeholder="e.g. Landlord returns deposit within 14 days&#10;Tenant vacates by end of month"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            {settlementError && <ErrorBox message={settlementError} />}
            <ActionButton
              onClick={handleSettlement}
              loading={settlementLoading}
              disabled={!agreedTermsInput.trim()}
            >
              {settlementLoading ? 'Drafting…' : 'Draft settlement'}
            </ActionButton>
          </div>
        )}
      </section>

      {/* Escalation */}
      {!isEscalated && (
        <section className="shadow-sm border border-gray-200 rounded-xl p-5 bg-white space-y-4">
          <h3 className="font-semibold text-gray-800">Escalate to human mediator</h3>
          <p className="text-sm text-gray-600">
            If this dispute cannot be resolved through negotiation, escalate to a licensed human
            mediator.
          </p>
          {escError && <ErrorBox message={escError} />}
          <ActionButton onClick={handleEscalate} loading={escLoading} variant="danger">
            {escLoading ? 'Escalating…' : 'Escalate to human mediator'}
          </ActionButton>
        </section>
      )}

      {isEscalated && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <p className="text-red-700 font-semibold">⚠ This case has been escalated.</p>
          <p className="text-sm text-red-600 mt-1">
            A licensed human mediator will be in touch shortly.
          </p>
        </div>
      )}

      {/* Audit log */}
      <section className="shadow-sm border border-gray-200 rounded-xl p-5 bg-white">
        <AuditPanel entries={audit} caseId={caseId} />
      </section>
    </div>
  )
}

function CaseDetailInner() {
  const params = useParams()
  const searchParams = useSearchParams()
  const caseId = params?.id as string
  const partyParam = (searchParams.get('party') ?? 'initiator') as PartyParam

  const [tab, setTab] = useState<TabId>('briefing')
  const [caseData, setCaseData] = useState<CaseData | null>(null)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [deliveredMsgs, setDeliveredMsgs] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Derived state stored locally for mutability
  const [briefing, setBriefing] = useState<BriefingResult | undefined>(undefined)
  const [steelman, setSteelman] = useState<SteelmanResult | undefined>(undefined)
  const [sharedReality, setSharedReality] = useState<SharedRealityResult | undefined>(undefined)
  const [commonGround, setCommonGround] = useState<CommonGroundResult | undefined>(undefined)
  const [leaseAnalysis, setLeaseAnalysis] = useState<LeaseAnalysisResult | undefined>(undefined)

  const party: 'initiator' | 'respondent' =
    partyParam === 'respondent' ? 'respondent' : 'initiator'

  const partyLabel =
    partyParam === 'neutral'
      ? 'Mediator'
      : party === 'initiator'
      ? caseData?.parties.initiator.role ?? 'Initiator'
      : caseData?.parties.respondent.role ?? 'Respondent'

  useEffect(() => {
    if (!caseId) return
    setLoading(true)
    Promise.all([
      getCase(caseId),
      getAudit(caseId),
      getMessages(caseId),
    ])
      .then(([c, a, m]) => {
        setCaseData(c)
        setAudit(a)
        setDeliveredMsgs(m)
        // Populate from fetched case data
        if (party === 'initiator') {
          setBriefing(c.briefings?.initiator)
        } else {
          setBriefing(c.briefings?.respondent)
        }
        setSteelman(c.steelman)
        setSharedReality(c.shared_reality)
        setCommonGround(c.common_ground)
        setLeaseAnalysis(c.lease_analysis)
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Failed to load case.'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId])

  // When party changes, update briefing from already-loaded caseData
  useEffect(() => {
    if (!caseData) return
    if (party === 'initiator') {
      setBriefing(caseData.briefings?.initiator)
    } else {
      setBriefing(caseData.briefings?.respondent)
    }
  }, [party, caseData])

  const TABS: { id: TabId; label: string; hidden?: boolean }[] = [
    { id: 'briefing', label: 'My Briefing', hidden: partyParam === 'neutral' },
    { id: 'negotiate', label: 'Negotiate', hidden: partyParam === 'neutral' },
    { id: 'lease', label: '📋 Lease Analysis' },
    { id: 'full', label: 'Full Case' },
  ]

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <Spinner />
          <span>Loading case…</span>
        </div>
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="max-w-md w-full space-y-4 text-center">
          <p className="text-red-600 font-medium">Could not load case</p>
          <ErrorBox message={loadError} />
          <Link href="/mediator" className="text-sm text-blue-600 hover:underline">
            ← Back to docket
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <Link
              href="/mediator"
              className="text-sm text-blue-600 hover:underline inline-block"
            >
              ← Back to docket
            </Link>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 font-mono">
                {caseId?.slice(0, 8)}…
              </h1>
              {caseData?.status && <StatusBadge status={caseData.status} />}
              <span className="text-sm text-gray-500">
                You are:{' '}
                <span className="font-medium text-gray-700 capitalize">{partyLabel}</span>
              </span>
            </div>
          </div>
          <TalkToHuman />
        </div>
      </header>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 sticky top-14 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-0 overflow-x-auto">
            {TABS.filter((t) => !t.hidden).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-selected={tab === t.id}
                role="tab"
                className={`px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  tab === t.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {tab === 'briefing' && partyParam !== 'neutral' && (
          <BriefingTab
            caseId={caseId}
            party={party}
            briefing={briefing}
            onBriefingLoaded={(result) => {
              setBriefing(result)
              setCaseData((prev) =>
                prev
                  ? {
                      ...prev,
                      briefings: {
                        ...prev.briefings,
                        [party]: result,
                      },
                    }
                  : prev,
              )
            }}
          />
        )}

        {tab === 'negotiate' && partyParam !== 'neutral' && (
          <NegotiateTab
            caseId={caseId}
            party={party}
            deliveredMessages={deliveredMsgs}
            onApprove={(msg) => setDeliveredMsgs((prev) => [...prev, msg])}
            sharedReality={sharedReality}
            onSharedRealityLoaded={(r) => {
              setSharedReality(r)
              setCaseData((prev) => (prev ? { ...prev, shared_reality: r } : prev))
            }}
          />
        )}

        {tab === 'lease' && (
          <LeaseTab
            caseId={caseId}
            leaseAnalysis={leaseAnalysis}
            onLeaseLoaded={(r) => {
              setLeaseAnalysis(r)
              setCaseData((prev) => (prev ? { ...prev, lease_analysis: r } : prev))
            }}
          />
        )}

        {tab === 'full' && (
          <FullCaseTab
            caseId={caseId}
            caseData={caseData}
            steelman={steelman}
            sharedReality={sharedReality}
            commonGround={commonGround}
            audit={audit}
            onSteelmanLoaded={(r) => {
              setSteelman(r)
              setCaseData((prev) => (prev ? { ...prev, steelman: r } : prev))
            }}
            onSharedRealityLoaded={(r) => {
              setSharedReality(r)
              setCaseData((prev) => (prev ? { ...prev, shared_reality: r } : prev))
            }}
            onCommonGroundLoaded={(r) => {
              setCommonGround(r)
              setCaseData((prev) => (prev ? { ...prev, common_ground: r } : prev))
            }}
            onEscalated={() => {
              setCaseData((prev) => (prev ? { ...prev, status: 'escalated' } : prev))
            }}
          />
        )}
      </div>
    </main>
  )
}

export default function CaseDetail() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-500">Loading…</p>
        </main>
      }
    >
      <CaseDetailInner />
    </Suspense>
  )
}
