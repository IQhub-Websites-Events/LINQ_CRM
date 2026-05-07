import React, { useState, useEffect } from 'react';
import { usersApi, teamsApi } from '../api';
import { Td, EmptyState } from '../components/ui/Table';
import { useToast } from '../contexts/ToastContext';
import { UserModal } from '../components/users/UserModal';
import { UserDetailDrawer } from '../components/users/UserDetailDrawer';

export function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({ role: '', status: '', team: '' });
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerUser, setDrawerUser] = useState(null);

  useEffect(() => {
    fetchData();
    fetchTeams();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await usersApi.list({ page_size: 1000 });
      setUsers(res.results || res);
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await teamsApi.list();
      setTeams(res.results || res);
    } catch (error) {
      console.error('Failed to fetch teams');
    }
  };

  const handleToggleStatus = async (user) => {
    const nextStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await usersApi.toggleStatus(user.id, nextStatus);
      toast.success(`User ${nextStatus === 'active' ? 'activated' : 'deactivated'}`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update status');
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Are you sure you want to delete ${user.username}?`)) return;
    try {
      await usersApi.delete(user.id);
      toast.success('User deleted successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    }
  };

  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      user.username.toLowerCase().includes(query) ||
      (user.full_name || '').toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query);
    
    const matchesRole = !filters.role || user.role === filters.role;
    const matchesStatus = !filters.status || user.status === filters.status;
    const matchesTeam = !filters.team || user.team_id?.toString() === filters.team;

    return matchesSearch && matchesRole && matchesStatus && matchesTeam;
  });

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h4 style={{ margin: 0, fontWeight: 700, textTransform: 'uppercase', fontSize: '18px', color: '#495057' }}>User Management</h4>
          <p style={{ margin: '4px 0 0', color: '#878a99', fontSize: '13px' }}>Configure organization access, roles, and event assignments.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSelectedUser(null); setIsModalOpen(true); }}>
          <i className="ri-user-add-line align-bottom me-1"></i> Add New User
        </button>
      </div>

      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Filters Header */}
        <div style={{ padding: '16px 20px', background: '#fff', borderBottom: '1px solid var(--vz-card-border-color)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div className="search-box" style={{ width: '250px' }}>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search username, name, email..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <i className="ri-search-line search-icon"></i>
          </div>
          <select 
            className="form-select" 
            style={{ width: '150px' }}
            value={filters.role}
            onChange={e => setFilters({ ...filters, role: e.target.value })}
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="sales">Sales</option>
            <option value="market_research">Market Research</option>
            <option value="spex">SpEx</option>
            <option value="operations">Operations</option>
          </select>
          <select 
            className="form-select" 
            style={{ width: '150px' }}
            value={filters.team}
            onChange={e => setFilters({ ...filters, team: e.target.value })}
          >
            <option value="">All Teams</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select 
            className="form-select" 
            style={{ width: '150px' }}
            value={filters.status}
            onChange={e => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
          <button className="btn btn-light" onClick={() => { setSearchQuery(''); setFilters({ role: '', status: '', team: '' }); }}>
            Reset
          </button>
        </div>

        {/* Table Body */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f3f6f9', borderBottom: '1px solid var(--vz-card-border-color)' }}>
                <th style={thStyle}>User</th>
                <th style={thStyle}>Username</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Team</th>
                <th style={thStyle}>Events</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Last Login</th>
                <th style={thStyle} className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-5 text-muted">Loading enterprise workforce...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <EmptyState title="No users match your criteria" subtitle="Try adjusting your filters or search query." />
              ) : (
                filteredUsers.map(user => (
                  <tr 
                    key={user.id} 
                    style={{ borderBottom: '1px solid var(--vz-card-border-color)', cursor: 'pointer', transition: 'all 0.15s ease' }}
                    onClick={() => { setDrawerUser(user); setIsDrawerOpen(true); }}
                    className="user-row"
                  >
                    <Td>
                      <div className="d-flex align-items-center gap-2">
                        <div className="avatar-initials" style={{ width: '32px', height: '32px', fontSize: '11px' }}>
                          {getInitials(user.full_name || user.username)}
                        </div>
                        <div className="fw-semibold" style={{ color: 'var(--vz-primary)' }}>{user.full_name || user.username}</div>
                      </div>
                    </Td>
                    <Td>@{user.username}</Td>
                    <Td>
                      <span className={`badge badge-soft-${user.role === 'admin' ? 'danger' : 'info'}`}>
                        {user.role}
                      </span>
                    </Td>
                    <Td>{user.team_name || <span className="text-muted">Unassigned</span>}</Td>
                    <Td>
                      <span className="badge bg-light text-body border">{user.assigned_events_count}</span>
                    </Td>
                    <Td>
                      <span className={`badge badge-soft-${user.status === 'active' ? 'success' : 'danger'}`}>
                        {user.status || 'active'}
                      </span>
                    </Td>
                    <Td muted>{user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</Td>
                    <Td className="text-end" onClick={e => e.stopPropagation()}>
                      <div className="d-flex justify-content-end gap-1">
                        <button className="btn btn-sm btn-soft-primary" onClick={() => { setSelectedUser(user); setIsModalOpen(true); }}>
                          <i className="ri-edit-2-line"></i>
                        </button>
                        <button className={`btn btn-sm btn-soft-${user.status === 'active' ? 'warning' : 'success'}`} onClick={() => handleToggleStatus(user)}>
                          <i className={`ri-${user.status === 'active' ? 'eye-off' : 'eye'}-line`}></i>
                        </button>
                        <button className="btn btn-sm btn-soft-danger" onClick={() => handleDelete(user)}>
                          <i className="ri-delete-bin-line"></i>
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UserModal 
        user={selectedUser} 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={fetchData} 
      />

      <UserDetailDrawer 
        user={drawerUser} 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
      />

      <style>
        {`
          .user-row:hover { background-color: #f8f9fa; }
          .btn-soft-primary { background: rgba(64, 81, 137, 0.1); color: #405189; border: none; }
          .btn-soft-primary:hover { background: #405189; color: #fff; }
          .btn-soft-danger { background: rgba(240, 101, 72, 0.1); color: #f06548; border: none; }
          .btn-soft-danger:hover { background: #f06548; color: #fff; }
          .btn-soft-warning { background: rgba(247, 184, 75, 0.1); color: #f7b84b; border: none; }
          .btn-soft-warning:hover { background: #f7b84b; color: #fff; }
          .btn-soft-success { background: rgba(10, 179, 156, 0.1); color: #0ab39c; border: none; }
          .btn-soft-success:hover { background: #0ab39c; color: #fff; }
        `}
      </style>
    </div>
  );
}

const thStyle = {
  position: 'sticky',
  top: 0,
  zIndex: 3,
  background: '#f8fafc',
  color: '#878a99',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '.5px',
  padding: '12px 16px',
  textAlign: 'left',
  borderBottom: '1px solid #e9ebec',
  whiteSpace: 'nowrap',
};
