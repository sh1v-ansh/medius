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
  const [hoveredCit, setHoveredCit] = useState<string | null>(null)

  const { floor, typical_band, ceiling, citations } = data
  const range = ceiling - floor || 1
  const lowPct = Math.round(((typical_band.low - floor) / range) * 100)
  const highPct = Math.round(((typical_band.high - floor) / range) * 100)

  return (
    <div className="rounded-lg border border-gray-200 p-4 space-y-4" data-testid="shared-reality-range">
      <h3 className="text-sm font-semibold text-gray-700">Statutory range</h3>
      <p className="text-xs text-gray-500">
        Both parties see this same range — it is a negotiation anchor, not a prediction.
      </p>

      {/* Bar */}
      <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="absolute top-0 h-full bg-blue-200 rounded-full"
          style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }}
          title={`Typical band: $${typical_band.low} – $${typical_band.high}`}
        />
        <div className="absolute inset-0 flex items-center justify-between px-3">
          <span className="text-xs font-medium text-gray-600">${floor}</span>
          <span className="text-xs font-medium text-blue-700">
            ${typical_band.low} – ${typical_band.high} typical
          </span>
          <span className="text-xs font-medium text-gray-600">${ceiling}</span>
        </div>
      </div>

      {/* Citations with hover */}
      <div className="space-y-1">
        <p className="text-xs text-gray-500 font-medium">Based on:</p>
        {citations.map((c) => (
          <div key={c.statute_id} className="relative">
            <button
              type="button"
              onMouseEnter={() => setHoveredCit(c.statute_id)}
              onMouseLeave={() => setHoveredCit(null)}
              onFocus={() => setHoveredCit(c.statute_id)}
              onBlur={() => setHoveredCit(null)}
              className="text-xs text-blue-600 hover:underline"
              data-testid={`range-citation-${c.statute_id}`}
            >
              {c.statute_id}{c.label ? ` — ${c.label}` : ''}
            </button>
            {hoveredCit === c.statute_id && (
              <div
                className="absolute z-10 left-0 mt-1 w-80 bg-white border border-gray-300 rounded-lg shadow-lg p-3 text-xs text-gray-700"
                data-testid={`range-citation-tooltip-${c.statute_id}`}
              >
                <p className="font-medium mb-1">{c.statute_id}</p>
                <p className="italic text-gray-600">{c.statute_text}</p>
                {c.note && <p className="mt-1 text-gray-500">{c.note}</p>}
              </div>
            )}
          </div>
        ))}
      </div>

      {data.anchor_note && (
        <p className="text-xs text-gray-400">{data.anchor_note}</p>
      )}
    </div>
  )
}
