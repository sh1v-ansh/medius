"""
Escalation packet + settlement template assembly.

The AI assembles; it does not resolve. Every field is labeled as
AI-prepared; humans confirm before any action is taken.
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import Any


# ── Timeline reconstruction ────────────────────────────────────────────────────

_TIMELINE_QUESTION_LABELS = {
    "q_dispute_type": "Dispute type reported",
    "q_deposit_amount": "Security deposit amount",
    "q_deposit_returned": "Deposit returned?",
    "q_days_since_moveout": "Days since move-out",
    "q_eviction_notice": "Written eviction notice received?",
    "q_notice_days": "Days given to vacate",
    "q_verbal_notice": "Verbal notice given?",
    "q_repairs_notified": "Landlord notified about repairs?",
    "q_repairs_days_waiting": "Days waiting for repairs",
    "q_rent_increase_notice": "Written notice of rent increase received?",
    "q_rent_increase_amount": "Rent increase amount ($/month)",
    "q_doc_source": "Document source",
    "q_verbal_terms": "Verbal rental terms",
    "q_jurisdiction": "State / jurisdiction",
    "q_jurisdiction_nodoc": "City / town",
    "q_unit_type": "Unit type",
    "q_monthly_rent": "Monthly rent ($)",
    "q_has_counsel": "Has legal counsel?",
}


def reconstruct_timeline(case: dict[str, Any]) -> list[dict[str, str]]:
    """
    Build an ordered timeline of events from intake answers.
    Each entry is {label, value, party}; ordered deterministically
    by question position in the intake tree.
    """
    events: list[dict[str, str]] = []

    events.append({
        "label": "Case opened",
        "value": case.get("created_at", "unknown"),
        "party": "system",
    })

    for party in ("initiator", "respondent"):
        answers = case["intake"][party].get("answers", {})
        for q_id, label in _TIMELINE_QUESTION_LABELS.items():
            if q_id in answers:
                events.append({
                    "label": f"[{party}] {label}",
                    "value": str(answers[q_id]),
                    "party": party,
                })

    # Append delivered negotiation messages in chronological order
    for msg in case["negotiation"].get("messages", []):
        events.append({
            "label": f"[{msg.get('sender', 'unknown')}] Sent message",
            "value": msg.get("content", "")[:120],
            "party": msg.get("sender", "unknown"),
        })

    return events


# ── Statute summary ────────────────────────────────────────────────────────────

def _collect_statute_citations(case: dict[str, Any]) -> list[dict[str, str]]:
    """Collect unique statute citations from briefings and steelman."""
    seen: set[str] = set()
    citations: list[dict[str, str]] = []

    sources = []
    for party in ("initiator", "respondent"):
        briefing = case["briefings"].get(party)
        if briefing:
            sources.extend(briefing.get("citations", []))
        if case.get("steelman"):
            arg = case["steelman"].get(f"{party}_argument", {})
            sources.extend(arg.get("citations", []))

    for c in sources:
        sid = c.get("statute_id", "")
        if sid and sid not in seen:
            seen.add(sid)
            citations.append({
                "statute_id": sid,
                "statute_text": c.get("statute_text", ""),
            })

    return citations


# ── Agreed / disputed facts ────────────────────────────────────────────────────

_AGREED_PATTERNS = [
    ("deposit_was_paid", ["paid a deposit", "security deposit", "deposit of", "paid deposit"]),
    ("move_out_occurred", ["moved out", "vacated", "left the property", "tenant vacated"]),
    ("tenancy_existed", ["rented", "tenant", "landlord", "lease", "rental"]),
    ("monthly_rent_amount", ["monthly rent", "rent was", "rent of", "paid rent"]),
]

_DISPUTED_PATTERNS = [
    ("deposit_return", ["did not return", "has not returned", "kept the deposit", "not returned"]),
    ("deduction_legitimacy", ["repair costs", "damage", "cleaning fee", "deduction"]),
    ("notice_adequacy", ["no notice", "short notice", "improper notice", "without notice"]),
    ("repair_obligations", ["repairs needed", "not fixed", "failed to repair", "habitability"]),
    ("eviction_basis", ["eviction", "notice to quit", "hold over"]),
]


def _find_facts(
    narrative_i: str,
    narrative_r: str,
    patterns: list[tuple[str, list[str]]],
) -> list[str]:
    found = []
    a, b = narrative_i.lower(), narrative_r.lower()
    for label, variants in patterns:
        if any(v in a or v in b for v in variants):
            found.append(label.replace("_", " ").title())
    return found


# ── Per-party ranges ──────────────────────────────────────────────────────────

def _build_party_ranges(shared_reality: dict[str, Any] | None) -> dict[str, Any]:
    """
    Derive best / realistic / worst from the shared_reality range.
    Labeled per party perspective — not a prediction of outcome.
    """
    if not shared_reality:
        return {
            "note": "No shared-reality range computed yet — run /shared-reality first.",
            "initiator": None,
            "respondent": None,
        }

    floor = shared_reality.get("floor", 0)
    low = shared_reality.get("typical_band", {}).get("low", 0)
    high = shared_reality.get("typical_band", {}).get("high", 0)
    ceiling = shared_reality.get("ceiling", 0)

    return {
        "initiator": {
            "best": ceiling,
            "realistic": high,
            "worst": floor,
            "note": "From initiator's perspective — not a prediction of outcome.",
        },
        "respondent": {
            "best": floor,
            "realistic": low,
            "worst": ceiling,
            "note": "From respondent's perspective — not a prediction of outcome.",
        },
        "anchor_note": shared_reality.get("anchor_note", ""),
    }


# ── Open issues ───────────────────────────────────────────────────────────────

_OPEN_ISSUE_PATTERNS = [
    ("Deposit amount still in dispute", ["did not return", "kept", "deducted", "withheld"]),
    ("Need for itemized deduction statement", ["repair costs", "damage", "cleaning", "deduction"]),
    ("Notice validity contested", ["no notice", "improper notice", "verbal only"]),
    ("Repair / habitability obligations unresolved", ["repairs", "habitab", "heat", "pest"]),
    ("Retaliation claim raised", ["retaliat", "complained", "reported"]),
]


def identify_open_issues(narrative_i: str, narrative_r: str) -> list[str]:
    combined = (narrative_i + " " + narrative_r).lower()
    return [
        label
        for label, variants in _OPEN_ISSUE_PATTERNS
        if any(v in combined for v in variants)
    ] or ["Parties have not yet identified specific open issues"]


# ── Main escalation packet builder ────────────────────────────────────────────

def build_escalation_packet(case: dict[str, Any]) -> dict[str, Any]:
    """
    Assemble the mediator escalation packet.
    The AI assembles; it does not resolve.
    """
    narrative_i = case["parties"]["initiator"].get("narrative", "")
    narrative_r = case["parties"]["respondent"].get("narrative", "")

    timeline = reconstruct_timeline(case)
    applicable_statutes = _collect_statute_citations(case)
    agreed_facts = _find_facts(narrative_i, narrative_r, _AGREED_PATTERNS)
    disputed_facts = _find_facts(narrative_i, narrative_r, _DISPUTED_PATTERNS)
    ranges = _build_party_ranges(case.get("shared_reality"))
    open_issues = identify_open_issues(narrative_i, narrative_r)

    # Ensure every section is non-empty
    if not agreed_facts:
        agreed_facts = ["No agreed facts identified from intake narratives"]
    if not disputed_facts:
        disputed_facts = ["No disputed facts identified from intake narratives"]
    if not applicable_statutes:
        applicable_statutes = [{"statute_id": "N/A", "statute_text": "No statutes retrieved — complete briefing first"}]

    return {
        "timeline": timeline,
        "applicable_statutes": applicable_statutes,
        "agreed_facts": agreed_facts,
        "disputed_facts": disputed_facts,
        "ranges": ranges,
        "open_issues": open_issues,
        "assembled_by": "AI (Medius) — not resolved by AI",
        "note": (
            "This packet was assembled by the Medius AI system to assist a human mediator. "
            "Every item is AI-prepared and must be confirmed with both parties. "
            "The AI has not resolved any dispute or made any decision."
        ),
        "is_advice": False,
    }


# ── Settlement template ────────────────────────────────────────────────────────

_SETTLEMENT_TEMPLATE = """\
SETTLEMENT AGREEMENT
Case ID: {case_id}
Date Prepared: {date_prepared}
Status: DRAFT — pending human approval

