import re


def normalize_event_code(code: str) -> str:
    """'DDU - PT' → 'DDU'. Used for HistoricalEventReference lookups."""
    if not code:
        return ""
    code = code.strip()
    if " - " in code:
        code = code.split(" - ")[0].strip()
    code = code.upper()
    code = re.sub(r"[^A-Z0-9]", "", code)
    return code


def booking_code_regex(base_code: str) -> str:
    """
    Returns a regex matching all booking event_code variants for a base code.

    Booking codes are stored in several formats:
      - exact base:        'HDU'
      - base + year:       'HDU25', 'HDU2025'
      - base + suffix:     'HDU - VV'
      - base + suffix+yr:  'HDU - VV26', 'HDU - VV2026'

    Example: booking_code_regex('HDU') matches all of the above.
    """
    escaped = re.escape(base_code.strip().upper())
    # Optional " - LETTERS" suffix followed by optional 2-4 digit year
    return rf"^{escaped}(\s*-\s*[A-Za-z/]+\s*)?\d{{0,4}}$"
