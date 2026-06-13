"""Phase 3 briefing engine tests."""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from unittest.mock import call, patch

import pytest
from fastapi.testclient import TestClient

_tmp = tempfile.mkdtemp()
os.environ["MEDIUS_DATA_DIR"] = _tmp

from backend.main import app  # noqa: E402
import backend.storage as storage  # noqa: E402

storage.DATA_DIR = Path(_tmp)
storage.CASES_FILE = Path(_tmp) / "cases.json"
storage.AUDIT_FILE = Path(_tmp) / "audit.json"

client = TestClient(app)

SAMPLE_LEASE = (
    "Tenant: John Smith (john.smith@email.com)\n"
    "Landlord: Jane Doe\n"
    "Security deposit: $2,000. Tenant moved out on March 1, 2024. "
    "Landlord has not returned the deposit after 45 days."
)

_BASE_PAYLOAD = {
    "type": "housing",
    "parties": {
        "initiator": {
            "role": "tenant",
            "narrative": SAMPLE_LEASE,
            "doc_source": "none",
            "has_counsel": False,
            "language": "en",
        },
        "respondent": {
            "role": "landlord",
            "narrative": "Deposit was used for legitimate repair costs.",
            "doc_source": "none",
            "has_counsel": False,
            "language": "en",
        },
    },
}


def _fresh():
    for f in [storage.CASES_FILE, storage.AUDIT_FILE]:
        if f.exists():
            f.unlink()


def _new_case() -> str:
    r = client.post("/cases", json=_BASE_PAYLOAD)
    assert r.status_code == 201
    return r.json()["case_id"]


def _brief(case_id: str, party: str = "initiator") -> dict:
    r = client.post(f"/cases/{case_id}/brief/{party}")
    assert r.status_code == 200, r.text
    return r.json()


# ── Test 1: Citation lockbox ──────────────────────────────────────────────────

def test_lockbox_removes_unretrieved_citation():
    """A statute ID cited in the explanation but NOT in the retrieved set must be stripped."""
    from backend.briefing import verify_citations

    citations = [
        {"statute_id": "MGL_186_15B", "statute_text": "No lessor may require...", "source": "MGL"},
    ]
    explanation = {
        "simple": "The law MGL_186_15B applies here.",
        "standard": "Per MGL_186_15B and MGL_FAKE_99, the landlord must...",
        "full": "MGL_186_15B text. Also see MGL_FAKE_99 for more.",
    }

    result = verify_citations(explanation, citations)
    assert "MGL_FAKE_99" in result["removed"]
    assert "MGL_FAKE_99" not in result["clean_explanation"]["simple"]
    assert "MGL_FAKE_99" not in result["clean_explanation"]["standard"]
    assert "MGL_FAKE_99" not in result["clean_explanation"]["full"]
    # Real citation should stay untouched
    assert "MGL_186_15B" in result["clean_explanation"]["simple"]


def test_lockbox_clean_when_all_cited_are_retrieved():
    """No removals when every cited ID is in the retrieved set."""
    from backend.briefing import verify_citations

    citations = [
        {"statute_id": "MGL_186_15B", "statute_text": "No lessor may require...", "source": "MGL"},
        {"statute_id": "MGL_186_22", "statute_text": "Either party to a tenancy...", "source": "MGL"},
    ]
    explanation = {
        "simple": "MGL_186_15B covers deposits.",
        "standard": "MGL_186_15B and MGL_186_22 both apply.",
        "full": "See MGL_186_15B and MGL_186_22.",
    }
    result = verify_citations(explanation, citations)
    assert result["removed"] == []


# ── Test 2: Three levels exist, are non-empty, and are distinct ───────────────

def test_three_reading_levels_exist_nonempty_distinct():
    _fresh()
    case_id = _new_case()
    body = _brief(case_id)

    levels = body["levels"]
    assert set(levels.keys()) >= {"simple", "standard", "full"}

    assert len(levels["simple"]) > 10
    assert len(levels["standard"]) > 10
    assert len(levels["full"]) > 10

    # All three must be distinct
    assert levels["simple"] != levels["standard"]
    assert levels["standard"] != levels["full"]
    assert levels["simple"] != levels["full"]


