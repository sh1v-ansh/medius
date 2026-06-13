"""
Steelman + shared-reality range engine.

Steelman: produces the STRONGEST HONEST statute-cited argument for EACH side,
using the same code path for both — no asymmetric branching.

Shared reality: derives a monetary/remedy range from retrieved statute text.
This is a negotiation anchor visible to both parties; it is NEVER an
AI-chosen settlement value. Humans decide what to do with it.
"""
from __future__ import annotations

import re
from typing import Any

from backend.legal_engine.analyze import analyze
from backend.legal_engine.redact import redact
from backend.briefing import verify_citations, NOT_CONSIDERED, _statute_title


# ── Steelman argument builder ─────────────────────────────────────────────────

_PERSPECTIVE_FRAMES = {
    "tenant": {
        "intro": (
            "The strongest honest argument available from the tenant's perspective, "
            "based only on the retrieved statutes:"
        ),
        "simple_prefix": "Here is the strongest legal point that supports your position as tenant:",
    },
    "landlord": {
        "intro": (
            "The strongest honest argument available from the landlord's perspective, "
            "based only on the retrieved statutes:"
        ),
        "simple_prefix": "Here is the strongest legal point that supports your position as landlord:",
    },
}

_DEFAULT_FRAME = {
    "intro": "The strongest honest argument from this perspective, based only on retrieved statutes:",
    "simple_prefix": "Here is the strongest legal point that supports this position:",
}


def _build_steelman_levels(
    statutes: list[dict[str, Any]],
    perspective: str,
    raw: dict[str, Any],
) -> dict[str, str]:
    """
    Identical code path for both perspectives — the perspective label changes,
    the logic does not.
    """
    frame = _PERSPECTIVE_FRAMES.get(perspective, _DEFAULT_FRAME)
    titles = ", ".join(s["title"] for s in statutes)
    ids = ", ".join(s["id"] for s in statutes)

    # Pick the strongest-sounding statute (first retrieved = highest cosine-sim)
    top = statutes[0] if statutes else {"id": "N/A", "title": "N/A", "text": "No statute retrieved."}

    simple = (
        f"{frame['simple_prefix']}\n"
        f"The law '{top['title']}' ({top['id']}) says:\n"
        f"\"{top['text']}\"\n\n"
        f"This is information about the law — not legal advice. "
        f"A human will always help you decide what to do next."
    )

    standard = (
        f"{frame['intro']}\n\n"
        f"Relevant statutes: {titles} ({ids}).\n"
        f"{raw['explanation']['standard']}\n\n"
        f"NOTE: This is the strongest argument the retrieved law can support for the "
        f"{perspective} perspective. It does not predict outcomes and is not legal advice."
    )

    statute_blocks = "\n\n".join(
        f"[{s['id']}] {s['title']}\n{s['text']}"
        for s in statutes
    )
    full = (
        f"STEELMAN — PERSPECTIVE: {perspective}\n\n"
        f"{frame['intro']}\n\n"
        f"RETRIEVED STATUTES (verbatim):\n{statute_blocks}\n\n"
        f"SCOPE DISCLOSURE: {'; '.join(NOT_CONSIDERED)}\n\n"
        f"This output is information only and does not constitute legal advice. "
        f"It presents the strongest available statutory argument for this perspective "
        f"based solely on the retrieved corpus."
    )

    return {"simple": simple, "standard": standard, "full": full}


def build_steelman_argument(
    source_text: str,
    perspective: str,
) -> dict[str, Any]:
    """
    Single code path used for BOTH initiator and respondent.
    Returns levels + citations + lockbox metadata.
    """
    clean_text = redact(source_text)
    raw = analyze(clean_text, perspective)

    statutes = [
        {
            "id": c["statute_id"],
            "title": _statute_title(c["statute_id"]),
            "text": c["statute_text"],
        }
        for c in raw["citations"]
    ]

    levels = _build_steelman_levels(statutes, perspective, raw)
    lockbox = verify_citations(levels, raw["citations"])

    # Logical fallacy / weakness detection via Gemini (graceful no-op if unconfigured)
    fallacies: list[dict] = []
    try:
        from backend.legal_engine.gemini_client import detect_fallacies, is_configured
        if is_configured() and statutes:
            full_text = lockbox["clean_explanation"].get("full", "")
            fallacies = detect_fallacies(full_text, statutes, perspective)
    except Exception:
        pass

    return {
        "levels": lockbox["clean_explanation"],
        "citations": raw["citations"],
        "unverified_removed": lockbox["removed"],
        "not_considered": NOT_CONSIDERED,
        "is_advice": False,
        "fallacies": fallacies,
    }


# ── Shared-reality range ──────────────────────────────────────────────────────

