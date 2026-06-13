from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from dotenv import load_dotenv

load_dotenv(override=False)

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from backend.models import Case, CaseCreate, CasePatch
from backend.storage import get_case, read_cases, save_case
from backend.translate import get_or_create_translation
from backend.audit import get_audit, log as audit_log
from backend.intake import (
    next_question,
    reconstruct_narrative,
    build_no_doc_assumptions,
    map_verbal_to_framework,
)
from backend.legal_engine.transcribe import transcribe
from backend.legal_engine.ocr import ocr
from backend.briefing import produce_briefing
from backend.triage import run_triage
from backend.steelman import build_steelman_argument, build_shared_reality
from backend.negotiation import classify_tone, rewrite_message, empathy_ack, find_common_ground
from backend.escalation import build_escalation_packet, build_settlement_draft
from backend.lease_analysis import analyze_lease, SAMPLE_LEASE

app = FastAPI(
    title="Medius Backend",
    description="AI-assisted dispute resolution — humans make every decision.",
    version="0.1.0",
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "medius-backend"}


# ── Cases ───────────────────────────────────────────────────────────────────

@app.post("/cases", response_model=Case, status_code=201)
def create_case(payload: CaseCreate) -> Any:
    case = Case(type=payload.type, parties=payload.parties)
    save_case(case.model_dump())
    return case


@app.get("/cases", response_model=list[Case])
def list_cases() -> Any:
    return read_cases()


@app.get("/cases/{case_id}", response_model=Case)
def read_case(case_id: str) -> Any:
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@app.patch("/cases/{case_id}", response_model=Case)
def patch_case(case_id: str, payload: CasePatch) -> Any:
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    updates = payload.model_dump(exclude_none=True)
    case.update(updates)
    save_case(case)
    return case


# ── Audit ────────────────────────────────────────────────────────────────────

@app.get("/cases/{case_id}/audit")
def read_case_audit(case_id: str) -> Any:
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return get_audit(case_id)


# ── Intake ───────────────────────────────────────────────────────────────────

class IntakeNextRequest(BaseModel):
    party: Literal["initiator", "respondent"]
    answers: dict[str, Any] = {}
    lang: str = "en"


class IntakeAnswerRequest(BaseModel):
    party: Literal["initiator", "respondent"]
    question_id: str
    answer: Optional[str] = None


@app.post("/cases/{case_id}/intake/next")
def intake_next(case_id: str, payload: IntakeNextRequest) -> Any:
    """Return the next question given answers collected so far, optionally translated."""
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    question = next_question(payload.answers)
    if question is None:
        return {"done": True, "question": None}

    if payload.lang and payload.lang != "en":
        question = dict(question)
        question["original_text"] = question["text"]
        question["text"] = get_or_create_translation(question["text"], payload.lang)
        if "choices" in question:
            question["original_choices"] = question["choices"]
            question["choices"] = [
                get_or_create_translation(c, payload.lang) for c in question["choices"]
            ]

    return {"done": False, "question": question}


@app.post("/cases/{case_id}/intake/answer")
async def intake_answer(
    case_id: str,
    party: str = Form(...),
    question_id: str = Form(...),
    answer: Optional[str] = Form(None),
    audio: Optional[UploadFile] = File(None),
    image: Optional[UploadFile] = File(None),
) -> Any:
    """Record an answer — accepts text, audio (-> transcribe), or image (-> ocr)."""
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if party not in ("initiator", "respondent"):
        raise HTTPException(status_code=422, detail="party must be 'initiator' or 'respondent'")

    resolved_answer = answer

    if audio is not None:
        audio_bytes = await audio.read()
        resolved_answer = transcribe(audio_bytes)
        audit_log(case_id, actor=party, action="transcribe_audio",
                  ai_suggestion=resolved_answer, human_decision=None)

    if image is not None:
        image_bytes = await image.read()
        resolved_answer = ocr(image_bytes)
        audit_log(case_id, actor=party, action="ocr_image",
                  ai_suggestion=resolved_answer, human_decision=None)

    if resolved_answer is None:
        raise HTTPException(status_code=422, detail="Provide answer, audio, or image")

    # Persist answer into intake.{party}.answers
    intake_party = case["intake"][party]
    intake_party["answers"][question_id] = resolved_answer

    # Append to rolling transcript
    intake_party["transcript"] += f"\n[{question_id}]: {resolved_answer}"

    save_case(case)
    return {"question_id": question_id, "recorded": resolved_answer}


