"""Phase 6 negotiation + de-escalation + approval gate tests."""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

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

_BASE_PAYLOAD = {
    "type": "housing",
    "parties": {
        "initiator": {
            "role": "tenant",
            "narrative": "Landlord has not returned my deposit after 45 days.",
            "doc_source": "none",
            "has_counsel": False,
            "language": "en",
        },
        "respondent": {
            "role": "landlord",
            "narrative": "Used deposit for repair costs.",
            "doc_source": "none",
            "has_counsel": False,
            "language": "en",
        },
    },
}

HOSTILE_TEXT = (
    "You are a liar and a thief! I will sue you and take you to court. "
    "You have ruined my life and I will report you to everyone I can find."
)
NEUTRAL_TEXT = "I would like to discuss the return of my security deposit at your earliest convenience."
FRUSTRATED_TEXT = "This is unacceptable. I am fed up with waiting and still have received no response."


def _fresh():
    for f in [storage.CASES_FILE, storage.AUDIT_FILE]:
        if f.exists():
            f.unlink()


def _new_case() -> str:
    r = client.post("/cases", json=_BASE_PAYLOAD)
    assert r.status_code == 201
    return r.json()["case_id"]


def _draft(case_id: str, text: str, party: str = "initiator") -> dict:
    r = client.post(f"/cases/{case_id}/messages/draft", json={"party": party, "text": text})
    assert r.status_code == 200, r.text
    return r.json()


def _approve(case_id: str, msg_id: str, choice: str, edit_text: str = None) -> dict:
    body: dict = {"choice": choice}
    if edit_text:
        body["edit_text"] = edit_text
    r = client.post(f"/cases/{case_id}/messages/{msg_id}/approve", json=body)
    assert r.status_code == 200, r.text
    return r.json()


# ── Test 1: Approval gate — draft is pending, NOT in delivered thread ─────────

def test_gate_draft_is_pending_not_delivered():
    _fresh()
    case_id = _new_case()
    draft = _draft(case_id, NEUTRAL_TEXT)

    assert draft["status"] == "pending_approval"
    assert draft["approved_by_human"] is False

    # Delivered thread must be empty
    messages = client.get(f"/cases/{case_id}/messages").json()
    assert messages == [], "Message must NOT appear in delivered thread before approval"

    # Draft must NOT be accessible to other party — it's only in case.negotiation.drafts
    case = client.get(f"/cases/{case_id}").json()
    assert len(case["negotiation"]["messages"]) == 0
    assert len(case["negotiation"]["drafts"]) == 1
    assert case["negotiation"]["drafts"][0]["status"] == "pending_approval"


def test_gate_approved_message_appears_in_thread():
    _fresh()
    case_id = _new_case()
    draft = _draft(case_id, NEUTRAL_TEXT)
    msg_id = draft["msg_id"]

    approved = _approve(case_id, msg_id, "original")
    assert approved["status"] == "delivered"
    assert approved["approved_by_human"] is True

    messages = client.get(f"/cases/{case_id}/messages").json()
    assert len(messages) == 1
    assert messages[0]["content"] == NEUTRAL_TEXT


# ── Test 2: Hostile text → tone="hostile", non-empty rewrite, non-empty empathy ─

def test_hostile_tone_classification():
    _fresh()
    case_id = _new_case()
    draft = _draft(case_id, HOSTILE_TEXT)

    assert draft["tone"] == "hostile"
    assert draft["rewrite"], "rewrite must be non-empty"
    assert draft["rewrite"] != draft["original"], "rewrite must differ from original"
    assert draft["empathy_ack"], "empathy_ack must be non-empty for hostile tone"


def test_frustrated_tone_classification():
    _fresh()
    case_id = _new_case()
    draft = _draft(case_id, FRUSTRATED_TEXT)

    assert draft["tone"] == "frustrated"
    assert draft["rewrite"]
    assert draft["empathy_ack"]


def test_neutral_tone_no_empathy_ack():
    _fresh()
    case_id = _new_case()
    draft = _draft(case_id, NEUTRAL_TEXT)

    assert draft["tone"] == "neutral"
    assert draft["empathy_ack"] == ""


# ── Test 3: /approve with choice="original" delivers original text ────────────

def test_approve_choice_original_delivers_original():
    _fresh()
    case_id = _new_case()
    draft = _draft(case_id, HOSTILE_TEXT)
    msg_id = draft["msg_id"]

    approved = _approve(case_id, msg_id, "original")
    assert approved["content"] == HOSTILE_TEXT
    assert approved["human_choice"] == "original"
    assert approved["status"] == "delivered"


