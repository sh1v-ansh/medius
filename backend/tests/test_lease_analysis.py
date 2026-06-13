"""Phase 11 — lease analysis tests."""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

_tmp = tempfile.mkdtemp()
os.environ["MEDIUS_DATA_DIR"] = _tmp

from backend.main import app  # noqa: E402
from backend.lease_analysis import analyze_lease, SAMPLE_LEASE  # noqa: E402
import backend.storage as storage  # noqa: E402

storage.DATA_DIR = Path(_tmp)
storage.CASES_FILE = Path(_tmp) / "cases.json"
storage.AUDIT_FILE = Path(_tmp) / "audit.json"
storage.TRANSLATIONS_FILE = Path(_tmp) / "translations.json"

client = TestClient(app)

_BASE_CASE = {
    "type": "housing",
    "parties": {
        "initiator": {"role": "tenant", "narrative": "", "doc_source": "none", "has_counsel": False, "language": "en"},
        "respondent": {"role": "landlord", "narrative": "", "doc_source": "none", "has_counsel": False, "language": "en"},
    },
}


def _fresh():
    for p in [storage.CASES_FILE, storage.AUDIT_FILE]:
        if p.exists():
            p.unlink()


def _new_case() -> str:
    r = client.post("/cases", json=_BASE_CASE)
    assert r.status_code == 201
    return r.json()["case_id"]


# ── Unit tests for the analysis engine ───────────────────────────────────────

def test_sample_lease_detects_illegal_clauses():
    result = analyze_lease(SAMPLE_LEASE)
    illegal = [i for i in result["issues"] if i["severity"] == "illegal"]
    assert len(illegal) >= 4, f"Expected ≥4 illegal clauses, got {len(illegal)}: {[i['id'] for i in illegal]}"


def test_sample_lease_detects_waiver_of_habitability():
    result = analyze_lease(SAMPLE_LEASE)
    ids = [i["id"] for i in result["issues"]]
    assert "waive_habitability" in ids


def test_sample_lease_detects_excess_security_deposit():
    result = analyze_lease(SAMPLE_LEASE)
    ids = [i["id"] for i in result["issues"]]
    assert "excess_security_deposit" in ids


def test_sample_lease_detects_unrestricted_entry():
    result = analyze_lease(SAMPLE_LEASE)
    ids = [i["id"] for i in result["issues"]]
    assert "unrestricted_entry" in ids


def test_sample_lease_detects_waive_right_to_sue():
    result = analyze_lease(SAMPLE_LEASE)
    ids = [i["id"] for i in result["issues"]]
    assert "waive_right_to_sue" in ids


def test_sample_lease_detects_missing_disclosures():
    result = analyze_lease(SAMPLE_LEASE)
    assert len(result["missing_disclosures"]) >= 1


def test_sample_lease_extracts_key_terms():
    result = analyze_lease(SAMPLE_LEASE)
    terms = result["key_terms"]
    assert "monthly_rent" in terms
    assert "security_deposit" in terms


def test_clean_lease_has_no_illegal_clauses():
    clean = """
    LEASE AGREEMENT
    Monthly rent is $1,500 per month. Security deposit of $1,500.
    Landlord shall give 24-hour notice before entry.
    Landlord warrants habitability. Lead paint disclosure attached.
    Move-in checklist provided. Security deposit receipt to be issued within 30 days.
    Tenant shall receive interest on security deposit at 5% per year.
    Last month's rent interest at 5% per year shall be paid.
    Auto-renewal unless 30 days notice given.
    """
    result = analyze_lease(clean)
    illegal = [i for i in result["issues"] if i["severity"] == "illegal"]
    assert len(illegal) == 0, f"Clean lease should have no illegal clauses: {[i['id'] for i in illegal]}"


def test_empty_text_returns_error():
    result = analyze_lease("")
    assert "error" in result


def test_result_includes_not_considered_note():
    result = analyze_lease(SAMPLE_LEASE)
    assert "not_considered" in result
    assert len(result["not_considered"]) > 20


def test_result_is_not_advice():
    result = analyze_lease(SAMPLE_LEASE)
    assert result.get("is_advice") is False


# ── API endpoint tests ────────────────────────────────────────────────────────

def test_analyze_lease_endpoint_demo_mode():
    """Without a lease doc uploaded, endpoint falls back to sample lease (demo mode)."""
    _fresh()
    case_id = _new_case()
    r = client.post(f"/cases/{case_id}/analyze-lease")
    assert r.status_code == 200
    body = r.json()
    assert body["demo_mode"] is True
    assert body["summary"]["red_flags"] >= 4


def test_analyze_lease_endpoint_with_real_text():
    """With a lease doc uploaded, endpoint analyzes real text."""
    _fresh()
    case_id = _new_case()

    # Inject a lease with one known issue
    from backend.storage import get_case, save_case
    case = get_case(case_id)
    case["intake"]["initiator"]["answers"]["__doc_text__"] = (
        "Monthly rent is $1,200. Security deposit of $1,200. "
        "Landlord may enter at any time without notice."
    )
    save_case(case)

    r = client.post(f"/cases/{case_id}/analyze-lease")
    assert r.status_code == 200
    body = r.json()
    assert body["demo_mode"] is False
    ids = [i["id"] for i in body["issues"]]
    assert "unrestricted_entry" in ids


def test_sample_lease_endpoint():
    r = client.get("/lease-analysis/sample")
    assert r.status_code == 200
    body = r.json()
    assert body["demo_mode"] is True
    assert "issues" in body
    assert "missing_disclosures" in body
    assert "key_terms" in body