class NarrativeRequest(BaseModel):
    party: Literal["initiator", "respondent"]
    narrative: str
    language: str = "en"


@app.post("/cases/{case_id}/intake/narrative")
def intake_narrative(case_id: str, payload: NarrativeRequest) -> Any:
    """
    Accept a free-form narrative directly from a party (bypasses Q&A intake).
    Sets parties[party].narrative and marks intake as complete for that party.
    """
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if not payload.narrative.strip():
        raise HTTPException(status_code=422, detail="Narrative cannot be empty")

    party = payload.party
    # Store narrative
    case["parties"][party]["narrative"] = payload.narrative.strip()
    # Store language preference so briefing can respond in the right language
    case["parties"][party]["language"] = payload.language
    # Mark doc_source so downstream briefing knows it's a direct narrative
    case["parties"][party]["doc_source"] = "narrative"
    # Stamp into intake answers so existing briefing path still works
    case["intake"][party]["answers"]["q_describe_other"] = payload.narrative.strip()
    case["intake"][party]["answers"]["q_dispute_type"] = "Other"
    case["intake"][party]["transcript"] = payload.narrative.strip()

    audit_log(case_id, actor="human", action="narrative_submitted",
              ai_suggestion=None, human_decision=payload.narrative[:300])
    save_case(case)
    return {"ok": True, "narrative": payload.narrative.strip()}


@app.post("/cases/{case_id}/intake/finish")
def intake_finish(case_id: str, party: Literal["initiator", "respondent"]) -> Any:
    """
    Assemble short answers into a structured narrative and store in parties[party].narrative.
    For doc_source='none', also returns statutory default assumptions flagged for confirmation.
    For doc_source='verbal', maps verbal description to likely legal framework.
    """
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    answers = case["intake"][party]["answers"]
    narrative = reconstruct_narrative(answers, party)
    case["parties"][party]["narrative"] = narrative

    result: dict[str, Any] = {"narrative": narrative}

    doc_source = case["parties"][party].get("doc_source", "none")

    if doc_source == "none":
        assumptions = build_no_doc_assumptions(answers)
        result["assumptions"] = assumptions
        audit_log(case_id, actor="ai", action="no_doc_assumptions",
                  ai_suggestion=assumptions, human_decision=None)

    elif doc_source == "verbal":
        verbal_desc = answers.get("q_verbal_terms", "")
        framework = map_verbal_to_framework(verbal_desc)
        result["verbal_framework"] = framework
        audit_log(case_id, actor="ai", action="verbal_framework_mapping",
                  ai_suggestion=framework, human_decision=None)

    audit_log(case_id, actor="ai", action="intake_finish",
              ai_suggestion=narrative, human_decision=None)

    save_case(case)
    return result


# ── Briefing ─────────────────────────────────────────────────────────────────

@app.post("/cases/{case_id}/brief/{party}")
def create_briefing(case_id: str, party: Literal["initiator", "respondent"]) -> Any:
    """
    Produce a full briefing for one party:
    - redact -> analyze -> lockbox -> three reading levels -> WTMFM card
    - stored in briefings[party]; audit-logged
    """
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Source text: stored doc text or reconstructed narrative
    answers = case["intake"][party]["answers"]
    source_text = (
        answers.get("__doc_text__")
        or case["parties"][party].get("narrative")
        or case["intake"][party].get("transcript")
        or ""
    )
    if not source_text.strip():
        raise HTTPException(status_code=422, detail="No intake text found — complete intake first")

    perspective = case["parties"][party].get("role", party)
    target_lang = case["parties"][party].get("language", "en")
    briefing = produce_briefing(source_text, perspective, target_lang=target_lang)

    case["briefings"][party] = briefing
    save_case(case)

    audit_log(
        case_id,
        actor="ai",
        action=f"briefing_{party}",
        ai_suggestion={"levels_keys": list(briefing["levels"].keys()), "citations_count": len(briefing["citations"])},
        human_decision=None,
    )
    return briefing


# ── Triage ────────────────────────────────────────────────────────────────────

