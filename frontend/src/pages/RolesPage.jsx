import { useState, useEffect, useCallback } from "react";
import { usersApi, customRolesApi } from "../api";
import { useToast } from "../contexts/ToastContext";

const CRM_MODULES = [
  { key: "bookings",       label: "Bookings"       },
  { key: "ticket_central", label: "Ticket Central" },
  { key: "events",         label: "Events"         },
  { key: "reports",        label: "Reports"        },
  { key: "users",          label: "Users"          },
  { key: "teams",          label: "Teams"          },
  { key: "performance",    label: "Performance"    },
  { key: "webhooks",       label: "Webhooks"       },
  { key: "roles",          label: "Roles"          },
];

export function RolesPage() {
  const toast = useToast();
  const [roles,        setRoles]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [syncing,      setSyncing]      = useState(false);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editRole,     setEditRole]     = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [roleUsers,    setRoleUsers]    = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await customRolesApi.list();
      const list = data.results || data;
      if (!Array.isArray(list)) throw new Error(`Unexpected response format: ${typeof list}`);
      setRoles(list);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || "Unknown error";
      console.error("[RolesPage] Failed to load roles:", msg, err);
      if (!silent) toast.error(`Failed to load roles: ${msg}`);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [toast]);

  // useEffect with cleanup prevents StrictMode double-invocation from showing double toasts
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const data = await customRolesApi.list();
        const list = data.results || data;
        if (active) setRoles(Array.isArray(list) ? list : []);
      } catch (err) {
        const msg = err.response?.data?.detail || err.message || "Unknown error";
        console.error("[RolesPage] Failed to load roles:", msg, err);
        if (active) toast.error(`Failed to load roles: ${msg}`);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSync = async () => {
    if (!window.confirm("Re-derive all users' roles from their current team names?\n\nThis will overwrite roles for users who are in a team.")) return;
    setSyncing(true);
    try {
      const result = await usersApi.syncRoles();
      toast.success(result.detail || `Synced ${result.updated} user(s).`);
      fetchData(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectRole = async (role) => {
    setSelectedRole(role);
    setUsersLoading(true);
    try {
      const res = await usersApi.list({ custom_role: role.id, page_size: 200 });
      setRoleUsers(res.results || res);
    } catch {
      toast.error("Failed to load members.");
    } finally {
      setUsersLoading(false);
    }
  };

  const handleDeleteRole = async (role) => {
    if (!window.confirm(`Delete role "${role.display_label}"?`)) return;
    try {
      await customRolesApi.delete(role.id);
      toast.success("Role deleted.");
      if (selectedRole?.id === role.id) setSelectedRole(null);
      fetchData(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete role.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg)" }}>

      {/* Header */}
      <div style={{ padding: "24px 28px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 4 }}>CRM › Roles</div>
          <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 500, fontSize: 38, lineHeight: 1, letterSpacing: "-0.01em", color: "var(--text)" }}>Roles.</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-dim)", maxWidth: 520 }}>
            Configure what each role can access. Click a role to view its members.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, marginTop: 6 }}>
          <button onClick={handleSync} disabled={syncing} style={{ padding: "7px 14px", fontSize: 12, borderRadius: 7, fontWeight: 500, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-dim)", cursor: syncing ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: syncing ? 0.7 : 1 }}>
            {syncing ? "Syncing…" : "↺ Sync from Teams"}
          </button>
          <button onClick={() => { setEditRole(null); setModalOpen(true); }} style={{ padding: "7px 14px", fontSize: 12, borderRadius: 7, fontWeight: 500, background: "var(--accent)", border: "none", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
            + Create Role
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", gap: 0, minHeight: 0, padding: "0 28px 28px" }}>

        {/* Roles list */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <div style={{ color: "var(--text-faint)", fontSize: 13 }}>Loading…</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
              {roles.map(role => {
                const active = selectedRole?.id === role.id;
                return (
                  <div key={role.id} onClick={() => handleSelectRole(role)}
                    style={{ background: active ? "var(--accent-soft)" : "var(--surface)", border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`, borderRadius: 12, padding: "16px", cursor: "pointer", transition: "all .15s" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: role.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{role.display_label}</span>
                        {role.is_system_role && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text-faint)" }}>SYSTEM</span>}
                      </div>
                      <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setEditRole(role); setModalOpen(true); }} style={iconBtn} title="Edit">✎</button>
                        {!role.is_system_role && (
                          <button onClick={() => handleDeleteRole(role)} style={{ ...iconBtn, color: "var(--danger)" }} title="Delete">✕</button>
                        )}
                      </div>
                    </div>

                    {role.is_all_access ? (
                      <div style={{ fontSize: 11, color: "var(--success, #22c55e)", fontWeight: 500 }}>✓ Full access (Admin)</div>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {(role.permissions || []).filter(p => p.can_view).map(p => (
                          <span key={p.module} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text-dim)" }}>
                            {CRM_MODULES.find(m => m.key === p.module)?.label || p.module}
                          </span>
                        ))}
                        {(role.permissions || []).filter(p => p.can_view).length === 0 && (
                          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>No permissions set</span>
                        )}
                      </div>
                    )}

                    <div style={{ marginTop: 10, fontSize: 22, fontWeight: 600, color: "var(--text)", fontFamily: "var(--font-serif)" }}>{role.user_count}</div>
                    <div style={{ fontSize: 11, color: "var(--text-faint)" }}>member{role.user_count !== 1 ? "s" : ""}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Member panel */}
        {selectedRole && (
          <div style={{ width: 300, flexShrink: 0, marginLeft: 20, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{selectedRole.display_label} — Members</span>
              <button onClick={() => setSelectedRole(null)} style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", fontSize: 14 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {usersLoading ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>Loading…</div>
              ) : roleUsers.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>No members.</div>
              ) : (
                roleUsers.map(u => (
                  <div key={u.id} style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--accent)", flexShrink: 0 }}>
                      {(u.full_name || u.username || "?")[0].toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.full_name || u.username}</div>
                      <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{u.team_name || "Unassigned"}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <RoleFormModal
          role={editRole}
          onClose={() => { setModalOpen(false); setEditRole(null); }}
          onSaved={() => { setModalOpen(false); setEditRole(null); fetchData(true); }}
        />
      )}
    </div>
  );
}

// ── Role Form Modal ─────────────────────────────────────────────────────────

function buildDefaultPerms(role) {
  const base = {};
  CRM_MODULES.forEach(m => {
    const existing = (role?.permissions || []).find(p => p.module === m.key);
    base[m.key] = {
      view:   existing?.can_view   ?? false,
      create: existing?.can_create ?? false,
      update: existing?.can_update ?? false,
      delete: existing?.can_delete ?? false,
    };
  });
  return base;
}

function RoleFormModal({ role, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = !!role;

  const [form, setForm] = useState({
    name:          role?.name          || "",
    display_label: role?.display_label || "",
    color:         role?.color         || "#405189",
    description:   role?.description   || "",
    is_all_access: role?.is_all_access ?? false,
  });
  const [perms,  setPerms]  = useState(() => buildDefaultPerms(role));
  const [saving, setSaving] = useState(false);

  const setField  = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setPerm   = (mod, action, val) => {
    setPerms(prev => {
      const updated = { ...prev, [mod]: { ...prev[mod], [action]: val } };
      // If view turns off, clear all others
      if (action === "view" && !val) {
        updated[mod] = { view: false, create: false, update: false, delete: false };
      }
      // If any non-view turns on, ensure view is on
      if (action !== "view" && val) {
        updated[mod] = { ...updated[mod], view: true };
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.display_label.trim()) { toast.error("Display label is required."); return; }
    if (!isEdit && !form.name.trim()) { toast.error("Role name is required."); return; }
    setSaving(true);
    try {
      let saved;
      if (isEdit) {
        saved = await customRolesApi.update(role.id, { display_label: form.display_label, color: form.color, description: form.description });
      } else {
        saved = await customRolesApi.create({ name: form.name, display_label: form.display_label, color: form.color, description: form.description });
      }

      // Save permissions
      const permArray = CRM_MODULES.map(m => ({
        module:     m.key,
        can_view:   form.is_all_access ? true  : (perms[m.key]?.view   ?? false),
        can_create: form.is_all_access ? true  : (perms[m.key]?.create ?? false),
        can_update: form.is_all_access ? true  : (perms[m.key]?.update ?? false),
        can_delete: form.is_all_access ? true  : (perms[m.key]?.delete ?? false),
      }));
      await customRolesApi.setPermissions(saved.id || role?.id, permArray, form.is_all_access);

      toast.success(isEdit ? "Role updated." : "Role created.");
      onSaved();
    } catch (err) {
      const data = err.response?.data;
      toast.error(data?.name?.[0] || data?.display_label?.[0] || data?.detail || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const ACTIONS = ["view", "create", "update", "delete"];
  const ACTION_LABELS = { view: "View", create: "Create", update: "Edit", delete: "Delete" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 680, maxHeight: "90vh", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(15,23,42,0.2)" }}>

        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-alt)", flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{isEdit ? `Edit Role — ${role.display_label}` : "Create Role"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px" }}>

            {/* Basic fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              {!isEdit && (
                <FormField label="Role Name (identifier) *">
                  <input value={form.name} onChange={e => setField("name", e.target.value)} placeholder="e.g. senior_sales" style={inputStyle} />
                </FormField>
              )}
              <FormField label="Display Label *">
                <input value={form.display_label} onChange={e => setField("display_label", e.target.value)} placeholder="e.g. Senior Sales" style={inputStyle} />
              </FormField>
              <FormField label="Colour">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="color" value={form.color} onChange={e => setField("color", e.target.value)} style={{ width: 34, height: 34, border: "1px solid var(--border)", borderRadius: 7, cursor: "pointer", padding: 2 }} />
                  <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>{form.color}</span>
                </div>
              </FormField>
            </div>

            {/* Admin switch */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: form.is_all_access ? "rgba(13,122,79,0.06)" : "var(--surface-alt)", border: `1px solid ${form.is_all_access ? "var(--accent)" : "var(--border)"}`, borderRadius: 8, marginBottom: 16, cursor: "pointer" }}
              onClick={() => setField("is_all_access", !form.is_all_access)}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Admin — Grant Full Access</div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>Bypasses all module restrictions. Equivalent to system admin.</div>
              </div>
              <Toggle checked={form.is_all_access} onChange={v => setField("is_all_access", v)} />
            </div>

            {/* Permission grid */}
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
              {/* Header row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 70px 70px", background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
                <div style={{ padding: "8px 14px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-dim)" }}>Module</div>
                {ACTIONS.map(a => (
                  <div key={a} style={{ padding: "8px 0", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-dim)", textAlign: "center" }}>{ACTION_LABELS[a]}</div>
                ))}
              </div>
              {/* Module rows */}
              {CRM_MODULES.map((mod, i) => {
                const p = perms[mod.key] || {};
                const disabled = form.is_all_access;
                return (
                  <div key={mod.key} style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 70px 70px", borderBottom: i < CRM_MODULES.length - 1 ? "1px solid var(--border)" : "none", background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)" }}>
                    <div style={{ padding: "10px 14px", fontSize: 13, color: "var(--text)", display: "flex", alignItems: "center" }}>{mod.label}</div>
                    {ACTIONS.map(action => {
                      const checked = disabled ? true : (p[action] ?? false);
                      const isDisabled = disabled || (action !== "view" && !p.view);
                      return (
                        <div key={action} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isDisabled}
                            onChange={e => !disabled && setPerm(mod.key, action, e.target.checked)}
                            style={{ width: 15, height: 15, accentColor: "var(--accent)", cursor: isDisabled ? "not-allowed" : "pointer", opacity: isDisabled && !disabled ? 0.35 : 1 }}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11, color: "var(--text-dim)" }}>
              ℹ️ <strong>View</strong> is required for any access. Turning View off clears all other permissions for that module.
            </div>
          </div>

          <div style={{ padding: "12px 24px", borderTop: "1px solid var(--border)", background: "var(--surface-alt)", display: "flex", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>
            <button type="button" onClick={onClose} style={ghostBtn}>Cancel</button>
            <button type="submit" disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : (isEdit ? "Save Changes" : "Create Role")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <div onClick={e => { e.stopPropagation(); onChange(!checked); }}
      style={{ width: 40, height: 22, borderRadius: 11, background: checked ? "var(--accent)" : "var(--border)", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background .2s" }}>
      <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: checked ? 21 : 3, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-dim)" }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle = { height: 34, padding: "0 10px", fontSize: 13, border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface)", color: "var(--text)", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };
const iconBtn = { width: 24, height: 24, borderRadius: 5, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, padding: 0 };
const primaryBtn = { background: "var(--accent)", border: "none", color: "#fff", padding: "7px 16px", borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };
const ghostBtn = { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-dim)", padding: "7px 16px", borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };
