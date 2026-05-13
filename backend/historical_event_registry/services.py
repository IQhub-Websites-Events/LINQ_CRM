"""
historical_event_registry/services.py
"""
import logging
from typing import List, Dict, Any

from .models import HistoricalEventReference
from .matchers import EventCodeMatcher
from .utils import normalize_event_code

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
CONFIDENCE_THRESHOLD = 0.60


class HistoricalImportServiceBase:
    YEAR: int = 0
    SOURCE_PDF: str = ""

    def __init__(self, pdf_path=None, dry_run=False):
        self.pdf_path = pdf_path
        self.dry_run = dry_run
        self.errors: List[Dict[str, Any]] = []
        self.successes: List[Dict[str, Any]] = []

    def _make_importer(self):
        raise NotImplementedError

    def run(self) -> Dict[str, Any]:
        logger.info("Starting %d historical event import (dry_run=%s).", self.YEAR, self.dry_run)
        importer = self._make_importer()
        raw_rows = importer.extract()
        logger.info("Extracted %d rows from source.", len(raw_rows))

        matcher = EventCodeMatcher()
        results = self._process_rows(raw_rows, matcher)

        unverified = [r for r in results if r["verification_status"] == "pending"]
        attempt = 0
        while unverified and attempt < MAX_RETRIES:
            attempt += 1
            matcher = EventCodeMatcher()
            for rec in unverified:
                event, conf = matcher.match(rec["normalized_code"])
                if conf >= CONFIDENCE_THRESHOLD:
                    rec["matched_event"] = event
                    rec["confidence"] = conf
                    rec["verification_status"] = "verified"
                else:
                    rec["verification_status"] = "unmatched"
            unverified = [r for r in results if r["verification_status"] == "pending"]

        if not self.dry_run:
            self._persist(results)

        self._build_reports(results)
        summary = {
            "total":      len(results),
            "verified":   sum(1 for r in results if r["verification_status"] == "verified"),
            "unmatched":  sum(1 for r in results if r["verification_status"] == "unmatched"),
            "failed":     sum(1 for r in results if r["verification_status"] == "failed"),
            "duplicates": sum(1 for r in results if r.get("is_duplicate")),
            "dry_run":    self.dry_run,
            "errors":     self.errors,
            "successes":  self.successes,
        }
        logger.info("Import complete -- verified=%d, unmatched=%d, failed=%d",
                    summary["verified"], summary["unmatched"], summary["failed"])
        return summary

    def _process_rows(self, raw_rows, matcher):
        results = []
        seen = set()
        for row in raw_rows:
            norm_code  = normalize_event_code(row.get("code", ""))
            month      = row.get("month", "")
            location   = row.get("location", "")
            page       = row.get("page", 1)
            confidence = row.get("confidence", 0.70)

            if not norm_code:
                results.append(self._err_record(row, "Empty event code after normalization", page))
                continue

            dedup_key = (norm_code, self.YEAR, month)
            if dedup_key in seen:
                results.append({
                    **self._base_record(row, norm_code, month, location, page, confidence),
                    "verification_status": "failed",
                    "is_duplicate": True,
                    "error_reason": "Duplicate row -- same code+year+month already processed.",
                })
                continue
            seen.add(dedup_key)

            event, match_conf = matcher.match(norm_code)
            final_conf = min(confidence, 1.0) * match_conf if match_conf > 0 else 0.0
            if event:
                final_conf = max(match_conf, confidence * match_conf)

            status = "verified" if (event and final_conf >= CONFIDENCE_THRESHOLD) else (
                "unmatched" if not event else "pending"
            )

            results.append({
                **self._base_record(row, norm_code, month, location, page, confidence),
                "matched_event": event,
                "confidence": final_conf,
                "verification_status": status,
                "is_duplicate": False,
                "error_reason": "" if status != "unmatched" else f"No CRM event matched code '{norm_code}'.",
            })
        return results

    def _persist(self, results):
        for rec in results:
            if rec.get("is_duplicate"):
                continue
            if rec["verification_status"] == "failed" and not rec.get("matched_event"):
                continue
            try:
                obj, created = HistoricalEventReference.objects.get_or_create(
                    normalized_event_code=rec["normalized_code"],
                    event_year=rec["event_year"],
                    event_month=rec["event_month"],
                    defaults={
                        "event":               rec.get("matched_event"),
                        "original_event_code": rec["original_code"],
                        "event_location":      rec["location"],
                        "source_pdf":          rec["source_pdf"],
                        "source_page":         rec["source_page"],
                        "raw_row_data":        rec["raw_row_data"],
                        "verification_status": rec["verification_status"],
                        "matched_confidence":  rec["confidence"],
                    },
                )
                if not created:
                    obj.event = rec.get("matched_event")
                    obj.verification_status = rec["verification_status"]
                    obj.matched_confidence = rec["confidence"]
                    obj.event_location = rec["location"] or obj.event_location
                    obj.save(update_fields=[
                        "event", "verification_status", "matched_confidence",
                        "event_location", "updated_at",
                    ])
            except Exception as exc:
                logger.error("Persist error for %s: %s", rec["normalized_code"], exc)
                rec["verification_status"] = "failed"
                rec["error_reason"] = str(exc)

    def _build_reports(self, results):
        for rec in results:
            if rec.get("verification_status") == "verified":
                self.successes.append(rec)
            else:
                self.errors.append(rec)

    def _base_record(self, row, norm_code, month, location, page, confidence):
        return {
            "original_code":   row.get("code", ""),
            "normalized_code": norm_code,
            "event_year":      self.YEAR,
            "event_month":     month,
            "location":        location,
            "source_pdf":      self.SOURCE_PDF,
            "source_page":     page,
            "raw_row_data":    row,
            "confidence":      confidence,
        }

    def _err_record(self, row, reason, page):
        return {
            "original_code":       row.get("code", ""),
            "normalized_code":     "",
            "event_year":          self.YEAR,
            "event_month":         row.get("month", ""),
            "location":            row.get("location", ""),
            "source_pdf":          self.SOURCE_PDF,
            "source_page":         page,
            "raw_row_data":        row,
            "confidence":          0.0,
            "matched_event":       None,
            "verification_status": "failed",
            "is_duplicate":        False,
            "error_reason":        reason,
        }


class Historical2023ImportService(HistoricalImportServiceBase):
    YEAR = 2023
    SOURCE_PDF = "2023.pdf"

    def _make_importer(self):
        from .parsers import Historical2023PDFImporter
        return Historical2023PDFImporter(pdf_path=self.pdf_path)


class Historical2024ImportService(HistoricalImportServiceBase):
    YEAR = 2024
    SOURCE_PDF = "2024.pdf"

    def _make_importer(self):
        from .parsers import Historical2024PDFImporter
        return Historical2024PDFImporter(pdf_path=self.pdf_path)


class Historical2025ImportService(HistoricalImportServiceBase):
    YEAR = 2025
    SOURCE_PDF = "2025.pdf"

    def _make_importer(self):
        from .parsers import Historical2025PDFImporter
        return Historical2025PDFImporter(pdf_path=self.pdf_path)
