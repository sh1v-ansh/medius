"""Gemini client for embeddings and legal reasoning."""
from __future__ import annotations

import json
import os
import re
from typing import Any

GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
EMBEDDING_MODEL = os.environ.get("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")

LANG_NAMES: dict[str, str] = {
    "en": "English", "es": "Spanish", "fr": "French", "de": "German",
    "zh": "Chinese (Simplified)", "ar": "Arabic", "ja": "Japanese",
    "ko": "Korean", "pt": "Portuguese", "it": "Italian", "ru": "Russian",
    "hi": "Hindi",
}


def _api_key() -> str:
    return os.environ.get("GEMINI_API_KEY", "")


def is_configured() -> bool:
    return bool(_api_key())


def embed_text(text: str) -> list[float]:
    """Embed text with Gemini. Raises if API key is missing."""
    from google import genai

    client = genai.Client(api_key=_api_key())
    result = client.models.embed_content(model=EMBEDDING_MODEL, contents=text)
    return list(result.embeddings[0].values)


def generate_analysis(
    document_text: str,
    perspective: str,
    statutes: list[dict[str, Any]],
    target_lang: str = "en",
) -> dict[str, str]:
    """
    Use Gemini to produce three reading-level explanations grounded in retrieved statutes.
    Returns dict with keys: simple, standard, full.
    When target_lang != 'en', all three levels are generated in that language.
    """
    from google import genai

    statute_block = "\n\n".join(
        f"[{s['id']}] {s['title']}\n{s['text']}"
        for s in statutes
    )
    allowed_ids = ", ".join(s["id"] for s in statutes)
    lang_name = LANG_NAMES.get(target_lang, "English")
    lang_instruction = (
        f"Write ALL responses in {lang_name}. "
        f"Adapt vocabulary complexity for each reading level as described below. "
        if target_lang != "en"
        else ""
    )

    prompt = f"""You are a legal information assistant for Massachusetts rental disputes.
The AI NEVER decides outcomes, NEVER predicts who wins, and NEVER says "you should" do anything.
{lang_instruction}
Analyze this situation from the perspective of: {perspective}

PARTY'S SITUATION (PII already redacted):
{document_text}

RETRIEVED MASSACHUSETTS STATUTES (you may ONLY cite these IDs: {allowed_ids}):
{statute_block}

Write three explanations as JSON with exactly these keys:
- "simple": Basic level — ~4th grade reading level, very short paragraphs, plain everyday {lang_name}, no legal terms
- "standard": Intermediate level — ~8th grade reading level, clear explanation connecting facts to the statutes, some legal terms explained
- "full": Advanced level — detailed analysis citing statute IDs inline (format: MGL_186_15B), include relevant statute language

Rules:
- ONLY cite statute IDs from the retrieved list above
- Do NOT predict outcomes or say who will win/lose
- Do NOT use phrases like "you should sue", "strong case", "guaranteed", "you will win"
- End each level with a note that this is information, not legal advice
- A human mediator makes all decisions

Return ONLY valid JSON, no markdown fences."""

    client = genai.Client(api_key=_api_key())
    response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    raw = (response.text or "").strip()

    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        parsed = json.loads(raw)
        return {
            "simple": str(parsed.get("simple", "")),
            "standard": str(parsed.get("standard", "")),
            "full": str(parsed.get("full", "")),
        }
    except json.JSONDecodeError:
        return {
            "simple": raw[:500] if raw else "",
            "standard": raw,
            "full": raw,
        }


def detect_fallacies(
    argument_text: str,
    statutes: list[dict[str, Any]],
    perspective: str,
) -> list[dict[str, Any]]:
    """
    Identify potential logical fallacies or weak points in a legal argument.
    Returns a list of {type, description, severity} dicts. Empty list if argument is sound.
    """
    from google import genai

    statute_block = "\n".join(
        f"[{s['id']}] {s['title']}: {s['text'][:200]}"
        for s in statutes
    )

    prompt = f"""You are a neutral legal argument analyst reviewing a {perspective} argument in a Massachusetts rental dispute.

Identify up to 3 notable logical weaknesses, fallacies, or unsupported claims in this argument.

ARGUMENT:
{argument_text[:1500]}

CITED STATUTES:
{statute_block}

For each issue found, return:
- "type": short label (e.g. "Overgeneralization", "Missing evidence", "Statute misapplication", "Appeal to emotion", "Hasty conclusion", "Circular reasoning")
- "description": one concise neutral sentence explaining the weakness
- "severity": "minor" or "notable"

Rules:
- Be balanced and fair — this is NOT about who wins
- If the argument is well-grounded, return an empty array
- Maximum 3 items

Return ONLY a valid JSON array, no markdown fences."""

    client = genai.Client(api_key=_api_key())
    response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    raw = (response.text or "").strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        result = json.loads(raw)
        if isinstance(result, list):
            return [
                {
                    "type": str(item.get("type", "")),
                    "description": str(item.get("description", "")),
                    "severity": item.get("severity", "minor"),
                }
                for item in result
                if isinstance(item, dict)
            ][:3]
    except (json.JSONDecodeError, TypeError):
        pass
    return []


def generate_wtmfm(
    document_text: str,
    perspective: str,
    statutes: list[dict[str, Any]],
    target_lang: str = "en",
) -> dict[str, Any] | None:
    """Optional Gemini-generated What-This-Means-For-Me card."""
    from google import genai

    statute_block = "\n\n".join(
        f"[{s['id']}] {s['title']}: {s['text']}"
        for s in statutes
    )

    lang_name = LANG_NAMES.get(target_lang, "English")
    lang_instruction = f"Write the entire response in {lang_name}. " if target_lang != "en" else ""

    prompt = f"""You are a legal information assistant for Massachusetts rental disputes.
{lang_instruction}Generate a "What This Means For Me" summary for a {perspective}.

SITUATION:
{document_text}

RELEVANT STATUTES:
{statute_block}

Return JSON with:
- "what_law_says": plain explanation of what the law says about this situation (no outcome prediction)
- "what_i_can_do": array of 3-5 neutral options the person could explore (not commands — use "Consider...", "You may...")
- "what_are_risks": array of 3-5 general risks to be aware of

Rules:
- NEVER predict who wins
- NEVER say "you should"
- This is information, not legal advice

Return ONLY valid JSON."""

    client = genai.Client(api_key=_api_key())
    response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    raw = (response.text or "").strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        parsed = json.loads(raw)
        return {
            "what_law_says": str(parsed.get("what_law_says", "")),
            "what_i_can_do": list(parsed.get("what_i_can_do", [])),
            "what_are_risks": list(parsed.get("what_are_risks", [])),
            "is_advice": False,
            "disclaimer": (
                "This is information, not legal advice. "
                "Confirm next steps with a lawyer or licensed housing counselor."
            ),
        }
    except (json.JSONDecodeError, TypeError):
        return None
