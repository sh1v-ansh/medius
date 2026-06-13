from __future__ import annotations

import re
from typing import Any

from backend.legal_engine.analyze import analyze
from backend.legal_engine.redact import redact

# ── Safety guardrails ─────────────────────────────────────────────────────────

BANNED_PHRASES = [
    "you will win",
    "you should sue",
    "guaranteed",
    "strong case",
    "weak case",
    "you will lose",
    "you'll win",
    "you'll lose",
    "winning",  # as in "winning this case"
    "certain to",
    "definitely win",
    "definitely lose",
]

NOT_CONSIDERED = [
    "Facts not in the submitted text were not verified",
    "Credibility of either party was not assessed",
    "Side agreements or verbal modifications not captured in intake were not reviewed",
    "Law reflects the corpus date only — recent changes may not be included",
    "Local ordinances and federal law were not analyzed",
    "This analysis does not consider facts not shared during intake",
]

# ── Citation lockbox ──────────────────────────────────────────────────────────

def _ids_in_text(text: str) -> set[str]:
    """Return all MGL_* statute IDs found in a block of text."""
    return set(re.findall(r"MGL_[A-Z0-9_]+", text))


def verify_citations(
    explanation: dict[str, str],
    citations: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Citation lockbox: strip any statute ID referenced in the explanation text
    that is NOT present in the retrieved citations set.
    Returns cleaned explanation levels and a list of removed IDs.
    """
    retrieved_ids = {c["statute_id"] for c in citations}
    all_cited_in_text: set[str] = set()
    for level_text in explanation.values():
        all_cited_in_text |= _ids_in_text(level_text)

    unverified = all_cited_in_text - retrieved_ids
    removed: list[str] = sorted(unverified)

    clean_explanation: dict[str, str] = {}
    for level, text in explanation.items():
        cleaned = text
        for sid in unverified:
            cleaned = cleaned.replace(sid, "[UNVERIFIED-CITATION-REMOVED]")
        clean_explanation[level] = cleaned

    return {"clean_explanation": clean_explanation, "removed": removed}


# ── Reading-level producer ────────────────────────────────────────────────────

def _build_levels(
    statutes: list[dict[str, Any]],
    perspective: str,
    raw_analyze: dict[str, Any],
) -> dict[str, str]:
    """Return three reading levels from analysis output."""
    titles = ", ".join(s["title"] for s in statutes)
    ids = ", ".join(s["id"] for s in statutes)

    simple = (
        f"Here is what the law says about your situation as a {perspective}:\n"
        f"The rules cover: {titles}.\n"
        f"This is information about the law — not advice about what to do. "
        f"A person will always help you decide next steps."
    )

    standard = (
        f"As the {perspective}, Massachusetts law addresses your situation through "
        f"the following statutes: {titles} ({ids}).\n"
        f"{raw_analyze['explanation']['standard']}\n"
        f"This is information, not legal advice. A human mediator reviews all decisions."
    )

    # Full level: verbatim statute text per retrieved statute
    statute_blocks = "\n\n".join(
        f"[{s['id']}] {s['title']}\n{s['text']}"
        for s in statutes
    )
    full = (
        f"PERSPECTIVE: {perspective}\n\n"
        f"RETRIEVED STATUTES (verbatim):\n{statute_blocks}\n\n"
        f"SCOPE DISCLOSURE: {'; '.join(NOT_CONSIDERED)}\n\n"
        f"This output is information only and does not constitute legal advice."
    )

    return {"simple": simple, "standard": standard, "full": full}


# ── What This Means For Me card ───────────────────────────────────────────────

_OPTIONS_BY_TYPE = {
    "deposit": [
        "Send the other party a written request for the deposit (or itemized deductions)",
        "Request mediation through a neutral third party",
        "File a claim in small-claims court (no lawyer required)",
        "Contact a local tenant legal aid organization for further information",
    ],
    "eviction": [
        "Review the notice you received with a housing counselor",
        "Request mediation before any court date",
        "Attend any scheduled court hearing — missing it can affect your rights",
        "Contact a legal aid organization for information about defenses",
    ],
    "repairs": [
        "Document the condition with photos and written notice to the landlord",
        "Contact the local housing authority or inspectional services",
        "Request mediation to agree on a repair timeline",
        "Learn about the repair-and-deduct option (MGL_239_8A) from a housing counselor",
    ],
    "default": [
        "Document everything in writing",
        "Request mediation through a neutral third party",
        "Consult a legal aid organization for more information",
        "Consider small-claims court if financial damages are involved",
    ],
}

_RISKS = [
    "Filing fees apply to court processes (small claims has a modest fee)",
    "Legal processes take time — outcomes are not immediate",
    "Evidence and documentation affect how a mediator or court understands the situation",
    "Missing deadlines (e.g. responding to a notice) may limit your options",
    "This analysis covers Massachusetts law only; other jurisdictions may differ",
]


def _detect_dispute_type(text: str) -> str:
    t = text.lower()
    if "deposit" in t:
        return "deposit"
    if "evict" in t or "notice to quit" in t or "leave" in t:
        return "eviction"
    if "repair" in t or "habitab" in t or "heat" in t or "pest" in t:
        return "repairs"
    return "default"


def _sanitize_for_wtmfm(text: str) -> str:
    """Remove any banned phrases from a string."""
    out = text
    for phrase in BANNED_PHRASES:
        out = re.sub(re.escape(phrase), "[information only]", out, flags=re.IGNORECASE)
    return out


def build_what_this_means(
    statutes: list[dict[str, Any]],
    document_text: str,
    perspective: str,
) -> dict[str, Any]:
    dispute_type = _detect_dispute_type(document_text)
    options = _OPTIONS_BY_TYPE.get(dispute_type, _OPTIONS_BY_TYPE["default"])

    # What the law says: describe the statute requirement + whether described facts appear to match.
    # Never predict outcome; never say "you should".
    law_lines = []
    for s in statutes:
        law_lines.append(f"• {s['title']} ({s['id']}): {s['text']}")
    what_law_says = (
        "Based on the text you provided, the following Massachusetts laws appear relevant "
        f"to your situation as {perspective}:\n"
        + "\n".join(law_lines)
        + "\n\nWhether the facts in your situation match these requirements is "
        "something a mediator or lawyer can help assess — this analysis does not make that determination."
    )
    what_law_says = _sanitize_for_wtmfm(what_law_says)

    return {
        "what_law_says": what_law_says,
        "what_i_can_do": options,
        "what_are_risks": _RISKS,
        "is_advice": False,
        "disclaimer": (
            "This is information, not legal advice. "
            "Confirm next steps with a lawyer or licensed housing counselor."
        ),
    }


# ── Main entry point ──────────────────────────────────────────────────────────

def produce_briefing(
    document_text: str,
    perspective: str,
) -> dict[str, Any]:
    """
    Full briefing pipeline:
      1. redact PII
      2. analyze (retrieve statutes + build levels)
      3. citation lockbox
      4. three reading levels
      5. WTMFM card
      6. scope disclosure
    """
    clean_text = redact(document_text)
    raw = analyze(clean_text, perspective)

    statutes = [
        {"id": c["statute_id"], "title": _statute_title(c["statute_id"]), "text": c["statute_text"]}
        for c in raw["citations"]
    ]

    levels = _build_levels(statutes, perspective, raw)
    lockbox = verify_citations(levels, raw["citations"])

    what_this_means = build_what_this_means(statutes, clean_text, perspective)

    return {
        "levels": lockbox["clean_explanation"],
        "citations": raw["citations"],
        "not_considered": NOT_CONSIDERED,
        "what_this_means": what_this_means,
        "unverified_removed": lockbox["removed"],
        "is_advice": False,
    }


def _statute_title(statute_id: str) -> str:
    """Resolve a statute ID to its title from the corpus."""
    from backend.legal_engine.corpus import STATUTES
    for s in STATUTES:
        if s["id"] == statute_id:
            return s["title"]
    return statute_id