@app.post("/cases/{case_id}/triage")
def triage_case(case_id: str) -> Any:
    """
    Compute triage scores to sort the mediator queue.
    Merits firewall enforced: has_counsel affects only power_asymmetry.
    """
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    result = run_triage(case)
    case["triage"] = result
    save_case(case)

    audit_log(
        case_id,
        actor="ai",
        action="triage",
        ai_suggestion={
            "composite": result["composite"],
            "scores": result["scores"],
        },
        human_decision=None,
    )
    return result


# ── Steelman ──────────────────────────────────────────────────────────────────

@app.post("/cases/{case_id}/steelman")
def steelman_case(case_id: str) -> Any:
    """
    Produce the strongest honest statute-cited argument for EACH side.
    Same code path for both — symmetric process.
    """
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    result: dict[str, Any] = {}
    for party in ("initiator", "respondent"):
        answers = case["intake"][party]["answers"]
        source_text = (
            answers.get("__doc_text__")
            or case["parties"][party].get("narrative")
            or case["intake"][party].get("transcript")
            or ""
        )
        if not source_text.strip():
            raise HTTPException(
                status_code=422,
                detail=f"No intake text for {party} — complete intake first",
            )
        perspective = case["parties"][party].get("role", party)
        result[f"{party}_argument"] = build_steelman_argument(source_text, perspective)

    case["steelman"] = result
    save_case(case)

    audit_log(
        case_id,
        actor="ai",
        action="steelman",
        ai_suggestion={
            "initiator_citations": len(result["initiator_argument"]["citations"]),
            "respondent_citations": len(result["respondent_argument"]["citations"]),
        },
        human_decision=None,
    )
    return result


# ── Shared reality ────────────────────────────────────────────────────────────

@app.post("/cases/{case_id}/shared-reality")
def shared_reality(case_id: str) -> Any:
    """
    Derive a statutory damage range visible to BOTH parties.
    This is a negotiation anchor only — not an AI-chosen settlement.
    """
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Collect all retrieved statute IDs from both briefings
    retrieved_ids: list[str] = []
    for party in ("initiator", "respondent"):
        briefing = case["briefings"].get(party)
        if briefing:
            retrieved_ids.extend(c["statute_id"] for c in briefing.get("citations", []))

    if not retrieved_ids:
        # Fall back to steelman citations
        steelman = case.get("steelman") or {}
        for party in ("initiator", "respondent"):
            arg = steelman.get(f"{party}_argument", {})
            retrieved_ids.extend(c["statute_id"] for c in arg.get("citations", []))

    result = build_shared_reality(case, list(set(retrieved_ids)))
    case["shared_reality"] = result
    save_case(case)

    audit_log(
        case_id,
        actor="ai",
        action="shared_reality",
        ai_suggestion={
            "floor": result["floor"],
            "ceiling": result["ceiling"],
            "statutes_matched": result["basis"]["statutes_matched"],
        },
        human_decision=None,
    )
    return result


# ── Negotiation + approval gate ───────────────────────────────────────────────

class DraftRequest(BaseModel):
    party: Literal["initiator", "respondent"]
    text: str


class ApproveRequest(BaseModel):
    choice: Literal["original", "rewrite", "edit"]
    edit_text: Optional[str] = None  # required when choice="edit"


@app.post("/cases/{case_id}/messages/draft")
def draft_message(case_id: str, payload: DraftRequest) -> Any:
    """
    AI classifies tone, produces rewrite and empathy_ack for SENDER only.
    Message is set to pending_approval — NOT delivered to the other party.
    """
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    tone = classify_tone(payload.text)
    rewrite = rewrite_message(payload.text, tone)
    ack = empathy_ack(tone)

    msg = {
        "msg_id": str(__import__("uuid").uuid4()),
        "sender": payload.party,
        "original": payload.text,
        "rewrite": rewrite,
        "content": "",
        "tone": tone,
        "empathy_ack": ack,
        "status": "pending_approval",
        "timestamp": datetime.utcnow().isoformat(),
        "approved_by_human": False,
        "human_choice": None,
    }

    case["negotiation"]["drafts"].append(msg)
    save_case(case)

    audit_log(
        case_id,
        actor="ai",
        action="message_draft",
        ai_suggestion={"rewrite": rewrite, "tone": tone},
        human_decision=None,
    )

    return msg