# Known statutory damage amounts extracted from MA statutes
_STATUTORY_DAMAGES: list[dict[str, Any]] = [
    {
        "statute_id": "MGL_186_15B_return",
        "label": "Security deposit not returned within 30 days",
        "floor_mult": 1.0,
        "ceiling_mult": 3.0,
        "typical_low_mult": 1.0,
        "typical_high_mult": 2.0,
        "unit": "deposit",
        "note": "Landlord liable for the deposit amount; bad-faith withholding may incur treble damages.",
    },
    {
        "statute_id": "MGL_186_12",
        "label": "Quiet enjoyment violation",
        "floor_mult": 1.0,
        "ceiling_mult": 3.0,
        "typical_low_mult": 1.0,
        "typical_high_mult": 2.0,
        "unit": "monthly_rent",
        "note": "Landlord liable for three months' rent or actual damages, whichever is greater.",
    },
    {
        "statute_id": "MGL_239_8A",
        "label": "Repair-and-deduct",
        "floor_mult": 0.0,
        "ceiling_mult": 4.0,
        "typical_low_mult": 0.5,
        "typical_high_mult": 2.0,
        "unit": "monthly_rent",
        "note": "Tenant may deduct repair costs up to 4 months' rent.",
    },
    {
        "statute_id": "MGL_93A_9",
        "label": "Consumer protection — unfair practices",
        "floor_mult": 1.0,
        "ceiling_mult": 3.0,
        "typical_low_mult": 1.0,
        "typical_high_mult": 2.0,
        "unit": "actual_damages",
        "note": "Double or triple actual damages for willful/knowing violations.",
    },
]

_DEFAULT_DEPOSIT = 1500.0
_DEFAULT_MONTHLY_RENT = 1200.0


def _extract_amount(text: str, keyword: str, default: float) -> float:
    """Try to parse a dollar amount following a keyword in the text."""
    pattern = rf"{re.escape(keyword)}[^$\d]{{0,30}}\$?([\d,]+)"
    m = re.search(pattern, text, re.IGNORECASE)
    if m:
        try:
            return float(m.group(1).replace(",", ""))
        except ValueError:
            pass
    return default


def build_shared_reality(
    case: dict[str, Any],
    retrieved_statute_ids: list[str],
) -> dict[str, Any]:
    """
    Derive a range from statutory damages for the retrieved statutes.
    This is a NEGOTIATION ANCHOR only — not an AI-chosen settlement.
    Both parties see the same range.
    """
    combined_text = (
        case["parties"]["initiator"].get("narrative", "")
        + " "
        + case["parties"]["respondent"].get("narrative", "")
    )

    deposit_amount = _extract_amount(combined_text, "deposit", _DEFAULT_DEPOSIT)
    monthly_rent = _extract_amount(combined_text, "rent", _DEFAULT_MONTHLY_RENT)

    applicable: list[dict[str, Any]] = []
    for dmg in _STATUTORY_DAMAGES:
        if dmg["statute_id"] in retrieved_statute_ids:
            applicable.append(dmg)

    if not applicable:
        # Fall back to the deposit statute as baseline
        applicable = [_STATUTORY_DAMAGES[0]]

    floors, ceilings, typical_lows, typical_highs = [], [], [], []
    used_citations: list[dict[str, Any]] = []

    for dmg in applicable:
        unit = dmg["unit"]
        base = (
            deposit_amount if unit == "deposit"
            else monthly_rent if unit == "monthly_rent"
            else deposit_amount  # actual_damages approximated by deposit
        )
        floors.append(dmg["floor_mult"] * base)
        ceilings.append(dmg["ceiling_mult"] * base)
        typical_lows.append(dmg["typical_low_mult"] * base)
        typical_highs.append(dmg["typical_high_mult"] * base)

        # Resolve statute text from corpus
        from backend.legal_engine.corpus import STATUTES as _CORPUS
        statute_text = next(
            (s["text"] for s in _CORPUS if s["id"] == dmg["statute_id"]),
            dmg["note"],
        )
        used_citations.append({
            "statute_id": dmg["statute_id"],
            "statute_text": statute_text,
            "label": dmg["label"],
            "note": dmg["note"],
        })

    floor_val = round(min(floors), 2)
    ceiling_val = round(max(ceilings), 2)
    typical_low_val = round(min(typical_lows), 2)
    typical_high_val = round(max(typical_highs), 2)

    # Enforce ordering invariant
    typical_low_val = max(typical_low_val, floor_val)
    typical_high_val = min(typical_high_val, ceiling_val)
    if typical_low_val > typical_high_val:
        typical_low_val, typical_high_val = typical_high_val, typical_low_val

    return {
        "floor": floor_val,
        "typical_band": {"low": typical_low_val, "high": typical_high_val},
        "ceiling": ceiling_val,
        "citations": used_citations,
        "basis": {
            "deposit_amount_used": deposit_amount,
            "monthly_rent_used": monthly_rent,
            "statutes_matched": [d["statute_id"] for d in applicable],
        },
        "anchor_note": (
            "This range reflects statutory minimums and maximums under Massachusetts law "
            "for the relevant provisions. It is a negotiation anchor — not a prediction, "
            "not a recommended settlement, and not legal advice. "
            "Both parties see the same range. Humans decide what to do with it."
        ),
        "is_advice": False,
    }
