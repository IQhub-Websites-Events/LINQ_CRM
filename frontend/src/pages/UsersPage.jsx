import { useState, useEffect } from 'react';
import { usersApi, teamsApi, customRolesApi } from '../api';
import { useToast } from '../contexts/ToastContext';
import { Avatar } from '../components/ui/Avatar';
import { UserModal } from '../components/users/UserModal';
import { UserDetailDrawer } from '../components/users/UserDetailDrawer';

export function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [customRoles, setCustomRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({ role: '', status: '', team: '' });

  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerUser, setDrawerUser] = useState(null);

  useEffect(() => { fetchData(); fetchTeams(); fetchRoles(); }, []);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await usersApi.list({ page_size: 1000 });
      setUsers(res.results || res);
    } catch {
      if (!silent) toast.error('Failed to fetch users');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await teamsApi.list();
      setTeams(res.results || res);
    } catch {}
  };

  const fetchRoles = async () => {
    try {
      const res = await customRolesApi.list();
      setCustomRoles(Array.isArray(res) ? res : (res.results || []));
    } catch {}
  };

  const handleToggleStatus = async (targetUser) => {
    const nextStatus = targetUser.status === 'active' ? 'inactive' : 'active';
    try {
      await usersApi.toggleStatus(targetUser.id, nextStatus);
      toast.success(`User ${nextStatus === 'active' ? 'activated' : 'deactivated'}`);
      setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, status: nextStatus } : u));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update status');
    }
  };

  const handleDelete = async (targetUser) => {
    if (!window.confirm(`Delete ${targetUser.username}?`)) return;
    try {
      await usersApi.delete(targetUser.id);
      toast.success('User deleted');
      setUsers(prev => prev.filter(u => u.id !== targetUser.id));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete user');
    }
  };

  const filteredUsers = users.filter((user) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      user.username.toLowerCase().includes(q) ||
      (user.full_name || '').toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q);
    // Filter by custom_role_id if a role is selected
    const matchRole = !filters.role || String(user.custom_role_id) === filters.role;
    const matchStatus = !filters.status || user.status === filters.status;
    const matchTeam = !filters.team || user.team_id?.toString() === filters.team;
    return matchSearch && matchRole && matchStatus && matchTeam;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>

      {/* Page header */}
      <div style={{
        padding: '24px 28px 16px',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 16, flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 4 }}>CRM › Users</div>
          <h1 style={{
            margin: 0, fontFamily: 'var(--font-serif)',
            fontWeight: 500, fontSize: 38, lineHeight: 1,
            letterSpacing: '-0.01em', color: 'var(--text)',
          }}>
            Users.
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-dim)', maxWidth: 520 }}>
            Configure access, roles, and event assignments across the organisation.
          </p>
        </div>
        <button onClick={() => { setSelectedUser(null); setIsModalOpen(true); }} style={primaryBtnStyle}>
          + Add User
        </button>
      </div>

      {/* Table card */}
      <div style={{
        flex: 1, margin: '0 28px 28px',
        display: 'flex', flexDirection: 'column',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, overflow: 'hidden', minHeight: 0,
      }}>

        {/* Toolbar */}
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'var(--surface-alt)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '0 10px', height: 32,
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--text-faint)" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="5" cy="5" r="4" /><path d="M9 9l2 2" />
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email…"
              style={{ border: 'none', outline: 'none', fontSize: 12, background: 'none', color: 'var(--text)', fontFamily: 'inherit', width: 200 }}
            />
          </div>

          <select value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })} style={selectStyle}>
            <option value="">All Roles</option>
            {customRoles.map(r => (
              <option key={r.id} value={String(r.id)}>{r.display_label}</option>
            ))}
          </select>
          <select value={filters.team} onChange={(e) => setFilters({ ...filters, team: e.target.value })} style={selectStyle}>
            <option value="">All Teams</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} style={selectStyle}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>

          {(searchQuery || filters.role || filters.team || filters.status) && (
            <button
              onClick={() => { setSearchQuery(''); setFilters({ role: '', status: '', team: '' }); }}
              style={{ fontSize: 11, color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Clear ×
            </button>
          )}

          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ background: 'var(--surface-alt)' }}>
                <Th>User</Th>
                <Th>Username</Th>
                <Th>Role</Th>
                <Th>Team</Th>
                <Th>Events</Th>
                <Th>Status</Th>
                <Th style={{ width: 110 }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={emptyCell}>Loading users…</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={8} style={emptyCell}>No users match the current filters.</td></tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => { setDrawerUser(user); setIsDrawerOpen(true); }}
                    style={{ height: 44, borderTop: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseOver={(e) => { e.currentTarget.style.background = 'var(--surface-alt)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={cell}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={user.full_name || user.username} size={26} />
                        <span style={{ fontWeight: 500, color: 'var(--text)' }}>{user.full_name || user.username}</span>
                      </div>
                    </td>
                    <td style={cell}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)' }}>@{user.username}</span>
                    </td>
                    <td style={cell}><RoleBadge role={user.role} label={user.custom_role_label} /></td>
                    <td style={cell}>
                      {user.team_name
                        ? <span style={{ color: 'var(--text-dim)' }}>{user.team_name}</span>
                        : <span style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>Unassigned</span>}
                    </td>
                    <td style={cell}>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 12,
                        background: 'var(--surface-alt)', border: '1px solid var(--border)',
                        padding: '2px 7px', borderRadius: 6, color: 'var(--text-dim)',
                      }}>
                        {user.assigned_events_count ?? 0}
                      </span>
                    </td>
                    <td style={cell}><UserStatusBadge status={user.status || 'active'} /></td>
                    <td style={{ ...cell, width: 110 }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <ActionBtn onClick={() => { setSelectedUser(user); setIsModalOpen(true); }} title="Edit">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M8.5 1.5l2 2L4 10H2v-2L8.5 1.5z" />
                          </svg>
                        </ActionBtn>
                        <ActionBtn
                          onClick={() => handleToggleStatus(user)}
                          title={user.status === 'active' ? 'Deactivate' : 'Activate'}
                          color={user.status === 'active' ? 'var(--warn)' : 'var(--success)'}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            {user.status === 'active'
                              ? <><circle cx="6" cy="6" r="4" /><line x1="4" y1="4" x2="8" y2="8" /></>
                              : <><circle cx="6" cy="6" r="4" /><path d="M4 6h4" /></>}
                          </svg>
                        </ActionBtn>
                        <ActionBtn onClick={() => handleDelete(user)} title="Delete" color="var(--danger)">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M2 3h8M5 3V2h2v1M4 3v6h4V3H4z" />
                          </svg>
                        </ActionBtn>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UserModal user={selectedUser} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={() => fetchData(true)} />
      <UserDetailDrawer user={drawerUser} isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </div>
  );
}


