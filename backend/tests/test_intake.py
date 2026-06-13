"""Phase 2 intake tests."""
from __future__ import annotations

import io
import json
import os
import tempfile
from pathlib import Path
from unittest.mock import patch

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
            "narrative": "",
            "doc_source": "none",
            "has_counsel": False,
            "language": "en",
        },
        "respondent": {
            "role": "landlord",
            "narrative": "",
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


def _new_case(**overrides) -> str:
    payload = json.loads(json.dumps(_BASE_PAYLOAD))
    payload.update(overrides)
    r = client.post("/cases", json=payload)
    assert r.status_code == 201
    return r.json()["case_id"]


# ── Test 1: branching tree returns different next-question for yes vs no ────

def test_branching_yes_vs_no():
    _fresh()
    case_id = _new_case()

    # First question should be q_dispute_type
    r = client.post(f"/cases/{case_id}/intake/next", json={"party": "initiator", "answers": {}})
    assert r.status_code == 200
    first_q = r.json()["question"]
    assert first_q["id"] == "q_dispute_type"

    # Answer "Security deposit" -> should lead to q_deposit_amount
    r_yes = client.post(f"/cases/{case_id}/intake/next", json={
        "party": "initiator",
        "answers": {"q_dispute_type": "Security deposit"},
    })
    assert r_yes.status_code == 200
    next_after_deposit = r_yes.json()["question"]["id"]

    # Answer "Eviction / notice to leave" -> should lead to q_eviction_notice
    r_no = client.post(f"/cases/{case_id}/intake/next", json={
        "party": "initiator",
        "answers": {"q_dispute_type": "Eviction / notice to leave"},
    })
    assert r_no.status_code == 200
    next_after_eviction = r_no.json()["question"]["id"]

    # The two branches must diverge
    assert next_after_deposit != next_after_eviction
    assert next_after_deposit == "q_deposit_amount"
    assert next_after_eviction == "q_eviction_notice"


def test_yes_no_branching_on_deposit_returned():
    """q_deposit_returned branches: yes -> q_deposit_full, no -> q_days_since_moveout."""
    _fresh()
    case_id = _new_case()

    base_answers = {"q_dispute_type": "Security deposit", "q_deposit_amount": "2000"}

    r_yes = client.post(f"/cases/{case_id}/intake/next", json={
        "party": "initiator",
        "answers": {**base_answers, "q_deposit_returned": "yes"},
    })
    next_yes = r_yes.json()["question"]["id"]

    r_no = client.post(f"/cases/{case_id}/intake/next", json={
        "party": "initiator",
        "answers": {**base_answers, "q_deposit_returned": "no"},
    })
    next_no = r_no.json()["question"]["id"]

    assert next_yes == "q_deposit_full"
    assert next_no == "q_days_since_moveout"
    assert next_yes != next_no


# ── Test 2: audio answer routed through transcribe() (mock) and stored ─────

def test_audio_answer_routed_through_transcribe():
    _fresh()
    case_id = _new_case()

    fake_transcript = "My landlord kept my entire $2,000 deposit."

    with patch("backend.main.transcribe", return_value=fake_transcript) as mock_t:
        fake_audio = io.BytesIO(b"\x00\x01\x02\x03")  # dummy bytes
        r = client.post(
            f"/cases/{case_id}/intake/answer",
            data={"party": "initiator", "question_id": "q_deposit_amount"},
            files={"audio": ("answer.wav", fake_audio, "audio/wav")},
        )
        assert r.status_code == 200
        mock_t.assert_called_once()
        assert r.json()["recorded"] == fake_transcript

    # Verify it was persisted
    case = client.get(f"/cases/{case_id}").json()
    assert case["intake"]["initiator"]["answers"]["q_deposit_amount"] == fake_transcript


# ── Test 3: finish produces non-empty narrative from short answers ──────────

def test_finish_reconstructs_narrative():
    _fresh()
    case_id = _new_case()

    answers = {
        "q_dispute_type": "Security deposit",
        "q_deposit_amount": "1500",
        "q_deposit_returned": "no",
        "q_days_since_moveout": "45",
        "q_doc_source": "No document at all",
        "q_jurisdiction": "Massachusetts",
        "q_has_counsel": "no",
    }

    for qid, ans in answers.items():
        r = client.post(
            f"/cases/{case_id}/intake/answer",
            data={"party": "initiator", "question_id": qid, "answer": ans},
        )
        assert r.status_code == 200

    r = client.post(f"/cases/{case_id}/intake/finish", params={"party": "initiator"})
    assert r.status_code == 200
    body = r.json()
    assert body["narrative"]
    assert len(body["narrative"]) > 20
    assert "Security deposit" in body["narrative"] or "1500" in body["narrative"]

    # Confirm it was saved on the case
    case = client.get(f"/cases/{case_id}").json()
    assert case["parties"]["initiator"]["narrative"]


# ── Test 4: doc_source "none" yields assumptions flagged "confirm", not fact ─

def test_no_doc_yields_assumptions_flagged_confirm():
    _fresh()
    # Create case with doc_source=none (default)
    case_id = _new_case()

    minimal_answers = {
        "q_dispute_type": "Security deposit",
        "q_jurisdiction_nodoc": "Boston",
        "q_unit_type": "Apartment",
        "q_monthly_rent": "1200",
        "q_jurisdiction": "Massachusetts",
        "q_has_counsel": "no",
    }
    for qid, ans in minimal_answers.items():
        client.post(
            f"/cases/{case_id}/intake/answer",
            data={"party": "initiator", "question_id": qid, "answer": ans},
        )

    r = client.post(f"/cases/{case_id}/intake/finish", params={"party": "initiator"})
    assert r.status_code == 200
    body = r.json()
    assert "assumptions" in body
    assumptions_block = body["assumptions"]
    assert assumptions_block["flagged"] == "confirm"
    for item in assumptions_block["assumptions"]:
        assert item["confirm"] is True
    # Note must disclaim — not stated as fact
    assert "ASSUMPTIONS" in assumptions_block["note"] or "confirm" in assumptions_block["note"].lower()


# ── Test 5: doc_source "photo" routes through ocr() (mock) ─────────────────

def test_photo_routes_through_ocr():
    _fresh()
    payload = json.loads(json.dumps(_BASE_PAYLOAD))
    payload["parties"]["initiator"]["doc_source"] = "photo"
    r = client.post("/cases", json=payload)
    case_id = r.json()["case_id"]

    fake_ocr_text = "LEASE AGREEMENT\nTenant: Jane Doe\nSecurity Deposit: $1,000"

    with patch("backend.main.ocr", return_value=fake_ocr_text) as mock_ocr:
        fake_image = io.BytesIO(b"\xff\xd8\xff")  # JPEG magic bytes
        r2 = client.post(
            f"/cases/{case_id}/intake/upload-doc",
            data={"party": "initiator", "doc_source": "photo"},
            files={"file": ("lease.jpg", fake_image, "image/jpeg")},
        )
        assert r2.status_code == 200
        mock_ocr.assert_called_once()

    case = client.get(f"/cases/{case_id}").json()
    assert case["parties"]["initiator"]["doc_source"] == "photo"
    assert case["intake"]["initiator"]["answers"]["__doc_text__"] == fake_ocr_text
