import { useState, useEffect } from 'react';
import { teamsApi, eventsApi, usersApi } from '../../api';
import { useToast } from '../../contexts/ToastContext';

export function UserModal({ user, isOpen, onClose, onSave, defaultTeamId }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  const [events, setEvents] = useState([]);
  const [formData, setFormData] = useState({
    username: '', email: '',
    first_name: '', last_name: '',
    password: '', confirm_password: '',
    role: 'sales', status: 'active',
    team_id: defaultTeamId || '', assigned_event_ids: [],
    mapped_lead_id: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    fetchOptions();
    if (user) {
      setFormData({
        username: user.username || '', email: user.email || '',
        first_name: user.first_name || '', last_name: user.last_name || '',
        password: '', confirm_password: '',
        role: user.role || 'sales', status: user.status || 'active',
        team_id: user.team_id || '',
        assigned_event_ids: user.assigned_events?.map((e) => e.id) || [],
        mapped_lead_id: user.mapped_lead_id || '',
      });
    } else {
      setFormData({
        username: '', email: '',
        first_name: '', last_name: '',
        password: '', confirm_password: '',
        role: 'sales', status: 'active',
        team_id: defaultTeamId || '', assigned_event_ids: [],
        mapped_lead_id: '',
      });
    }
  }, [isOpen, user, defaultTeamId]);

  const getMappedTeamIdForRole = (role, teamsList) => {
    if (!role || !teamsList || teamsList.length === 0) return '';
    let matchKeyword = '';
    let excludeKeyword = '';

    if (role === 'sales') {
      matchKeyword = 'sales';
      excludeKeyword = 'speaker';
    } else if (role === 'speaker_sales') {
      matchKeyword = 'speaker';
    } else if (role === 'telemarketing') {
      matchKeyword = 'tele';
    } else if (role === 'market_research') {
      matchKeyword = 'research';
    } else if (role === 'spex') {
      matchKeyword = 'spex';
    } else if (role === 'operations') {
      matchKeyword = 'operations';
    } else if (role === 'admin') {
      matchKeyword = 'admin';
    }

    if (!matchKeyword) return '';

    const matched = teamsList.find(t => {
      const name = (t.name || '').toLowerCase();
      if (excludeKeyword && name.includes(excludeKeyword.toLowerCase())) {
        return false;
      }
      return name.includes(matchKeyword.toLowerCase());
    });

    return matched ? matched.id : '';
  };

  const fetchOptions = async () => {
    try {
      const [teamsRes, eventsRes] = await Promise.all([
        teamsApi.list(),
        eventsApi.list({ limit: 1000 }),
      ]);
      const list = teamsRes.results || teamsRes;
      setTeams(list);
      setEvents(eventsRes.results || eventsRes);

      // Auto-assign team on initial load if creating a new user and team_id not set
      if (!user && !formData.team_id && formData.role) {
        const mapped = getMappedTeamIdForRole(formData.role, list);
        if (mapped) {
          setFormData(f => ({ ...f, team_id: mapped }));
        }
      }
    } catch {
      toast.error('Failed to load form options');
    }
  };

  const handleRoleChange = (newRole) => {
    const mappedTeamId = getMappedTeamIdForRole(newRole, teams);
    setFormData(f => ({
      ...f,
      role: newRole,
      team_id: mappedTeamId || ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password && formData.password !== formData.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const payload = { ...formData };
      delete payload.confirm_password;
      if (!payload.password) delete payload.password;
      if (!payload.team_id) payload.team_id = null;
      if (!payload.mapped_lead_id) payload.mapped_lead_id = null;

      if (user) {
        await usersApi.update(user.id, payload);
        toast.success('User updated');
      } else {
        await usersApi.create(payload);
        toast.success('User created');
      }
      onSave();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.username?.[0] || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const set = (field, value) => setFormData((f) => ({ ...f, [field]: value }));

  const selectedTeamObj = teams.find(t => t.id === parseInt(formData.team_id));
  const teamLeads = selectedTeamObj?.team_leads || [];
  const showMappedLeadField = teamLeads.length > 1;

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,12,8,0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 1100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: 700,
        maxHeight: 'calc(100vh - 48px)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(20,20,15,0.18)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '22px 32px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 24, fontWeight: 400, color: 'var(--text)' }}>
            {user ? 'Edit user' : 'New user'}
          </span>
          <button
            onClick={onClose} disabled={loading}
            style={{
              width: 32, height: 32, borderRadius: 7,
              background: 'var(--surface-alt)', border: '1px solid var(--border)',
              color: 'var(--text-dim)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}
          >×</button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>

            {/* Section 1 — Account */}
            <FormSection title="Account" desc="Login credentials and personal identity.">
              <Field label="First name *" span={3}>
                <MInput value={formData.first_name} onChange={(v) => set('first_name', v)} required />
              </Field>
              <Field label="Last name *" span={3}>
                <MInput value={formData.last_name} onChange={(v) => set('last_name', v)} required />
              </Field>
              <Field label="Username *" span={3}>
                <MInput mono value={formData.username} onChange={(v) => set('username', v)} placeholder="j.doe" required />
              </Field>
              <Field label="Email *" span={3}>
                <MInput type="email" value={formData.email} onChange={(v) => set('email', v)} placeholder="john@linq.com" required />
              </Field>
              <Field label={user ? 'New password (optional)' : 'Password *'} span={3}>
                <MInput type="password" value={formData.password} onChange={(v) => set('password', v)} placeholder="••••••••" required={!user} />
              </Field>
              <Field label="Confirm password" span={3}>
                <MInput type="password" value={formData.confirm_password} onChange={(v) => set('confirm_password', v)} placeholder="••••••••" required={!user && !!formData.password} />
              </Field>
            </FormSection>

                        <FormSection title="Organisation" desc="Role, team, and event access." last>
              <Field key="role-field" label="Role" span={2}>
                <MSelect value={formData.role} onChange={handleRoleChange} options={[
                  { value: 'admin', label: 'Administrator' },
                  { value: 'sales', label: 'Sales Executive' },
                  { value: 'speaker_sales', label: 'Speaker Sales' },
                  { value: 'telemarketing', label: 'Telemarketing' },
                  { value: 'market_research', label: 'Market Research' },
                  { value: 'spex', label: 'SpEx' },
                  { value: 'operations', label: 'Operations' },
                ]} />
              </Field>
              <Field key="team-field" label="Team" span={2}>
                <MSelect value={formData.team_id} onChange={(v) => set('team_id', v)} disabled={true} options={[
                  { value: '', label: 'Unassigned' },
                  ...teams.map((t) => ({ value: t.id, label: t.name })),
                ]} />
              </Field>
              <Field key="status-field" label="Status" span={2}>
                <MSelect value={formData.status} onChange={(v) => set('status', v)}
                  options={['active', 'inactive', 'suspended']} />
              </Field>
              {showMappedLeadField && (
                <Field key="mapped-lead-field" label="Mapped Team Lead" span={2}>
                  <MSelect value={formData.mapped_lead_id} onChange={(v) => set('mapped_lead_id', v)} options={[
                    { value: '', label: 'Unassigned' },
                    ...teamLeads.map((l) => ({ value: l.id, label: l.name })),
                  ]} />
                </Field>
              )}

              <Field key="assigned-events-field" label="Assigned Events" span={6}>
                <div style={{
                  maxHeight: 160, overflowY: 'auto',
                  border: '1px solid var(--border)', borderRadius: 8,
                  padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  {events.length === 0
                    ? <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>No events available</span>
                    : events.map((event) => (
                      <label key={event.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formData.assigned_event_ids.includes(event.id)}
                          onChange={(e) => {
                            const ids = e.target.checked
                              ? [...formData.assigned_event_ids, event.id]
                              : formData.assigned_event_ids.filter((id) => id !== event.id);
                            set('assigned_event_ids', ids);
                          }}
                          style={{ accentColor: 'var(--accent)', width: 13, height: 13, flexShrink: 0 }}
                        />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>{event.event_code}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>— {event.name}</span>
                      </label>
                    ))
                  }
                </div>
              </Field>
            </FormSection>
          </div>

          {/* Footer */}
          <div style={{
            padding: '14px 32px',
            background: 'var(--surface-alt)', borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
            flexShrink: 0,
          }}>
            <button type="button" onClick={onClose} disabled={loading} style={ghostBtn}>Cancel</button>
            <button type="submit" disabled={loading} style={primaryBtn}>
              {loading ? (user ? 'Updating…' : 'Creating…') : (user ? 'Save changes' : 'Create user')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


/* ─── Layout helpers ─── */

function FormSection({ title, desc, children, last }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '180px 1fr', gap: 28,
      paddingBottom: 24, marginBottom: last ? 0 : 24,
      borderBottom: last ? 'none' : '1px solid var(--border)',
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>{desc}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, alignContent: 'start' }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, span = 6, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: `span ${span}` }}>
      <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 500, letterSpacing: '0.02em' }}>{label}</span>
      {children}
    </label>
  );
}

function MInput({ value, onChange, type = 'text', mono, readOnly, placeholder, required }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type} value={value ?? ''} readOnly={readOnly}
      placeholder={placeholder} required={required}
      onChange={(e) => onChange?.(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        height: 36, padding: '0 12px',
        border: `1px solid ${focused ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 8, background: readOnly ? 'var(--surface-alt)' : 'var(--surface)',
        color: 'var(--text)', fontSize: 13,
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        outline: 'none', width: '100%',
        boxShadow: focused ? '0 0 0 3px var(--accent-soft)' : 'none',
        transition: 'border-color .15s, box-shadow .15s',
      }}
    />
  );
}

function MSelect({ value, onChange, options, disabled }) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      value={value ?? ''} onChange={(e) => onChange?.(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      disabled={disabled}
      style={{
        height: 36, padding: '0 28px 0 12px',
        border: `1px solid ${focused ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 8,
        background: disabled ? 'var(--surface-alt)' : 'var(--surface)',
        color: disabled ? 'var(--text-faint)' : 'var(--text)',
        fontSize: 13, fontFamily: 'var(--font-sans)',
        outline: 'none', width: '100%', appearance: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: focused ? '0 0 0 3px var(--accent-soft)' : 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%235a5853' stroke-width='1.3' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
        backgroundSize: "10px 6px",
        transition: 'border-color .15s, box-shadow .15s',
      }}
    >
      {options.map((o) => {
        const val = typeof o === 'string' ? o : o.value;
        const lbl = typeof o === 'string' ? o : o.label;
        return <option key={val} value={val}>{lbl || '(none)'}</option>;
      })}
    </select>
  );
}

const ghostBtn = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 12, fontWeight: 500,
  padding: '7px 14px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
};

const primaryBtn = {
  background: 'var(--accent)', border: 'none', color: '#fff',
  fontSize: 12, fontWeight: 500, padding: '7px 14px', borderRadius: 7,
  cursor: 'pointer', fontFamily: 'inherit',
};
