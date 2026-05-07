import React, { useState, useEffect } from 'react';
import { usersApi } from '../../api';

export function UserDetailDrawer({ user, isOpen, onClose }) {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      fetchDetails();
    }
  }, [isOpen, user]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        usersApi.logs(user.id),
        usersApi.eventsStats(user.id)
      ]);
      setLogs(logsRes);
      setStats(statsRes);
    } catch (error) {
      console.error('Failed to fetch user details');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (!isOpen || !user) return null;

  return (
    <>
      <div 
        className="drawer-backdrop" 
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', zIndex: 1040 }}
        onClick={onClose}
      />
      <div className="user-detail-drawer" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '450px',
        background: '#fff', zIndex: 1050, boxShadow: '-5px 0 25px rgba(0,0,0,0.1)',
        display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.3s ease-out'
      }}>
        <div className="p-4 border-bottom" style={{ background: 'var(--vz-primary)', color: '#fff' }}>
          <div className="d-flex justify-content-between align-items-start mb-3">
            <h5 className="modal-title text-white">User Profile</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <div className="d-flex align-items-center gap-3">
             <div className="avatar-initials" style={{ width: '64px', height: '64px', fontSize: '24px', background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              {getInitials(user.full_name || user.username)}
            </div>
            <div>
              <h5 className="mb-1 text-white">{user.full_name || user.username}</h5>
              <div style={{ fontSize: '13px', opacity: 0.8 }}>@{user.username} • {user.role}</div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <section className="mb-4">
            <h6 className="text-muted text-uppercase fw-semibold mb-3" style={{ fontSize: '11px' }}>Basic Information</h6>
            <div className="d-flex flex-column gap-2">
              <div className="d-flex justify-content-between">
                <span className="text-muted small">Email</span>
                <span className="small fw-medium">{user.email || '—'}</span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted small">Team</span>
                <span className="small fw-medium">{user.team_name || 'Unassigned'}</span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted small">Status</span>
                <span className={`badge ${user.status === 'active' ? 'badge-soft-success' : 'badge-soft-danger'}`}>
                  {user.status || 'active'}
                </span>
              </div>
               <div className="d-flex justify-content-between">
                <span className="text-muted small">Joined</span>
                <span className="small fw-medium">{new Date(user.date_joined).toLocaleDateString()}</span>
              </div>
            </div>
          </section>

          <section className="mb-4">
            <h6 className="text-muted text-uppercase fw-semibold mb-3" style={{ fontSize: '11px' }}>Assigned Events ({user.assigned_events_count})</h6>
            {stats.length === 0 ? (
              <div className="text-center py-3 bg-light rounded text-muted small">No events assigned</div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {stats.map(stat => (
                  <div key={stat.event_code} className="p-2 border rounded d-flex justify-content-between align-items-center">
                    <div>
                      <div className="fw-semibold small">{stat.event_code}</div>
                      <div className="text-muted" style={{ fontSize: '10px' }}>{stat.name}</div>
                    </div>
                    <span className="badge badge-soft-info">{stat.event_status}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mb-4">
            <h6 className="text-muted text-uppercase fw-semibold mb-3" style={{ fontSize: '11px' }}>Recent Activity</h6>
            {loading ? <div className="small text-muted">Loading logs...</div> : (
              <div className="timeline" style={{ position: 'relative', paddingLeft: '20px' }}>
                <div style={{ position: 'absolute', left: '4px', top: 0, bottom: 0, width: '2px', background: '#e9ebec' }}></div>
                {logs.length === 0 ? <div className="small text-muted">No activity recorded</div> : logs.map(log => (
                  <div key={log.id} className="mb-3" style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '-20px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--vz-primary)', border: '2px solid #fff' }}></div>
                    <div className="fw-semibold small">{log.action}</div>
                    <div className="text-muted" style={{ fontSize: '11px' }}>{log.details}</div>
                    <div className="text-muted" style={{ fontSize: '10px' }}>{new Date(log.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
        
        <div className="p-3 border-top bg-light">
           <button className="btn btn-outline-danger w-100 btn-sm" onClick={onClose}>Close Overview</button>
        </div>
      </div>
      <style>
        {`
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}
      </style>
    </>
  );
}
