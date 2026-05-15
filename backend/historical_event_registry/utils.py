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


def booking_code_regex(base_code: str, year: int = None) -> str:
    """
    Returns a regex matching all booking event_code variants for a base code.

    Booking codes are stored in several formats:
      - exact base:        'HDU'
      - base + year:       'HDU25', 'HDU2025'
      - base + suffix:     'HDU - VV'
      - base + suffix+yr:  'HDU - VV26', 'HDU - VV2026'

    If `year` is provided (e.g. 2025), it strictly limits the suffix to '25' or '2025'.
    Example: booking_code_regex('HDU', 2025) matches 'HDU25' and 'HDU - VV2025'.
    """
    escaped = re.escape(base_code.strip().upper())
    
    if year:
        # Match exactly the 2-digit or 4-digit year representation
        yr2 = str(year)[-2:]
        yr4 = str(year)
        return rf"^{escaped}(\s*-\s*[A-Za-z/]+\s*)?({yr2}|{yr4})$"
        
    # Optional " - LETTERS" suffix followed by optional 2-4 digit year
    return rf"^{escaped}(\s*-\s*[A-Za-z/]+\s*)?\d{{0,4}}$"
