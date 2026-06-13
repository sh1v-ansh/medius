import os


def ocr(image_bytes: bytes) -> str:
    """
    Extract text from an image using OCR.

    In production, this would call the Gemini Vision API.
    Returns a placeholder string when no API key is present.

    Args:
        image_bytes: Raw image bytes (JPEG, PNG, etc.).

    Returns:
        Extracted text string.
    """
    api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        return "[OCR STUB: No GEMINI_API_KEY set. In production, this would call Gemini vision for OCR.]"

    # Production implementation would call Gemini Vision API here.
    # Example:
    # import google.generativeai as genai
    # genai.configure(api_key=api_key)
    # model = genai.GenerativeModel("gemini-pro-vision")
    # ... send image and extract text ...
    return "[OCR STUB: Gemini Vision API integration not yet implemented.]"
