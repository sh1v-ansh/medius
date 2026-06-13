"""
Lease analysis engine — Massachusetts residential leases only.

Scans extracted lease text for:
  - Illegal clauses (void under MA law)
  - Concerning but legal clauses (yellow flags)
  - Required disclosures that are absent
  - Key terms (rent, deposit, dates, fees)

All findings cite real MA statutes from the corpus. No win/loss prediction.
"""
from __future__ import annotations

import re
from typing import Any


# ── Statute snippets (sourced from legal_engine/corpus.py) ───────────────────

_STATUTES: dict[str, dict[str, str]] = {
    "MGL_111_127L": {
        "title": "Implied warranty of habitability",
        "text": "Every landlord shall maintain premises in a habitable condition. Any lease clause that waives this warranty is void.",
    },
    "MGL_186_15B": {
        "title": "Security deposits",
        "text": "No lessor may require a security deposit exceeding the amount of first month's rent. Failure to return within 30 days entitles the tenant to 3× the deposit plus interest and attorney's fees.",
    },
    "MGL_186_15B_interest": {
        "title": "Security deposit interest",
        "text": "A lessor who holds a security deposit shall pay interest at 5% per year or the rate paid by the bank holding the deposit. Any clause waiving this right is void.",
    },
    "MGL_186_15B_receipt": {
        "title": "Security deposit receipt",
        "text": "Upon receipt of a security deposit, the lessor shall give the tenant a receipt stating the amount and the bank holding the deposit.",
    },
    "MGL_186_15C": {
        "title": "Move-in checklist (statement of condition)",
        "text": "Before or at the time of receiving a security deposit, the lessor shall provide a written statement of the condition of the premises signed by the lessor.",
    },
    "MGL_186_14": {
        "title": "Last month's rent — interest required",
        "text": "A lessor who requires last month's rent in advance must pay the tenant interest at 5% per year. Any clause waiving this obligation is void.",
    },
    "MGL_186_11": {
        "title": "Entry by landlord — 24-hour notice",
        "text": "A landlord may enter a tenant's unit only with at least 24-hour advance notice except in a genuine emergency. Clauses granting unrestricted entry rights are unenforceable.",
    },
    "MGL_186_12": {
        "title": "Quiet enjoyment",
        "text": "Every tenant is entitled to quiet enjoyment. A landlord who substantially interferes is liable for 3 months' rent or actual damages, whichever is greater.",
    },
    "MGL_186_19": {
        "title": "Lockout prohibited",
        "text": "A landlord may not lock out a tenant, remove doors or windows, or otherwise force a tenant to vacate without a court order. Any lease clause purporting to allow self-help eviction is void.",
    },
    "MGL_186_20": {
        "title": "Utility shutoff prohibited",
        "text": "No landlord may cause termination of utilities to a tenant as a means of eviction or retaliation. Any such clause is void.",
    },
    "MGL_186_22": {
        "title": "Notice to quit — at-will tenancy",
        "text": "Either party may terminate a tenancy at will with at least 30 days written notice before the next rental due date.",
    },
    "MGL_186_28": {
        "title": "Lead paint disclosure",
        "text": "Landlords must provide a lead paint disclosure and the MA Lead Law Notification pamphlet before signing a lease for any unit built before 1978.",
    },
    "MGL_93A_9": {
        "title": "Consumer protection — unfair practices",
        "text": "Unfair or deceptive lease terms may entitle the tenant to double or triple damages under G.L. c. 93A §9.",
    },
    "MGL_239_8A": {
        "title": "Repair-and-deduct remedy",
        "text": "A tenant may repair conditions endangering health or safety and deduct the cost from rent (up to 4 months) if the landlord fails to repair after proper written notice.",
    },
}


# ── Issue definitions ─────────────────────────────────────────────────────────
# Each issue: patterns (any match triggers it), statute_id, severity, flag text,
# plain English explanation, and tenant remedy.

