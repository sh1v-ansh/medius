import re


def redact(text: str) -> str:
    """
    Remove PII from text using regex patterns.

    Redacts:
    - Email addresses
    - Phone numbers (various formats)
    - Social Security Numbers (SSNs)
    - Names preceded by "Name:", "Tenant:", "Landlord:", "Plaintiff:", "Defendant:"

    Replacements use [REDACTED].
    """
    # Remove email addresses
    text = re.sub(
        r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}',
        '[REDACTED]',
        text,
    )

    # Remove SSNs (formats: 123-45-6789, 123 45 6789, 123456789)
    text = re.sub(
        r'\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b',
        '[REDACTED]',
        text,
    )

    # Remove phone numbers (various formats):
    # (123) 456-7890, 123-456-7890, 123.456.7890, +1 123 456 7890, 1234567890
    text = re.sub(
        r'(\+?1[-.\s]?)?'
        r'(\(?\d{3}\)?[-.\s]?)'
        r'\d{3}[-.\s]?\d{4}\b',
        '[REDACTED]',
        text,
    )

    # Remove names after labels: "Name:", "Tenant:", "Landlord:", "Plaintiff:", "Defendant:"
    # Matches the label and captures the name on the same line until punctuation or newline
    text = re.sub(
        r'(?i)(Name|Tenant|Landlord|Plaintiff|Defendant)\s*:\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)',
        r'\1: [REDACTED]',
        text,
    )

    return text
