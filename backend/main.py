from __future__ import annotations

from typing import Any
from fastapi import FastAPI, HTTPException
from backend.models import Case, CaseCreate, CasePatch
from backend.storage import get_case, read_cases, save_case
from backend.audit import get_audit

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
