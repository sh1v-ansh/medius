"""Pinecone vector retrieval for Massachusetts law corpus."""
from __future__ import annotations

import os
import re
from typing import Any

PINECONE_INDEX = os.environ.get("PINECONE_INDEX", "clause-ma-laws-3072")
PINECONE_NAMESPACE = os.environ.get("PINECONE_NAMESPACE", "__default__")

_index = None


def is_configured() -> bool:
    return bool(os.environ.get("PINECONE_API_KEY")) and bool(os.environ.get("GEMINI_API_KEY"))


def _get_index():
    global _index
    if _index is None:
        from pinecone import Pinecone

        pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
        _index = pc.Index(PINECONE_INDEX)
    return _index


def citation_to_statute_id(chapter: str, section: str) -> str:
    """Map chapter/section to MGL_186_15B style ID used elsewhere in Medius."""
    section_clean = section.replace(".", "_").replace(" ", "")
    return f"MGL_{chapter}_{section_clean}"


def _parse_metadata(match: Any) -> dict[str, str]:
    meta = match.metadata or {}
    chapter = str(meta.get("chapter", ""))
    section = str(meta.get("section", ""))
    statute_id = citation_to_statute_id(chapter, section) if chapter and section else match.id

    return {
        "id": statute_id,
        "title": str(meta.get("title", meta.get("citation", statute_id))),
        "text": str(meta.get("text", "")),
        "citation": str(meta.get("citation", "")),
        "source_url": str(meta.get("source_url", "")),
        "score": float(match.score or 0),
    }


def retrieve_from_pinecone(query: str, top_k: int = 5) -> list[dict[str, str]]:
    """
    Embed query with Gemini and search Pinecone.
    Deduplicates by statute_id, keeping highest-scoring chunk per statute.
    """
    from backend.legal_engine.gemini_client import embed_text

    if not query.strip():
        return []

    vector = embed_text(query)
    index = _get_index()

    # Fetch extra chunks since multiple may map to same statute section
    results = index.query(
        namespace=PINECONE_NAMESPACE,
        vector=vector,
        top_k=max(top_k * 3, 9),
        include_metadata=True,
    )

    seen: dict[str, dict[str, str]] = {}
    for match in results.matches or []:
        parsed = _parse_metadata(match)
        sid = parsed["id"]
        if sid not in seen or parsed["score"] > seen[sid].get("score", 0):
            seen[sid] = parsed

    ranked = sorted(seen.values(), key=lambda x: x.get("score", 0), reverse=True)
    return ranked[:top_k]
