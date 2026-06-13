from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

TREE_PATH = Path(__file__).parent.parent / "data" / "intake_tree.json"
_TREE_CACHE: Optional[dict[str, Any]] = None

# Assumption templates used when no document is provided
_NO_DOC_ASSUMPTIONS = [
    {
        "assumption": "Month-to-month tenancy applies (no written fixed-term lease found)",
        "statute": "MGL_186_22",
        "confirm": True,
    },
    {
        "assumption": "Implied warranty of habitability applies — landlord must keep unit habitable",
        "statute": "MGL_111_127L",
        "confirm": True,
    },
    {
        "assumption": "Security deposit (if any) is capped at one month's rent",
        "statute": "MGL_186_15B",
        "confirm": True,
    },
    {
        "assumption": "Landlord must give 30-day written notice before terminating tenancy",
        "statute": "MGL_186_22",
        "confirm": True,
    },
]

# Framework mappings for verbal descriptions
_VERBAL_PATTERNS = [
    ("month-to-month", "MGL_186_22", "Month-to-month tenancy (no fixed end date)"),
    ("week to week", "MGL_186_22", "Week-to-week tenancy"),
    ("year lease", "MGL_186_23", "Fixed-term annual lease"),
    ("one year", "MGL_186_23", "Fixed-term annual lease"),
    ("6 month", "MGL_186_23", "Fixed-term 6-month lease"),
    ("six month", "MGL_186_23", "Fixed-term 6-month lease"),
]


def _load_tree() -> dict[str, Any]:
    global _TREE_CACHE
    if _TREE_CACHE is None:
        with open(TREE_PATH) as f:
            _TREE_CACHE = json.load(f)
    return _TREE_CACHE


def next_question(answers: dict[str, Any]) -> dict[str, Any] | None:
    """Return the next unanswered question node, or None when done."""
    tree = _load_tree()
    node_id = tree["start"]

    while node_id and node_id != "__done__":
        if node_id not in answers:
            return tree["nodes"][node_id]
        node = tree["nodes"][node_id]
        answer = str(answers[node_id]).lower()
        branches = node.get("branches", {})
        # Try exact match first, then case-insensitive, then default
        node_id = (
            branches.get(answers[node_id])
            or branches.get(answer)
            or node.get("next")
            or node.get("default_next")
            or "__done__"
        )

    return None  # interview complete


def reconstruct_narrative(answers: dict[str, Any], party: str) -> str:
    """Build a coherent structured narrative from short answers."""
    lines: list[str] = [f"Intake summary for {party}:"]

    dispute = answers.get("q_dispute_type", "a dispute")
    lines.append(f"- Dispute type: {dispute}")

    if "q_deposit_amount" in answers:
        lines.append(f"- Security deposit amount: {answers['q_deposit_amount']}")
    if "q_deposit_returned" in answers:
        returned = answers["q_deposit_returned"]
        lines.append(f"- Deposit returned: {returned}")
    if "q_deduction_reason" in answers:
        lines.append(f"- Reason given for keeping deposit: {answers['q_deduction_reason']}")
    if "q_days_since_moveout" in answers:
        lines.append(f"- Days since move-out: {answers['q_days_since_moveout']}")
    if "q_eviction_notice" in answers:
        lines.append(f"- Received written eviction notice: {answers['q_eviction_notice']}")
    if "q_notice_days" in answers:
        lines.append(f"- Days given to leave: {answers['q_notice_days']}")
    if "q_verbal_notice" in answers:
        lines.append(f"- Told verbally to leave: {answers['q_verbal_notice']}")
    if "q_repairs_notified" in answers:
        lines.append(f"- Notified landlord about repairs: {answers['q_repairs_notified']}")
    if "q_repairs_days_waiting" in answers:
        lines.append(f"- Days waiting for repairs: {answers['q_repairs_days_waiting']}")
    if "q_rent_increase_notice" in answers:
        lines.append(f"- Received notice of rent increase: {answers['q_rent_increase_notice']}")
    if "q_rent_increase_amount" in answers:
        lines.append(f"- Rent increase amount: ${answers['q_rent_increase_amount']}/month")
    if "q_describe_other" in answers:
        lines.append(f"- Description: {answers['q_describe_other']}")
    if "q_verbal_terms" in answers:
        lines.append(f"- Verbal agreement: {answers['q_verbal_terms']}")
    if "q_jurisdiction" in answers:
        lines.append(f"- State: {answers['q_jurisdiction']}")
    if "q_jurisdiction_nodoc" in answers:
        lines.append(f"- City/town: {answers['q_jurisdiction_nodoc']}")
    if "q_unit_type" in answers:
        lines.append(f"- Unit type: {answers['q_unit_type']}")
    if "q_monthly_rent" in answers:
        lines.append(f"- Monthly rent: ${answers['q_monthly_rent']}")
    if "q_has_counsel" in answers:
        lines.append(f"- Has legal counsel: {answers['q_has_counsel']}")

    return "\n".join(lines)


def build_no_doc_assumptions(answers: dict[str, Any]) -> dict[str, Any]:
    """Return statutory default assumptions flagged for confirmation (never stated as fact)."""
    rent = answers.get("q_monthly_rent")
    jurisdiction = answers.get("q_jurisdiction") or answers.get("q_jurisdiction_nodoc", "unknown")
    unit_type = answers.get("q_unit_type", "unknown")

    assumptions = [dict(a) for a in _NO_DOC_ASSUMPTIONS]

    note = (
        "IMPORTANT: These are ASSUMPTIONS based on common Massachusetts residential tenancy law "
        "defaults, not verified facts. Each item marked confirm=true must be confirmed with the "
        "parties before any action is taken. This is information, not legal advice."
    )

    return {
        "assumptions": assumptions,
        "context": {
            "jurisdiction": jurisdiction,
            "unit_type": unit_type,
            "monthly_rent": rent,
        },
        "note": note,
        "flagged": "confirm",
    }


def map_verbal_to_framework(verbal_description: str) -> dict[str, Any]:
    """Map a verbal description of rental terms to the likely legal framework."""
    desc_lower = verbal_description.lower()
    matches = []
    for keyword, statute, label in _VERBAL_PATTERNS:
        if keyword in desc_lower:
            matches.append({"framework": label, "statute": statute})
    if not matches:
        matches.append({
            "framework": "Month-to-month tenancy (default when no written lease)",
            "statute": "MGL_186_22",
        })
    return {
        "verbal_description": verbal_description,
        "likely_frameworks": matches,
        "note": (
            "These are AI-identified frameworks based on your description. "
            "A human mediator must confirm which applies. This is information, not legal advice."
        ),
    }
