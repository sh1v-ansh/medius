'use client'

import { useState } from 'react'

export type ReadingLevel = 'simple' | 'standard' | 'full'

interface Levels {
  simple: string
  standard: string
  full: string
}

interface ReadingLevelToggleProps {
  levels: Levels
  defaultLevel?: ReadingLevel
}

const LEVEL_LABELS: { value: ReadingLevel; label: string; description: string }[] = [
  { value: 'simple', label: 'Basic', description: 'Plain everyday language' },
  { value: 'standard', label: 'Intermediate', description: 'With statute names and context' },
  { value: 'full', label: 'Advanced', description: 'Complete statute text and citations' },
]

export function ReadingLevelToggle({
  levels,
  defaultLevel = 'simple',
}: ReadingLevelToggleProps) {
  const [activeLevel, setActiveLevel] = useState<ReadingLevel>(defaultLevel)

  return (
    <div data-testid="reading-level-toggle">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reading level</span>
        <div
          className="flex gap-0.5 p-0.5 bg-gray-100 rounded-lg"
          role="group"
          aria-label="Reading level"
        >
          {LEVEL_LABELS.map(({ value, label, description }) => (
            <button
              key={value}
              onClick={() => setActiveLevel(value)}
              aria-pressed={activeLevel === value}
              title={description}
              data-testid={`level-btn-${value}`}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeLevel === value
                  ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-100'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap"
        data-testid={`level-content-${activeLevel}`}
        aria-live="polite"
      >
        {levels[activeLevel]}
      </div>
    </div>
  )
}
