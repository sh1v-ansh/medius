from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field
import uuid


class PartyProfile(BaseModel):
    role: str
    narrative: str = ""
    doc_file_id: Optional[str] = None
    doc_source: Literal["pdf", "photo", "verbal", "none"] = "none"
    has_counsel: bool = False
    language: str = "en"


class PartyIntake(BaseModel):
    transcript: str = ""
    answers: dict[str, Any] = Field(default_factory=dict)


class Parties(BaseModel):
    initiator: PartyProfile
    respondent: PartyProfile


class IntakeData(BaseModel):
    initiator: PartyIntake = Field(default_factory=PartyIntake)
    respondent: PartyIntake = Field(default_factory=PartyIntake)


class NegotiationMessage(BaseModel):
    sender: str
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    approved_by_human: bool = False


class Negotiation(BaseModel):
    messages: list[NegotiationMessage] = Field(default_factory=list)


class Case(BaseModel):
    case_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["housing", "medical"]
    status: Literal["intake", "informed", "negotiating", "escalated", "settled"] = "intake"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    parties: Parties
    intake: IntakeData = Field(default_factory=IntakeData)
    briefings: dict[str, Any] = Field(default_factory=lambda: {"initiator": None, "respondent": None})
    triage: Optional[dict[str, Any]] = None
    steelman: Optional[dict[str, Any]] = None
    shared_reality: Optional[dict[str, Any]] = None
    negotiation: Negotiation = Field(default_factory=Negotiation)
    escalation_packet: Optional[dict[str, Any]] = None
    settlement_draft: Optional[dict[str, Any]] = None


class CaseCreate(BaseModel):
    type: Literal["housing", "medical"]
    parties: Parties


class CasePatch(BaseModel):
    status: Optional[Literal["intake", "informed", "negotiating", "escalated", "settled"]] = None
    triage: Optional[dict[str, Any]] = None
    steelman: Optional[dict[str, Any]] = None
    shared_reality: Optional[dict[str, Any]] = None
    escalation_packet: Optional[dict[str, Any]] = None
    settlement_draft: Optional[dict[str, Any]] = None
