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
      className="border border-gray-200 rounded-md overflow-hidden"
      data-testid={`citation-${citation.statute_id}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-left transition-colors"
        aria-expanded={expanded}
      >
        <span className="text-sm font-mono font-medium text-gray-700">{citation.statute_id}</span>
        <span className="text-gray-400 text-xs">{expanded ? '▲ hide' : '▼ show text'}</span>
      </button>
      {expanded && (
        <div className="px-3 py-2 bg-white" data-testid={`citation-text-${citation.statute_id}`}>
          <p className="text-sm text-gray-600 italic">{citation.statute_text}</p>
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
    <div className="space-y-2" data-testid="citation-list">
      <h3 className="text-sm font-medium text-gray-700">Cited statutes</h3>
      <ul className="space-y-1">
        {citations.map((c) => (
          <CitationItem key={c.statute_id} citation={c} />
        ))}
      </ul>
      {note && (
        <p className="text-xs text-gray-400 mt-2" data-testid="not-considered-note">
          <span className="font-medium">Scope:</span> {note}
        </p>
      )}
    </div>
  )
}
