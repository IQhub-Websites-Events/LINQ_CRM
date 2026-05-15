import re


def normalize_event_code(code: str) -> str:
    """
    'SPU - VV26' → 'SPU - VV'. Strips trailing year digits to get the base event code.
    The last 2 or 4 digits of a booking event_code represent the year;
    everything before them is the event identifier used on the Event record.
    """
    if not code:
        return ""
    code = code.strip().upper()
    # Remove any trailing run of digits (the year suffix: e.g. '26', '2026')
    code = re.sub(r"\d+$", "", code).strip()
    return code


def booking_code_regex(base_code: str, year: int = None) -> str:
    """
    Returns a regex matching all booking event_code variants for a normalized base code.

    base_code is already year-stripped (e.g. 'SPU - VV', 'HDU').
    Booking codes are stored as:
      - exact base:    'SPU - VV'  or  'HDU'
      - base + year:   'SPU - VV26', 'SPU - VV2026'

    If `year` is provided, restricts to that specific year's 2-digit or 4-digit suffix.
    Example: booking_code_regex('SPU - VV', 2026) matches 'SPU - VV26' and 'SPU - VV2026'.
    """
    escaped = re.escape(base_code.strip().upper())

    if year:
        yr2 = str(year)[-2:]
        yr4 = str(year)
        return rf"^{escaped}\s*({yr2}|{yr4})$"

    # No year filter — match the exact base or base + any trailing digits
    return rf"^{escaped}\s*\d{{0,4}}$"
