import os


def transcribe(audio_bytes: bytes) -> str:
    """
    Transcribe audio to text.

    In production, this would call the Gemini API for speech-to-text.
    Returns a placeholder string when no API key is present.

    Args:
        audio_bytes: Raw audio bytes to transcribe.

    Returns:
        Transcribed text string.
    """
    api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        return "[TRANSCRIPTION STUB: No GEMINI_API_KEY set. In production, this would call Gemini speech-to-text.]"

    # Production implementation would call Gemini API here.
    # Example:
    # import google.generativeai as genai
    # genai.configure(api_key=api_key)
    # model = genai.GenerativeModel("gemini-pro")
    # ... upload audio and get transcript ...
    return "[TRANSCRIPTION STUB: Gemini API integration not yet implemented.]"
