import React, { useState, useEffect } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  PointerSensor, 
  useSensor, 
  useSensors,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { teamsApi, usersApi } from '../api';
import { UserDraggable } from '../components/teams/UserDraggable';
import { TeamCard } from '../components/teams/TeamCard';
import { useToast } from '../contexts/ToastContext';

export function TeamsManagementPage() {
  const toast = useToast();
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeUser, setActiveUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: '', description: '', color: '#405189' });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [teamsData, usersData] = await Promise.all([
        teamsApi.list(),
        usersApi.list({ limit: 1000 })
      ]);
      setTeams(teamsData.results || teamsData);
      setUsers(usersData.results || usersData);
    } catch (error) {
      toast.error('Failed to fetch teams and users');
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (event) => {
    const { active } = event;
    const userId = active.id.replace('user-', '');
    const user = users.find(u => u.id.toString() === userId);
    setActiveUser(user);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveUser(null);

    if (!over) return;

    const userId = active.id.replace('user-', '');
    const teamId = over.id.replace('team-', '');

    const user = users.find(u => u.id.toString() === userId);
    if (!user) return;

    // Check if user is already in this team
    if (user.team_id?.toString() === teamId) return;

    try {
      // Optimistic update
      const updatedUsers = users.map(u => 
        u.id.toString() === userId ? { ...u, team_id: parseInt(teamId), team_name: teams.find(t => t.id.toString() === teamId)?.name } : u
      );
      setUsers(updatedUsers);

      await usersApi.moveTeam(userId, teamId);
      toast.success(`Moved ${user.full_name || user.username} to ${teams.find(t => t.id.toString() === teamId)?.name}`);
      
      // Refresh count from backend
      const updatedTeams = await teamsApi.list();
      setTeams(updatedTeams.results || updatedTeams);
    } catch (error) {
      toast.error('Failed to move user');
      fetchData(); // Rollback
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    try {
      await teamsApi.create(newTeam);
      toast.success('Team created successfully');
      setShowCreateModal(false);
      setNewTeam({ name: '', description: '', color: '#405189' });
      fetchData();
    } catch (error) {
      toast.error('Failed to create team');
    }
  };

  const filteredUsers = users.filter(u => 
    (u.full_name || u.username).toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const unassignedUsers = filteredUsers.filter(u => !u.team_id);

  if (loading && teams.length === 0) return <div style={{ padding: 40 }}>Loading workspace...</div>;

  return (
    <div className="teams-management-workspace" style={{ padding: '24px', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h4 style={{ margin: 0, fontWeight: 700, textTransform: 'uppercase', fontSize: '18px', color: '#495057' }}>Team Management</h4>
          <p style={{ margin: '4px 0 0', color: '#878a99', fontSize: '13px' }}>Organize your workforce with modern drag-and-drop tools.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <i className="ri-add-line align-bottom me-1"></i> Create Team
        </button>
      </div>

      <DndContext 
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>
          {/* Left Side: Unassigned & Search */}
          <div className="card" style={{ width: '320px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div className="card-header">
              <div className="search-box">
                <input 
                  type="text" 
                  className="form-control search" 
                  placeholder="Search users..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <i className="ri-search-line search-icon"></i>
              </div>
            </div>
            <div className="card-body" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              <h6 className="text-muted text-uppercase fw-semibold mb-3" style={{ fontSize: '11px' }}>
                Unassigned Members ({unassignedUsers.length})
              </h6>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {unassignedUsers.map(user => (
                  <UserDraggable key={user.id} user={user} />
                ))}
                {unassignedUsers.length === 0 && (
                  <div className="text-center py-4 text-muted" style={{ fontSize: '13px' }}>
                    All members assigned
                  </div>
                )}
              </div>
              
              <h6 className="text-muted text-uppercase fw-semibold mt-4 mb-3" style={{ fontSize: '11px' }}>
                Quick Search Results
              </h6>
              {searchQuery && filteredUsers.filter(u => u.team_id).length > 0 && (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filteredUsers.filter(u => u.team_id).map(user => (
                      <UserDraggable key={user.id} user={user} />
                    ))}
                 </div>
              )}
            </div>
          </div>

          {/* Right Side: Teams Grid */}
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
            <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-4">
              {teams.map(team => (
                <div key={team.id} className="col">
                  <TeamCard 
                    team={team} 
                    members={users.filter(u => u.team_id === team.id)} 
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <DragOverlay>
          {activeUser ? (
            <div className="user-draggable-card dragging" style={{ width: '280px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', cursor: 'grabbing' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="avatar-initials" style={{ backgroundColor: 'var(--vz-primary)', color: '#fff' }}>
                  {activeUser.username[0].toUpperCase()}
                </div>
                <div>
                  <div className="user-name">{activeUser.full_name || activeUser.username}</div>
                  <div className="user-role">{activeUser.role}</div>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0">
              <div className="modal-header p-3 bg-soft-info">
                <h5 className="modal-title">Create New Team</h5>
                <button type="button" className="btn-close" onClick={() => setShowCreateModal(false)}></button>
              </div>
              <form onSubmit={handleCreateTeam}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Team Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      required 
                      value={newTeam.name}
                      onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                      placeholder="e.g. SpEx Team"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea 
                      className="form-control" 
                      rows="3"
                      value={newTeam.description}
                      onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                      placeholder="Briefly describe the team's purpose..."
                    ></textarea>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Color Theme</label>
                    <input 
                      type="color" 
                      className="form-control form-control-color w-100" 
                      value={newTeam.color}
                      onChange={(e) => setNewTeam({ ...newTeam, color: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light" onClick={() => setShowCreateModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Create Team</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
