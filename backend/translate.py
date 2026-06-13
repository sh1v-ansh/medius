"""
Translation service — Claude-powered, cache-first.

Rules:
- Translation NEVER changes meaning or decides anything.
- Cache prevents redundant API calls (keyed by target_lang:source_text).
- Returns the stub string when ANTHROPIC_API_KEY is absent (safe for tests).
"""
from __future__ import annotations

import os

import anthropic

from backend.storage import get_cached_translation, save_cached_translation

CLAUDE_MODEL = "claude-opus-4-8"

LANG_NAMES: dict[str, str] = {
    "en": "English", "es": "Spanish", "fr": "French", "de": "German",
    "zh": "Chinese (Simplified)", "ar": "Arabic", "ja": "Japanese",
    "ko": "Korean", "pt": "Portuguese", "it": "Italian", "ru": "Russian",
    "hi": "Hindi",
}


def translate_with_claude(text: str, target_lang: str) -> str:
    """Call Claude to translate text. Returns stub when no API key is set."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return f"[TRANSLATION STUB — no ANTHROPIC_API_KEY: {text}]"

    lang_name = LANG_NAMES.get(target_lang, target_lang)
    prompt = (
        f"Translate the following text to {lang_name}. "
        f"Return ONLY the translated text, no explanations or quotes.\n\n{text}"
    )
    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()


def get_or_create_translation(text: str, target_lang: str) -> str:
    """Return cached translation or create via Claude and cache the result."""
    cached = get_cached_translation(text, target_lang)
    if cached is not None:
        return cached
    translated = translate_with_claude(text, target_lang)
    save_cached_translation(text, target_lang, translated)
    return translated
