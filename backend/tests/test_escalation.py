"""Phase 7 escalation packet + settlement template tests."""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

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
            "narrative": (
                "Tenant: John Smith. I paid a security deposit of $2,000 and moved out on March 1, 2024. "
                "The landlord did not return the deposit after 45 days. Monthly rent was $1,500."
            ),
            "doc_source": "none",
            "has_counsel": False,
            "language": "en",
        },
        "respondent": {
            "role": "landlord",
            "narrative": (
                "Landlord: Jane Doe. The tenant vacated on March 1. "
                "I kept the deposit for repair costs and cleaning fees."
            ),
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


def _escalate(case_id: str) -> dict:
    r = client.post(f"/cases/{case_id}/escalate")
    assert r.status_code == 200, r.text
    return r.json()


def _settlement(case_id: str, terms: list[str], approved: bool = False) -> dict:
    r = client.post(
        f"/cases/{case_id}/settlement-draft",
        json={"agreed_terms": terms, "human_approved": approved},
    )
    assert r.status_code == 200, r.text
    return r.json()


# ── Test 1: Escalation packet has all six sections, each non-empty ────────────

def test_escalation_packet_has_all_six_sections():
    _fresh()
    case_id = _new_case()
    packet = _escalate(case_id)

    required_sections = [
        "timeline",
        "applicable_statutes",
        "agreed_facts",
        "disputed_facts",
        "ranges",
        "open_issues",
    ]
    for section in required_sections:
        assert section in packet, f"Missing section: {section}"
        val = packet[section]
        # Each section must be non-empty (list or dict with content)
        if isinstance(val, list):
            assert len(val) > 0, f"Section '{section}' is an empty list"
        elif isinstance(val, dict):
            assert len(val) > 0, f"Section '{section}' is an empty dict"
        else:
            assert val, f"Section '{section}' is falsy"


# ── Test 2: Timeline is ordered (system event first, then intake events) ──────

def test_timeline_ordered_system_first():
    _fresh()
    case_id = _new_case()
    packet = _escalate(case_id)

    timeline = packet["timeline"]
    assert isinstance(timeline, list)
    assert len(timeline) >= 1
    # First event must be case-open
    assert "Case opened" in timeline[0]["label"] or timeline[0]["party"] == "system"
    # Must have party and label fields
    for event in timeline:
        assert "label" in event
        assert "value" in event
        assert "party" in event


def test_timeline_includes_intake_answers_when_present():
    _fresh()
    case_id = _new_case()
    # Record an intake answer so it shows in timeline
    client.post(
        f"/cases/{case_id}/intake/answer",
        data={"party": "initiator", "question_id": "q_dispute_type", "answer": "Security deposit"},
    )
    packet = _escalate(case_id)
    labels = [e["label"] for e in packet["timeline"]]
    assert any("initiator" in lbl.lower() or "Dispute type" in lbl for lbl in labels)


# ── Test 3: Settlement template fills case fields and has two signature blocks ─

def test_settlement_draft_fills_case_fields():
    _fresh()
    case_id = _new_case()
    terms = ["Landlord returns $1,500 to tenant within 14 days", "Both parties agree to close this dispute"]
    draft = _settlement(case_id, terms)

    doc = draft["document"]
    assert case_id in doc, "case_id must appear in document"
    assert draft["parties"]["initiator"]["role"] == "tenant"
    assert draft["parties"]["respondent"]["role"] == "landlord"
    # Agreed terms must appear in doc
    assert "Landlord returns $1,500" in doc


def test_settlement_draft_has_two_party_signature_blocks():
    _fresh()
    case_id = _new_case()
    draft = _settlement(case_id, ["Landlord returns deposit"])

    doc = draft["document"]
    # Count "Signature:" lines — must have at least 2 party blocks
    sig_count = doc.count("Signature: __")
    assert sig_count >= 2, f"Expected >=2 signature blocks, found {sig_count}"
    # Verify both roles appear in signature section
    assert "tenant" in doc.lower() or "initiator" in doc.lower()
    assert "landlord" in doc.lower() or "respondent" in doc.lower()
    assert draft["signature_blocks"] >= 2


# ── Test 4: Status only flips to "settled" with human_approved=True ──────────

def test_status_not_settled_without_approval():
    _fresh()
    case_id = _new_case()
    draft = _settlement(case_id, ["Landlord returns deposit"], approved=False)

    assert draft["status"] == "draft"
    assert draft["human_approved"] is False

    case = client.get(f"/cases/{case_id}").json()
    assert case["status"] != "settled"


def test_status_settles_only_with_human_approved_true():
    _fresh()
    case_id = _new_case()
    draft = _settlement(case_id, ["Landlord returns deposit"], approved=True)

    assert draft["status"] == "settled"
    assert draft["human_approved"] is True

    case = client.get(f"/cases/{case_id}").json()
    assert case["status"] == "settled"


def test_escalate_sets_case_status_escalated():
    _fresh()
    case_id = _new_case()
    _escalate(case_id)

    case = client.get(f"/cases/{case_id}").json()
    assert case["status"] == "escalated"


# ── Test 5: Both endpoints write audit ────────────────────────────────────────

def test_escalation_audit_logged():
    _fresh()
    case_id = _new_case()
    _escalate(case_id)

    audit = client.get(f"/cases/{case_id}/audit").json()
    assert any(e["action"] == "escalate" for e in audit)


def test_settlement_audit_logged():
    _fresh()
    case_id = _new_case()
    _settlement(case_id, ["Return $1,500"], approved=True)

    audit = client.get(f"/cases/{case_id}/audit").json()
    assert any(e["action"] == "settlement_draft" for e in audit)
    # Human-approved entry must record human_decision
    entries = [e for e in audit if e["action"] == "settlement_draft"]
    assert entries[0]["human_decision"] is not None


# ── Test 6: Packet stored on case ────────────────────────────────────────────

def test_escalation_packet_stored_on_case():
    _fresh()
    case_id = _new_case()
    _escalate(case_id)

    case = client.get(f"/cases/{case_id}").json()
    assert case["escalation_packet"] is not None
    assert "timeline" in case["escalation_packet"]


def test_settlement_draft_stored_on_case():
    _fresh()
    case_id = _new_case()
    _settlement(case_id, ["Return deposit"])

    case = client.get(f"/cases/{case_id}").json()
    assert case["settlement_draft"] is not None
    assert "document" in case["settlement_draft"]


# ── Test 7: AI-assembly disclaimer always present ─────────────────────────────

def test_escalation_packet_has_ai_assembly_note():
    _fresh()
    case_id = _new_case()
    packet = _escalate(case_id)
    assert packet.get("assembled_by")
    assert "AI" in packet["assembled_by"]
    assert packet["is_advice"] is False


def test_settlement_draft_has_ai_disclosure():
    _fresh()
    case_id = _new_case()
    draft = _settlement(case_id, ["Return deposit"])
    assert "AI" in draft["document"]
    assert draft["is_advice"] is False
