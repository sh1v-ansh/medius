"""
Assisted negotiation engine.

Rules from CONTEXT.md:
- AI drafts and rewrites; humans approve before anything reaches the other party.
- Approval gate is STRICT: pending_approval messages are invisible to the other side.
- No credibility scoring, no win prediction, no auto-delivery.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Any


# ── Tone classifier ────────────────────────────────────────────────────────────

_HOSTILE_SIGNALS = [
    "sue you", "take you to court", "lawyer", "fraud", "liar", "lying",
    "stealing", "thief", "criminal", "illegal", "harass", "threaten",
    "you owe me", "i will report", "going to report", "ruined", "destroyed",
    "hate", "disgusting", "terrible landlord", "slumlord", "terrible tenant",
    "you will regret", "you'll regret", "report you", "file a complaint",
]

_FRUSTRATED_SIGNALS = [
    "unacceptable", "unbelievable", "ridiculous", "absurd", "unfair",
    "fed up", "sick of", "tired of", "frustrated", "upset", "angry",
    "disappointed", "this is wrong", "not okay", "not ok", "can't believe",
    "still waiting", "ignored", "no response", "never responded",
    "months ago", "weeks ago", "long time", "keep asking",
]


def classify_tone(text: str) -> str:
    t = text.lower()
    if any(sig in t for sig in _HOSTILE_SIGNALS):
        return "hostile"
    if any(sig in t for sig in _FRUSTRATED_SIGNALS):
        return "frustrated"
    return "neutral"


# ── Message rewriter ──────────────────────────────────────────────────────────

_HOSTILE_REWRITES = [
    ("sue you", "seek legal remedies"),
    ("take you to court", "pursue this through official channels"),
    ("liar", "there appears to be a disagreement about the facts"),
    ("lying", "the accounts differ"),
    ("stealing", "withholding funds I believe I'm entitled to"),
    ("thief", "acting contrary to what I believe the law requires"),
    ("criminal", "potentially unlawful"),
    ("fraud", "a potentially serious concern"),
    ("harass", "put pressure on"),
    ("threaten", "warn"),
    ("ruined", "significantly harmed"),
    ("destroyed", "damaged"),
    ("slumlord", "landlord who has not met their obligations"),
    ("terrible landlord", "landlord who has not met their obligations"),
    ("terrible tenant", "tenant who has not met their obligations"),
    ("you will regret", "I hope we can resolve this"),
    ("you'll regret", "I hope we can resolve this"),
    ("hate", "am very frustrated with"),
    ("disgusting", "deeply concerning"),
]

_FRUSTRATED_REWRITES = [
    ("unacceptable", "a serious concern"),
    ("unbelievable", "surprising"),
    ("ridiculous", "unreasonable"),
    ("absurd", "difficult to understand"),
    ("fed up", "at a point where I need resolution"),
    ("sick of", "concerned about the ongoing situation with"),
    ("tired of", "hoping to resolve"),
    ("this is wrong", "I believe this is incorrect"),
    ("not okay", "something I need to address"),
    ("not ok", "something I need to address"),
    ("can't believe", "I am surprised that"),
    ("still waiting", "have not yet received a response about"),
    ("keep asking", "have repeatedly requested"),
]


def _apply_rewrites(text: str, pairs: list[tuple[str, str]]) -> str:
    out = text
    for original, replacement in pairs:
        out = re.sub(re.escape(original), replacement, out, flags=re.IGNORECASE)
    return out


def rewrite_message(text: str, tone: str) -> str:
    """Produce a civil, same-facts rewrite. Never changes substance, only phrasing."""
    if tone == "neutral":
        return text  # nothing to rewrite

    rewrites = _HOSTILE_REWRITES + _FRUSTRATED_REWRITES if tone == "hostile" else _FRUSTRATED_REWRITES
    rewritten = _apply_rewrites(text, rewrites)

    # Prepend a civil framing line if the tone was heated
    framing = "I would like to discuss the following concern: " if tone == "hostile" else ""
    if framing and not rewritten.lower().startswith(("i would like", "i am writing", "i want to")):
        rewritten = framing + rewritten[0].lower() + rewritten[1:]

    # Append a closing only if tone was hostile (softens the message)
    if tone == "hostile" and not rewritten.rstrip().endswith((".", "?", "!")):
        rewritten = rewritten.rstrip() + "."
    if tone == "hostile":
        rewritten = rewritten.rstrip() + " I hope we can resolve this together."

    return rewritten


# ── Empathy acknowledgment (shown to SENDER only) ─────────────────────────────

_EMPATHY_BY_TONE = {
    "hostile": (
        "It sounds like you're feeling very frustrated about this situation — that's understandable. "
        "Here is a calmer way to express the same concern, which is more likely to move things forward:"
    ),
    "frustrated": (
        "It sounds like this situation has been stressful. "
        "Here is a slightly calmer way to say the same thing:"
    ),
    "neutral": "",
}


def empathy_ack(tone: str) -> str:
    return _EMPATHY_BY_TONE.get(tone, "")


# ── Common-ground finder ──────────────────────────────────────────────────────

_COMMON_KEYWORDS = [
    ("move-out date", ["moved out", "vacated", "left the property", "end of tenancy"]),
    ("deposit was paid", ["paid a deposit", "security deposit", "gave a deposit", "deposit of"]),
    ("tenancy duration", ["lived there", "rented for", "tenancy of", "months", "years"]),
    ("rent amount", ["rent was", "paid rent", "monthly rent", "rent of"]),
    ("property address", ["at the address", "the property", "the apartment", "the unit"]),
]

_DISPUTE_KEYWORDS = [
    ("deposit return", ["did not return", "has not returned", "kept the deposit", "withhold"]),
    ("deduction legitimacy", ["repair costs", "damage", "deduction", "cleaning fee"]),
    ("notice adequacy", ["no notice", "short notice", "improper notice", "no written notice"]),
    ("repair obligations", ["repairs needed", "not fixed", "failed to repair", "unsafe"]),
    ("retaliation", ["retaliat", "eviction notice after", "rent increase after"]),
]


def _present_in_both(keyword_variants: list[str], text_a: str, text_b: str) -> bool:
    a, b = text_a.lower(), text_b.lower()
    return any(kw in a or kw in b for kw in keyword_variants)


def _disputed(keyword_variants: list[str], text_a: str, text_b: str) -> bool:
    a, b = text_a.lower(), text_b.lower()
    return any(kw in a or kw in b for kw in keyword_variants)


def find_common_ground(
    narrative_i: str,
    narrative_r: str,
) -> dict[str, Any]:
    agreed = []
    disputed = []

    for label, variants in _COMMON_KEYWORDS:
        if _present_in_both(variants, narrative_i, narrative_r):
            agreed.append(label)

    for label, variants in _DISPUTE_KEYWORDS:
        if _disputed(variants, narrative_i, narrative_r):
            disputed.append(label)

    return {
        "agreed": agreed,
        "disputed": disputed,
        "note": (
            "These points were identified from the intake narratives. "
            "They are informational only — not verified facts. "
            "A human mediator will confirm which points both parties actually agree on."
        ),
        "is_advice": False,
    }
