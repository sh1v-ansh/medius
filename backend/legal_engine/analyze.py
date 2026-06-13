from typing import Dict, Any, List
from .corpus import retrieve


def analyze(document_text: str, perspective: str) -> Dict[str, Any]:
    """
    Analyze a legal document from the given perspective.

    This is a stub implementation that uses cosine-similarity retrieval to find
    relevant statutes and builds template-based explanations without any LLM calls.

    Args:
        document_text: The text of the document to analyze.
        perspective: Either "tenant" or "landlord".

    Returns:
        A dict with keys:
          - explanation: dict with "simple", "standard", "full" reading levels
          - citations: list of dicts with statute_id, statute_text, source
          - not_considered: scope disclosure note
    """
    # Retrieve relevant statutes via cosine similarity
    relevant_statutes: List[Dict] = retrieve(document_text, top_k=3)

    # Build citations list
    citations = [
        {
            "statute_id": statute["id"],
            "statute_text": statute["text"],
            "source": "MGL",
        }
        for statute in relevant_statutes
    ]

    # Build explanation from retrieved statute titles and texts (no LLM needed)
    statute_titles = ", ".join(s["title"] for s in relevant_statutes)
    statute_texts_combined = " | ".join(s["text"] for s in relevant_statutes)

    perspective_note = (
        "as a tenant" if perspective == "tenant" else "as a landlord"
    )

    simple_explanation = (
        f"Based on what you shared {perspective_note}, the law talks about: {statute_titles}. "
        f"This is information only — not legal advice. A human mediator will help decide next steps."
    )

    standard_explanation = (
        f"From the perspective of {perspective}, the following Massachusetts statutes appear relevant: "
        f"{statute_titles}. "
        f"The retrieved law states: {statute_texts_combined}. "
        f"This analysis is based only on the text you provided and the statutes retrieved above. "
        f"This is information, not legal advice."
    )

    full_explanation = (
        f"PERSPECTIVE: {perspective}\n\n"
        f"RETRIEVED STATUTES:\n"
        + "\n\n".join(
            f"[{s['id']}] {s['title']}\n{s['text']}"
            for s in relevant_statutes
        )
        + "\n\nThis is information only. This analysis does not constitute legal advice."
    )

    not_considered = (
        "This analysis is based only on the retrieved statutes above. "
        "Other laws, local ordinances, or facts not mentioned in your document may apply."
    )

    return {
        "explanation": {
            "simple": simple_explanation,
            "standard": standard_explanation,
            "full": full_explanation,
        },
        "citations": citations,
        "not_considered": not_considered,
    }
