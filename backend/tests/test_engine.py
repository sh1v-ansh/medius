from backend.legal_engine.analyze import analyze
from backend.legal_engine.redact import redact

LEASE_SNIPPET = """
Tenant: John Smith (john.smith@email.com)
Landlord: Jane Doe
Security deposit: $2,000. Tenant moved out on March 1, 2024.
Landlord has not returned the deposit after 45 days.
"""


def test_analyze_returns_explanation():
    result = analyze(LEASE_SNIPPET, "tenant")
    assert result["explanation"]["simple"]
    assert len(result["citations"]) >= 1
    assert result["citations"][0]["statute_text"]
    assert "not_considered" in result


def test_redact_removes_pii():
    result = redact(LEASE_SNIPPET)
    assert "john.smith@email.com" not in result
    assert "[REDACTED]" in result
