"""
Speech-to-text transcription stub.

In production this routes audio to a dedicated STT service (e.g. Whisper, AssemblyAI)
then optionally post-processes the transcript with Gemini for formatting.
Returns a placeholder when GEMINI_API_KEY is absent so tests can mock at the call-site.
"""
from __future__ import annotations

import os


def transcribe(audio_bytes: bytes) -> str:
    """Transcribe audio bytes to text. Stub — no live STT in demo."""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return (
            "[TRANSCRIPTION STUB: No GEMINI_API_KEY set. "
            "In production, audio is sent to a dedicated STT service and the "
            "transcript is post-processed by Gemini for cleanup.]"
        )
    return "[TRANSCRIPTION STUB: Real-time audio STT not yet wired for demo.]"
