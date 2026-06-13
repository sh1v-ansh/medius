from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).parent.parent / "data"
CASES_FILE = DATA_DIR / "cases.json"
AUDIT_FILE = DATA_DIR / "audit.json"
TRANSLATIONS_FILE = DATA_DIR / "translations.json"


def _ensure_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _read(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    with open(path) as f:
        return json.load(f)


def _write(path: Path, data: list[dict[str, Any]]) -> None:
    _ensure_dir()
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)


# ── Cases ──────────────────────────────────────────────────────────────────

def read_cases() -> list[dict[str, Any]]:
    return _read(CASES_FILE)


def write_cases(cases: list[dict[str, Any]]) -> None:
    _write(CASES_FILE, cases)


def get_case(case_id: str) -> dict[str, Any] | None:
    return next((c for c in read_cases() if c["case_id"] == case_id), None)


def save_case(case: dict[str, Any]) -> None:
    cases = read_cases()
    idx = next((i for i, c in enumerate(cases) if c["case_id"] == case["case_id"]), None)
    if idx is None:
        cases.append(case)
    else:
        cases[idx] = case
    write_cases(cases)


# ── Audit ───────────────────────────────────────────────────────────────────

def read_audit() -> list[dict[str, Any]]:
    return _read(AUDIT_FILE)


def write_audit(entries: list[dict[str, Any]]) -> None:
    _write(AUDIT_FILE, entries)


def append_audit(entry: dict[str, Any]) -> None:
    entries = read_audit()
    entries.append(entry)
    write_audit(entries)


def get_case_audit(case_id: str) -> list[dict[str, Any]]:
    return [e for e in read_audit() if e.get("case_id") == case_id]


# ── Translation cache ────────────────────────────────────────────────────────

def _read_dict(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    with open(path) as f:
        return json.load(f)


def _write_dict(path: Path, data: dict[str, str]) -> None:
    _ensure_dir()
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def get_cached_translation(text: str, target_lang: str) -> str | None:
    cache = _read_dict(TRANSLATIONS_FILE)
    return cache.get(f"{target_lang}:{text}")


def save_cached_translation(text: str, target_lang: str, translated: str) -> None:
    cache = _read_dict(TRANSLATIONS_FILE)
    cache[f"{target_lang}:{text}"] = translated
    _write_dict(TRANSLATIONS_FILE, cache)
