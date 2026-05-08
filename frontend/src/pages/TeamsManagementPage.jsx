import { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { teamsApi, usersApi } from '../api';
import { UserDraggable } from '../components/teams/UserDraggable';
import { TeamCard } from '../components/teams/TeamCard';
import { Avatar } from '../components/ui/Avatar';
import { useToast } from '../contexts/ToastContext';

export function TeamsManagementPage() {
  const toast = useToast();
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeUser, setActiveUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: '', description: '', color: '#0d7a4f' });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [teamsData, usersData] = await Promise.all([
        teamsApi.list(),
        usersApi.list({ limit: 1000 }),
      ]);
      setTeams(teamsData.results || teamsData);
      setUsers(usersData.results || usersData);
    } catch {
      toast.error('Failed to fetch teams and users');
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (event) => {
    const userId = event.active.id.replace('user-', '');
    setActiveUser(users.find((u) => u.id.toString() === userId));
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveUser(null);
    if (!over) return;

    const userId = active.id.replace('user-', '');
    const teamId = over.id.replace('team-', '');
    const user = users.find((u) => u.id.toString() === userId);
    if (!user || user.team_id?.toString() === teamId) return;

    try {
      setUsers(users.map((u) =>
        u.id.toString() === userId
          ? { ...u, team_id: parseInt(teamId), team_name: teams.find((t) => t.id.toString() === teamId)?.name }
          : u
      ));
      await usersApi.moveTeam(userId, teamId);
      toast.success(`Moved ${user.full_name || user.username} to ${teams.find((t) => t.id.toString() === teamId)?.name}`);
      const updated = await teamsApi.list();
      setTeams(updated.results || updated);
    } catch {
      toast.error('Failed to move user');
      fetchData();
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    try {
      await teamsApi.create(newTeam);
      toast.success('Team created');
      setShowCreateModal(false);
      setNewTeam({ name: '', description: '', color: '#0d7a4f' });
      fetchData();
    } catch {
      toast.error('Failed to create team');
    }
  };

  const filteredUsers = users.filter((u) =>
    (u.full_name || u.username).toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const unassignedUsers = filteredUsers.filter((u) => !u.team_id);

  if (loading && teams.length === 0) {
    return <div style={{ padding: 40, color: 'var(--text-faint)', fontSize: 13 }}>Loading workspace…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>

      {/* Page header */}
      <div style={{
        padding: '24px 28px 16px',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 16, flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 4 }}>CRM › Teams</div>
          <h1 style={{
            margin: 0, fontFamily: 'var(--font-serif)',
            fontWeight: 500, fontSize: 38, lineHeight: 1,
            letterSpacing: '-0.01em', color: 'var(--text)',
          }}>
            Teams.
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-dim)', maxWidth: 520 }}>
            Organise your workforce. Drag a user card onto a team to assign them.
          </p>
        </div>
        <button onClick={() => setShowCreateModal(true)} style={primaryBtnStyle}>
          + Create Team
        </button>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0, padding: '0 28px 28px' }}>

          {/* Left: unassigned panel */}
          <div style={{
            width: 300, flexShrink: 0,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'var(--surface-alt)',
                border: '1px solid var(--border)',
                borderRadius: 8, padding: '0 10px', height: 32,
              }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--text-faint)" strokeWidth="1.6" strokeLinecap="round">
                  <circle cx="5" cy="5" r="4" /><path d="M9 9l2 2" />
                </svg>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users…"
                  style={{
                    border: 'none', outline: 'none', fontSize: 12,
                    background: 'none', color: 'var(--text)', fontFamily: 'inherit', width: '100%',
                  }}
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-faint)', marginBottom: 10 }}>
                Unassigned ({unassignedUsers.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {unassignedUsers.map((user) => (
                  <UserDraggable key={user.id} user={user} />
                ))}
                {unassignedUsers.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-faint)', fontSize: 12 }}>
                    All members assigned
                  </div>
                )}
              </div>

              {searchQuery && filteredUsers.filter((u) => u.team_id).length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-faint)', margin: '16px 0 10px' }}>
                    In teams ({filteredUsers.filter((u) => u.team_id).length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filteredUsers.filter((u) => u.team_id).map((user) => (
                      <UserDraggable key={user.id} user={user} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right: teams grid */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
              alignContent: 'start',
            }}>
              {teams.map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  members={users.filter((u) => u.team_id === team.id)}
                />
              ))}
              {teams.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '48px 0', color: 'var(--text-faint)', fontSize: 13 }}>
                  No teams yet. Create one to get started.
                </div>
              )}
            </div>
          </div>
        </div>

        <DragOverlay>
          {activeUser ? (
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--accent)',
              borderRadius: 8,
              padding: '10px 12px',
              width: 260,
              boxShadow: '0 10px 30px rgba(0,0,0,0.14)',
              cursor: 'grabbing',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <Avatar name={activeUser.full_name || activeUser.username} size={32} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                  {activeUser.full_name || activeUser.username}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'capitalize' }}>{activeUser.role}</div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Create Team Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15,12,8,0.55)',
            backdropFilter: 'blur(4px)',
            zIndex: 1100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}
        >
          <div style={{
            width: '100%', maxWidth: 480,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 24px 80px rgba(20,20,15,0.18)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '20px 28px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 22, fontWeight: 400, color: 'var(--text)' }}>
                New team
              </span>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  width: 32, height: 32, borderRadius: 7,
                  background: 'var(--surface-alt)', border: '1px solid var(--border)',
                  color: 'var(--text-dim)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}
              >×</button>
            </div>

            <form onSubmit={handleCreateTeam}>
              <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <ModalField label="Team Name *">
                  <ModalInput
                    type="text" required
                    value={newTeam.name}
                    onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                    placeholder="e.g. SpEx Team"
                  />
                </ModalField>
                <ModalField label="Description">
                  <textarea
                    value={newTeam.description}
                    onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                    placeholder="Briefly describe the team's purpose…"
                    rows={3}
                    style={{ ...baseInputStyle, height: 'auto', padding: '9px 12px', resize: 'vertical', lineHeight: 1.5 }}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-soft)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                  />
                </ModalField>
                <ModalField label="Colour">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="color"
                      value={newTeam.color}
                      onChange={(e) => setNewTeam({ ...newTeam, color: e.target.value })}
                      style={{ width: 36, height: 36, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', padding: 2, background: 'var(--surface)' }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{newTeam.color}</span>
                  </div>
                </ModalField>
              </div>
              <div style={{
                padding: '14px 28px',
                background: 'var(--surface-alt)', borderTop: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
              }}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={ghostBtnStyle}>Cancel</button>
                <button type="submit" style={primaryBtnStyle}>Create Team</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


function ModalField({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 500, letterSpacing: '0.02em' }}>{label}</span>
      {children}
    </label>
  );
}

function ModalInput({ value, onChange, type = 'text', placeholder, required }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type} value={value} required={required} placeholder={placeholder}
      onChange={onChange}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        ...baseInputStyle,
        borderColor: focused ? 'var(--accent)' : 'var(--border)',
        boxShadow: focused ? '0 0 0 3px var(--accent-soft)' : 'none',
      }}
    />
  );
}

const baseInputStyle = {
  height: 36, padding: '0 12px',
  border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--surface)', color: 'var(--text)',
  fontSize: 13, fontFamily: 'var(--font-sans)',
  outline: 'none', width: '100%',
  transition: 'border-color .15s, box-shadow .15s',
};

const primaryBtnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  background: 'var(--accent)', border: 'none', color: '#fff',
  padding: '7px 14px', borderRadius: 7,
  fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
};

const ghostBtnStyle = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 12, fontWeight: 500,
  padding: '7px 14px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
};
