'use client'

import { useState } from 'react'

interface KeyTerms {
  monthly_rent?: string
  security_deposit?: string
  lease_start?: string
  lease_end?: string
  late_fee?: string
  notice_period?: string
  pets?: string
}

interface Issue {
  id: string
  severity: 'illegal' | 'concerning'
  flag: string
  plain: string
  remedy: string
  statute: string
  statute_title: string
  statute_text: string
  matched_excerpt?: string
}

interface MissingDisclosure {
  id: string
  name: string
  statute: string
  statute_title: string
  plain: string
}

interface AnalysisResult {
  demo_mode?: boolean
  demo_notice?: string
  key_terms: KeyTerms
  issues: Issue[]
  missing_disclosures: MissingDisclosure[]
  summary: { red_flags: number; yellow_flags: number; missing_disclosures: number }
  not_considered: string
  is_advice: boolean
}

interface LeaseAnalysisProps {
  data: AnalysisResult
}

const KEY_TERM_LABELS: Record<string, string> = {
  monthly_rent: 'Monthly Rent',
  security_deposit: 'Security Deposit',
  lease_start: 'Start Date',
  lease_end: 'End Date',
  late_fee: 'Late Fee',
  notice_period: 'Notice Period',
  pets: 'Pet Policy',
}

function RiskMeter({ summary }: { summary: AnalysisResult['summary'] }) {
  const total = summary.red_flags + summary.yellow_flags + summary.missing_disclosures
  const score = total === 0 ? 0 : Math.min(100, summary.red_flags * 25 + summary.yellow_flags * 10 + summary.missing_disclosures * 8)

  const color =
    score >= 60 ? 'text-red-600' :
    score >= 30 ? 'text-amber-600' :
    'text-emerald-600'

  const label =
    score >= 60 ? 'High Risk' :
    score >= 30 ? 'Moderate Risk' :
    'Low Risk'

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm" data-testid="score-bar">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Lease Risk Assessment</h3>
        <span className={`text-sm font-bold ${color}`}>{label}</span>
      </div>

      {/* Risk bar */}
      <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mb-5">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            score >= 60 ? 'bg-red-500' : score >= 30 ? 'bg-amber-400' : 'bg-emerald-500'
          }`}
          style={{ width: `${Math.max(4, score)}%` }}
        />
      </div>

      {/* Breakdown cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center bg-red-50 border border-red-100 rounded-xl p-3">
          <p className="text-2xl font-bold text-red-600" data-testid="red-count">{summary.red_flags}</p>
          <p className="text-xs text-red-500 mt-1 font-medium">Illegal Clauses</p>
        </div>
        <div className="text-center bg-amber-50 border border-amber-100 rounded-xl p-3">
          <p className="text-2xl font-bold text-amber-600" data-testid="yellow-count">{summary.yellow_flags}</p>
          <p className="text-xs text-amber-500 mt-1 font-medium">Concerning Terms</p>
        </div>
        <div className="text-center bg-blue-50 border border-blue-100 rounded-xl p-3">
          <p className="text-2xl font-bold text-blue-600" data-testid="missing-count">{summary.missing_disclosures}</p>
          <p className="text-xs text-blue-500 mt-1 font-medium">Missing Disclosures</p>
        </div>
      </div>
    </div>
  )
}

function ClauseHighlight({ text }: { text: string }) {
  if (!text) return null
  return (
    <div className="my-2 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 border-b border-gray-200">
        <span className="text-xs font-mono text-gray-500">Clause excerpt from lease</span>
      </div>
      <blockquote className="px-4 py-3 text-sm font-mono text-gray-700 leading-relaxed italic border-l-4 border-gray-300 mx-3 my-2">
        "{text}"
      </blockquote>
    </div>
  )
}

function IssueCard({ issue }: { issue: Issue }) {
  const [expanded, setExpanded] = useState(false)
  const isIllegal = issue.severity === 'illegal'

  return (
    <div
      data-testid={`issue-${issue.id}`}
      className={`rounded-xl border overflow-hidden transition-shadow hover:shadow-md ${
        isIllegal
          ? 'border-red-200 bg-red-50'
          : 'border-amber-200 bg-amber-50'
      }`}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left px-5 py-4 flex items-start gap-3"
      >
        <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
          isIllegal ? 'bg-red-500 text-white' : 'bg-amber-400 text-white'
        }`}>
          {isIllegal ? '✕' : '!'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
              isIllegal
                ? 'bg-red-200 text-red-800'
                : 'bg-amber-200 text-amber-800'
            }`}>
              {isIllegal ? 'Void under MA law' : 'Concerning'}
            </span>
            <span className="text-xs text-gray-500 font-mono">{issue.statute}</span>
          </div>
          <p className={`text-sm font-semibold mt-1 ${isIllegal ? 'text-red-900' : 'text-amber-900'}`}>
            {issue.flag}
          </p>
        </div>
        <span className="text-gray-400 text-xs flex-shrink-0 mt-1">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Body */}
      {expanded && (
        <div className={`px-5 pb-5 space-y-3 border-t ${isIllegal ? 'border-red-200' : 'border-amber-200'}`}>
          <p className="text-sm text-gray-700 pt-3">{issue.plain}</p>

          {issue.matched_excerpt && (
            <ClauseHighlight text={issue.matched_excerpt} />
          )}

          {isIllegal && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                What you can do
              </p>
              <p className="text-sm text-gray-800">{issue.remedy}</p>
            </div>
          )}

          <details className="group">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 list-none flex items-center gap-1">
              <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
              View statute text ({issue.statute_title})
            </summary>
            <p className="mt-2 text-xs text-gray-500 italic leading-relaxed bg-white rounded p-3 border border-gray-200">
              {issue.statute_text}
            </p>
          </details>
        </div>
      )}
    </div>
  )
}

function DisclosureCard({ d }: { d: MissingDisclosure }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div
      data-testid={`disclosure-${d.id}`}
      className="rounded-xl border border-blue-200 bg-blue-50 overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left px-5 py-4 flex items-center gap-3"
      >
        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-400 text-white flex items-center justify-center text-xs font-bold">
          ?
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-blue-900">{d.name}</p>
          <p className="text-xs text-blue-600 mt-0.5 font-mono">{d.statute}</p>
        </div>
        <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="px-5 pb-4 pt-0 border-t border-blue-200 space-y-2">
          <p className="text-sm text-gray-700 pt-3">{d.plain}</p>
        </div>
      )}
    </div>
  )
}

export function LeaseAnalysis({ data }: LeaseAnalysisProps) {
  const [activeSection, setActiveSection] = useState<'all' | 'illegal' | 'concerning' | 'missing'>('all')
  const redIssues = data.issues.filter((i) => i.severity === 'illegal')
  const yellowIssues = data.issues.filter((i) => i.severity === 'concerning')

  const sections = [
    { key: 'all', label: 'All Issues', count: data.issues.length + data.missing_disclosures.length },
    { key: 'illegal', label: 'Illegal', count: redIssues.length, color: 'text-red-600' },
    { key: 'concerning', label: 'Concerning', count: yellowIssues.length, color: 'text-amber-600' },
    { key: 'missing', label: 'Missing', count: data.missing_disclosures.length, color: 'text-blue-600' },
  ] as const

  return (
    <div className="space-y-6" data-testid="lease-analysis">
      {data.demo_mode && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4" data-testid="demo-banner">
          <span className="text-blue-500 text-lg flex-shrink-0">ℹ</span>
          <div>
            <p className="text-sm font-medium text-blue-900">Demo Analysis</p>
            <p className="text-sm text-blue-700 mt-0.5">{data.demo_notice}</p>
          </div>
        </div>
      )}

      <RiskMeter summary={data.summary} />

      {/* Key terms */}
      {Object.keys(data.key_terms).length > 0 && (
        <div data-testid="key-terms" className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Key Terms Extracted</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(data.key_terms).map(([k, v]) => (
              <div key={k} className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                <p className="text-xs text-gray-500 font-medium">{KEY_TERM_LABELS[k] ?? k.replace(/_/g, ' ')}</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section filter tabs */}
      {(data.issues.length > 0 || data.missing_disclosures.length > 0) && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-200">
            {sections.map(s => (
              <button
                key={s.key}
                type="button"
                onClick={() => setActiveSection(s.key)}
                className={`flex-1 px-4 py-3 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                  activeSection === s.key
                    ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {s.label}
                {s.count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                    s.key === 'illegal' ? 'bg-red-100 text-red-600' :
                    s.key === 'concerning' ? 'bg-amber-100 text-amber-600' :
                    s.key === 'missing' ? 'bg-blue-100 text-blue-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {s.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-5 space-y-4">
            {/* Illegal clauses */}
            {(activeSection === 'all' || activeSection === 'illegal') && redIssues.length > 0 && (
              <section data-testid="illegal-issues">
                {activeSection === 'all' && (
                  <h4 className="text-xs font-bold uppercase tracking-wide text-red-600 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                    Illegal Clauses — Void Under Massachusetts Law
                  </h4>
                )}
                <div className="space-y-3">
                  {redIssues.map(issue => <IssueCard key={issue.id} issue={issue} />)}
                </div>
              </section>
            )}

            {/* Concerning clauses */}
            {(activeSection === 'all' || activeSection === 'concerning') && yellowIssues.length > 0 && (
              <section data-testid="concerning-issues">
                {activeSection === 'all' && (
                  <h4 className="text-xs font-bold uppercase tracking-wide text-amber-600 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    Concerning Terms — Legal but Worth Knowing
                  </h4>
                )}
                <div className="space-y-3">
                  {yellowIssues.map(issue => <IssueCard key={issue.id} issue={issue} />)}
                </div>
              </section>
            )}

            {/* Missing disclosures */}
            {(activeSection === 'all' || activeSection === 'missing') && data.missing_disclosures.length > 0 && (
              <section data-testid="missing-disclosures">
                {activeSection === 'all' && (
                  <h4 className="text-xs font-bold uppercase tracking-wide text-blue-600 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                    Required Disclosures Not Found
                  </h4>
                )}
                <div className="space-y-3">
                  {data.missing_disclosures.map(d => <DisclosureCard key={d.id} d={d} />)}
                </div>
              </section>
            )}

            {data.issues.length === 0 && data.missing_disclosures.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <p className="text-4xl mb-2">✓</p>
                <p className="text-sm font-medium">No issues detected in this section.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-xs text-gray-500" data-testid="disclaimer">
        <span className="font-semibold text-gray-700">Not legal advice.</span>{' '}
        {data.not_considered}
      </div>
    </div>
  )
}
