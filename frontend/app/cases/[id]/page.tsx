'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { WtmfmCard } from '../../components/WtmfmCard'
import { ReadingLevelToggle } from '../../components/ReadingLevelToggle'
import { CitationList } from '../../components/CitationList'
import { AuditPanel } from '../../components/AuditPanel'
import { NegotiationThread } from '../../components/NegotiationThread'
import { SharedRealityRange } from '../../components/SharedRealityRange'
import { TalkToHuman } from '../../components/trust/TalkToHuman'
import { AiBadge } from '../../components/trust/AiBadge'

type TabId = 'tenant' | 'landlord' | 'neutral'

const TABS: { id: TabId; label: string }[] = [
  { id: 'tenant', label: 'Tenant' },
  { id: 'landlord', label: 'Landlord' },
  { id: 'neutral', label: 'Neutral (Mediator)' },
]

function PartyBriefingTab({ briefing, party }: { briefing: any; party: string }) {
  if (!briefing) {
    return (
      <p className="text-sm text-gray-500 py-4">
        No briefing yet for {party}. Complete intake and run /brief/{party} first.
      </p>
    )
  }
  return (
    <div className="space-y-5">
      <AiBadge />
      {briefing.what_this_means && <WtmfmCard data={briefing.what_this_means} />}
      <ReadingLevelToggle levels={briefing.levels} defaultLevel="simple" />
      <CitationList
        citations={briefing.citations}
        notConsidered={briefing.not_considered}
      />
    </div>
  )
}

function NeutralTab({ caseData }: { caseData: any }) {
  const steelman = caseData?.steelman
  const sharedReality = caseData?.shared_reality

  return (
    <div className="space-y-6">
      {/* Steelman side-by-side */}
      {steelman ? (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Strongest arguments (steelman)</h3>
          <div className="grid grid-cols-2 gap-4">
            {(['initiator', 'respondent'] as const).map((party) => {
              const arg = steelman[`${party}_argument`]
              if (!arg) return null
              return (
                <div key={party} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase">{party}</p>
                  <AiBadge />
                  <ReadingLevelToggle levels={arg.levels} defaultLevel="simple" />
                  <CitationList citations={arg.citations} />
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">No steelman yet — run /steelman first.</p>
      )}

      {/* Shared reality range */}
      {sharedReality && <SharedRealityRange data={sharedReality} />}

      {/* Common ground */}
      {caseData?.common_ground && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Common ground</h3>
          <p className="text-xs text-gray-500">Agreed: {caseData.common_ground.agreed?.join(', ') || 'none identified'}</p>
          <p className="text-xs text-gray-500">Disputed: {caseData.common_ground.disputed?.join(', ') || 'none identified'}</p>
        </div>
      )}
    </div>
  )
}

export default function CaseDetail() {
  const params = useParams()
  const caseId = params?.id as string

  const [tab, setTab] = useState<TabId>('tenant')
  const [caseData, setCaseData] = useState<any>(null)
  const [audit, setAudit] = useState<any[]>([])
  const [deliveredMsgs, setDeliveredMsgs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!caseId) return
    Promise.all([
      fetch(`/api/cases/${caseId}`).then((r) => r.json()),
      fetch(`/api/cases/${caseId}/audit`).then((r) => r.json()),
      fetch(`/api/cases/${caseId}/messages`).then((r) => r.json()),
    ])
      .then(([c, a, m]) => {
        setCaseData(c)
        setAudit(a)
        setDeliveredMsgs(m)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [caseId])

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading case…</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <Link href="/mediator" className="text-sm text-blue-600 hover:underline">
            ← Back to docket
          </Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">
            Case {caseId?.slice(0, 8)}…
          </h1>
        </div>
        <TalkToHuman />
      </header>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-selected={tab === t.id}
              role="tab"
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
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

      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Party tabs */}
        {(tab === 'tenant' || tab === 'landlord') && (
          <>
            <PartyBriefingTab
              briefing={
                tab === 'tenant'
                  ? caseData?.briefings?.initiator
                  : caseData?.briefings?.respondent
              }
              party={tab}
            />
            <NegotiationThread
              caseId={caseId}
              party={tab === 'tenant' ? 'initiator' : 'respondent'}
              deliveredMessages={deliveredMsgs}
              onApprove={(msg) => setDeliveredMsgs((prev) => [...prev, msg])}
            />
          </>
        )}

        {tab === 'neutral' && <NeutralTab caseData={caseData} />}

        {/* Audit panel always visible at bottom */}
        <div className="border-t border-gray-200 pt-6">
          <AuditPanel entries={audit} caseId={caseId} />
        </div>
      </div>
    </main>
  )
}
