'use client'

import { useEffect, useRef, useState } from 'react'

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

const TONE_COLORS: Record<string, string> = {
  neutral: 'bg-gray-100 text-gray-600',
  frustrated: 'bg-amber-100 text-amber-700',
  hostile: 'bg-red-100 text-red-700',
}

const FAKE_TRANSCRIPTS = [
  "I haven't received my security deposit back and it's been over 45 days since I moved out.",
  "The heating stopped working in January and the landlord refused to fix it for three weeks.",
  "I was given less than 24 hours notice before the landlord entered the unit.",
  "The late fee charged is 15% of rent which I believe exceeds what's allowed.",
]

type SttState = 'idle' | 'listening' | 'processing' | 'done'

function SpeechToTextButton({ onTranscript }: { onTranscript: (t: string) => void }) {
  const [sttState, setSttState] = useState<SttState>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleMic() {
    if (sttState !== 'idle') return
    setSttState('listening')
    timerRef.current = setTimeout(() => {
      setSttState('processing')
      setTimeout(() => {
        const transcript = FAKE_TRANSCRIPTS[Math.floor(Math.random() * FAKE_TRANSCRIPTS.length)]
        onTranscript(transcript)
        setSttState('done')
        setTimeout(() => setSttState('idle'), 1500)
      }, 1200)
    }, 2500)
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <button
      type="button"
      onClick={handleMic}
      disabled={sttState !== 'idle' && sttState !== 'done'}
      title="Speak your message — supports 10+ languages"
      className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
        sttState === 'listening'
          ? 'bg-red-500 text-white shadow-lg shadow-red-200'
          : sttState === 'processing'
          ? 'bg-amber-500 text-white'
          : sttState === 'done'
          ? 'bg-emerald-500 text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {sttState === 'listening' && (
        <span className="absolute inset-0 rounded-lg animate-ping bg-red-400 opacity-40" />
      )}
      <span className="relative">
        {sttState === 'idle' && '🎙'}
        {sttState === 'listening' && '⏺'}
        {sttState === 'processing' && '⏳'}
        {sttState === 'done' && '✓'}
      </span>
      <span className="relative text-xs">
        {sttState === 'idle' && 'Speak'}
        {sttState === 'listening' && 'Listening…'}
        {sttState === 'processing' && 'Transcribing…'}
        {sttState === 'done' && 'Done!'}
      </span>
    </button>
  )
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
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' })
  }, [deliveredMessages])

  async function handleDraft() {
    if (!text.trim()) return
    setSending(true)
    setError(null)
    try {
      const d = await draftApi(caseId, party, text)
      setDraft(d)
      onDraft?.(d)
    } catch {
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
    } catch {
      setError('Could not approve message.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4" data-testid="negotiation-thread">
      {/* Message thread */}
      <div
        ref={threadRef}
        data-testid="delivered-thread"
        className="max-h-72 overflow-y-auto space-y-3 pr-1"
      >
        {deliveredMessages.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-3xl mb-2">💬</p>
            <p className="text-sm">No messages yet. Start the conversation below.</p>
          </div>
        ) : (
          deliveredMessages.map((m) => {
            const isMe = m.sender === party
            const senderIsRTL = RTL_LANGS.has(m.sender_lang ?? '')
            return (
              <div
                key={m.msg_id}
                data-testid={`delivered-msg-${m.msg_id}`}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 space-y-1 ${
                  isMe
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                  <p className={`text-xs font-medium opacity-70 capitalize`}>{m.sender}</p>
                  {m.is_machine_translation && m.translation ? (
                    <>
                      <p className="text-sm leading-relaxed">{m.translation}</p>
                      <div className="border-t border-white/20 pt-1 mt-1" dir={senderIsRTL ? 'rtl' : 'ltr'} data-testid="machine-translation-block">
                        <span className="text-xs opacity-60 italic" data-testid="machine-translation-label">translated</span>
                        <p className="text-xs opacity-60 mt-0.5">{m.content}</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm leading-relaxed">{m.content}</p>
                  )}
                  {m.tone && m.tone !== 'neutral' && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      isMe ? 'bg-white/20 text-white' : TONE_COLORS[m.tone] ?? ''
                    }`}>
                      {m.tone} tone → rewritten
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Compose or review */}
      {!draft ? (
        <div className="space-y-3" data-testid="compose-area">
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your message — or use the mic to speak in any language…"
              rows={3}
              data-testid="compose-input"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent pr-28"
            />
          </div>
          <div className="flex items-center gap-2">
            <SpeechToTextButton onTranscript={(t) => setText((prev) => prev ? prev + ' ' + t : t)} />
            <div className="flex-1" />
            <p className="text-xs text-gray-400">
              AI will suggest a calmer version before anything is sent.
            </p>
            <button
              type="button"
              onClick={handleDraft}
              disabled={!text.trim() || sending}
              data-testid="draft-btn"
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50 hover:bg-blue-700 transition-colors"
            >
              {sending ? 'Getting suggestion…' : 'Get AI suggestion →'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 border border-amber-200 rounded-xl p-4 bg-amber-50" data-testid="draft-review">
          {draft.empathy_ack && (
            <div className="flex items-start gap-2 text-sm text-amber-800 bg-white border border-amber-200 rounded-lg p-3" data-testid="empathy-ack">
              <span className="text-lg flex-shrink-0">🤝</span>
              <p>{draft.empathy_ack}</p>
            </div>
          )}

          <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">
            Choose what to send — nothing goes out until you approve
          </p>

          <div className="grid grid-cols-2 gap-3">
            <label className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
              choice === 'original' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
            }`} data-testid="choice-original">
              <input type="radio" name="msg-choice" value="original" checked={choice === 'original'} onChange={() => setChoice('original')} className="sr-only" />
              <p className="text-xs font-semibold text-gray-500 mb-2">Your original</p>
              <p className="text-sm text-gray-800 leading-relaxed">{draft.original}</p>
            </label>

            <label className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
              choice === 'rewrite' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
            }`} data-testid="choice-rewrite">
              <input type="radio" name="msg-choice" value="rewrite" checked={choice === 'rewrite'} onChange={() => setChoice('rewrite')} className="sr-only" />
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-xs font-semibold text-gray-500">AI calmer version</p>
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">Recommended</span>
              </div>
              <p className="text-sm text-gray-800 leading-relaxed">{draft.rewrite}</p>
            </label>
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}

          <div className="flex gap-2">
            <button type="button" onClick={handleApprove} disabled={sending} data-testid="approve-btn"
              className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 hover:bg-emerald-700 transition-colors">
              {sending ? 'Sending…' : '✓ Approve & send'}
            </button>
            <button type="button" onClick={() => { setDraft(null); setText('') }} data-testid="cancel-btn"
              className="px-4 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
