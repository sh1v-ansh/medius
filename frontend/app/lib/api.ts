// Typed API wrappers for all Medius backend endpoints.
// next.config.js rewrites /api/* → http://localhost:8000/*

export interface CaseParty {
  role: string
  lang: string
  has_counsel: boolean
}

export interface TriageScores {
  urgency: number
  power_asymmetry: number
  violation_strength: number
  settlement_likelihood: number
}

export interface CaseData {
  case_id: string
  type: string
  status: string
  created_at: string
  parties: {
    initiator: CaseParty
    respondent: CaseParty
  }
  triage: {
    composite: number
    scores: TriageScores
  } | null
  briefings?: {
    initiator?: BriefingResult
    respondent?: BriefingResult
  }
  steelman?: SteelmanResult
  shared_reality?: SharedRealityResult
  common_ground?: CommonGroundResult
  settlement?: SettlementResult
  lease_analysis?: LeaseAnalysisResult
}

export interface Question {
  id: string
  text: string
  type: 'yes_no' | 'choice' | 'short_answer'
  choices?: string[]
  original_text?: string
  original_choices?: string[]
}

export interface NextQuestionResponse {
  done: boolean
  question: Question | null
}

export interface Message {
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

export interface Citation {
  statute_id: string
  statute_text: string
  source?: string
  label?: string
  note?: string
}

export interface WtmfmData {
  what_law_says: string
  what_i_can_do: string[]
  what_are_risks: string[]
  is_advice: boolean
  disclaimer?: string
}

export interface BriefingResult {
  what_this_means: WtmfmData
  levels: {
    simple: string
    standard: string
    full: string
  }
  citations: Citation[]
  not_considered: string
}

export interface TriageResult {
  composite: number
  scores: TriageScores
  explanation: string
}

export interface Fallacy {
  type: string
  description: string
  severity: 'minor' | 'notable'
}

export interface SteelmanArgument {
  levels: { simple: string; standard: string; full: string }
  citations: Citation[]
  fallacies?: Fallacy[]
}

export interface SteelmanResult {
  initiator_argument: SteelmanArgument
  respondent_argument: SteelmanArgument
}

export interface SharedRealityResult {
  floor: number
  typical_band: { low: number; high: number }
  ceiling: number
  citations: Citation[]
  anchor_note?: string
}

export interface CommonGroundResult {
  agreed: string[]
  disputed: string[]
  suggestions: string[]
}

export interface EscalationResult {
  escalated: boolean
  reason: string
}

export interface SettlementResult {
  document: string      // backend field name
  draft_text?: string   // alias
  agreed_terms: string[]
  human_approved: boolean
}

export interface AuditEntry {
  case_id: string
  actor: string
  action: string
  ai_suggestion: unknown
  human_decision: unknown
  timestamp: string
}

export interface TranslationResult {
  original: string
  translated: string   // backend field name
  translation?: string // alias for convenience
  target_lang: string
}

export interface KeyTerms {
  monthly_rent?: string
  security_deposit?: string
  lease_start?: string
  lease_end?: string
  late_fee?: string
  notice_period?: string
  pets?: string
}

export interface LeaseIssue {
  id: string
  severity: 'illegal' | 'concerning'
  flag: string
  plain: string
  remedy: string
  statute: string
  statute_title: string
  statute_text: string
}

export interface MissingDisclosure {
  id: string
  name: string
  statute: string
  statute_title: string
  plain: string
}

export interface LeaseAnalysisResult {
  demo_mode?: boolean
  demo_notice?: string
  key_terms: KeyTerms
  issues: LeaseIssue[]
  missing_disclosures: MissingDisclosure[]
  summary: { red_flags: number; yellow_flags: number; missing_disclosures: number }
  not_considered: string
  is_advice: boolean
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`/api${path}`, options)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API error ${res.status}: ${body || res.statusText}`)
  }
  return res.json() as Promise<T>
}

// POST /cases  — backend expects { type, parties: { initiator, respondent } }
export async function createCase(
  initiatorRole: string,
  initiatorLang: string,
  respondentRole: string,
  respondentLang: string,
): Promise<CaseData> {
  return apiFetch<CaseData>('/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'housing',
      parties: {
        initiator: { role: initiatorRole, language: initiatorLang, has_counsel: false },
        respondent: { role: respondentRole, language: respondentLang, has_counsel: false },
      },
    }),
  })
}

// GET /cases/{id}
export async function getCase(id: string): Promise<CaseData> {
  return apiFetch<CaseData>(`/cases/${id}`)
}

// GET /cases
export async function listCases(): Promise<CaseData[]> {
  return apiFetch<CaseData[]>('/cases')
}

// POST /cases/{id}/intake/next
export async function getNextQuestion(
  caseId: string,
  party: string,
  answers: Record<string, string>,
  lang: string,
): Promise<NextQuestionResponse> {
  return apiFetch<NextQuestionResponse>(`/cases/${caseId}/intake/next`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ party, answers, lang }),
  })
}

// POST /cases/{id}/intake/answer (form-data)
export async function submitAnswer(
  caseId: string,
  party: string,
  questionId: string,
  answer: string,
): Promise<{ ok: boolean }> {
  const form = new FormData()
  form.append('party', party)
  form.append('question_id', questionId)
  form.append('answer', answer)
  return apiFetch<{ ok: boolean }>(`/cases/${caseId}/intake/answer`, {
    method: 'POST',
    body: form,
  })
}

// POST /cases/{id}/intake/finish  — backend expects query param ?party=
export async function finishIntake(
  caseId: string,
  party: string,
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/cases/${caseId}/intake/finish?party=${encodeURIComponent(party)}`, {
    method: 'POST',
  })
}

