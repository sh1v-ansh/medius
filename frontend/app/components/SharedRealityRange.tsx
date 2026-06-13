'use client'

import { useState } from 'react'

interface Citation {
  statute_id: string
  statute_text: string
  label?: string
  note?: string
}

interface SharedRealityData {
  floor: number
  typical_band: { low: number; high: number }
  ceiling: number
  citations: Citation[]
  anchor_note?: string
}

export function SharedRealityRange({ data }: { data: SharedRealityData }) {
  const [expanded, setExpanded] = useState(false)
  const { floor, typical_band, ceiling, citations } = data
  const range = ceiling - floor || 1
  const lowPct = Math.round(((typical_band.low - floor) / range) * 100)
  const highPct = Math.round(((typical_band.high - floor) / range) * 100)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="shared-reality-range">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-slate-900">Statutory Damage Range</h3>
        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Both parties see this</span>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Negotiation anchor based on Massachusetts law — not a settlement prediction.
      </p>

      {/* Range visualization */}
      <div className="space-y-2">
        <div className="relative h-10 bg-slate-100 rounded-xl overflow-hidden">
          {/* Typical band */}
          <div
            className="absolute top-0 h-full bg-blue-200 rounded-xl"
            style={{ left: `${lowPct}%`, width: `${Math.max(highPct - lowPct, 5)}%` }}
            title={`Typical: $${typical_band.low.toLocaleString()} – $${typical_band.high.toLocaleString()}`}
          />
          <div className="absolute inset-0 flex items-center justify-between px-3">
            <span className="text-xs font-semibold text-slate-600">${floor.toLocaleString()}</span>
            <span className="text-xs font-bold text-blue-700 bg-white/80 rounded px-1.5 py-0.5">
              ${typical_band.low.toLocaleString()} – ${typical_band.high.toLocaleString()} typical
            </span>
            <span className="text-xs font-semibold text-slate-600">${ceiling.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex justify-between text-xs text-slate-400">
          <span>Floor (statutory minimum)</span>
          <span>Ceiling (statutory maximum)</span>
        </div>
      </div>

      {/* Citations toggle */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="mt-4 text-xs text-blue-600 hover:underline flex items-center gap-1"
      >
        <span>{expanded ? '▲' : '▼'}</span>
        {expanded ? 'Hide' : 'Show'} cited statutes ({citations.length})
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {citations.map((c) => (
            <div key={c.statute_id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-xs font-mono font-semibold text-slate-700">{c.statute_id}{c.label ? ` — ${c.label}` : ''}</p>
              <p className="text-xs text-slate-500 italic mt-1">{c.statute_text}</p>
              {c.note && <p className="text-xs text-slate-400 mt-1">{c.note}</p>}
            </div>
          ))}
        </div>
      )}

      {data.anchor_note && (
        <p className="mt-3 text-xs text-slate-400 border-t border-slate-100 pt-3">{data.anchor_note}</p>
      )}
    </div>
  )
}
