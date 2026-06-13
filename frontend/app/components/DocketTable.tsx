'use client'

import Link from 'next/link'

export interface TriageScores {
  urgency: number
  power_asymmetry: number
  violation_strength: number
  settlement_likelihood: number
}

export interface CaseRow {
  case_id: string
  type: string
  status: string
  created_at: string
  parties: {
    initiator: { role: string; has_counsel: boolean }
    respondent: { role: string; has_counsel: boolean }
  }
  triage: {
    composite: number
    scores: TriageScores
  } | null
}

const STATUS_STYLES: Record<string, string> = {
  intake: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  informed: 'bg-blue-100 text-blue-700 border-blue-200',
  negotiating: 'bg-violet-100 text-violet-700 border-violet-200',
  escalated: 'bg-red-100 text-red-700 border-red-200',
  settled: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

function UrgencyDot({ score }: { score: number }) {
  const level = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low'
  const cls = { high: 'bg-red-500', medium: 'bg-amber-400', low: 'bg-emerald-500' }[level]
  const label = { high: 'High', medium: 'Med', low: 'Low' }[level]
  return (
    <span className="inline-flex items-center gap-1.5" data-testid="urgency-badge">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cls}`} />
      <span className="text-xs text-slate-600 font-medium">{label}</span>
    </span>
  )
}

function CompositeBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value))
  const color = pct >= 70 ? 'bg-red-400' : pct >= 40 ? 'bg-amber-400' : 'bg-emerald-400'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-700 tabular-nums">{value}</span>
    </div>
  )
}

export function sortByComposite(cases: CaseRow[]): CaseRow[] {
  return [...cases].sort((a, b) => {
    const ca = a.triage?.composite ?? -1
    const cb = b.triage?.composite ?? -1
    return cb - ca
  })
}

export function DocketTable({ cases }: { cases: CaseRow[] }) {
  const sorted = sortByComposite(cases)

  if (sorted.length === 0) {
    return <p className="text-slate-500 text-sm py-8 text-center">No cases in the docket.</p>
  }

  return (
    <div className="overflow-x-auto" data-testid="docket-table">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            {['Case ID', 'Parties', 'Status', 'Priority', 'Urgency', 'Power', 'Violation', 'Settlement', ''].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((c) => {
            const scores = c.triage?.scores
            const statusCls = STATUS_STYLES[c.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'
            const hasAsymmetry = c.parties.initiator.has_counsel !== c.parties.respondent.has_counsel
            return (
              <tr key={c.case_id} className="hover:bg-blue-50/40 transition-colors group" data-testid={`docket-row-${c.case_id}`}>
                <td className="px-4 py-4">
                  <Link href={`/cases/${c.case_id}`} className="font-mono text-xs text-blue-600 hover:underline font-semibold">
                    {c.case_id.slice(0, 8)}…
                  </Link>
                  <p className="text-xs text-slate-400 mt-0.5">{new Date(c.created_at).toLocaleDateString()}</p>
                </td>
                <td className="px-4 py-4">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-slate-700 capitalize">{c.parties.initiator.role}</p>
                    <p className="text-xs text-slate-400">vs</p>
                    <p className="text-xs font-semibold text-slate-700 capitalize">{c.parties.respondent.role}</p>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${statusCls}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-4">
                  {c.triage ? (
                    <CompositeBar value={c.triage.composite} />
                  ) : (
                    <span className="text-slate-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-4">
                  {scores ? <UrgencyDot score={scores.urgency} /> : <span className="text-slate-300 text-xs">—</span>}
                </td>
                <td className="px-4 py-4 text-xs text-slate-600 font-mono">
                  {scores ? scores.power_asymmetry : '—'}
                </td>
                <td className="px-4 py-4 text-xs text-slate-600 font-mono">
                  {scores ? scores.violation_strength : '—'}
                </td>
                <td className="px-4 py-4 text-xs text-slate-600 font-mono">
                  {scores ? scores.settlement_likelihood : '—'}
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    {hasAsymmetry && (
                      <span title="Representation asymmetry" data-testid="asymmetry-flag" className="text-amber-500 text-sm">⚠️</span>
                    )}
                    <Link
                      href={`/cases/${c.case_id}?party=neutral`}
                      className="text-xs text-blue-600 hover:underline font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Open →
                    </Link>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
