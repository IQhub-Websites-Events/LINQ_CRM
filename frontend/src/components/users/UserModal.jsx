import React, { useState, useEffect } from 'react';
import { teamsApi, eventsApi, usersApi } from '../../api';
import { useToast } from '../../contexts/ToastContext';

export function UserModal({ user, isOpen, onClose, onSave }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  const [events, setEvents] = useState([]);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    confirm_password: '',
    role: 'sales',
    status: 'active',
    team_id: '',
    assigned_event_ids: []
  });

  useEffect(() => {
    if (isOpen) {
      fetchOptions();
      if (user) {
        setFormData({
          username: user.username || '',
          email: user.email || '',
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          password: '',
          confirm_password: '',
          role: user.role || 'sales',
          status: user.status || 'active',
          team_id: user.team_id || '',
          assigned_event_ids: user.assigned_events?.map(e => e.id) || []
        });
      } else {
        setFormData({
          username: '',
          email: '',
          first_name: '',
          last_name: '',
          password: '',
          confirm_password: '',
          role: 'sales',
          status: 'active',
          team_id: '',
          assigned_event_ids: []
        });
      }
    }
  }, [isOpen, user]);

  const fetchOptions = async () => {
    try {
      const [teamsRes, eventsRes] = await Promise.all([
        teamsApi.list(),
        eventsApi.list({ limit: 1000 })
      ]);
      setTeams(teamsRes.results || teamsRes);
      setEvents(eventsRes.results || eventsRes);
    } catch (error) {
      toast.error('Failed to load form options');
    }
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

      if (user) {
        await usersApi.update(user.id, payload);
        toast.success('User updated successfully');
      } else {
        await usersApi.create(payload);
        toast.success('User created successfully');
      }
      onSave();
      onClose();
    } catch (error) {
      const msg = error.response?.data?.detail || error.response?.data?.username?.[0] || 'Failed to save user';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content border-0">
          <div className="modal-header p-3 bg-soft-info">
            <h5 className="modal-title">{user ? 'Edit User' : 'Create New User'}</h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={loading}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              <div className="row g-4">
                {/* Section 1: Basic Info */}
                <div className="col-12">
                  <h6 className="text-muted text-uppercase fw-semibold mb-3" style={{ fontSize: '11px' }}>
                    Section 1 — Account Information
                  </h6>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">First Name</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        required 
                        value={formData.first_name}
                        onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                        placeholder="Enter first name"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Last Name</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        required 
                        value={formData.last_name}
                        onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                        placeholder="Enter last name"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Username</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        required 
                        value={formData.username}
                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                        placeholder="j.doe"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Email Address</label>
                      <input 
                        type="email" 
                        className="form-control" 
                        required 
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        placeholder="john@linq.com"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">{user ? 'New Password (Optional)' : 'Password'}</label>
                      <input 
                        type="password" 
                        className="form-control" 
                        required={!user}
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Confirm Password</label>
                      <input 
                        type="password" 
                        className="form-control" 
                        required={!user && formData.password}
                        value={formData.confirm_password}
                        onChange={e => setFormData({ ...formData, confirm_password: e.target.value })}
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Organization */}
                <div className="col-12">
                  <h6 className="text-muted text-uppercase fw-semibold mb-3 mt-2" style={{ fontSize: '11px' }}>
                    Section 2 — Organization & Role
                  </h6>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Role</label>
                      <select 
                        className="form-select" 
                        value={formData.role}
                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                      >
                        <option value="admin">Administrator</option>
                        <option value="sales">Sales Executive</option>
                        <option value="market_research">Market Research</option>
                        <option value="spex">SpEx</option>
                        <option value="operations">Operations</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Team</label>
                      <select 
                        className="form-select" 
                        value={formData.team_id}
                        onChange={e => setFormData({ ...formData, team_id: e.target.value })}
                      >
                        <option value="">Unassigned</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Status</label>
                      <select 
                        className="form-select" 
                        value={formData.status}
                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 3: Access */}
                <div className="col-12">
                  <h6 className="text-muted text-uppercase fw-semibold mb-3 mt-2" style={{ fontSize: '11px' }}>
                    Section 3 — Assigned Events
                  </h6>
                  <div className="mb-3">
                    <label className="form-label">Accessible Events</label>
                    <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #e9ebec', borderRadius: '4px', padding: '10px' }}>
                      {events.map(event => (
                        <div key={event.id} className="form-check mb-2">
                          <input 
                            className="form-check-input" 
                            type="checkbox" 
                            id={`event-${event.id}`}
                            checked={formData.assigned_event_ids.includes(event.id)}
                            onChange={(e) => {
                              const ids = e.target.checked 
                                ? [...formData.assigned_event_ids, event.id]
                                : formData.assigned_event_ids.filter(id => id !== event.id);
                              setFormData({ ...formData, assigned_event_ids: ids });
                            }}
                          />
                          <label className="form-check-label" htmlFor={`event-${event.id}`} style={{ fontSize: '12px' }}>
                            <span className="fw-semibold">{event.event_code}</span> — {event.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light" onClick={onClose} disabled={loading}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Processing...' : user ? 'Update User' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
