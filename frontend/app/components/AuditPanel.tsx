'use client'

interface AuditEntry {
  case_id: string
  actor: string
  action: string
  ai_suggestion: unknown
  human_decision: unknown
  timestamp: string
}

interface AuditPanelProps {
  entries: AuditEntry[]
  caseId: string
}

function EntryRow({ entry }: { entry: AuditEntry }) {
  return (
    <div
      className="border border-gray-200 rounded-md p-3 space-y-1 bg-white"
      data-testid="audit-entry"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-gray-500">{entry.timestamp}</span>
        <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
          {entry.actor}
        </span>
      </div>
      <p className="text-sm font-medium text-gray-800">{entry.action}</p>

      {entry.ai_suggestion !== null && entry.ai_suggestion !== undefined && (
        <div data-testid="audit-ai-suggestion">
          <span className="text-xs text-amber-700 font-medium">AI suggestion: </span>
          <span className="text-xs text-gray-600 font-mono">
            {typeof entry.ai_suggestion === 'string'
              ? entry.ai_suggestion
              : JSON.stringify(entry.ai_suggestion, null, 0)}
          </span>
        </div>
      )}

      {entry.human_decision !== null && entry.human_decision !== undefined && (
        <div data-testid="audit-human-decision">
          <span className="text-xs text-green-700 font-medium">Human decision: </span>
          <span className="text-xs text-gray-600 font-mono">
            {typeof entry.human_decision === 'string'
              ? entry.human_decision
              : JSON.stringify(entry.human_decision, null, 0)}
          </span>
        </div>
      )}

      <button
        type="button"
        className="text-xs text-red-600 hover:underline mt-1"
        data-testid="flag-for-review"
        onClick={() => alert(`Flagged "${entry.action}" for human review.`)}
      >
        Flag for human review
      </button>
    </div>
  )
}

export function AuditPanel({ entries, caseId }: AuditPanelProps) {
  function downloadAudit() {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-${caseId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3" data-testid="audit-panel">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Audit log</h3>
        <button
          type="button"
          onClick={downloadAudit}
          className="text-xs text-blue-600 hover:underline"
          data-testid="export-audit"
        >
          Export audit log
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-gray-400">No audit entries yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((e, i) => (
            <EntryRow key={i} entry={e} />
          ))}
        </div>
      )}
    </div>
  )
}