_ISSUES = [
    {
        "id": "waive_habitability",
        "patterns": [
            r"as[- ]is", r"waiv\w* warranty", r"waiv\w* habitab",
            r"landlord.*not.*responsible.*repair", r"no warranty",
            r"tenant.*accept.*condition", r"premises.*accepted.*is",
        ],
        "statute": "MGL_111_127L",
        "severity": "illegal",
        "flag": "Waiver of implied warranty of habitability",
        "plain": (
            "This clause tries to make you give up your right to a liveable apartment. "
            "Massachusetts law says landlords must keep units habitable — heat, water, "
            "no pests, structurally sound. You cannot legally sign that right away."
        ),
        "remedy": (
            "This clause is void. You retain all habitability rights. If the landlord "
            "refuses to repair, you can withhold rent, repair-and-deduct (up to 4 months), "
            "or sue under MGL c.111 §127L."
        ),
    },
    {
        "id": "waive_deposit_interest",
        "patterns": [
            r"no interest.*deposit", r"deposit.*no interest",
            r"waiv\w* interest.*security", r"security.*waiv\w* interest",
            r"interest.*not.*paid.*deposit",
        ],
        "statute": "MGL_186_15B_interest",
        "severity": "illegal",
        "flag": "Waiver of interest on security deposit",
        "plain": (
            "Your landlord must pay you 5% interest per year on your security deposit "
            "(or whatever the bank pays). Any clause saying otherwise is illegal."
        ),
        "remedy": (
            "This clause is void. Demand interest when your deposit is returned. "
            "Failure to pay interest is grounds to recover 3× the deposit."
        ),
    },
    {
        "id": "waive_lmr_interest",
        "patterns": [
            r"no interest.*last month", r"last month.*no interest",
            r"waiv\w* interest.*last month",
        ],
        "statute": "MGL_186_14",
        "severity": "illegal",
        "flag": "Waiver of interest on last month's rent",
        "plain": (
            "If the landlord collected last month's rent upfront, they owe you 5% "
            "interest per year on that money. A clause saying they don't is void."
        ),
        "remedy": "Demand interest at lease end. Failure to pay can be challenged in small claims court.",
    },
    {
        "id": "unrestricted_entry",
        "patterns": [
            r"landlord.*enter.*any time", r"enter.*without.*notice",
            r"right.*inspect.*any time", r"access.*any time",
            r"landlord.*right.*enter.*without",
        ],
        "statute": "MGL_186_11",
        "severity": "illegal",
        "flag": "Clause granting unrestricted landlord entry without notice",
        "plain": (
            "Your landlord needs to give you at least 24 hours' notice before entering, "
            "except in a genuine emergency. A clause saying they can walk in any time "
            "violates your right to quiet enjoyment."
        ),
        "remedy": (
            "You can refuse entry without 24-hour notice (except emergencies). "
            "Document any unauthorized entries — they can support a quiet-enjoyment claim "
            "worth 3 months' rent."
        ),
    },
    {
        "id": "lockout_clause",
        "patterns": [
            r"landlord.*lock.*out", r"self.?help.*eviction",
            r"change.*locks.*without", r"remove.*belongings.*without.*court",
            r"landlord.*remove.*tenant.*without.*court",
        ],
        "statute": "MGL_186_19",
        "severity": "illegal",
        "flag": "Self-help eviction / lockout clause",
        "plain": (
            "A landlord cannot lock you out, remove your belongings, or shut off "
            "utilities to force you out — ever. Only a court order can evict you. "
            "Any clause saying otherwise is void."
        ),
        "remedy": (
            "If locked out, call the police (it's a criminal act in MA) and seek an "
            "emergency injunction. You are also entitled to damages of 3 months' rent "
            "or actual damages, whichever is more."
        ),
    },
    {
        "id": "utility_shutoff_clause",
        "patterns": [
            r"landlord.*shut.*off.*util", r"terminat.*util.*non.?payment",
            r"util.*terminat.*evict", r"cut.*off.*util.*remedy",
        ],
        "statute": "MGL_186_20",
        "severity": "illegal",
        "flag": "Utility shutoff as eviction remedy",
        "plain": (
            "A landlord cannot cut off heat, water, or electricity to force you out. "
            "Any lease clause that claims this right is illegal."
        ),
        "remedy": (
            "If utilities are shut off, you can immediately seek an emergency court order "
            "and claim damages. File a complaint with the local Board of Health."
        ),
    },
    {
        "id": "waive_right_to_sue",
        "patterns": [
            r"waiv\w* right.*sue", r"no.*right.*sue", r"binding.*arbitration.*only",
            r"waiv\w*.*court", r"shall not.*bring.*action",
            r"sole.*remedy.*arbitrat",
        ],
        "statute": "MGL_93A_9",
        "severity": "illegal",
        "flag": "Waiver of right to sue / binding arbitration only",
        "plain": (
            "You cannot sign away your right to go to court against a landlord in "
            "Massachusetts. Mandatory arbitration-only clauses that strip court access "
            "are unenforceable under consumer protection law."
        ),
        "remedy": "This clause is void. You may still bring claims in housing court or small claims court.",
    },
    {
        "id": "forfeiture_deposit",
        "patterns": [
            r"forfeit.*deposit", r"deposit.*forfeit",
            r"deposit.*not.*return", r"deposit.*retained.*breach",
            r"landlord.*keep.*deposit.*terminat",
        ],
        "statute": "MGL_186_15B",
        "severity": "illegal",
        "flag": "Automatic forfeiture of security deposit on any breach",
        "plain": (
            "A landlord can only keep your security deposit for specific, documented "
            "damages above normal wear and tear. A blanket 'you forfeit your deposit' "
            "clause is illegal."
        ),
        "remedy": (
            "If your deposit is wrongfully withheld, you are owed 3× the deposit "
            "plus interest and reasonable attorney's fees."
        ),
    },
    # ── Yellow flags ──────────────────────────────────────────────────────────
    {
        "id": "high_late_fee",
        "patterns": [
            r"late fee.*\d{2,}",  # late fee of 10+ (two digit number)
            r"late.*charge.*\d{2,}",
            r"10.*percent.*late", r"15.*percent.*late", r"20.*percent.*late",
        ],
        "statute": "MGL_186_15B",
        "severity": "concerning",
        "flag": "Potentially excessive late fee",
        "plain": (
            "Massachusetts courts have found late fees above 5% of rent to be "
            "unconscionable in many cases. Check the exact amount in this lease."
        ),
        "remedy": "You may challenge an excessive late fee as an unfair practice under MGL c.93A.",
    },
    {
        "id": "broad_inspection",
        "patterns": [
            r"inspect.*at.*landlord.*discretion",
            r"routine.*inspect.*without.*notice",
            r"right.*inspect.*frequen",
        ],
        "statute": "MGL_186_11",
        "severity": "concerning",
        "flag": "Broad landlord inspection rights",
        "plain": (
            "The landlord must give you 24 hours' notice for inspections except in "
            "emergencies. Vague inspection rights clauses may be used to harass tenants."
        ),
        "remedy": "You can insist on 24-hour notice. Document any harassment pattern for a quiet-enjoyment claim.",
    },
    {
        "id": "tenant_pays_all_repairs",
        "patterns": [
            r"tenant.*responsible.*all.*repair",
            r"tenant.*maintain.*premises",
            r"all repairs.*tenant.*expense",
            r"tenant.*pay.*all.*maintenance",
        ],
        "statute": "MGL_111_127L",
        "severity": "concerning",
        "flag": "Tenant responsible for all repairs",
        "plain": (
            "Landlords are legally required to maintain the premises and cannot shift "
            "all repair responsibility to tenants, especially for structural, heating, "
            "plumbing, or safety issues."
        ),
        "remedy": (
            "You can report code violations to the local Board of Health. For health/safety "
            "repairs, you may use the repair-and-deduct remedy (up to 4 months' rent)."
        ),
    },
    {
        "id": "automatic_renewal_short_notice",
        "patterns": [
            r"automat\w* renew",
            r"renew.*unless.*notice",
            r"auto.?renew",
        ],
        "statute": "MGL_186_22",
        "severity": "concerning",
        "flag": "Automatic renewal clause",
        "plain": (
            "This lease automatically renews unless you give notice. Make sure you know "
            "the deadline to opt out, or you could be locked into another term."
        ),
        "remedy": "Note the opt-out deadline in your calendar. Written notice is required.",
    },
]


