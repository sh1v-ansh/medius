'use client'

interface WtmfmData {
  what_law_says: string
  what_i_can_do: string[]
  what_are_risks: string[]
  is_advice: boolean
  disclaimer?: string
}

export function WtmfmCard({ data }: { data: WtmfmData }) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 space-y-4" data-testid="wtmfm-card">
      <h2 className="text-base font-semibold text-blue-900">What This Means For Me</h2>

      <section data-testid="wtmfm-what-law-says">
        <h3 className="text-sm font-medium text-blue-800 mb-1">What the law says</h3>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.what_law_says}</p>
      </section>

      <section data-testid="wtmfm-what-i-can-do">
        <h3 className="text-sm font-medium text-blue-800 mb-1">What I can do</h3>
        <ul className="space-y-1">
          {data.what_i_can_do.map((option, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-0.5 text-blue-400 font-bold flex-shrink-0" aria-hidden="true">→</span>
              {option}
            </li>
          ))}
        </ul>
      </section>

      <section data-testid="wtmfm-what-are-risks">
        <h3 className="text-sm font-medium text-blue-800 mb-1">What are the risks</h3>
        <ul className="space-y-1">
          {data.what_are_risks.map((risk, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-0.5 text-amber-500 flex-shrink-0" aria-hidden="true">⚠</span>
              {risk}
            </li>
          ))}
        </ul>
      </section>

      <p
        className="text-xs text-gray-500 border-t border-blue-200 pt-3"
        data-testid="wtmfm-not-advice"
      >
        <span className="font-medium">This is information, not legal advice.</span>{' '}
        {data.disclaimer || 'Confirm next steps with a lawyer or licensed housing counselor.'}
      </p>
    </div>
  )
}
