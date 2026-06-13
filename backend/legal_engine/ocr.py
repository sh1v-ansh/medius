"""OCR via Gemini vision. Stub when GEMINI_API_KEY is absent."""
from __future__ import annotations

import os

GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")


def ocr(image_bytes: bytes) -> str:
    """Extract text from an image using Gemini's vision capability."""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return "[OCR STUB: No GEMINI_API_KEY set. Gemini vision OCR requires an API key.]"

    from google import genai
    from google.genai import types

    if image_bytes[:3] == b"\xff\xd8\xff":
        mime_type = "image/jpeg"
    elif image_bytes[:4] == b"\x89PNG":
        mime_type = "image/png"
    elif image_bytes[:4] in (b"GIF8", b"GIF9"):
        mime_type = "image/gif"
    else:
        mime_type = "image/jpeg"

    client = genai.Client(api_key=api_key)

    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
    text_prompt = (
        "Extract all text visible in this document image. "
        "Return ONLY the extracted text, preserving structure. "
        "No commentary or explanations."
    )

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[image_part, text_prompt],
    )
    return (response.text or "").strip()
