"""
Speech-to-text transcription stub.

Claude does not natively transcribe audio. In production this should route
audio to a dedicated STT service (e.g. AWS Transcribe, AssemblyAI) and then
optionally post-process the transcript with Claude for formatting/cleanup.
The stub returns a placeholder when ANTHROPIC_API_KEY is absent so tests
can mock at the call-site (backend.main.transcribe).
"""
from __future__ import annotations

import os


def transcribe(audio_bytes: bytes) -> str:
    """Transcribe audio bytes to text. Requires ANTHROPIC_API_KEY to be set."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return (
            "[TRANSCRIPTION STUB: No ANTHROPIC_API_KEY set. "
            "In production, audio is sent to a dedicated STT service and "
            "the transcript is post-processed by Claude for cleanup.]"
        )
    # Production: send audio_bytes to STT service, then optionally clean up
    # with Claude. Claude itself does not accept raw audio as input.
    return "[TRANSCRIPTION STUB: STT integration not yet implemented.]"
