"""
Triage engine — sorts the mediator queue, never decides cases.

MERITS FIREWALL (enforced by code structure):
  - _score_violation_strength()  reads: citations, narrative text, statute keywords
  - _score_settlement_likelihood() reads: dispute type, days elapsed, doc_source
  - _score_urgency()              reads: narrative text, keyword signals
  - _score_power_asymmetry()      reads: has_counsel (ONLY this dimension may read it)

has_counsel MUST NOT flow into violation_strength or settlement_likelihood.
"""
from __future__ import annotations

from typing import Any

# ── Tunable constants (single importable dict) ─────────────────────────────────

WEIGHTS: dict[str, float] = {
    "urgency": 0.35,
    "power_asymmetry": 0.30,
    "violation_strength": 0.20,
    "settlement_inverse": 0.15,
}


def _clamp(value: float) -> int:
    return max(0, min(100, round(value)))


# ── Individual score functions ─────────────────────────────────────────────────
# Each function receives ONLY the arguments it is allowed to read.

def _score_violation_strength(
    briefing: dict[str, Any] | None,
    narrative: str,
) -> tuple[int, str]:
    """
    Reads: retrieved citations and narrative text only.
    MUST NOT receive has_counsel.
    """
    if not briefing:
        return 20, "No briefing available — low default assigned."

    citations = briefing.get("citations", [])
    n_citations = len(citations)

    # Keywords that signal a clear statutory violation
    HIGH_SIGNAL = [
        "did not return", "has not returned", "failed to return",
        "lockout", "shut off utilities", "no notice", "no receipt",
        "no separate account", "no checklist", "without a court order",
        "45 days", "60 days", "more than 30 days",
    ]
    LOW_SIGNAL = [
        "repair costs", "legitimate", "damage", "cleaning",
        "unpaid rent", "lease breach",
    ]

    text = narrative.lower()
    high_hits = sum(1 for kw in HIGH_SIGNAL if kw in text)
    low_hits = sum(1 for kw in LOW_SIGNAL if kw in text)

    base = 30
    score = base + (high_hits * 12) - (low_hits * 8) + (n_citations * 5)

    rationale = (
        f"{n_citations} statute(s) retrieved; "
        f"{high_hits} violation signal(s) detected in narrative; "
        f"{low_hits} counter-signal(s) detected."
    )
    return _clamp(score), rationale


def _score_settlement_likelihood(
    briefing: dict[str, Any] | None,
    narrative: str,
    doc_source: str,
) -> tuple[int, str]:
    """
    Reads: dispute characteristics, doc availability, narrative text.
    MUST NOT receive has_counsel.
    """
    text = narrative.lower()

    # Signals that resolution may be straightforward
    POSITIVE = ["deposit", "receipt", "agreed", "partial", "willing", "discuss"]
    # Signals of entrenched conflict
    NEGATIVE = ["eviction", "court", "harass", "retaliat", "lockout", "utilities"]

    pos = sum(1 for kw in POSITIVE if kw in text)
    neg = sum(1 for kw in NEGATIVE if kw in text)

    doc_bonus = 10 if doc_source in ("pdf", "photo") else 0

    score = 50 + (pos * 8) - (neg * 10) + doc_bonus

    rationale = (
        f"{pos} resolution-positive signal(s); "
        f"{neg} conflict signal(s); "
        f"doc_source='{doc_source}' ({'bonus' if doc_bonus else 'no bonus'})."
    )
    return _clamp(score), rationale


def _score_urgency(narrative: str) -> tuple[int, str]:
    """Reads: narrative text only."""
    text = narrative.lower()

    URGENT = [
        "eviction", "lockout", "no heat", "no water", "mold", "pest",
        "unsafe", "court date", "notice to quit", "sheriff", "marshal",
        "imminent", "immediately", "emergency", "health", "children",
        "disabled", "elderly",
    ]

    hits = sum(1 for kw in URGENT if kw in text)
    score = 20 + (hits * 15)
    rationale = f"{hits} urgency signal(s) detected in narrative."
    return _clamp(score), rationale


def _score_power_asymmetry(
    initiator_has_counsel: bool,
    respondent_has_counsel: bool,
) -> tuple[int, str]:
    """
    Reads: has_counsel for both parties ONLY.
    This is the ONLY score function permitted to read has_counsel.
    """
    if initiator_has_counsel and not respondent_has_counsel:
        score, note = 25, "Initiator has counsel; respondent does not."
    elif not initiator_has_counsel and respondent_has_counsel:
        score, note = 75, "Respondent has counsel; initiator does not — higher asymmetry."
    elif initiator_has_counsel and respondent_has_counsel:
        score, note = 20, "Both parties have counsel — relatively balanced."
    else:
        score, note = 50, "Neither party has counsel — moderate asymmetry."
    return score, note


# ── Composite score ────────────────────────────────────────────────────────────

def compute_composite(
    urgency: int,
    power_asymmetry: int,
    violation_strength: int,
    settlement_likelihood: int,
) -> int:
    composite = (
        urgency * WEIGHTS["urgency"]
        + power_asymmetry * WEIGHTS["power_asymmetry"]
        + violation_strength * WEIGHTS["violation_strength"]
        + (100 - settlement_likelihood) * WEIGHTS["settlement_inverse"]
    )
    return _clamp(composite)


# ── Main triage call ───────────────────────────────────────────────────────────

def run_triage(case: dict[str, Any]) -> dict[str, Any]:
    """
    Produce triage scores for a case.

    Merits firewall: has_counsel is passed ONLY to _score_power_asymmetry.
    violation_strength and settlement_likelihood receive NO counsel information.
    """
    briefing_i = case["briefings"].get("initiator")
    briefing_r = case["briefings"].get("respondent")
    briefing = briefing_i or briefing_r

    narrative_i = case["parties"]["initiator"].get("narrative", "")
    narrative_r = case["parties"]["respondent"].get("narrative", "")
    combined_narrative = f"{narrative_i} {narrative_r}"

    doc_source_i = case["parties"]["initiator"].get("doc_source", "none")

    # FIREWALL: violation_strength and settlement_likelihood computed without counsel
    vs, vs_rationale = _score_violation_strength(briefing, combined_narrative)
    sl, sl_rationale = _score_settlement_likelihood(briefing, combined_narrative, doc_source_i)

    # Urgency also counsel-free
    urg, urg_rationale = _score_urgency(combined_narrative)

    # ONLY power_asymmetry reads has_counsel
    pa, pa_rationale = _score_power_asymmetry(
        initiator_has_counsel=case["parties"]["initiator"].get("has_counsel", False),
        respondent_has_counsel=case["parties"]["respondent"].get("has_counsel", False),
    )

    composite = compute_composite(urg, pa, vs, sl)

    return {
        "scores": {
            "urgency": urg,
            "power_asymmetry": pa,
            "violation_strength": vs,
            "settlement_likelihood": sl,
        },
        "rationales": {
            "urgency": urg_rationale,
            "power_asymmetry": pa_rationale,
            "violation_strength": vs_rationale,
            "settlement_likelihood": sl_rationale,
        },
        "composite": composite,
        "weights_used": WEIGHTS,
        "note": (
            "Triage scores sort the mediator queue only. "
            "They do not predict case outcomes or determine who is right. "
            "has_counsel affects only power_asymmetry, never legal-merits scores."
        ),
    }
