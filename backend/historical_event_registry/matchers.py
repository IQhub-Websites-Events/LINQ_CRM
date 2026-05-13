import logging
from typing import Optional, Tuple

from events.models import Event

logger = logging.getLogger(__name__)

MATCH_THRESHOLD = 0.60


class EventCodeMatcher:
    def __init__(self):
        self._codes = list(Event.objects.values_list("event_code", flat=True))

    def match(self, normalized_code: str) -> Tuple[Optional[Event], float]:
        if not normalized_code:
            return None, 0.0

        # Exact
        for code in self._codes:
            if code.upper() == normalized_code:
                try:
                    return Event.objects.get(event_code=code), 1.00
                except Event.DoesNotExist:
                    pass

        # Prefix
        for code in self._codes:
            if code.upper().startswith(normalized_code) or normalized_code.startswith(code.upper()):
                try:
                    return Event.objects.get(event_code=code), 0.80
                except Event.DoesNotExist:
                    pass

        # Suffix
        for code in self._codes:
            if code.upper().endswith(normalized_code) or normalized_code.endswith(code.upper()):
                try:
                    return Event.objects.get(event_code=code), 0.75
                except Event.DoesNotExist:
                    pass

        # Partial
        for code in self._codes:
            cu = code.upper()
            if (len(normalized_code) >= 3 and (normalized_code in cu or cu in normalized_code)):
                try:
                    return Event.objects.get(event_code=code), 0.60
                except Event.DoesNotExist:
                    pass

        return None, 0.0
