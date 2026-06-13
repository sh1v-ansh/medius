from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from backend.storage import append_audit, get_case_audit


def log(
    case_id: str,
    actor: str,
    action: str,
    ai_suggestion: Optional[Any] = None,
    human_decision: Optional[Any] = None,
) -> dict[str, Any]:
    entry = {
        "case_id": case_id,
        "actor": actor,
        "action": action,
        "ai_suggestion": ai_suggestion,
        "human_decision": human_decision,
        "timestamp": datetime.utcnow().isoformat(),
    }
    append_audit(entry)
    return entry


def get_audit(case_id: str) -> list[dict[str, Any]]:
    return get_case_audit(case_id)
