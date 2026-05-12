from __future__ import annotations


def calc_trend(curr_7d: int, prev_7d: int) -> tuple[str, str]:
    """
    Returns (trend_label, trend_color) by comparing current vs previous 7-day window.
    """
    if prev_7d == 0:
        if curr_7d > 0:
            return "New Activity", "purple"
        return "Inactive", "grey"
    ratio = curr_7d / prev_7d
    if ratio >= 1.2:
        return "Increasing", "green"
    elif ratio >= 0.8:
        return "Stable", "blue"
    return "Declining", "red"


def calc_activity_color(paid_7d: int) -> str:
    """Operational color for 7-day activity volume."""
    if paid_7d >= 5:
        return "green"
    if paid_7d >= 1:
        return "yellow"
    return "red"