// POST /cases/{id}/intake/narrative  — free-form story input
export async function submitNarrative(
  caseId: string,
  party: 'initiator' | 'respondent',
  narrative: string,
  language: string = 'en',
): Promise<{ ok: boolean; narrative: string }> {
  return apiFetch<{ ok: boolean; narrative: string }>(`/cases/${caseId}/intake/narrative`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ party, narrative, language }),
  })
}

// POST /cases/{id}/brief/{party}
export async function getBriefing(
  caseId: string,
  party: string,
): Promise<BriefingResult> {
  return apiFetch<BriefingResult>(`/cases/${caseId}/brief/${party}`, {
    method: 'POST',
  })
}

// POST /cases/{id}/triage
export async function getTriage(caseId: string): Promise<TriageResult> {
  return apiFetch<TriageResult>(`/cases/${caseId}/triage`, { method: 'POST' })
}

// POST /cases/{id}/steelman
export async function getSteelman(caseId: string): Promise<SteelmanResult> {
  return apiFetch<SteelmanResult>(`/cases/${caseId}/steelman`, { method: 'POST' })
}

// POST /cases/{id}/shared-reality
export async function getSharedReality(caseId: string): Promise<SharedRealityResult> {
  return apiFetch<SharedRealityResult>(`/cases/${caseId}/shared-reality`, { method: 'POST' })
}

// POST /cases/{id}/messages/draft
export async function draftMessage(
  caseId: string,
  party: string,
  text: string,
): Promise<Message> {
  return apiFetch<Message>(`/cases/${caseId}/messages/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ party, text }),
  })
}

// POST /cases/{id}/messages/{msgId}/approve
export async function approveMessage(
  caseId: string,
  msgId: string,
  choice: string,
  editText?: string,
): Promise<Message> {
  return apiFetch<Message>(`/cases/${caseId}/messages/${msgId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ choice, edit_text: editText }),
  })
}

// GET /cases/{id}/messages
export async function getMessages(
  caseId: string,
  viewerLang?: string,
): Promise<Message[]> {
  const qs = viewerLang ? `?viewer_lang=${encodeURIComponent(viewerLang)}` : ''
  return apiFetch<Message[]>(`/cases/${caseId}/messages${qs}`)
}

// POST /cases/{id}/analyze-lease
export async function analyzeLeaseEndpoint(caseId: string): Promise<LeaseAnalysisResult> {
  return apiFetch<LeaseAnalysisResult>(`/cases/${caseId}/analyze-lease`, { method: 'POST' })
}

// GET /lease-analysis/sample
export async function getSampleLease(): Promise<LeaseAnalysisResult> {
  return apiFetch<LeaseAnalysisResult>('/lease-analysis/sample')
}

// GET /cases/{id}/audit
export async function getAudit(caseId: string): Promise<AuditEntry[]> {
  return apiFetch<AuditEntry[]>(`/cases/${caseId}/audit`)
}

// POST /translate
export async function translate(
  text: string,
  targetLang: string,
): Promise<TranslationResult> {
  return apiFetch<TranslationResult>('/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, target_lang: targetLang }),
  })
}

// POST /cases/{id}/common-ground
export async function getCommonGround(caseId: string): Promise<CommonGroundResult> {
  return apiFetch<CommonGroundResult>(`/cases/${caseId}/common-ground`, { method: 'POST' })
}

// POST /cases/{id}/escalate
export async function escalate(caseId: string): Promise<EscalationResult> {
  return apiFetch<EscalationResult>(`/cases/${caseId}/escalate`, { method: 'POST' })
}

// POST /cases/{id}/settlement-draft
export async function settlementDraft(
  caseId: string,
  agreedTerms: string[],
  humanApproved: boolean,
): Promise<SettlementResult> {
  return apiFetch<SettlementResult>(`/cases/${caseId}/settlement-draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agreed_terms: agreedTerms, human_approved: humanApproved }),
  })
}