PARTIES
-------
Initiator ({initiator_role}): {initiator_name}
Respondent ({respondent_role}): {respondent_name}

DISPUTE SUMMARY
---------------
{dispute_summary}

AGREED TERMS
------------
{agreed_terms}

APPLICABLE STATUTES
-------------------
{statutes_cited}

SCOPE
-----
This agreement covers only the matters listed above.
Other claims, if any, are not addressed by this document.

SIGNATURES
----------
By signing below, both parties confirm they have read and understood
this agreement and agree to its terms voluntarily. This agreement was
prepared with AI assistance; both parties were encouraged to seek
independent legal advice before signing.

Initiator ({initiator_role}):
Name: _______________________________
Signature: __________________________
Date: _______________________________

Respondent ({respondent_role}):
Name: _______________________________
Signature: __________________________
Date: _______________________________

Human Mediator (if present):
Name: _______________________________
Signature: __________________________
Date: _______________________________

---
AI DISCLOSURE: This document was prepared with AI assistance (Medius).
The AI organized and formatted information provided by the parties.
It did not decide any terms. This is information, not legal advice.
"""


def _extract_name_from_narrative(narrative: str, role: str) -> str:
    m = re.search(rf"{re.escape(role)}[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)", narrative, re.IGNORECASE)
    if m:
        return m.group(1)
    m2 = re.search(r"([A-Z][a-z]+ [A-Z][a-z]+)", narrative)
    if m2:
        return m2.group(1)
    return f"[{role.title()} name]"


def build_settlement_draft(
    case: dict[str, Any],
    agreed_terms: list[str],
    human_approved: bool = False,
) -> dict[str, Any]:
    """
    Fill the settlement template from case fields.
    Status becomes 'settled' ONLY when human_approved=True is explicitly passed.
    """
    case_id = case["case_id"]
    date_prepared = datetime.utcnow().strftime("%B %d, %Y")

    initiator_role = case["parties"]["initiator"].get("role", "initiator")
    respondent_role = case["parties"]["respondent"].get("role", "respondent")
    narrative_i = case["parties"]["initiator"].get("narrative", "")
    narrative_r = case["parties"]["respondent"].get("narrative", "")

    initiator_name = _extract_name_from_narrative(narrative_i, initiator_role)
    respondent_name = _extract_name_from_narrative(narrative_r, respondent_role)

    # Dispute summary from narratives
    dispute_summary = (
        f"Initiator ({initiator_role}) states: {narrative_i[:300].strip()}\n"
        f"Respondent ({respondent_role}) states: {narrative_r[:300].strip()}"
    )

    # Format agreed terms
    if not agreed_terms:
        agreed_terms_text = "[No agreed terms provided — human mediator must fill in]"
    else:
        agreed_terms_text = "\n".join(f"{i+1}. {term}" for i, term in enumerate(agreed_terms))

    # Statutes from escalation packet or briefings
    citations = _collect_statute_citations(case)
    if citations:
        statutes_cited = "\n".join(
            f"• {c['statute_id']}: {c['statute_text'][:100]}..."
            for c in citations[:5]
        )
    else:
        statutes_cited = "[Complete the briefing step to populate applicable statutes]"

    filled = _SETTLEMENT_TEMPLATE.format(
        case_id=case_id,
        date_prepared=date_prepared,
        initiator_role=initiator_role,
        respondent_role=respondent_role,
        initiator_name=initiator_name,
        respondent_name=respondent_name,
        dispute_summary=dispute_summary,
        agreed_terms=agreed_terms_text,
        statutes_cited=statutes_cited,
    )

    # Count signature blocks — must have exactly two party blocks + one mediator block
    sig_blocks = filled.count("Signature: __")

    return {
        "document": filled,
        "case_id": case_id,
        "date_prepared": date_prepared,
        "parties": {
            "initiator": {"role": initiator_role, "name": initiator_name},
            "respondent": {"role": respondent_role, "name": respondent_name},
        },
        "agreed_terms": agreed_terms,
        "citations_used": citations[:5],
        "signature_blocks": sig_blocks,
        "human_approved": human_approved,
        "status": "settled" if human_approved else "draft",
        "note": (
            "This is a draft prepared by AI. It does not become final until "
            "both parties and (if present) the human mediator sign it. "
            "This is information, not legal advice."
        ),
        "is_advice": False,
    }
