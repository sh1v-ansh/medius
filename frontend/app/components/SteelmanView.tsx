'use client'

import { useState } from 'react'
import { ReadingLevelToggle } from './ReadingLevelToggle'
import { CitationList } from './CitationList'
import type { SteelmanArgument, Fallacy } from '../lib/api'

interface SteelmanViewProps {
  initiator: SteelmanArgument & { role?: string }
  respondent: SteelmanArgument & { role?: string }
  commonGround?: string[]
}

function FallacyBadge({ fallacy }: { fallacy: Fallacy }) {
  const [tooltip, setTooltip] = useState(false)
  const isNotable = fallacy.severity === 'notable'
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setTooltip(true)}
        onMouseLeave={() => setTooltip(false)}
        onFocus={() => setTooltip(true)}
        onBlur={() => setTooltip(false)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-help ${
          isNotable
            ? 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100'
            : 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100'
        }`}
      >
        <span>{isNotable ? '⚠' : '○'}</span>
        {fallacy.type}
      </button>
      {tooltip && (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-slate-900 text-white rounded-xl p-3 text-xs shadow-xl z-20">
          <p className="font-semibold mb-1">{fallacy.type}</p>
          <p className="text-slate-300 leading-relaxed">{fallacy.description}</p>
          <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-slate-900 rotate-45" />
        </div>
      )}
    </div>
  )
}

function StrengthMeter({ citations }: { citations: SteelmanArgument['citations'] }) {
  const score = Math.min(5, citations.length)
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-slate-500">Statutory support</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`w-2 h-2 rounded-full ${i <= score ? 'bg-blue-500' : 'bg-slate-200'}`}
          />
        ))}
      </div>
      <span className="text-xs text-slate-400">{citations.length} statute{citations.length !== 1 ? 's' : ''}</span>
    </div>
  )
}

function ArgumentPanel({
  arg,
  role,
  side,
}: {
  arg: SteelmanArgument
  role: string
  side: 'initiator' | 'respondent'
}) {
  const [showCitations, setShowCitations] = useState(false)
  const borderColor = side === 'initiator' ? 'border-blue-200' : 'border-violet-200'
  const headerColor = side === 'initiator' ? 'bg-blue-600' : 'bg-violet-600'
  const accentBg = side === 'initiator' ? 'bg-blue-50' : 'bg-violet-50'

  return (
    <div className={`rounded-2xl border ${borderColor} bg-white overflow-hidden shadow-sm flex flex-col`}>
      {/* Header */}
      <div className={`${headerColor} px-5 py-4`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-white/70">
              {side === 'initiator' ? 'Initiator' : 'Respondent'}
            </p>
            <p className="text-base font-bold text-white capitalize mt-0.5">{role}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">
            {side === 'initiator' ? '🏠' : '🔑'}
          </div>
        </div>
        <div className="mt-3">
          <StrengthMeter citations={arg.citations} />
        </div>
      </div>

      {/* Fallacy badges */}
      {arg.fallacies && arg.fallacies.length > 0 && (
        <div className={`px-5 py-3 border-b ${side === 'initiator' ? 'border-blue-100 bg-blue-50/50' : 'border-violet-100 bg-violet-50/50'}`}>
          <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Argument Analysis</p>
          <div className="flex flex-wrap gap-1.5">
            {arg.fallacies.map((f, i) => (
              <FallacyBadge key={i} fallacy={f} />
            ))}
          </div>
        </div>
      )}
      {arg.fallacies && arg.fallacies.length === 0 && (
        <div className={`px-5 py-2.5 border-b ${side === 'initiator' ? 'border-blue-100' : 'border-violet-100'} ${accentBg}`}>
          <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
            <span>✓</span> Argument appears well-grounded
          </p>
        </div>
      )}

      {/* Argument content */}
      <div className="p-5 flex-1">
        <ReadingLevelToggle levels={arg.levels} defaultLevel="simple" />
      </div>

      {/* Citations toggle */}
      <div className="px-5 pb-5">
        <button
          type="button"
          onClick={() => setShowCitations(v => !v)}
          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          <span>{showCitations ? '▲' : '▼'}</span>
          {showCitations ? 'Hide' : 'Show'} statutes ({arg.citations.length})
        </button>
        {showCitations && (
          <div className="mt-3">
            <CitationList citations={arg.citations} />
          </div>
        )}
      </div>
    </div>
  )
}

export function SteelmanView({ initiator, respondent, commonGround }: SteelmanViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-slate-900">Argument Analysis</h2>
        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
          AI steelmanned — strongest version of each position
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <ArgumentPanel
          arg={initiator}
          role={initiator.role ?? 'tenant'}
          side="initiator"
        />
        <ArgumentPanel
          arg={respondent}
          role={respondent.role ?? 'landlord'}
          side="respondent"
        />
      </div>

      {commonGround && commonGround.length > 0 && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5">
          <h3 className="text-sm font-bold text-emerald-900 mb-3 flex items-center gap-2">
            <span>🤝</span> Common Ground
          </h3>
          <ul className="space-y-2">
            {commonGround.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-emerald-800">
                <span className="text-emerald-500 font-bold flex-shrink-0 mt-0.5">✓</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-slate-400 text-center">
        Steelmanning presents the strongest version of each argument — this is not a prediction of who will win.
        Logical analysis is AI-assisted and may miss context.
      </p>
    </div>
  )
}
