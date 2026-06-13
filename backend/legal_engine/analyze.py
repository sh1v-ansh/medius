from typing import Any, Dict, List

from .corpus import retrieve


def _template_explanation(
    relevant_statutes: List[Dict],
    perspective: str,
) -> Dict[str, str]:
    """Fallback template explanations when Gemini is unavailable."""
    statute_titles = ", ".join(s["title"] for s in relevant_statutes)
    statute_texts_combined = " | ".join(s["text"] for s in relevant_statutes)

    perspective_note = "as a tenant" if perspective == "tenant" else "as a landlord"

    simple = (
        f"Based on what you shared {perspective_note}, the law talks about: {statute_titles}. "
        f"This is information only — not legal advice. A human mediator will help decide next steps."
    )

    standard = (
        f"From the perspective of {perspective}, the following Massachusetts statutes appear relevant: "
        f"{statute_titles}. "
        f"The retrieved law states: {statute_texts_combined}. "
        f"This analysis is based only on the text you provided and the statutes retrieved above. "
        f"This is information, not legal advice."
    )

    full = (
        f"PERSPECTIVE: {perspective}\n\n"
        f"RETRIEVED STATUTES:\n"
        + "\n\n".join(
            f"[{s['id']}] {s['title']}\n{s['text']}"
            for s in relevant_statutes
        )
        + "\n\nThis is information only. This analysis does not constitute legal advice."
    )

    return {"simple": simple, "standard": standard, "full": full}


def analyze(document_text: str, perspective: str, target_lang: str = "en") -> Dict[str, Any]:
    """
    Analyze a legal document from the given perspective.

    1. Retrieve relevant MA statutes via Pinecone (or local fallback)
    2. Generate explanations with Gemini (or template fallback)
    """
    relevant_statutes: List[Dict] = retrieve(document_text, top_k=5)

    citations = [
        {
            "statute_id": statute["id"],
            "statute_text": statute["text"],
            "source": "MGL",
        }
        for statute in relevant_statutes
    ]

    explanation: Dict[str, str]
    try:
        from backend.legal_engine.gemini_client import generate_analysis, is_configured

        if is_configured() and relevant_statutes:
            explanation = generate_analysis(document_text, perspective, relevant_statutes, target_lang=target_lang)
            # Ensure full level includes verbatim statute text for citation lockbox tests
            statute_blocks = "\n\n".join(
                f"[{s['id']}] {s['title']}\n{s['text']}"
                for s in relevant_statutes
            )
            if not any(s["text"][:30] in explanation.get("full", "") for s in relevant_statutes if s["text"]):
                explanation["full"] = (
                    f"PERSPECTIVE: {perspective}\n\n"
                    f"RETRIEVED STATUTES (verbatim):\n{statute_blocks}\n\n"
                    f"{explanation.get('full', '')}"
                )
        else:
            explanation = _template_explanation(relevant_statutes, perspective)
    except Exception:
        explanation = _template_explanation(relevant_statutes, perspective)

    not_considered = (
        "This analysis is based only on the retrieved statutes above. "
        "Other laws, local ordinances, or facts not mentioned in your document may apply."
    )

    return {
        "explanation": explanation,
        "citations": citations,
        "not_considered": not_considered,
    }
