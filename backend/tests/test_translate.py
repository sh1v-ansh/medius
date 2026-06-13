"""Phase 10 translation tests."""
from __future__ import annotations

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
storage.TRANSLATIONS_FILE = Path(_tmp) / "translations.json"

client = TestClient(app)

_BASE_CASE = {
    "type": "housing",
    "parties": {
        "initiator": {
            "role": "tenant", "narrative": "", "doc_source": "none",
            "has_counsel": False, "language": "en",
        },
        "respondent": {
            "role": "landlord", "narrative": "", "doc_source": "none",
            "has_counsel": False, "language": "es",
        },
    },
}


def _fresh():
    for p in [storage.CASES_FILE, storage.AUDIT_FILE, storage.TRANSLATIONS_FILE]:
        if p.exists():
            p.unlink()


# ── /translate endpoint ───────────────────────────────────────────────────────

def test_translate_returns_non_empty_translated_text_and_echoes_original():
    _fresh()
    with patch("backend.translate.translate_with_gemini", return_value="Hola mundo"):
        r = client.post("/translate", json={"text": "Hello world", "target_lang": "es"})
    assert r.status_code == 200
    data = r.json()
    assert len(data["translated"]) > 0
    assert data["translated"] == "Hola mundo"
    assert data["original"] == "Hello world"
    assert data["target_lang"] == "es"


def test_translate_caches_and_does_not_call_claude_twice():
    _fresh()
    with patch("backend.translate.translate_with_gemini", return_value="Bonjour") as mock_t:
        client.post("/translate", json={"text": "Hello cache", "target_lang": "fr"})
        r = client.post("/translate", json={"text": "Hello cache", "target_lang": "fr"})
    assert r.status_code == 200
    assert r.json()["translated"] == "Bonjour"
    assert mock_t.call_count == 1


def test_translate_empty_text_returns_422():
    r = client.post("/translate", json={"text": "", "target_lang": "es"})
    assert r.status_code == 422


def test_translate_missing_target_lang_returns_422():
    r = client.post("/translate", json={"text": "Hello"})
    assert r.status_code == 422


# ── Negotiation thread machine translation ───────────────────────────────────

def _make_case_with_delivered_message() -> tuple[str, str]:
    _fresh()
    r = client.post("/cases", json=_BASE_CASE)
    assert r.status_code == 201
    case_id = r.json()["case_id"]

    # Draft then approve a message from the English-speaking initiator
    draft_r = client.post(
        f"/cases/{case_id}/messages/draft",
        json={"party": "initiator", "text": "Let us resolve this matter."},
    )
    assert draft_r.status_code == 200
    msg_id = draft_r.json()["msg_id"]

    approve_r = client.post(
        f"/cases/{case_id}/messages/{msg_id}/approve",
        json={"choice": "original"},
    )
    assert approve_r.status_code == 200
    return case_id, msg_id


def test_translated_thread_messages_labeled_machine_translation():
    """Translated messages appear with is_machine_translation=True when viewer_lang differs."""
    case_id, _ = _make_case_with_delivered_message()

    with patch("backend.translate.translate_with_gemini", return_value="Resolvamos este asunto."):
        r = client.get(f"/cases/{case_id}/messages?viewer_lang=es")

    assert r.status_code == 200
    messages = r.json()
    assert len(messages) > 0
    msg = messages[0]
    assert msg["is_machine_translation"] is True
    assert len(msg["translation"]) > 0


def test_same_language_messages_not_labeled_machine_translation():
    """Messages in the viewer's language are NOT marked as machine translations."""
    case_id, _ = _make_case_with_delivered_message()
    r = client.get(f"/cases/{case_id}/messages?viewer_lang=en")
    assert r.status_code == 200
    messages = r.json()
    assert len(messages) > 0
    assert "is_machine_translation" not in messages[0]


def test_messages_without_viewer_lang_unchanged():
    """Without viewer_lang param, messages are returned as-is."""
    case_id, _ = _make_case_with_delivered_message()
    r = client.get(f"/cases/{case_id}/messages")
    assert r.status_code == 200
    messages = r.json()
    assert len(messages) > 0
    assert "is_machine_translation" not in messages[0]


# ── Intake multilingual ───────────────────────────────────────────────────────

def test_intake_questions_render_in_selected_language_mock():
    """Intake questions are translated when lang != 'en' (mock)."""
    _fresh()
    r = client.post("/cases", json=_BASE_CASE)
    case_id = r.json()["case_id"]

    with patch(
        "backend.translate.translate_with_gemini",
        side_effect=lambda text, lang: f"[{lang}] {text}",
    ):
        r2 = client.post(
            f"/cases/{case_id}/intake/next",
            json={"party": "initiator", "answers": {}, "lang": "es"},
        )

    assert r2.status_code == 200
    body = r2.json()
    assert body["done"] is False
    q = body["question"]
    assert "[es]" in q["text"]
    assert "original_text" in q


def test_intake_questions_english_unchanged():
    """Default lang=en leaves question text untranslated."""
    _fresh()
    r = client.post("/cases", json=_BASE_CASE)
    case_id = r.json()["case_id"]

    r2 = client.post(
        f"/cases/{case_id}/intake/next",
        json={"party": "initiator", "answers": {}, "lang": "en"},
    )
    assert r2.status_code == 200
    q = r2.json()["question"]
    assert "original_text" not in q
    assert q["text"] == "What is your dispute mainly about?"
