"""Phase 4 triage + merits firewall tests."""
from __future__ import annotations

import json
import os
import tempfile
from copy import deepcopy
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


def _fresh():
    for f in [storage.CASES_FILE, storage.AUDIT_FILE]:
        if f.exists():
            f.unlink()


def _make_case(initiator_counsel: bool = False, respondent_counsel: bool = False,
               narrative_i: str = "", narrative_r: str = "") -> dict:
    return {
        "type": "housing",
        "parties": {
            "initiator": {
                "role": "tenant",
                "narrative": narrative_i or "Landlord has not returned my security deposit after 45 days.",
                "doc_source": "none",
                "has_counsel": initiator_counsel,
                "language": "en",
            },
            "respondent": {
                "role": "landlord",
                "narrative": narrative_r or "Deposit used for legitimate repair costs.",
                "doc_source": "none",
                "has_counsel": respondent_counsel,
                "language": "en",
            },
        },
    }


def _create_and_triage(payload: dict) -> dict:
    r = client.post("/cases", json=payload)
    assert r.status_code == 201
    case_id = r.json()["case_id"]
    r2 = client.post(f"/cases/{case_id}/triage")
    assert r2.status_code == 200, r2.text
    return r2.json()


# ── Test 1: All scores are ints in [0, 100] ───────────────────────────────────

def test_scores_are_ints_in_range():
    _fresh()
    result = _create_and_triage(_make_case())
    scores = result["scores"]
    assert set(scores.keys()) == {"urgency", "power_asymmetry", "violation_strength", "settlement_likelihood"}
    for name, val in scores.items():
        assert isinstance(val, int), f"{name} must be int, got {type(val)}"
        assert 0 <= val <= 100, f"{name}={val} out of [0,100]"
    assert isinstance(result["composite"], int)
    assert 0 <= result["composite"] <= 100


# ── Test 2: High urgency + asymmetry ranks above low ─────────────────────────

def test_high_urgency_asymmetry_ranks_above_low():
    _fresh()

    # High urgency: eviction, court date, children; respondent has counsel (asymmetry)
    high_narrative = (
        "I received a notice to quit for eviction. I have young children and "
        "we have no heat. The court date is imminent. Landlord has a lawyer."
    )
    high_result = _create_and_triage(_make_case(
        respondent_counsel=True,
        narrative_i=high_narrative,
    ))

    # Low urgency: simple deposit question, both self-represented, settled tone
    low_narrative = "We had a small disagreement about the deposit receipt."
    low_result = _create_and_triage(_make_case(
        narrative_i=low_narrative,
        narrative_r="I was willing to discuss this.",
    ))

    assert high_result["composite"] > low_result["composite"], (
        f"High urgency composite {high_result['composite']} should exceed "
        f"low urgency composite {low_result['composite']}"
    )
    assert high_result["scores"]["urgency"] > low_result["scores"]["urgency"]
    assert high_result["scores"]["power_asymmetry"] > low_result["scores"]["power_asymmetry"]


# ── Test 3: Merits firewall ────────────────────────────────────────────────────

def test_firewall_counsel_changes_only_power_asymmetry():
    """
    Flipping respondent.has_counsel must change power_asymmetry
    but must NOT change violation_strength or settlement_likelihood.
    """
    _fresh()

    narrative = "Landlord did not return deposit after 45 days and provided no receipt."

    result_no_counsel = _create_and_triage(_make_case(
        respondent_counsel=False,
        narrative_i=narrative,
    ))
    result_with_counsel = _create_and_triage(_make_case(
        respondent_counsel=True,
        narrative_i=narrative,
    ))

    pa_no = result_no_counsel["scores"]["power_asymmetry"]
    pa_yes = result_with_counsel["scores"]["power_asymmetry"]
    vs_no = result_no_counsel["scores"]["violation_strength"]
    vs_yes = result_with_counsel["scores"]["violation_strength"]
    sl_no = result_no_counsel["scores"]["settlement_likelihood"]
    sl_yes = result_with_counsel["scores"]["settlement_likelihood"]

    assert pa_no != pa_yes, "power_asymmetry must change when has_counsel changes"
    assert vs_no == vs_yes, (
        f"violation_strength must NOT change (firewall): {vs_no} vs {vs_yes}"
    )
    assert sl_no == sl_yes, (
        f"settlement_likelihood must NOT change (firewall): {sl_no} vs {sl_yes}"
    )


# ── Test 4: WEIGHTS is one importable constant ────────────────────────────────

def test_weights_importable_and_correct_keys():
    from backend.triage import WEIGHTS

    assert isinstance(WEIGHTS, dict)
    assert set(WEIGHTS.keys()) == {"urgency", "power_asymmetry", "violation_strength", "settlement_inverse"}
    total = sum(WEIGHTS.values())
    assert abs(total - 1.0) < 1e-9, f"Weights must sum to 1.0, got {total}"


def test_weights_used_in_composite_formula():
    """Manually verify the composite formula against known scores."""
    from backend.triage import WEIGHTS, compute_composite

    urg, pa, vs, sl = 80, 70, 60, 30
    expected = (
        urg * WEIGHTS["urgency"]
        + pa * WEIGHTS["power_asymmetry"]
        + vs * WEIGHTS["violation_strength"]
        + (100 - sl) * WEIGHTS["settlement_inverse"]
    )
    result = compute_composite(urg, pa, vs, sl)
    assert result == round(expected)


# ── Test 5: rationales are present and non-empty ─────────────────────────────

def test_rationales_present_and_nonempty():
    _fresh()
    result = _create_and_triage(_make_case())
    rationales = result["rationales"]
    assert set(rationales.keys()) == {"urgency", "power_asymmetry", "violation_strength", "settlement_likelihood"}
    for name, text in rationales.items():
        assert text and len(text) > 5, f"rationale for {name} is empty"


# ── Test 6: triage stored on case and audit-logged ────────────────────────────

def test_triage_stored_on_case_and_audit_logged():
    _fresh()
    r = client.post("/cases", json=_make_case())
    case_id = r.json()["case_id"]
    client.post(f"/cases/{case_id}/triage")

    case = client.get(f"/cases/{case_id}").json()
    assert case["triage"] is not None
    assert "composite" in case["triage"]

    audit = client.get(f"/cases/{case_id}/audit").json()
    assert any(e["action"] == "triage" for e in audit)


# ── Test 7: note on triage output disclaims queue-sort purpose ───────────────

def test_triage_note_disclaims_outcome_prediction():
    _fresh()
    result = _create_and_triage(_make_case())
    note = result.get("note", "")
    assert note, "triage result must include a note"
    note_lower = note.lower()
    assert "queue" in note_lower or "sort" in note_lower or "mediator" in note_lower
    assert "predict" not in note_lower or "not predict" in note_lower
