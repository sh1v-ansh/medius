import re
import math
from typing import List, Dict

STATUTES = [
  {"id": "MGL_186_15B", "title": "Security deposits", "text": "No lessor may require a security deposit exceeding the amount of first month's rent..."},
  {"id": "MGL_186_15B_return", "title": "Return of security deposit", "text": "The lessor shall, within thirty days after the termination of the tenancy, return to the tenant the security deposit..."},
  {"id": "MGL_186_15B_interest", "title": "Security deposit interest", "text": "A lessor who holds a security deposit shall pay interest on such deposit at the rate of five per cent per year or such other rate as the department of housing may establish..."},
  {"id": "MGL_186_15B_receipt", "title": "Security deposit receipt", "text": "Upon receipt of a security deposit, the lessor shall give the tenant a receipt..."},
  {"id": "MGL_186_15B_bank", "title": "Security deposit bank account", "text": "A lessor who holds a security deposit shall deposit it in a separate, interest-bearing account in a bank..."},
  {"id": "MGL_239_1", "title": "Summary process — eviction", "text": "A landlord may recover possession of premises by summary process (eviction) when a tenant holds over after notice to quit..."},
  {"id": "MGL_239_2A", "title": "Retaliatory eviction defense", "text": "A tenant who has reported a code violation or exercised a legal right shall have an affirmative defense to eviction..."},
  {"id": "MGL_111_127L", "title": "Implied warranty of habitability", "text": "Every landlord shall maintain premises in a habitable condition, including adequate heat, water, structural integrity, and freedom from pests..."},
  {"id": "MGL_186_14", "title": "Last month's rent", "text": "A lessor may require the tenant to pay last month's rent in advance. The lessor shall pay interest on such prepaid rent at five percent per year..."},
  {"id": "MGL_186_22", "title": "Notice to quit — at-will tenancy", "text": "Either party to a tenancy at will may terminate it by written notice of at least thirty days before the next rental due date..."},
  {"id": "MGL_186_23", "title": "Notice to quit — lease termination", "text": "A tenant holding under a written lease has the right to remain until the lease term expires unless the tenant breaches the lease..."},
  {"id": "MGL_186_18", "title": "Retaliatory rent increase", "text": "A landlord may not increase rent in retaliation for a tenant's exercise of legal rights or complaints to a housing authority..."},
  {"id": "MGL_186_19", "title": "Lockout prohibited", "text": "A landlord may not lock out a tenant, remove doors or windows, or shut off utilities to force a tenant to vacate without a court order..."},
  {"id": "MGL_186_20", "title": "Utility shutoff prohibited", "text": "No landlord shall cause the termination of utilities furnished to a tenant as a means of eviction..."},
  {"id": "MGL_239_8A", "title": "Tenant repair-and-deduct remedy", "text": "A tenant may repair conditions that endanger health or safety and deduct up to four months' rent from future payments if the landlord fails to repair after notice..."},
  {"id": "MGL_186_11", "title": "Entry by landlord", "text": "A landlord may enter a tenant's unit only with reasonable notice (24 hours) except in an emergency..."},
  {"id": "MGL_186_12", "title": "Quiet enjoyment", "text": "Every tenant shall have the right to quiet enjoyment of the premises. A landlord who substantially interferes with this right is liable for three months' rent or actual damages..."},
  {"id": "MGL_93A_9", "title": "Consumer protection — unfair practices", "text": "A landlord who engages in unfair or deceptive acts in violation of G.L. c. 93A may be liable for double or triple damages..."},
  {"id": "MGL_186_15C", "title": "Move-in checklist", "text": "Before or at the time of receiving a security deposit, the lessor shall provide the tenant with a written statement of the condition of the premises..."},
  {"id": "MGL_186_28", "title": "Lead paint disclosure", "text": "Landlords must disclose known lead paint hazards and comply with the Massachusetts Lead Law before renting to families with children under six..."},
]


def _tokenize(text: str) -> List[str]:
    """Lowercase and split text into word tokens."""
    return re.findall(r'[a-z]+', text.lower())


def embed(text: str) -> Dict[str, float]:
    """
    Compute a simple bag-of-words TF vector (word-frequency dict normalized by L2 norm).
    Returns a dict mapping word -> normalized frequency.
    """
    tokens = _tokenize(text)
    if not tokens:
        return {}

    freq: Dict[str, float] = {}
    for token in tokens:
        freq[token] = freq.get(token, 0) + 1

    # L2 normalize
    magnitude = math.sqrt(sum(v * v for v in freq.values()))
    if magnitude == 0:
        return {}

    return {word: count / magnitude for word, count in freq.items()}


def _cosine_sim(vec_a: Dict[str, float], vec_b: Dict[str, float]) -> float:
    """Compute cosine similarity between two normalized TF vectors."""
    if not vec_a or not vec_b:
        return 0.0

    dot_product = 0.0
    for word, weight in vec_a.items():
        if word in vec_b:
            dot_product += weight * vec_b[word]

    # Vectors are already L2-normalized, so cosine sim = dot product
    return dot_product


def retrieve(query: str, top_k: int = 3) -> List[Dict]:
    """
    Retrieve the top_k most relevant statutes for the given query
    using cosine similarity on bag-of-words TF vectors.
    """
    query_vec = embed(query)

    if not query_vec:
        # Return first top_k statutes if query is empty
        return STATUTES[:top_k]

    scored = []
    for statute in STATUTES:
        statute_text = statute["title"] + " " + statute["text"]
        statute_vec = embed(statute_text)
        score = _cosine_sim(query_vec, statute_vec)
        scored.append((score, statute))

    # Sort by score descending
    scored.sort(key=lambda x: x[0], reverse=True)

    return [statute for _, statute in scored[:top_k]]