# ── Required MA lease disclosures ─────────────────────────────────────────────

_REQUIRED_DISCLOSURES = [
    {
        "id": "lead_paint",
        "name": "Lead paint disclosure",
        "statute": "MGL_186_28",
        "check_patterns": [
            r"lead paint", r"lead-based paint", r"lead hazard",
            r"lead law", r"lead disclosure",
        ],
        "plain": (
            "For any unit built before 1978, Massachusetts law requires the landlord to "
            "give you the Lead Paint Notification pamphlet and disclose known lead hazards "
            "before you sign. This is especially critical if you have children under 6."
        ),
    },
    {
        "id": "statement_of_condition",
        "name": "Move-in checklist / statement of condition",
        "statute": "MGL_186_15C",
        "check_patterns": [
            r"statement of condition", r"move.in checklist",
            r"condition.*premises.*check", r"inspection.*checklist",
            r"move.?in.*inspection",
        ],
        "plain": (
            "Before or at the time of taking a security deposit, the landlord must give you "
            "a written list of existing damage (statement of condition). Without it, the "
            "landlord cannot lawfully deduct for pre-existing damage."
        ),
    },
    {
        "id": "deposit_receipt",
        "name": "Security deposit receipt requirement",
        "statute": "MGL_186_15B_receipt",
        "check_patterns": [
            r"deposit.*receipt", r"receipt.*deposit",
            r"receipt.*bank.*deposit", r"deposit.*bank.*account",
        ],
        "plain": (
            "The landlord must give you a written receipt within 30 days stating the amount "
            "of your deposit and the name/address of the bank holding it. No receipt = "
            "potential grounds to demand the deposit back immediately."
        ),
    },
    {
        "id": "lmr_interest_disclosure",
        "name": "Last month's rent interest disclosure",
        "statute": "MGL_186_14",
        "check_patterns": [
            r"last month.*interest", r"interest.*last month",
            r"prepaid rent.*interest",
        ],
        "plain": (
            "If the landlord collected last month's rent upfront, the lease should state "
            "that they will pay you 5% annual interest on it. If it doesn't, demand it."
        ),
    },
]


