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
  { value: 'simple', label: 'Simple', description: 'Plain language, 4th grade level' },
  { value: 'standard', label: 'Standard', description: '8th grade, with statute names' },
  { value: 'full', label: 'Full', description: 'Complete statute text and citations' },
]

export function ReadingLevelToggle({
  levels,
  defaultLevel = 'simple',
}: ReadingLevelToggleProps) {
  const [activeLevel, setActiveLevel] = useState<ReadingLevel>(defaultLevel)

  return (
    <div data-testid="reading-level-toggle">
      <div
        className="flex gap-1 mb-3 p-1 bg-gray-100 rounded-lg w-fit"
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
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeLevel === value
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap"
        data-testid={`level-content-${activeLevel}`}
        aria-live="polite"
      >
        {levels[activeLevel]}
      </div>
    </div>
  )
}
