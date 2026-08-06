/**
 * useFilterSpec — compound filter state for one module, persisted locally.
 *
 * Serialises to the exact wire shape backend/accounts/filter_spec.py validates:
 *   {"match":"all","criteria":[{field, op, value?|values?}]}
 * is_empty / is_not_empty carry NO value key at all; any_of / none_of / between
 * carry `values`; everything else carries `value`. Getting this wrong is a 400,
 * so the shape lives in one place — buildCriterion below — and nowhere else.
 *
 * ── HYDRATION RULE (important) ──────────────────────────────────────────────
 * When a stored spec exists, `hydrated` stays FALSE until the consumer has
 * fetched filter_schema and called sanitize(schema). A stored criterion whose
 * field or operator has since been removed would 400 every list request, which
 * presents to the user as a permanently broken table.
 *
 *   WIRING MUST NOT ISSUE A FILTERED LIST REQUEST BEFORE `hydrated` IS TRUE.
 *
 * With no stored spec there is nothing to validate, so `hydrated` is true from
 * the first render and the consumer can fetch immediately.
 *
 * Out of scope: cross-tab `storage` events. Two tabs on the same module keep
 * independent in-memory state and last-writer-wins on localStorage.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_PREFIX = "iqhub.filterSpec.";
const STORAGE_VERSION = 1;

/**
 * Conservative ceiling for the whole `filter_spec=<encoded>` query param.
 *
 * gunicorn's default limit_request_line is 4094 bytes for the ENTIRE request
 * line (method + URI + protocol). Past it gunicorn answers 414 before Django
 * sees the request — no JSON body, no application log, nothing to debug from.
 * 3300 leaves room for path, page, page_size and ordering.
 *
 * Raise to ~7000 once deployment sets limit_request_line=8190.
 */
export const MAX_SPEC_BYTES = 3300;

// Operators whose wire shape differs from the default single `value`.
const NO_VALUE_OPS = new Set(["is_empty", "is_not_empty"]);
const LIST_OPS = new Set(["any_of", "none_of", "between"]);

/** The single place that decides a criterion's wire shape. */
export function buildCriterion(field, op, payload) {
  if (NO_VALUE_OPS.has(op)) return { field, op };
  if (LIST_OPS.has(op)) {
    return { field, op, values: Array.isArray(payload) ? payload : [payload] };
  }
  return { field, op, value: payload };
}

/**
 * RAW JSON for the `filter_spec` param, or null when there is nothing to send.
 *
 * Deliberately NOT percent-encoded. This value is handed to axios as an ordinary
 * query param and the shared serializeParams (api/client.js) encodes it exactly
 * once via URLSearchParams. Pre-encoding here produced %257B — double-encoded —
 * and Django, which decodes once, saw the literal text "%7B%22match%22…" and
 * answered 400 "filter_spec is not valid JSON".
 *
 * A caller assembling a URL string by hand must encodeURIComponent() this.
 */
export function specToJson(criteria) {
  if (!criteria || criteria.length === 0) return null;
  return JSON.stringify({ match: "all", criteria });
}

function storageKey(moduleKey) {
  return `${STORAGE_PREFIX}${moduleKey}`;
}

