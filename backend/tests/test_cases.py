import json
import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Redirect data files to a temp dir so tests are isolated
_tmp = tempfile.mkdtemp()
os.environ["MEDIUS_DATA_DIR"] = _tmp

from backend.main import app  # noqa: E402 — import after env var set
import backend.storage as storage  # noqa: E402

storage.DATA_DIR = Path(_tmp)
storage.CASES_FILE = Path(_tmp) / "cases.json"
storage.AUDIT_FILE = Path(_tmp) / "audit.json"

client = TestClient(app)

INITIATOR = {
    "role": "tenant",
    "narrative": "Landlord kept my deposit.",
    "doc_file_id": None,
    "doc_source": "none",
    "has_counsel": False,
    "language": "en",
}

RESPONDENT = {
    "role": "landlord",
    "narrative": "Deposit used for repairs.",
    "doc_file_id": None,
    "doc_source": "verbal",
    "has_counsel": False,
    "language": "en",
}

PAYLOAD = {
    "type": "housing",
    "parties": {"initiator": INITIATOR, "respondent": RESPONDENT},
}


def _fresh() -> None:
    """Wipe the temp data files before each test."""
    for f in [storage.CASES_FILE, storage.AUDIT_FILE]:
        if f.exists():
            f.unlink()


def test_create_and_read_case():
    _fresh()
    r = client.post("/cases", json=PAYLOAD)
    assert r.status_code == 201
    body = r.json()
    assert body["case_id"]
    assert body["type"] == "housing"
    assert body["status"] == "intake"

    case_id = body["case_id"]
    r2 = client.get(f"/cases/{case_id}")
    assert r2.status_code == 200
    assert r2.json()["case_id"] == case_id


def test_list_cases():
    _fresh()
    client.post("/cases", json=PAYLOAD)
    client.post("/cases", json={**PAYLOAD, "type": "medical"})
    r = client.get("/cases")
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_patch_status():
    _fresh()
    r = client.post("/cases", json=PAYLOAD)
    case_id = r.json()["case_id"]

    r2 = client.patch(f"/cases/{case_id}", json={"status": "informed"})
    assert r2.status_code == 200
    assert r2.json()["status"] == "informed"


def test_invalid_type_rejected():
    _fresh()
    bad = {**PAYLOAD, "type": "divorce"}
    r = client.post("/cases", json=bad)
    assert r.status_code == 422


def test_doc_source_none_and_verbal():
    _fresh()
    r = client.post("/cases", json=PAYLOAD)
    assert r.status_code == 201
    body = r.json()
    assert body["parties"]["initiator"]["doc_source"] == "none"
    assert body["parties"]["respondent"]["doc_source"] == "verbal"


def test_not_found_returns_404():
    _fresh()
    r = client.get("/cases/nonexistent-id")
    assert r.status_code == 404


def test_audit_log_entry_retrievable():
    _fresh()
    from backend.audit import log

    r = client.post("/cases", json=PAYLOAD)
    case_id = r.json()["case_id"]

    log(case_id, actor="system", action="test_action", ai_suggestion="draft", human_decision="approved")

    r2 = client.get(f"/cases/{case_id}/audit")
    assert r2.status_code == 200
    entries = r2.json()
    assert len(entries) == 1
    assert entries[0]["action"] == "test_action"
    assert entries[0]["actor"] == "system"
    assert entries[0]["ai_suggestion"] == "draft"
    assert entries[0]["human_decision"] == "approved"