@app.post("/cases/{case_id}/messages/{msg_id}/approve")
def approve_message(case_id: str, msg_id: str, payload: ApproveRequest) -> Any:
    """
    HUMAN approval gate. Chooses original / rewrite / custom edit.
    Only after this call does the message become visible to the other party.
    """
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    drafts = case["negotiation"]["drafts"]
    draft = next((d for d in drafts if d["msg_id"] == msg_id), None)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft message not found")
    if draft["status"] == "delivered":
        raise HTTPException(status_code=409, detail="Message already delivered")

    if payload.choice == "original":
        final_text = draft["original"]
    elif payload.choice == "rewrite":
        final_text = draft["rewrite"]
    else:  # edit
        if not payload.edit_text:
            raise HTTPException(status_code=422, detail="edit_text required when choice='edit'")
        final_text = payload.edit_text

    draft["content"] = final_text
    draft["status"] = "delivered"
    draft["approved_by_human"] = True
    draft["human_choice"] = payload.choice

    # Append to the delivered thread (visible to both parties)
    delivered = dict(draft)
    case["negotiation"]["messages"].append(delivered)
    save_case(case)

    audit_log(
        case_id,
        actor="human",
        action="message_approve",
        ai_suggestion=draft["rewrite"],
        human_decision={"choice": payload.choice, "final_text": final_text},
    )

    return delivered


@app.get("/cases/{case_id}/messages")
def list_messages(
    case_id: str,
    party: Optional[str] = None,
    viewer_lang: Optional[str] = None,
) -> Any:
    """
    Returns only DELIVERED messages. When viewer_lang is set and differs from
    the sender's language, each message gains a 'translation' field and
    'is_machine_translation: true' — labeled for the viewer, never modifying
    the stored content.
    """
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    messages = case["negotiation"]["messages"]

    if not viewer_lang:
        return messages

    augmented = []
    for msg in messages:
        msg = dict(msg)
        sender = msg.get("sender", "initiator")
        sender_lang = case["parties"].get(sender, {}).get("language", "en")
        if sender_lang != viewer_lang and msg.get("content"):
            msg["translation"] = get_or_create_translation(msg["content"], viewer_lang)
            msg["is_machine_translation"] = True
        augmented.append(msg)
    return augmented


@app.post("/cases/{case_id}/common-ground")
def common_ground(case_id: str) -> Any:
    """Identify agreed vs disputed points from both narratives. Informational only."""
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    narrative_i = case["parties"]["initiator"].get("narrative", "")
    narrative_r = case["parties"]["respondent"].get("narrative", "")

    result = find_common_ground(narrative_i, narrative_r)

    audit_log(
        case_id,
        actor="ai",
        action="common_ground",
        ai_suggestion={"agreed_count": len(result["agreed"]), "disputed_count": len(result["disputed"])},
        human_decision=None,
    )
    return result


# ── Escalation ────────────────────────────────────────────────────────────────

@app.post("/cases/{case_id}/escalate")
def escalate_case(case_id: str) -> Any:
    """
    Assemble the mediator escalation packet and set status to 'escalated'.
    The AI assembles; it does not resolve.
    """
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    packet = build_escalation_packet(case)
    case["escalation_packet"] = packet
    case["status"] = "escalated"
    save_case(case)

    audit_log(
        case_id,
        actor="ai",
        action="escalate",
        ai_suggestion={
            "open_issues_count": len(packet["open_issues"]),
            "timeline_events": len(packet["timeline"]),
            "statutes_count": len(packet["applicable_statutes"]),
        },
        human_decision=None,
    )
    return packet


# ── Settlement draft ──────────────────────────────────────────────────────────

class SettlementRequest(BaseModel):
    agreed_terms: list[str] = []
    human_approved: bool = False


@app.post("/cases/{case_id}/settlement-draft")
def settlement_draft(case_id: str, payload: SettlementRequest) -> Any:
    """
    Fill a settlement template from case data.
    Status flips to 'settled' ONLY when human_approved=True is passed.
    The AI prepares; humans sign and decide.
    """
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    draft = build_settlement_draft(
        case,
        agreed_terms=payload.agreed_terms,
        human_approved=payload.human_approved,
    )

    case["settlement_draft"] = draft
    if payload.human_approved:
        case["status"] = "settled"

    save_case(case)

    audit_log(
        case_id,
        actor="ai" if not payload.human_approved else "human",
        action="settlement_draft",
        ai_suggestion={"terms_count": len(payload.agreed_terms)},
        human_decision={"human_approved": payload.human_approved} if payload.human_approved else None,
    )
    return draft


