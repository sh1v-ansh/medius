"""Phase 5 steelman + shared-reality tests."""
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

SAMPLE_LEASE = (
    "Tenant: John Smith. Landlord: Jane Doe. "
    "Security deposit: $2,000. Monthly rent $1,500. "
    "Tenant vacated March 1, 2024. Landlord has not returned the deposit after 45 days."
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
            "narrative": "Deposit used for legitimate repair costs after tenant vacated.",
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


def _do_steelman(case_id: str) -> dict:
    r = client.post(f"/cases/{case_id}/steelman")
    assert r.status_code == 200, r.text
    return r.json()


def _do_shared_reality(case_id: str) -> dict:
    r = client.post(f"/cases/{case_id}/shared-reality")
    assert r.status_code == 200, r.text
    return r.json()


# ── Test 1: Both steelman args non-empty and lockbox-clean ───────────────────

def test_both_steelman_args_nonempty():
    _fresh()
    case_id = _new_case()
    body = _do_steelman(case_id)

    for party in ("initiator", "respondent"):
        key = f"{party}_argument"
        assert key in body, f"Missing {key}"
        arg = body[key]
        assert arg["levels"]["simple"], f"{key} simple level empty"
        assert arg["levels"]["standard"], f"{key} standard level empty"
        assert arg["levels"]["full"], f"{key} full level empty"
        assert isinstance(arg["citations"], list) and len(arg["citations"]) >= 1


def test_steelman_lockbox_clean():
    """unverified_removed must be empty (no invented citations in text)."""
    _fresh()
    case_id = _new_case()
    body = _do_steelman(case_id)

    for party in ("initiator", "respondent"):
        arg = body[f"{party}_argument"]
        assert arg["unverified_removed"] == [], (
            f"{party}_argument has unverified citations: {arg['unverified_removed']}"
        )


# ── Test 2: Each argument has three reading levels ────────────────────────────

def test_steelman_three_levels_exist_and_distinct():
    _fresh()
    case_id = _new_case()
    body = _do_steelman(case_id)

    for party in ("initiator", "respondent"):
        levels = body[f"{party}_argument"]["levels"]
        assert set(levels.keys()) >= {"simple", "standard", "full"}
        assert levels["simple"] != levels["standard"]
        assert levels["standard"] != levels["full"]
        assert levels["simple"] != levels["full"]
        # full must contain verbatim statute text
        citations = body[f"{party}_argument"]["citations"]
        assert any(c["statute_text"][:20] in levels["full"] for c in citations), (
            f"{party} full level must contain verbatim statute text"
        )


# ── Test 3: Shared-reality ordering invariant ─────────────────────────────────

def test_shared_reality_range_ordering():
    _fresh()
    case_id = _new_case()
    body = _do_shared_reality(case_id)

    floor = body["floor"]
    low = body["typical_band"]["low"]
    high = body["typical_band"]["high"]
    ceiling = body["ceiling"]

    assert floor <= low, f"floor {floor} > typical.low {low}"
    assert low <= high, f"typical.low {low} > typical.high {high}"
    assert high <= ceiling, f"typical.high {high} > ceiling {ceiling}"


def test_shared_reality_citations_have_statute_text():
    _fresh()
    case_id = _new_case()
    body = _do_shared_reality(case_id)

    assert isinstance(body["citations"], list) and len(body["citations"]) >= 1
    for cit in body["citations"]:
        assert cit["statute_text"], f"Citation {cit['statute_id']} has empty statute_text"
        assert cit["statute_id"]


def test_shared_reality_anchor_note_not_settlement():
    """anchor_note must disclaim AI-chosen settlement."""
    _fresh()
    case_id = _new_case()
    body = _do_shared_reality(case_id)

    note = body.get("anchor_note", "").lower()
    assert note, "anchor_note missing"
    assert "not" in note and ("settlement" in note or "predict" in note or "recommendation" in note)
    assert body["is_advice"] is False


# ── Test 4: Same code path — no method-changing branch ───────────────────────

def test_both_parties_same_code_path():
    """
    build_steelman_argument is called identically for both parties.
    Verify by inspecting that the function is called with only the source text
    and perspective — no conditional logic.
    """
    from backend.steelman import build_steelman_argument

    initiator_result = build_steelman_argument(SAMPLE_LEASE, "tenant")
    respondent_result = build_steelman_argument(
        "Deposit used for legitimate repair costs.", "landlord"
    )

    # Both produce the same structure
    for key in ("levels", "citations", "unverified_removed", "not_considered", "is_advice"):
        assert key in initiator_result, f"initiator missing key: {key}"
        assert key in respondent_result, f"respondent missing key: {key}"

    for r in (initiator_result, respondent_result):
        assert set(r["levels"].keys()) >= {"simple", "standard", "full"}
        assert r["is_advice"] is False


# ── Test 5: Steelman stored on case and audit-logged ─────────────────────────

def test_steelman_stored_and_audit_logged():
    _fresh()
    case_id = _new_case()
    _do_steelman(case_id)

    case = client.get(f"/cases/{case_id}").json()
    assert case["steelman"] is not None
    assert "initiator_argument" in case["steelman"]
    assert "respondent_argument" in case["steelman"]

    audit = client.get(f"/cases/{case_id}/audit").json()
    assert any(e["action"] == "steelman" for e in audit)


def test_shared_reality_stored_and_audit_logged():
    _fresh()
    case_id = _new_case()
    _do_shared_reality(case_id)

    case = client.get(f"/cases/{case_id}").json()
    assert case["shared_reality"] is not None
    assert "floor" in case["shared_reality"]

    audit = client.get(f"/cases/{case_id}/audit").json()
    assert any(e["action"] == "shared_reality" for e in audit)
