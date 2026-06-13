"""OCR via Claude vision (claude-opus-4-8). Stub when ANTHROPIC_API_KEY is absent."""
from __future__ import annotations

import base64
import os


def ocr(image_bytes: bytes) -> str:
    """Extract text from an image using Claude's vision capability."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return "[OCR STUB: No ANTHROPIC_API_KEY set. Claude vision OCR requires an Anthropic key.]"

    import anthropic

    if image_bytes[:3] == b"\xff\xd8\xff":
        media_type = "image/jpeg"
    elif image_bytes[:4] == b"\x89PNG":
        media_type = "image/png"
    elif image_bytes[:4] in (b"GIF8", b"GIF9"):
        media_type = "image/gif"
    else:
        media_type = "image/jpeg"

    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": base64.standard_b64encode(image_bytes).decode("utf-8"),
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            "Extract all text visible in this document image. "
                            "Return ONLY the extracted text, preserving structure. "
                            "No commentary or explanations."
                        ),
                    },
                ],
            }
        ],
    )
    return response.content[0].text
