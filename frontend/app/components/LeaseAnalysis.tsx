'use client'

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

function SeverityBadge({ severity }: { severity: 'illegal' | 'concerning' }) {
  return severity === 'illegal' ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 border border-red-300">
      ⚠ Illegal clause
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
      ⚡ Concerning
    </span>
  )
}

function ScoreBar({ summary }: { summary: AnalysisResult['summary'] }) {
  const total = summary.red_flags + summary.yellow_flags + summary.missing_disclosures
  return (
    <div className="grid grid-cols-3 gap-3 text-center" data-testid="score-bar">
      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
        <p className="text-2xl font-bold text-red-700" data-testid="red-count">{summary.red_flags}</p>
        <p className="text-xs text-red-600 mt-1">Illegal clauses</p>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <p className="text-2xl font-bold text-amber-700" data-testid="yellow-count">{summary.yellow_flags}</p>
        <p className="text-xs text-amber-600 mt-1">Concerning terms</p>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-2xl font-bold text-blue-700" data-testid="missing-count">{summary.missing_disclosures}</p>
        <p className="text-xs text-blue-600 mt-1">Missing disclosures</p>
      </div>
    </div>
  )
}

export function LeaseAnalysis({ data }: LeaseAnalysisProps) {
  const redIssues = data.issues.filter((i) => i.severity === 'illegal')
  const yellowIssues = data.issues.filter((i) => i.severity === 'concerning')

  return (
    <div className="space-y-6" data-testid="lease-analysis">
      {data.demo_mode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800" data-testid="demo-banner">
          <strong>Demo mode:</strong> {data.demo_notice}
        </div>
      )}

      <ScoreBar summary={data.summary} />

      {/* Key terms */}
      {Object.keys(data.key_terms).length > 0 && (
        <section data-testid="key-terms">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Key terms extracted</h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(data.key_terms).map(([k, v]) => (
              <div key={k} className="bg-gray-50 rounded px-3 py-2 text-sm">
                <span className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}: </span>
                <span className="font-medium text-gray-800">{v}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Illegal clauses */}
      {redIssues.length > 0 && (
        <section data-testid="illegal-issues">
          <h3 className="text-sm font-semibold text-red-700 mb-3">
            🚨 Illegal clauses — void and unenforceable under Massachusetts law
          </h3>
          <div className="space-y-3">
            {redIssues.map((issue) => (
              <div key={issue.id} className="border border-red-200 rounded-lg p-4 bg-red-50" data-testid={`issue-${issue.id}`}>
                <div className="flex items-start gap-2 mb-2">
                  <SeverityBadge severity={issue.severity} />
                  <p className="text-sm font-semibold text-red-900">{issue.flag}</p>
                </div>
                <p className="text-sm text-gray-700 mb-2">{issue.plain}</p>
                <div className="bg-white border border-red-100 rounded p-3 space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase">What you can do</p>
                  <p className="text-sm text-gray-800">{issue.remedy}</p>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Statute: {issue.statute} — {issue.statute_title}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Concerning clauses */}
      {yellowIssues.length > 0 && (
        <section data-testid="concerning-issues">
          <h3 className="text-sm font-semibold text-amber-700 mb-3">
            ⚡ Concerning terms — legal but worth knowing
          </h3>
          <div className="space-y-3">
            {yellowIssues.map((issue) => (
              <div key={issue.id} className="border border-amber-200 rounded-lg p-4 bg-amber-50" data-testid={`issue-${issue.id}`}>
                <div className="flex items-start gap-2 mb-2">
                  <SeverityBadge severity={issue.severity} />
                  <p className="text-sm font-semibold text-amber-900">{issue.flag}</p>
                </div>
                <p className="text-sm text-gray-700 mb-2">{issue.plain}</p>
                <p className="text-xs text-gray-400">Statute: {issue.statute} — {issue.statute_title}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Missing disclosures */}
      {data.missing_disclosures.length > 0 && (
        <section data-testid="missing-disclosures">
          <h3 className="text-sm font-semibold text-blue-700 mb-3">
            📋 Required disclosures not found in this lease
          </h3>
          <div className="space-y-2">
            {data.missing_disclosures.map((d) => (
              <div key={d.id} className="border border-blue-200 rounded-lg p-3 bg-blue-50" data-testid={`disclosure-${d.id}`}>
                <p className="text-sm font-semibold text-blue-900">{d.name}</p>
                <p className="text-sm text-gray-700 mt-1">{d.plain}</p>
                <p className="text-xs text-gray-400 mt-1">Required by: {d.statute}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Disclaimer */}
      <div className="border border-gray-200 rounded p-3 text-xs text-gray-500 bg-gray-50" data-testid="disclaimer">
        <strong>Not legal advice.</strong> {data.not_considered}
      </div>
    </div>
  )
}
