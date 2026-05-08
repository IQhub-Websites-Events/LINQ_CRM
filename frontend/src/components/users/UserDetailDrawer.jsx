import { useState, useEffect } from 'react';
import { usersApi } from '../../api';
import { Avatar } from '../ui/Avatar';

export function UserDetailDrawer({ user, isOpen, onClose }) {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user) fetchDetails();
  }, [isOpen, user]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        usersApi.logs(user.id),
        usersApi.eventsStats(user.id),
      ]);
      setLogs(logsRes);
      setStats(statsRes);
    } catch {}
    finally {
      setLoading(false);
    }
  };

  if (!isOpen || !user) return null;

  const statusColors = {
    active: { bg: 'var(--success-soft)', c: 'var(--success)', dot: 'var(--success)' },
    inactive: { bg: 'var(--surface-alt)', c: 'var(--text-dim)', dot: 'var(--text-faint)' },
    suspended: { bg: 'var(--danger-soft)', c: 'var(--danger)', dot: 'var(--danger)' },
  };
  const sc = statusColors[user.status || 'active'] || statusColors.inactive;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15,12,8,0.4)',
          backdropFilter: 'blur(2px)',
          zIndex: 1040,
        }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 440,
        background: 'var(--surface)',
        zIndex: 1050,
        boxShadow: '-10px 0 40px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>

        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-alt)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <span style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
              User Profile
            </span>
            <button
              onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: 6,
                background: 'var(--surface)', border: '1px solid var(--border)',
                color: 'var(--text-dim)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
              }}
            >×</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar name={user.full_name || user.username} size={52} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 20, fontWeight: 400, color: 'var(--text)', lineHeight: 1.2, marginBottom: 4 }}>
                {user.full_name || user.username}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                <span style={{ fontFamily: 'var(--font-mono)' }}>@{user.username}</span>
                <span style={{ margin: '0 5px', color: 'var(--border-strong)' }}>·</span>
                <span style={{ textTransform: 'capitalize' }}>{user.role?.replace('_', ' ') || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Basic info */}
          <DrawerSection title="Basic Information">
            <InfoRow label="Email" value={user.email || '—'} mono />
            <InfoRow label="Team" value={user.team_name || 'Unassigned'} />
            <InfoRow label="Status">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 6, background: sc.bg, color: sc.c }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot }} />
                {user.status || 'active'}
              </span>
            </InfoRow>
            <InfoRow label="Joined" value={user.date_joined ? new Date(user.date_joined).toLocaleDateString() : '—'} />
          </DrawerSection>

          {/* Assigned events */}
          <DrawerSection title={`Assigned Events (${user.assigned_events_count ?? 0})`}>
            {stats.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '8px 0' }}>No events assigned</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {stats.map((stat) => (
                  <div key={stat.event_code} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px',
                    background: 'var(--surface-alt)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                  }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, color: 'var(--accent)' }}>{stat.event_code}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>{stat.name}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 6, background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                      {stat.event_status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </DrawerSection>

          {/* Activity log */}
          <DrawerSection title="Recent Activity" last>
            {loading ? (
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Loading activity…</div>
            ) : logs.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '8px 0' }}>No activity recorded</div>
            ) : (
              <div style={{ position: 'relative', paddingLeft: 16 }}>
                <div style={{ position: 'absolute', left: 3, top: 0, bottom: 0, width: 1, background: 'var(--border)' }} />
                {logs.map((log) => (
                  <div key={log.id} style={{ position: 'relative', marginBottom: 14 }}>
                    <div style={{
                      position: 'absolute', left: -17, top: 4,
                      width: 8, height: 8, borderRadius: '50%',
                      background: 'var(--accent)', border: '2px solid var(--surface)',
                    }} />
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{log.action}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{log.details}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>{new Date(log.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </DrawerSection>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface-alt)', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '7px 0',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 7, fontSize: 12, fontWeight: 500,
              color: 'var(--text-dim)', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}


function DrawerSection({ title, children, last }) {
  return (
    <div style={{ marginBottom: last ? 0 : 24 }}>
      <div style={{
        fontSize: 10, fontWeight: 500, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: 'var(--text-faint)',
        marginBottom: 10,
        paddingBottom: 6, borderBottom: '1px solid var(--border)',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '7px 0', borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{label}</span>
      {children || (
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>
          {value || '—'}
        </span>
      )}
    </div>
  );
}
