'use client'

import { useState } from 'react'

const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur'])

interface Message {
  msg_id: string
  sender: string
  content: string
  status: 'pending_approval' | 'delivered'
  tone: string
  original: string
  rewrite: string
  empathy_ack: string
  // Phase 10: machine translation
  translation?: string
  is_machine_translation?: boolean
  sender_lang?: string
}

interface NegotiationThreadProps {
  caseId: string
  party: 'initiator' | 'respondent'
  deliveredMessages: Message[]
  onDraft?: (draft: Message) => void
  onApprove?: (approved: Message) => void
  // Injected API functions for testability
  draftApi?: (caseId: string, party: string, text: string) => Promise<Message>
  approveApi?: (caseId: string, msgId: string, choice: string) => Promise<Message>
}

const defaultDraftApi = async (caseId: string, party: string, text: string): Promise<Message> => {
  const res = await fetch(`/api/cases/${caseId}/messages/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ party, text }),
  })
  if (!res.ok) throw new Error('Draft failed')
  return res.json()
}

const defaultApproveApi = async (caseId: string, msgId: string, choice: string): Promise<Message> => {
  const res = await fetch(`/api/cases/${caseId}/messages/${msgId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ choice }),
  })
  if (!res.ok) throw new Error('Approve failed')
  return res.json()
}

export function NegotiationThread({
  caseId,
  party,
  deliveredMessages,
  onDraft,
  onApprove,
  draftApi = defaultDraftApi,
  approveApi = defaultApproveApi,
}: NegotiationThreadProps) {
  const [text, setText] = useState('')
  const [draft, setDraft] = useState<Message | null>(null)
  const [choice, setChoice] = useState<'original' | 'rewrite'>('rewrite')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDraft() {
    if (!text.trim()) return
    setSending(true)
    setError(null)
    try {
      const d = await draftApi(caseId, party, text)
      setDraft(d)
      onDraft?.(d)
    } catch (e) {
      setError('Could not create draft.')
    } finally {
      setSending(false)
    }
  }

  async function handleApprove() {
    if (!draft) return
    setSending(true)
    setError(null)
    try {
      const approved = await approveApi(caseId, draft.msg_id, choice)
      onApprove?.(approved)
      setDraft(null)
      setText('')
    } catch (e) {
      setError('Could not approve message.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4" data-testid="negotiation-thread">
      {/* Delivered thread */}
      <div data-testid="delivered-thread">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Message thread</h3>
        {deliveredMessages.length === 0 ? (
          <p className="text-xs text-gray-400">No messages yet.</p>
        ) : (
          <div className="space-y-2">
            {deliveredMessages.map((m) => {
              const senderIsRTL = RTL_LANGS.has(m.sender_lang ?? '')
              return (
                <div
                  key={m.msg_id}
                  data-testid={`delivered-msg-${m.msg_id}`}
                  className={`p-3 rounded-lg text-sm ${
                    m.sender === party
                      ? 'bg-blue-100 ml-8'
                      : 'bg-gray-100 mr-8'
                  }`}
                >
                  <p className="text-xs text-gray-500 mb-1 font-medium">{m.sender}</p>
                  {m.is_machine_translation && m.translation ? (
                    <>
                      <p className="text-gray-800">{m.translation}</p>
                      <div
                        className="mt-2 border-t border-gray-200 pt-2"
                        dir={senderIsRTL ? 'rtl' : 'ltr'}
                        data-testid="machine-translation-block"
                      >
                        <span
                          className="text-xs font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded"
                          data-testid="machine-translation-label"
                        >
                          machine translation
                        </span>
                        <p className="text-xs text-gray-500 mt-1">{m.content}</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-800">{m.content}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Compose area */}
      {!draft ? (
        <div className="space-y-2" data-testid="compose-area">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your message…"
            rows={3}
            data-testid="compose-input"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <p className="text-xs text-gray-400">
            The AI will suggest a calmer version before anything is sent. You decide what goes.
          </p>
          <button
            type="button"
            onClick={handleDraft}
            disabled={!text.trim() || sending}
            data-testid="draft-btn"
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >
            {sending ? 'Getting AI suggestion…' : 'Get AI suggestion →'}
          </button>
        </div>
      ) : (
        /* Draft review — original vs rewrite side-by-side */
        <div className="space-y-3 border border-amber-200 rounded-lg p-4 bg-amber-50" data-testid="draft-review">
          {draft.empathy_ack && (
            <div
              className="text-sm text-amber-800 bg-amber-100 border border-amber-200 rounded p-2"
              data-testid="empathy-ack"
            >
              {draft.empathy_ack}
            </div>
          )}

          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Choose what to send — nothing is sent until you click Approve
          </p>

          <div className="grid grid-cols-2 gap-3">
            <label
              className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                choice === 'original'
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 bg-white'
              }`}
              data-testid="choice-original"
            >
              <input
                type="radio"
                name="msg-choice"
                value="original"
                checked={choice === 'original'}
                onChange={() => setChoice('original')}
                className="sr-only"
              />
              <p className="text-xs font-medium text-gray-500 mb-1">Your original</p>
              <p className="text-sm text-gray-800">{draft.original}</p>
            </label>

            <label
              className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                choice === 'rewrite'
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 bg-white'
              }`}
              data-testid="choice-rewrite"
            >
              <input
                type="radio"
                name="msg-choice"
                value="rewrite"
                checked={choice === 'rewrite'}
                onChange={() => setChoice('rewrite')}
                className="sr-only"
              />
              <p className="text-xs font-medium text-gray-500 mb-1">AI calmer version</p>
              <p className="text-sm text-gray-800">{draft.rewrite}</p>
            </label>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleApprove}
              disabled={sending}
              data-testid="approve-btn"
              className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-green-700 transition-colors"
            >
              {sending ? 'Sending…' : 'Approve & send'}
            </button>
            <button
              type="button"
              onClick={() => { setDraft(null); setText('') }}
              data-testid="cancel-btn"
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