function readStored(moduleKey) {
  try {
    const raw = window.localStorage.getItem(storageKey(moduleKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== STORAGE_VERSION) return null;
    return Array.isArray(parsed.criteria) ? parsed.criteria : null;
  } catch {
    return null;                     // private mode, quota, corrupt JSON
  }
}

function writeStored(moduleKey, criteria) {
  try {
    window.localStorage.setItem(
      storageKey(moduleKey),
      JSON.stringify({ version: STORAGE_VERSION, criteria }),
    );
  } catch {
    /* storage unavailable — in-memory state still works */
  }
}

/**
 * Drop criteria the schema no longer supports.
 * Returns {kept, dropped} where dropped carries a reason for reporting.
 */
export function sanitizeCriteria(criteria, schema) {
  const kept = [];
  const dropped = [];
  const fields = schema?.fields || {};

  for (const c of criteria) {
    const cfg = fields[c.field];
    if (!cfg) {
      dropped.push({ criterion: c, reason: `field '${c.field}' no longer exists` });
      continue;
    }
    if (!(cfg.operators || []).includes(c.op)) {
      dropped.push({ criterion: c, reason: `operator '${c.op}' not allowed on '${c.field}'` });
      continue;
    }
    const allowed = cfg.choices
      ? cfg.choices.map((ch) => (typeof ch === "object" ? ch.value : ch))
      : null;
    if (allowed && !NO_VALUE_OPS.has(c.op) && c.op !== "contains" && c.op !== "not_contains") {
      const vals = c.values ?? (c.value !== undefined ? [c.value] : []);
      const bad = vals.find((v) => !allowed.includes(v));
      if (bad !== undefined) {
        dropped.push({ criterion: c, reason: `value '${bad}' is not valid for '${c.field}'` });
        continue;
      }
    }
    kept.push(c);
  }
  return { kept, dropped };
}

/**
 * True only when there is a stored spec with something in it. An empty stored
 * array has nothing to sanitize, so it must not block the first list request.
 */
function hasStoredSpec(stored) {
  return Array.isArray(stored) && stored.length > 0;
}

export function useFilterSpec(moduleKey) {
  const storedRef = useRef(undefined);
  if (storedRef.current === undefined) storedRef.current = readStored(moduleKey);

  const [criteria, setCriteria] = useState(() => storedRef.current || []);
  // localStorage reads are synchronous, so this is decided on the FIRST render:
  // nothing stored (or an empty stored list) means nothing to validate, and the
  // consumer may fetch immediately with no unfiltered flash.
  const [hydrated, setHydrated] = useState(() => !hasStoredSpec(storedRef.current));
  // Schema unavailable: run unfiltered rather than blocking the table, but keep
  // the stored spec on disk so it returns when the schema fetch next succeeds.
  const [schemaFailed, setSchemaFailed] = useState(false);

  // Re-read if the consumer switches module key.
  useEffect(() => {
    const stored = readStored(moduleKey);
    storedRef.current = stored;
    setCriteria(stored || []);
    setHydrated(!hasStoredSpec(stored));
    setSchemaFailed(false);
  }, [moduleKey]);

  const persist = useCallback((next) => {
    setCriteria(next);
    writeStored(moduleKey, next);
  }, [moduleKey]);

  const addCriterion = useCallback((criterion) => {
    persist([...criteria, criterion]);
  }, [criteria, persist]);

  const updateCriterion = useCallback((index, criterion) => {
    persist(criteria.map((c, i) => (i === index ? criterion : c)));
  }, [criteria, persist]);

  const removeCriterion = useCallback((index) => {
    persist(criteria.filter((_, i) => i !== index));
  }, [criteria, persist]);

  const clearAll = useCallback(() => persist([]), [persist]);

  /** Replace wholesale — used by the builder modal's Apply. */
  const replaceAll = useCallback((next) => persist(next || []), [persist]);

  const sanitize = useCallback((schema) => {
    const { kept, dropped } = sanitizeCriteria(criteria, schema);
    if (dropped.length > 0) persist(kept);
    setHydrated(true);
    return { kept, dropped };
  }, [criteria, persist]);

  /**
   * Schema could not be fetched. Unblock the table unfiltered and keep the
   * builder shut, but deliberately DO NOT clear localStorage — the spec should
   * come back on the next reload if the schema fetch succeeds then.
   */
  const markSchemaFailed = useCallback(() => {
    setSchemaFailed(true);
    setHydrated(true);
  }, []);

  // Suppressed while the schema is unavailable: sending an unvalidated spec is
  // how a stale criterion 400s every request.
  const encodedParam = useMemo(
    () => (schemaFailed ? null : specToJson(criteria)),
    [criteria, schemaFailed],
  );
  // Budget must measure what actually travels — the percent-encoded form —
  // even though encodedParam itself is raw JSON.
  const byteLength = useMemo(
    () => (encodedParam
      ? `filter_spec=${encodeURIComponent(encodedParam)}`.length
      : 0),
    [encodedParam],
  );

  return {
    criteria,
    addCriterion,
    updateCriterion,
    removeCriterion,
    clearAll,
    replaceAll,
    encodedParam,
    byteLength,
    tooLarge: byteLength > MAX_SPEC_BYTES,
    hydrated,
    sanitize,
    schemaFailed,
    markSchemaFailed,
  };
}

export default useFilterSpec;
