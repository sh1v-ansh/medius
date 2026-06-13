'use client'

export function TalkToHuman() {
  return (
    <button
      type="button"
      data-testid="talk-to-human"
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
      onClick={() => {
        // In production, this would open a chat or contact form
        alert('A mediator will be in touch shortly.')
      }}
    >
      <span aria-hidden="true">💬</span>
      Talk to a human
    </button>
  )
}