def test_full_level_contains_verbatim_statute_text():
    _fresh()
    case_id = _new_case()
    body = _brief(case_id)

    full = body["levels"]["full"]
    # At least one citation's statute text should appear in full level
    citations = body["citations"]
    assert any(c["statute_text"][:30] in full for c in citations), (
        "full level must contain verbatim statute text from at least one citation"
    )


# ── Test 3: WTMFM card safety ─────────────────────────────────────────────────

BANNED = [
    "you will win", "you should sue", "guaranteed",
    "strong case", "weak case",
]


def test_what_this_means_has_all_fields():
    _fresh()
    case_id = _new_case()
    body = _brief(case_id)

    wtm = body["what_this_means"]
    assert wtm["what_law_says"]
    assert isinstance(wtm["what_i_can_do"], list) and len(wtm["what_i_can_do"]) > 0
    assert isinstance(wtm["what_are_risks"], list) and len(wtm["what_are_risks"]) > 0


def test_what_law_says_contains_no_banned_phrases():
    _fresh()
    case_id = _new_case()
    body = _brief(case_id)

    what_law_says = body["what_this_means"]["what_law_says"].lower()
    for phrase in BANNED:
        assert phrase not in what_law_says, (
            f"Banned phrase '{phrase}' found in what_law_says"
        )


# ── Test 4: not_considered non-empty; is_advice is false ─────────────────────

def test_not_considered_nonempty_and_is_advice_false():
    _fresh()
    case_id = _new_case()
    body = _brief(case_id)

    assert body["not_considered"], "not_considered must be non-empty"
    assert len(body["not_considered"]) >= 1
    assert body["is_advice"] is False
    assert body["what_this_means"]["is_advice"] is False


# ── Test 5: redact() runs before analyze() ────────────────────────────────────

def test_redact_runs_before_analyze():
    """Verify call ordering: redact is called first, then analyze receives its output."""
    _fresh()
    case_id = _new_case()

    call_order: list[str] = []

    def fake_redact(text: str) -> str:
        call_order.append("redact")
        return text.replace("john.smith@email.com", "[REDACTED]")

    def fake_analyze(text: str, perspective: str, target_lang: str = "en") -> dict:
        call_order.append("analyze")
        # Confirm the text arriving at analyze has already been redacted
        assert "john.smith@email.com" not in text, "PII reached analyze() before redaction"
        from backend.legal_engine.corpus import retrieve
        statutes = retrieve(text, top_k=3)
        return {
            "explanation": {
                "simple": "Simple explanation.",
                "standard": "Standard explanation.",
                "full": "Full explanation. " + " ".join(s["id"] for s in statutes),
            },
            "citations": [
                {"statute_id": s["id"], "statute_text": s["text"], "source": "MGL"}
                for s in statutes
            ],
            "not_considered": "Scope note.",
        }

    with patch("backend.briefing.redact", side_effect=fake_redact), \
         patch("backend.briefing.analyze", side_effect=fake_analyze):
        r = client.post(f"/cases/{case_id}/brief/initiator")
        assert r.status_code == 200

    assert call_order[0] == "redact", "redact must be called first"
    assert call_order[1] == "analyze", "analyze must be called second"
    assert call_order == ["redact", "analyze"]


# ── Test 6: briefing stored on case and audit-logged ─────────────────────────

def test_briefing_stored_on_case():
    _fresh()
    case_id = _new_case()
    _brief(case_id)

    case = client.get(f"/cases/{case_id}").json()
    assert case["briefings"]["initiator"] is not None
    assert "levels" in case["briefings"]["initiator"]


def test_briefing_audit_logged():
    _fresh()
    case_id = _new_case()
    _brief(case_id)

    audit = client.get(f"/cases/{case_id}/audit").json()
    actions = [e["action"] for e in audit]
    assert "briefing_initiator" in actions
