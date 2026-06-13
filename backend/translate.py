"""
Translation service — Gemini-powered, cache-first.

Rules:
- Translation NEVER changes meaning or decides anything.
- Cache prevents redundant API calls (keyed by target_lang:source_text).
- Returns a stub string when GEMINI_API_KEY is absent (safe for tests).
"""
from __future__ import annotations

import os

from backend.storage import get_cached_translation, save_cached_translation

GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

LANG_NAMES: dict[str, str] = {
    "en": "English", "es": "Spanish", "fr": "French", "de": "German",
    "zh": "Chinese (Simplified)", "ar": "Arabic", "ja": "Japanese",
    "ko": "Korean", "pt": "Portuguese", "it": "Italian", "ru": "Russian",
    "hi": "Hindi",
}


def translate_with_gemini(text: str, target_lang: str) -> str:
    """Call Gemini to translate text. Returns stub when no API key is set."""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return f"[TRANSLATION STUB — no GEMINI_API_KEY: {text}]"

    from google import genai

    lang_name = LANG_NAMES.get(target_lang, target_lang)
    prompt = (
        f"Translate the following text to {lang_name}. "
        f"Return ONLY the translated text, no explanations or quotes.\n\n{text}"
    )
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    return (response.text or "").strip()


def get_or_create_translation(text: str, target_lang: str) -> str:
    """Return cached translation or create via Gemini and cache the result."""
    cached = get_cached_translation(text, target_lang)
    if cached is not None:
        return cached
    translated = translate_with_gemini(text, target_lang)
    save_cached_translation(text, target_lang, translated)
    return translated