# ── Key terms extractor ───────────────────────────────────────────────────────

def _extract_key_terms(text: str) -> dict[str, str]:
    t = text.lower()
    terms: dict[str, str] = {}

    # Monthly rent — keep keyword-to-$ gap short to avoid cross-document false matches
    m = re.search(
        r"(?:monthly rent|base rent|rent payable|rent is|rent shall be)[^\$]{0,150}\$\s*([\d,]+)",
        t,
    ) or re.search(r"\$\s*([\d,]+)\s*(?:per month|/month|monthly)", t)
    if m:
        amount = m.group(1).replace(",", "")
        if amount.isdigit() and int(amount) <= 100_000:
            terms["monthly_rent"] = f"${amount}"

    # Security deposit
    m = re.search(
        r"security deposit[^\$]{0,80}\$\s*([\d,]+)",
        t,
    ) or re.search(r"\$\s*([\d,]+)[^\$]{0,40}(?:security deposit|as.*?security)", t)
    if m:
        terms["security_deposit"] = f"${m.group(1).replace(',', '')}"

    # Lease start
    m = re.search(
        r"(?:commenc|begin|start)(?:ing|s)?\s+(?:on\s+)?(\w+ \d{1,2},?\s*\d{4}|\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})",
        t,
    )
    if m:
        terms["lease_start"] = m.group(1).strip()

    # Lease end
    m = re.search(
        r"(?:expir|end|terminat)(?:ing|es|es on)?\s+(?:on\s+)?(\w+ \d{1,2},?\s*\d{4}|\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})",
        t,
    )
    if m:
        terms["lease_end"] = m.group(1).strip()

    # Late fee
    m = re.search(r"late (?:fee|charge)[^\n]*?(\$[\d,]+|\d+\s*%)", t)
    if m:
        terms["late_fee"] = m.group(1).strip()

    # Notice period
    m = re.search(r"(\d+)[- ]day\s+(?:written\s+)?notice", t)
    if m:
        terms["notice_period"] = f"{m.group(1)} days"

    # Pet policy
    if re.search(r"no pets|pets.*not.*permit|pets.*prohibit", t):
        terms["pets"] = "Not permitted"
    elif re.search(r"pets.*permit|pets.*allow|pets.*ok", t):
        terms["pets"] = "Permitted (see lease terms)"

    return terms


# ── Deposit amount check ──────────────────────────────────────────────────────

def _check_excess_deposit(text: str, key_terms: dict[str, str]) -> dict[str, Any] | None:
    rent_raw = key_terms.get("monthly_rent", "").replace("$", "").replace(",", "")
    dep_raw = key_terms.get("security_deposit", "").replace("$", "").replace(",", "")
    if not rent_raw or not dep_raw:
        return None
    try:
        rent = float(rent_raw)
        dep = float(dep_raw)
    except ValueError:
        return None
    if dep > rent:
        return {
            "id": "excess_security_deposit",
            "statute": "MGL_186_15B",
            "severity": "illegal",
            "flag": f"Security deposit (${dep:,.0f}) exceeds one month's rent (${rent:,.0f})",
            "plain": (
                f"Massachusetts law caps security deposits at one month's rent (${rent:,.0f}). "
                f"Your landlord collected ${dep:,.0f}, which is ${dep - rent:,.0f} too much."
            ),
            "remedy": (
                f"You can demand the excess ${dep - rent:,.0f} back immediately. "
                "Failure to return it triggers treble damages plus attorney's fees."
            ),
            "statute_title": _STATUTES["MGL_186_15B"]["title"],
            "statute_text": _STATUTES["MGL_186_15B"]["text"],
        }
    return None