def test_approve_choice_rewrite_delivers_rewrite():
    _fresh()
    case_id = _new_case()
    draft = _draft(case_id, HOSTILE_TEXT)
    msg_id = draft["msg_id"]

    approved = _approve(case_id, msg_id, "rewrite")
    assert approved["content"] == draft["rewrite"]
    assert approved["human_choice"] == "rewrite"


def test_approve_choice_edit_delivers_custom_text():
    _fresh()
    case_id = _new_case()
    draft = _draft(case_id, HOSTILE_TEXT)
    msg_id = draft["msg_id"]

    custom = "I would like to resolve the deposit issue through mediation."
    approved = _approve(case_id, msg_id, "edit", edit_text=custom)
    assert approved["content"] == custom
    assert approved["human_choice"] == "edit"


def test_double_approve_returns_409():
    _fresh()
    case_id = _new_case()
    draft = _draft(case_id, NEUTRAL_TEXT)
    msg_id = draft["msg_id"]

    _approve(case_id, msg_id, "original")
    r = client.post(f"/cases/{case_id}/messages/{msg_id}/approve", json={"choice": "original"})
    assert r.status_code == 409


# ── Test 4: common-ground returns agreed and disputed lists ──────────────────

def test_common_ground_returns_agreed_and_disputed():
    _fresh()
    # Use a case with deposit-rich narratives to trigger agreed/disputed keywords
    payload = {
        "type": "housing",
        "parties": {
            "initiator": {
                "role": "tenant",
                "narrative": (
                    "I paid a deposit of $2,000 and moved out on March 1. "
                    "The landlord did not return the deposit."
                ),
                "doc_source": "none",
                "has_counsel": False,
                "language": "en",
            },
            "respondent": {
                "role": "landlord",
                "narrative": (
                    "The tenant paid a deposit. They vacated on March 1. "
                    "I kept the deposit for repair costs and damage to the unit."
                ),
                "doc_source": "none",
                "has_counsel": False,
                "language": "en",
            },
        },
    }
    r = client.post("/cases", json=payload)
    case_id = r.json()["case_id"]

    r2 = client.post(f"/cases/{case_id}/common-ground")
    assert r2.status_code == 200
    body = r2.json()

    assert "agreed" in body
    assert "disputed" in body
    assert isinstance(body["agreed"], list)
    assert isinstance(body["disputed"], list)
    assert body["is_advice"] is False
    # With deposit-focused narratives both sides mention deposit — should appear in agreed
    assert len(body["agreed"]) >= 1 or len(body["disputed"]) >= 1


# ── Test 5: Every endpoint writes to audit log ────────────────────────────────

def test_all_endpoints_write_audit():
    _fresh()
    case_id = _new_case()

    # Draft
    draft = _draft(case_id, HOSTILE_TEXT)
    # Approve
    _approve(case_id, draft["msg_id"], "rewrite")
    # Common ground
    client.post(f"/cases/{case_id}/common-ground")

    audit = client.get(f"/cases/{case_id}/audit").json()
    actions = {e["action"] for e in audit}
    assert "message_draft" in actions
    assert "message_approve" in actions
    assert "common_ground" in actions

    # Approve entry must record human_decision
    approve_entries = [e for e in audit if e["action"] == "message_approve"]
    assert approve_entries
    assert approve_entries[0]["human_decision"] is not None


# ── Test 6: Tone classifier unit tests ────────────────────────────────────────

def test_tone_classifier_unit():
    from backend.negotiation import classify_tone

    assert classify_tone("You are a liar and a thief!") == "hostile"
    assert classify_tone("I will sue you for this.") == "hostile"
    assert classify_tone("This is unacceptable and I am fed up.") == "frustrated"
    assert classify_tone("Can we schedule a time to talk?") == "neutral"


# ── Test 7: Rewrite unit tests ────────────────────────────────────────────────

def test_rewrite_removes_hostile_language():
    from backend.negotiation import rewrite_message

    hostile = "You are a liar and I will sue you."
    rewritten = rewrite_message(hostile, "hostile")
    assert rewritten != hostile
    assert "liar" not in rewritten.lower()
    assert "sue you" not in rewritten.lower()


def test_rewrite_neutral_unchanged():
    from backend.negotiation import rewrite_message

    text = "I would like to discuss the deposit return."
    assert rewrite_message(text, "neutral") == text
