export function AiBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200"
      aria-label="AI did not decide this"
    >
      <span aria-hidden="true">🤖</span>
      AI didn&apos;t decide this
    </span>
  )
}