# ── Main analysis function ────────────────────────────────────────────────────

def analyze_lease(text: str) -> dict[str, Any]:
    """
    Analyze a lease text for issues and return structured findings.
    No win/loss prediction — findings are informational only.
    """
    if not text or not text.strip():
        return {
            "error": "No lease text provided. Upload a lease document or photo first.",
        }

    t_lower = text.lower()

    # Key terms
    key_terms = _extract_key_terms(text)

    # Detect issues
    found_issues: list[dict[str, Any]] = []

    for issue in _ISSUES:
        matched_excerpt = ""
        for pat in issue["patterns"]:
            m = re.search(pat, t_lower)
            if m:
                # Return surrounding original-case text (not lowercased)
                ctx_start = max(0, m.start() - 60)
                ctx_end = min(len(text), m.end() + 180)
                excerpt = text[ctx_start:ctx_end].strip()
                # Trim to sentence boundaries where possible
                if ctx_start > 0 and not excerpt[0].isupper():
                    sp = excerpt.find(' ')
                    excerpt = ("…" + excerpt[sp:]) if sp != -1 else ("…" + excerpt)
                matched_excerpt = excerpt
                break
        if matched_excerpt:
            stat_id = issue["statute"]
            stat = _STATUTES.get(stat_id, {})
            found_issues.append({
                "id": issue["id"],
                "statute": stat_id,
                "statute_title": stat.get("title", ""),
                "statute_text": stat.get("text", ""),
                "severity": issue["severity"],
                "flag": issue["flag"],
                "plain": issue["plain"],
                "remedy": issue["remedy"],
                "matched_excerpt": matched_excerpt,
            })

    # Deposit amount check
    excess = _check_excess_deposit(text, key_terms)
    if excess:
        found_issues.append(excess)

    # Missing disclosures
    missing: list[dict[str, Any]] = []
    for disc in _REQUIRED_DISCLOSURES:
        present = any(re.search(pat, t_lower) for pat in disc["check_patterns"])
        if not present:
            stat = _STATUTES.get(disc["statute"], {})
            missing.append({
                "id": disc["id"],
                "name": disc["name"],
                "statute": disc["statute"],
                "statute_title": stat.get("title", ""),
                "plain": disc["plain"],
            })

    red = [i for i in found_issues if i["severity"] == "illegal"]
    yellow = [i for i in found_issues if i["severity"] == "concerning"]

    return {
        "key_terms": key_terms,
        "issues": found_issues,
        "missing_disclosures": missing,
        "summary": {
            "red_flags": len(red),
            "yellow_flags": len(yellow),
            "missing_disclosures": len(missing),
        },
        "not_considered": (
            "This analysis covers only Massachusetts residential lease law and only the text "
            "provided. Local ordinances, federal law, lease amendments, side agreements, verbal "
            "promises, and the specific facts of your tenancy were not reviewed. "
            "This is information, not legal advice."
        ),
        "is_advice": False,
    }


# ── Sample lease for demo ─────────────────────────────────────────────────────

from pathlib import Path

_SAMPLE_LEASE_PATH = Path(__file__).resolve().parent.parent / "sample-lease.pdf"

# Minimal fallback if PDF is missing (e.g. CI without the file)
_FALLBACK_SAMPLE_LEASE = """
RESIDENTIAL LEASE AGREEMENT — MASSACHUSETTS
Monthly rent is $2,000 per month. Security deposit of $4,000.
Tenant accepts premises AS IS. Landlord may enter at any time without notice.
"""


def get_sample_lease_text() -> str:
    """Load demo lease text from sample-lease.pdf at project root."""
    if _SAMPLE_LEASE_PATH.exists():
        from backend.legal_engine.pdf_text import extract_pdf_text

        return extract_pdf_text(_SAMPLE_LEASE_PATH)
    return _FALLBACK_SAMPLE_LEASE


SAMPLE_LEASE = get_sample_lease_text()