function Th({ children, style = {} }) {
  return (
    <th style={{
      padding: '10px 14px', fontSize: 10, fontWeight: 500,
      textTransform: 'uppercase', letterSpacing: '0.05em',
      color: 'var(--text-dim)', textAlign: 'left', whiteSpace: 'nowrap',
      border: 'none', borderBottom: '1px solid var(--border)',
      ...style,
    }}>
      {children}
    </th>
  );
}

function RoleBadge({ role, label }) {
  const map = {
    admin:          { bg: 'var(--danger-soft)',   c: 'var(--danger)'   },
    sales:          { bg: 'var(--accent-soft)',   c: 'var(--accent)'   },
    speaker_sales:  { bg: 'var(--success-soft)',  c: 'var(--success)'  },
    telemarketing:  { bg: 'var(--surface-alt)',   c: 'var(--text)'     },
    market_research:{ bg: 'var(--warn-soft)',     c: 'var(--warn)'     },
    data_mining:    { bg: 'rgba(111,66,193,0.12)',c: '#6f42c1'         },
    spex:           { bg: 'var(--accent-soft)',   c: 'var(--accent)'   },
    operations:     { bg: 'var(--surface-alt)',   c: 'var(--text-dim)' },
  };
  const s = map[role] || map.operations;
  const display = label || (role?.replace(/_/g, ' ') || '—');
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 6, background: s.bg, color: s.c, whiteSpace: 'nowrap' }}>
      {display}
    </span>
  );
}

function UserStatusBadge({ status }) {
  const map = {
    active: { bg: 'var(--success-soft)', c: 'var(--success)', dot: 'var(--success)' },
    inactive: { bg: 'var(--surface-alt)', c: 'var(--text-dim)', dot: 'var(--text-faint)' },
    suspended: { bg: 'var(--danger-soft)', c: 'var(--danger)', dot: 'var(--danger)' },
  };
  const s = map[status] || map.inactive;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 6, background: s.bg, color: s.c }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {status}
    </span>
  );
}

function ActionBtn({ children, onClick, title, color = 'var(--text-dim)' }) {
  return (
    <button
      onClick={onClick} title={title}
      style={{
        width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)',
        background: 'var(--surface)', color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all .15s',
      }}
      onMouseOver={(e) => { e.currentTarget.style.background = 'var(--surface-alt)'; }}
      onMouseOut={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
    >
      {children}
    </button>
  );
}

const cell = {
  padding: '0 14px', color: 'var(--text)',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200,
};

const emptyCell = {
  textAlign: 'center', padding: '48px 0', color: 'var(--text-faint)', fontSize: 13,
};

const selectStyle = {
  height: 32, padding: '0 28px 0 10px', fontSize: 12,
  border: '1px solid var(--border)', borderRadius: 8,
  color: 'var(--text)', background: 'var(--surface)',
  fontFamily: 'inherit', outline: 'none', cursor: 'pointer', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239a978f' stroke-width='1.3' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  backgroundSize: "10px 6px",
};

const primaryBtnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  background: 'var(--accent)', border: 'none', color: '#fff',
  padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
};
