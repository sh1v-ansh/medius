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

function UrgencyBadge({ score }: { score: number }) {
  const level = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low'
  const styles = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-green-100 text-green-700 border-green-200',
  }
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${styles[level]}`}
      data-testid="urgency-badge"
    >
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  )
}

function AsymmetryFlag({
  initiatorCounsel,
  respondentCounsel,
}: {
  initiatorCounsel: boolean
  respondentCounsel: boolean
}) {
  const isAsymmetric = initiatorCounsel !== respondentCounsel
  if (!isAsymmetric) return null
  return (
    <span
      title="One party has legal counsel, the other does not"
      data-testid="asymmetry-flag"
      aria-label="Representation asymmetry"
      className="text-amber-500"
    >
      ⚠️
    </span>
  )
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex flex-col items-center text-xs">
      <span className="text-gray-400">{label}</span>
      <span className="font-semibold text-gray-700">{value}</span>
    </span>
  )
}

/** Sort cases by triage composite score descending; cases without triage go last. */
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
    return (
      <p className="text-gray-500 text-sm py-8 text-center">No cases in the docket.</p>
    )
  }

  return (
    <div className="overflow-x-auto" data-testid="docket-table">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-4 py-3 text-gray-600 font-medium">Case</th>
            <th className="text-left px-4 py-3 text-gray-600 font-medium">Type</th>
            <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
            <th className="text-center px-4 py-3 text-gray-600 font-medium">Composite</th>
            <th className="text-center px-4 py-3 text-gray-600 font-medium">Urgency</th>
            <th className="text-center px-4 py-3 text-gray-600 font-medium">Power</th>
            <th className="text-center px-4 py-3 text-gray-600 font-medium">Violation</th>
            <th className="text-center px-4 py-3 text-gray-600 font-medium">Settlement</th>
            <th className="text-center px-4 py-3 text-gray-600 font-medium">Flags</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => {
            const scores = c.triage?.scores
            return (
              <tr
                key={c.case_id}
                className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
                data-testid={`docket-row-${c.case_id}`}
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/cases/${c.case_id}`}
                    className="text-blue-600 hover:underline font-mono text-xs"
                  >
                    {c.case_id.slice(0, 8)}…
                  </Link>
                </td>
                <td className="px-4 py-3 capitalize text-gray-700">{c.type}</td>
                <td className="px-4 py-3">
                  <span className="capitalize text-gray-600">{c.status}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  {c.triage ? (
                    <span className="font-bold text-gray-900">{c.triage.composite}</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {scores ? <UrgencyBadge score={scores.urgency} /> : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  {scores ? <ScorePill label="PA" value={scores.power_asymmetry} /> : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  {scores ? <ScorePill label="VS" value={scores.violation_strength} /> : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  {scores ? <ScorePill label="SL" value={scores.settlement_likelihood} /> : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <AsymmetryFlag
                    initiatorCounsel={c.parties.initiator.has_counsel}
                    respondentCounsel={c.parties.respondent.has_counsel}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
