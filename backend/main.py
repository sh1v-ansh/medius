from __future__ import annotations

from typing import Any, Literal, Optional
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from backend.models import Case, CaseCreate, CasePatch
from backend.storage import get_case, read_cases, save_case
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


class IntakeAnswerRequest(BaseModel):
    party: Literal["initiator", "respondent"]
    question_id: str
    answer: Optional[str] = None


@app.post("/cases/{case_id}/intake/next")
def intake_next(case_id: str, payload: IntakeNextRequest) -> Any:
    """Return the next question given answers collected so far."""
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    question = next_question(payload.answers)
    if question is None:
        return {"done": True, "question": None}
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
    briefing = produce_briefing(source_text, perspective)

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