@app.post("/cases/{case_id}/intake/upload-doc")
async def intake_upload_doc(
    case_id: str,
    party: str = Form(...),
    doc_source: str = Form(...),
    file: UploadFile = File(...),
) -> Any:
    """
    Handle document uploads:
    - doc_source='pdf'  -> store text as-is (caller extracts text first)
    - doc_source='photo' -> run ocr() on image bytes
    """
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if party not in ("initiator", "respondent"):
        raise HTTPException(status_code=422, detail="party must be 'initiator' or 'respondent'")
    if doc_source not in ("pdf", "photo"):
        raise HTTPException(status_code=422, detail="doc_source must be 'pdf' or 'photo'")

    file_bytes = await file.read()
    extracted_text: str

    if doc_source == "photo":
        extracted_text = ocr(file_bytes)
        audit_log(case_id, actor=party, action="upload_photo_ocr",
                  ai_suggestion=extracted_text[:200], human_decision=None)
    else:
        extracted_text = file_bytes.decode("utf-8", errors="replace")

    case["parties"][party]["doc_source"] = doc_source
    case["intake"][party]["answers"]["__doc_text__"] = extracted_text
    save_case(case)

    return {"doc_source": doc_source, "extracted_length": len(extracted_text)}


# ── Translation ───────────────────────────────────────────────────────────────

class TranslateRequest(BaseModel):
    text: str
    target_lang: str


@app.post("/translate")
def translate(payload: TranslateRequest) -> Any:
    """
    Translate text to target_lang via Claude (cache-first).
    Returns the original and the translation — translation never alters meaning
    or makes decisions; it is purely for accessibility.
    """
    if not payload.text.strip():
        raise HTTPException(status_code=422, detail="text must not be empty")
    if not payload.target_lang.strip():
        raise HTTPException(status_code=422, detail="target_lang must not be empty")

    translated = get_or_create_translation(payload.text.strip(), payload.target_lang.strip())
    return {
        "original": payload.text.strip(),
        "translated": translated,
        "target_lang": payload.target_lang.strip(),
    }


# ── Lease analysis ────────────────────────────────────────────────────────────

@app.post("/cases/{case_id}/analyze-lease")
def analyze_lease_endpoint(case_id: str, party: Literal["initiator", "respondent"] = "initiator") -> Any:
    """
    Analyze the uploaded lease document for this case and party.
    Detects illegal clauses, concerning terms, and missing MA-required disclosures.
    Falls back to the sample lease if no document has been uploaded (demo mode).
    """
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    lease_text = case["intake"][party]["answers"].get("__doc_text__", "")
    demo_mode = False
    if not lease_text.strip():
        lease_text = SAMPLE_LEASE
        demo_mode = True

    result = analyze_lease(lease_text)
    result["demo_mode"] = demo_mode
    if demo_mode:
        result["demo_notice"] = (
            "Analyzing the demo lease (sample-lease.pdf) — a Swampscott, MA commercial lease template. "
            "Upload your own lease to analyze a specific document."
        )

    case["lease_analysis"] = result
    save_case(case)

    audit_log(
        case_id,
        actor="ai",
        action="lease_analysis",
        ai_suggestion={
            "red_flags": result["summary"]["red_flags"],
            "yellow_flags": result["summary"]["yellow_flags"],
            "missing_disclosures": result["summary"]["missing_disclosures"],
            "demo_mode": demo_mode,
        },
        human_decision=None,
    )
    return result


@app.get("/lease-analysis/sample")
def get_sample_lease() -> Any:
    """Return analysis of sample-lease.pdf (demo)."""
    from backend.lease_analysis import get_sample_lease_text

    result = analyze_lease(get_sample_lease_text())
    result["demo_mode"] = True
    result["demo_notice"] = (
        "Demo analysis of sample-lease.pdf — Swampscott, MA lease template."
    )
    return result
