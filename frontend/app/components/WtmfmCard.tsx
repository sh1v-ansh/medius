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
    <div className="rounded-2xl border border-slate-200 bg-slate-900 text-white overflow-hidden" data-testid="wtmfm-card">
      <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-2">
        <span className="text-lg">⚖️</span>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-300">What This Means For You</h2>
      </div>

      <div className="p-5 space-y-5">
        <section data-testid="wtmfm-what-law-says">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">What the law says</h3>
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{data.what_law_says}</p>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <section data-testid="wtmfm-what-i-can-do" className="bg-slate-800 rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-400 mb-3">Options to consider</h3>
            <ul className="space-y-2">
              {data.what_i_can_do.map((option, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="mt-0.5 text-emerald-400 font-bold flex-shrink-0">→</span>
                  {option}
                </li>
              ))}
            </ul>
          </section>

          <section data-testid="wtmfm-what-are-risks" className="bg-slate-800 rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-amber-400 mb-3">Risks to be aware of</h3>
            <ul className="space-y-2">
              {data.what_are_risks.map((risk, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="mt-0.5 text-amber-400 flex-shrink-0">⚠</span>
                  {risk}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <p className="text-xs text-slate-500 pt-1 border-t border-slate-700" data-testid="wtmfm-not-advice">
          <span className="font-semibold text-slate-400">Information only — not legal advice.</span>{' '}
          {data.disclaimer || 'Confirm next steps with a lawyer or licensed housing counselor.'}
        </p>
      </div>
    </div>
  )
}
