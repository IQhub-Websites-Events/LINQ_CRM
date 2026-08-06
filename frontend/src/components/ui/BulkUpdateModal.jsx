import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { useToast } from "../../contexts/ToastContext";

/**
 * Mass-update dialog: pick one field, set one value, apply to the selected rows.
 *
 * Field list comes entirely from `schema` (the server's bulk_update_schema
 * response) — nothing about editable fields is hardcoded here.
 *
 * Contract with the caller:
 *   onPreview(field, value)            -> resolves to the plan object
 *   onCommit(field, value, planHash)   -> resolves to the result object,
 *                                         or throws (409 handled here)
 * The caller should NOT raise its own toast; this component owns success and
 * error messaging so a 409 retry does not double-notify.
 */
export function BulkUpdateModal({
  open,
  onClose,
  selectedIds = [],
  schema,
  rowLabel = "record",
  onPreview,
  onCommit,
}) {
  const toast = useToast();

  const [step, setStep]         = useState("pick");   // "pick" | "preview" | "result"
  const [field, setField]       = useState("");
  const [value, setValue]       = useState("");
  const [plan, setPlan]         = useState(null);
  const [result, setResult]     = useState(null);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");
  const [staleNotice, setStale] = useState("");
  const [clearing, setClearing] = useState(false);   // explicit-null mode

  // Memoised so the identity is stable — it feeds the grouping useMemo below.
  const fields = useMemo(() => schema?.fields || {}, [schema]);
  const config = field ? fields[field] : null;

  const { rowFields, parentFields } = useMemo(() => {
    const row = [], parent = [];
    Object.entries(fields).forEach(([key, cfg]) => {
      (cfg.group === "parent" ? parent : row).push([key, cfg]);
    });
    return { rowFields: row, parentFields: parent };
  }, [fields]);

  const bothGroups = rowFields.length > 0 && parentFields.length > 0;

  const reset = useCallback(() => {
    setStep("pick"); setField(""); setValue(""); setClearing(false);
    setPlan(null); setResult(null); setError(""); setStale("");
  }, []);

  useEffect(() => { if (open) reset(); }, [open, reset]);

  // Re-price the plan whenever field or value changes. Previewing with no value
  // is valid — the distribution of CURRENT values does not depend on the target,
  // so "what am I about to overwrite?" renders the moment a field is picked.
  // no_op and side_effects only arrive once a value is chosen.
  useEffect(() => {
    if (!open || !field || !config) return;
    // Never call the endpoint with an empty selection. A caller whose handler
    // is not memoised re-fires this effect on every parent render, and after a
    // commit clears the selection that would post ids:[] and get back
    // {"detail":"ids list required"}. Guard here so no surface can regress.
    if (!selectedIds || selectedIds.length === 0) { setPlan(null); return; }
    // undefined => omit the key entirely (preview with no target).
    // null      => explicit clear, only offered on nullable fields.
    const outgoing = clearing ? null : (value !== "" && value != null ? value : undefined);
    let cancelled = false;
    setBusy(true); setError("");
    Promise.resolve(onPreview(field, outgoing))
      .then((p) => { if (!cancelled) setPlan(p); })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.detail || "Could not preview this change.");
      })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
    // selectedIds.LENGTH, not the array: callers build it with [...set], a new
    // reference every render, which would re-fire this effect continuously.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, field, value, clearing, config, onPreview, selectedIds.length]);

  // No auto-pick: every field type starts empty and the user chooses.
  const pickField = (key) => {
    setField(key);
    setPlan(null);
    setError("");
    setValue("");
    setClearing(false);
  };

  const valueChosen    = clearing || (value !== "" && value != null);
  const hasSideEffects = (plan?.side_effects?.length || 0) > 0;
  const hasCollateral  = (plan?.collateral?.count || 0) > 0;
  const isParent       = config?.group === "parent";

  // Fast path: a plain row-scoped change with nothing surprising about it stays
  // two clicks. Review is mandatory only when it is not plain. A value-less
  // preview never qualifies — there is nothing to apply yet.
  const fastPath =
    !!plan &&
    valueChosen &&
    !isParent &&
    plan.permitted === plan.requested &&
    !hasSideEffects &&
    !hasCollateral;

  const doCommit = async () => {
    setBusy(true); setError(""); setStale("");
    try {
      const res = await onCommit(field, clearing ? null : value, plan.plan_hash);
      setResult(res);
      setStep("result");
      toast.success(`Updated ${res.updated} ${rowLabel}${res.updated !== 1 ? "s" : ""}.`);
    } catch (err) {
      if (err?.response?.status === 409) {
        setPlan(err.response.data);
        setStep("preview");
        setStale("The underlying data changed since this plan was generated. Review the refreshed numbers and confirm again.");
      } else {
        setError(err?.response?.data?.detail || "Bulk update failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  // ── Field picker ──────────────────────────────────────────────────────────
  const renderFieldList = (entries) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {entries.map(([key, cfg]) => (
        <label key={key} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
          borderRadius: 6, cursor: "pointer", fontSize: 13, color: "var(--text)",
          background: field === key ? "var(--surface-alt)" : "transparent",
        }}>
          <input
            type="radio"
            name="bulk-field"
            checked={field === key}
            onChange={() => pickField(key)}
            style={{ accentColor: "var(--accent)" }}
          />
          {cfg.label || key}
        </label>
      ))}
    </div>
  );

  const distributionLine = plan && Object.keys(plan.distribution || {}).length > 0 && (
    <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-dim)" }}>
      Currently:{" "}
      {Object.entries(plan.distribution)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${n} ${k === "null" || k === null ? "(none)" : k}`)
        .join(" · ")}
    </div>
  );

  const pickBody = (
    <div>
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
        {selectedIds.length.toLocaleString()} {rowLabel}{selectedIds.length !== 1 ? "s" : ""} selected
      </div>

      {!bothGroups ? (
        renderFieldList(rowFields.length ? rowFields : parentFields)
      ) : (
        <>
          <div style={sectionLabel}>Per-{rowLabel} fields</div>
          <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginBottom: 6 }}>
            Affects exactly the {selectedIds.length.toLocaleString()} rows you selected.
          </div>
          {renderFieldList(rowFields)}

          <div style={{ ...sectionLabel, marginTop: 16, color: "var(--danger)" }}>
            Shared fields
          </div>
          <div style={{ fontSize: 11.5, color: "var(--danger)", marginBottom: 6 }}>
            {hasCollateral
              ? `Writes to shared parent records — also affects ${plan.collateral.count.toLocaleString()} row(s) you did not select.`
              : "Writes to shared parent records — may affect rows you did not select."}
          </div>
          {renderFieldList(parentFields)}
        </>
      )}

      {config && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          <div style={sectionLabel}>New value</div>
          {config.type === "boolean" ? (
            /* Sent as the strings "true"/"false"; the backend coerces to a real
               bool so a BooleanField never receives a truthy "false". */
            <select value={value} onChange={(e) => setValue(e.target.value)} style={inputStyle} disabled={clearing}>
              <option value="">Choose a value…</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          ) : config.type === "choice" ? (
            <select value={value} onChange={(e) => setValue(e.target.value)} style={inputStyle} disabled={clearing}>
              <option value="">Choose a value…</option>
              {(config.choices || []).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : config.type === "date" ? (
            <input type="date" value={value} onChange={(e) => setValue(e.target.value)} style={inputStyle} disabled={clearing} />
          ) : (
            <input type="text" value={value} onChange={(e) => setValue(e.target.value)} style={inputStyle} disabled={clearing} />
          )}

          {/* Only nullable fields can be emptied; the backend rejects a null
              on anything else, so don't offer it. */}
          {config.nullable && (
            <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 9, fontSize: 12, color: "var(--text-dim)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={clearing}
                onChange={(e) => { setClearing(e.target.checked); setValue(""); }}
                style={{ accentColor: "var(--accent)" }}
              />
              Clear this field instead (revert to inherited)
            </label>
          )}
          {distributionLine}
          {fastPath && (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-dim)" }}>
              {plan.no_op > 0
                ? `${plan.permitted - plan.no_op} will change · ${plan.no_op} already ${value}`
                : `All ${plan.permitted} will change.`}
            </div>
          )}
        </div>
      )}

      {error && <div style={errorStyle}>{error}</div>}
    </div>
  );

  // ── Preview ───────────────────────────────────────────────────────────────
  const previewBody = plan && (
    <div style={{ fontSize: 13, color: "var(--text)" }}>
      {staleNotice && <div style={{ ...errorStyle, background: "var(--surface-alt)", color: "var(--text)" }}>{staleNotice}</div>}

      <div style={{ marginBottom: 12 }}>
        Setting <strong>{config?.label || field}</strong> to <strong>{String(value)}</strong>
      </div>

      {/* no_op is absent from a value-less preview; preview state is only
          reachable with a value, but guard so a 409 refresh can never NaN. */}
      <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, fontSize: 12.5 }}>
        <li>{plan.requested.toLocaleString()} selected</li>
        <li>{(plan.permitted - (plan.no_op ?? 0)).toLocaleString()} will change</li>
        <li>{(plan.no_op ?? 0).toLocaleString()} already {String(value)}</li>
        {plan.requested > plan.permitted && (
          <li style={{ color: "var(--danger)" }}>
            {(plan.requested - plan.permitted).toLocaleString()} not editable by you
          </li>
        )}
      </ul>

      {hasSideEffects && (
        <div style={warnBox}>
          {plan.side_effects.map((s, i) => <div key={i}>⚠ {s}</div>)}
        </div>
      )}

      {hasCollateral && (
        <div style={warnBox}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            ⚠ {plan.collateral.count.toLocaleString()} {rowLabel}
            {plan.collateral.count !== 1 ? "s" : ""} you did not select will also change
            {plan.collateral.hidden_count > 0 && (
              <> — {plan.collateral.sample.length} shown,{" "}
              {plan.collateral.hidden_count.toLocaleString()} on records outside your access</>
            )}
          </div>
          {plan.collateral.sample.map((c) => (
            <div key={c.id} style={{ fontSize: 11.5 }}>
              {c.label}{c.parent ? ` — ${c.parent}` : ""}
            </div>
          ))}
          {plan.collateral.overflow > 0 && (
            <div style={{ fontSize: 11.5, marginTop: 4, color: "var(--text-dim)" }}>
              …and {plan.collateral.overflow.toLocaleString()} more you can see
            </div>
          )}
        </div>
      )}

      {error && <div style={errorStyle}>{error}</div>}
    </div>
  );

  // ── Result ────────────────────────────────────────────────────────────────
  const resultBody = result && (
    <div style={{ fontSize: 13 }}>
      Updated <strong>{result.updated.toLocaleString()}</strong> {rowLabel}
      {result.updated !== 1 ? "s" : ""}.
      {result.no_op > 0 && (
        <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-dim)" }}>
          {result.no_op.toLocaleString()} already held that value and were left alone.
        </div>
      )}
    </div>
  );

  // ── Footer ────────────────────────────────────────────────────────────────
  let footer;
  if (step === "pick") {
    footer = (
      <>
        <button style={ghostBtn} onClick={onClose}>Cancel</button>
        <button
          style={{ ...primaryBtn, opacity: !plan || !valueChosen || busy ? 0.55 : 1, cursor: !plan || !valueChosen || busy ? "not-allowed" : "pointer" }}
          disabled={!plan || !valueChosen || busy}
          onClick={() => (fastPath ? doCommit() : setStep("preview"))}
        >
          {busy ? "Working…"
            : fastPath ? `Apply to ${(plan.permitted - plan.no_op).toLocaleString()} ${rowLabel}${(plan.permitted - plan.no_op) !== 1 ? "s" : ""}`
            : "Review changes →"}
        </button>
      </>
    );
  } else if (step === "preview") {
    footer = (
      <>
        <button style={ghostBtn} onClick={() => setStep("pick")}>← Back</button>
        <button
          style={{ ...primaryBtn, opacity: busy ? 0.55 : 1, cursor: busy ? "not-allowed" : "pointer" }}
          disabled={busy}
          onClick={doCommit}
        >
          {busy ? "Applying…" : "Apply"}
        </button>
      </>
    );
  } else {
    footer = <button style={primaryBtn} onClick={onClose}>Done</button>;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === "result" ? "Mass update complete" : `Update ${selectedIds.length.toLocaleString()} ${rowLabel}${selectedIds.length !== 1 ? "s" : ""}`}
      footer={footer}
      width={520}
    >
      {step === "pick" && pickBody}
      {step === "preview" && previewBody}
      {step === "result" && resultBody}
    </Modal>
  );
}

const sectionLabel = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  marginBottom: 6,
};

const inputStyle = {
  width: "100%",
  height: 32,
  padding: "0 10px",
  fontSize: 13,
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "var(--surface-alt)",
  color: "var(--text)",
  fontFamily: "inherit",
  outline: "none",
};

const warnBox = {
  marginTop: 12,
  padding: "9px 11px",
  borderRadius: 6,
  border: "1px solid var(--danger)",
  background: "var(--danger-soft)",
  color: "var(--danger)",
  fontSize: 12,
  lineHeight: 1.6,
};

const errorStyle = {
  marginTop: 12,
  padding: "8px 10px",
  borderRadius: 6,
  background: "var(--danger-soft)",
  color: "var(--danger)",
  fontSize: 12,
};

const ghostBtn = {
  padding: "6px 14px",
  fontSize: 12.5,
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text-dim)",
  cursor: "pointer",
  fontFamily: "inherit",
};

const primaryBtn = {
  padding: "6px 14px",
  fontSize: 12.5,
  fontWeight: 600,
  borderRadius: 6,
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  cursor: "pointer",
  fontFamily: "inherit",
};

export default BulkUpdateModal;
