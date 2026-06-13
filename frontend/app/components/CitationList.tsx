'use client'

import { useState } from 'react'

interface Citation {
  statute_id: string
  statute_text: string
  source?: string
}

function CitationItem({ citation }: { citation: Citation }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <li
      className="border border-slate-200 rounded-xl overflow-hidden"
      data-testid={`citation-${citation.statute_id}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-white hover:bg-slate-50 text-left transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
          <span className="text-sm font-mono font-semibold text-slate-700">{citation.statute_id}</span>
        </div>
        <span className="text-slate-400 text-xs">{expanded ? '▲' : '▼ read'}</span>
      </button>
      {expanded && (
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200" data-testid={`citation-text-${citation.statute_id}`}>
          <p className="text-sm text-slate-600 italic leading-relaxed">{citation.statute_text}</p>
        </div>
      )}
    </li>
  )
}

interface CitationListProps {
  citations: Citation[]
  notConsidered?: string | string[]
}

export function CitationList({ citations, notConsidered }: CitationListProps) {
  if (!citations || citations.length === 0) return null

  const note = Array.isArray(notConsidered)
    ? notConsidered.join(' • ')
    : notConsidered

  return (
    <div className="space-y-3" data-testid="citation-list">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Massachusetts Statutes Cited</span>
        <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-bold">{citations.length}</span>
      </div>
      <ul className="space-y-1.5">
        {citations.map((c) => (
          <CitationItem key={c.statute_id} citation={c} />
        ))}
      </ul>
      {note && (
        <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100" data-testid="not-considered-note">
          <span className="font-semibold text-slate-500">Scope: </span>{note}
        </p>
      )}
    </div>
  )
}
