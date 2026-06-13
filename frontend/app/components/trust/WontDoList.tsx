const WONT_DO_ITEMS = [
  "Won't predict who wins or loses",
  "Won't share your information with the other side without your approval",
  "Won't finalize any agreement without your signature",
  "Won't make legal decisions — a human always decides",
  "Won't score your credibility or judge your character",
]

export function WontDoList() {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-200 p-4" data-testid="wont-do-list">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">What we won&apos;t do</h3>
      <ul className="space-y-1">
        {WONT_DO_ITEMS.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
            <span className="mt-0.5 text-green-600 font-bold flex-shrink-0" aria-hidden="true">✓</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
