import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { teamsApi, usersApi } from "../api";
import { TeamCard } from "../components/teams/TeamCard";
import { UserDraggable } from "../components/teams/UserDraggable";
import { Avatar } from "../components/ui/Avatar";
import { useToast } from "../contexts/ToastContext";
import { UserModal } from "../components/users/UserModal";

// ── Role display helpers ───────────────────────────────────────────────────────
const ROLES = ["admin", "sales", "market_research", "data_mining", "telemarketing", "speaker_sales", "spex", "operations"];
const ROLE_LABEL = {
  admin: "Admin", sales: "Sales", market_research: "MR",
  data_mining: "DMD", telemarketing: "Tele", speaker_sales: "Spkr Sales",
  spex: "SpEx", operations: "Ops",
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export function TeamsManagementPage() {
  const toast = useToast();

  const [teams,   setTeams]   = useState([]);
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeUser, setActiveUser] = useState(null);

  // Filters
  const [search,       setSearch]       = useState("");
  const [roleFilter,   setRoleFilter]   = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Dropdown menus (fixed-position portal)
  const [memberMenu, setMemberMenu] = useState(null); // { userId, x, y }
  const [teamMenu,   setTeamMenu]   = useState(null); // { teamId, x, y }

  // Modals
  const [teamModal,       setTeamModal]       = useState(null);  // { mode, team? }
  const [deleteTarget,    setDeleteTarget]    = useState(null);  // team obj
  const [moveDialog,      setMoveDialog]      = useState(null);  // { userId }
  const [assignLeadTarget, setAssignLeadTarget] = useState(null); // team obj
  const [activityTeamId,  setActivityTeamId] = useState(null);
  const [userModal,       setUserModal]       = useState(null);  // { defaultTeamId? }
  const [activityLogs,    setActivityLogs]   = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ── Data ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [td, ud] = await Promise.all([
        teamsApi.list(),
        usersApi.list({ limit: 1000 }),
      ]);
      setTeams(td.results || td);
      setUsers(ud.results || ud);
    } catch {
      if (!silent) toast.error("Failed to load teams");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Close menus on outside click or scroll
  useEffect(() => {
    if (!memberMenu && !teamMenu) return;
    const close = () => { setMemberMenu(null); setTeamMenu(null); };
    const handleMouse = (e) => { if (!e.target.closest("[data-menu-portal]")) close(); };
    window.addEventListener("scroll",    close,       true);
    window.addEventListener("mousedown", handleMouse, true);
    return () => {
      window.removeEventListener("scroll",    close,       true);
      window.removeEventListener("mousedown", handleMouse, true);
    };
  }, [memberMenu, teamMenu]);

  // ── DnD ───────────────────────────────────────────────────────────────────
  const handleDragStart = ({ active }) => {
    const uid = active.id.replace("user-", "");
    setActiveUser(users.find(u => u.id.toString() === uid) || null);
  };

  const handleDragEnd = async ({ active, over }) => {
    setActiveUser(null);
    if (!over) return;

    const uid    = active.id.replace("user-", "");
    const overId = over.id;
    const isUnassigned = overId === "team-unassigned";
    const targetTeamId = isUnassigned ? null : overId.replace("team-", "");
    const user         = users.find(u => u.id.toString() === uid);
    if (!user) return;

    const curId = user.team_id?.toString() || null;
    const newId = targetTeamId?.toString() || null;
    if (curId === newId) return;

    const targetTeam = targetTeamId ? teams.find(t => t.id.toString() === targetTeamId) : null;

    // Optimistic
    setUsers(prev => prev.map(u =>
      u.id.toString() === uid
        ? { ...u, team_id: targetTeam?.id || null, team_name: targetTeam?.name || null }
        : u
    ));

    try {
      const result = await teamsApi.moveMember({
        user_id:             parseInt(uid),
        source_team_id:      user.team_id || null,
        destination_team_id: targetTeam?.id || null,
      });
      // Patch role immediately from the response so the badge updates without waiting for refetch
      if (result?.role) {
        setUsers(prev => prev.map(u =>
          u.id.toString() === uid ? { ...u, role: result.role } : u
        ));
      }
      toast.success(
        `Moved ${user.full_name || user.username} to ${targetTeam?.name || "Unassigned"}`
      );
      fetchData(true);
    } catch {
      toast.error("Failed to move member");
      fetchData();
    }
  };

  // ── Member actions ────────────────────────────────────────────────────────
  const openMemberMenu = useCallback((userId, rect) => {
    setTeamMenu(null);
    setMemberMenu({ userId, x: rect.right, y: rect.bottom });
  }, []);

  const handleMemberRemove = async (userId) => {
    setMemberMenu(null);
    const user = users.find(u => u.id === userId);
    if (!user?.team_id) return;
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, team_id: null, team_name: null } : u));
    try {
      await teamsApi.moveMember({ user_id: userId, source_team_id: user.team_id, destination_team_id: null });
      toast.success(`${user.full_name || user.username} removed from team`);
      fetchData(true);
    } catch {
      toast.error("Failed to remove member");
      fetchData();
    }
  };

  const handleMemberMoveToTeam = async (userId, targetTeamId) => {
    setMemberMenu(null);
    setMoveDialog(null);
    const user   = users.find(u => u.id === userId);
    const target = teams.find(t => t.id === targetTeamId);
    if (!user || !target || user.team_id === targetTeamId) return;
    setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, team_id: target.id, team_name: target.name } : u
    ));
    try {
      await teamsApi.moveMember({ user_id: userId, source_team_id: user.team_id, destination_team_id: targetTeamId });
      toast.success(`Moved to ${target.name}`);
      fetchData(true);
    } catch {
      toast.error("Failed to move member");
      fetchData();
    }
  };

  const handleMemberAssignLead = async (userId) => {
    setMemberMenu(null);
    const user = users.find(u => u.id === userId);
    if (!user?.team_id) { toast.error("User must be in a team to become lead"); return; }
    try {
      await teamsApi.assignLead(user.team_id, userId);
      toast.success(`${user.full_name || user.username} is now Team Lead`);
      const updated = await teamsApi.list();
      setTeams(updated.results || updated);
    } catch {
      toast.error("Failed to assign lead");
    }
  };

  // ── Team actions ──────────────────────────────────────────────────────────
  const openTeamMenu = useCallback((teamId, rect) => {
    setMemberMenu(null);
    setTeamMenu({ teamId, x: rect.right, y: rect.bottom });
  }, []);

  const handleArchiveTeam = async (teamId) => {
    setTeamMenu(null);
    try {
      const res = await teamsApi.archive(teamId);
      toast.success(`Team ${res.is_archived ? "archived" : "restored"}`);
      fetchData(true);
    } catch {
      toast.error("Failed to archive team");
    }
  };

  const handleConfirmDelete = async (team, destTeamId) => {
    setDeleteTarget(null);
    try {
      if (destTeamId !== undefined) {
        await teamsApi.bulkMove(team.id, destTeamId);
      }
      await teamsApi.delete(team.id);
      toast.success(`"${team.name}" deleted`);
      fetchData(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete team");
    }
  };

  const handleAssignLeadConfirm = async (teamId, userIds) => {
    setAssignLeadTarget(null);
    try {
      await teamsApi.assignLead(teamId, userIds);
      toast.success("Team lead updated");
      const updated = await teamsApi.list();
      setTeams(updated.results || updated);
    } catch {
      toast.error("Failed to assign lead");
    }
  };

  const handleViewActivity = async (teamId) => {
    setTeamMenu(null);
    setActivityTeamId(teamId);
    setLoadingActivity(true);
    try {
      const logs = await teamsApi.activity(teamId);
      setActivityLogs(logs);
    } catch {
      toast.error("Failed to load activity");
    } finally {
      setLoadingActivity(false);
    }
  };

  const handleSaveTeam = async (data, teamId) => {
    try {
      teamId ? await teamsApi.update(teamId, data) : await teamsApi.create(data);
      toast.success(teamId ? "Team updated" : "Team created");
      setTeamModal(null);
      fetchData(true);
    } catch {
      toast.error("Failed to save team");
    }
  };

  // ── Computed ──────────────────────────────────────────────────────────────
  const filtered = users.filter(u => {
    const name = (u.full_name || u.username || "").toLowerCase();
    const q    = search.toLowerCase();
    if (q && !name.includes(q) && !(u.email || "").toLowerCase().includes(q)) return false;
    if (roleFilter   && u.role   !== roleFilter)   return false;
    if (statusFilter && u.status !== statusFilter) return false;
    return true;
  });

  const unassigned     = filtered.filter(u => !u.team_id);
  const menuUser       = memberMenu ? users.find(u => u.id === memberMenu.userId) : null;
  const menuTeam       = teamMenu   ? teams.find(t => t.id === teamMenu.teamId)   : null;
  const activityTeam   = activityTeamId ? teams.find(t => t.id === activityTeamId) : null;

  if (loading && !teams.length) {
    return (
      <div style={{ padding: 40, color: "var(--text-faint)", fontSize: 13 }}>
        Loading workspace…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg)", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "18px 28px 12px", flexShrink: 0, borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 3 }}>CRM › Teams</div>
            <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 500, fontSize: 32, letterSpacing: "-0.01em", color: "var(--text)", lineHeight: 1 }}>
              Teams.
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-dim)" }}>
              Drag members between columns to reassign them.
            </p>
          </div>
          <button onClick={() => setTeamModal({ mode: "create" })} style={primaryBtn}>
            + Create Team
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <SearchBox value={search} onChange={setSearch} placeholder="Search members…" />

          <div style={{ display: "flex", gap: 3 }}>
            {["", ...ROLES].map(r => (
              <button key={r} onClick={() => setRoleFilter(r)}
                style={{ ...chip, ...(roleFilter === r ? chipActive : {}) }}>
                {r ? (ROLE_LABEL[r] || r) : "All"}
              </button>
            ))}
          </div>

          <div style={{ width: 1, height: 18, background: "var(--border)", flexShrink: 0 }} />

          <div style={{ display: "flex", gap: 3 }}>
            {["", "active", "inactive"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{ ...chip, ...(statusFilter === s ? chipActive : {}) }}>
                {s || "Any Status"}
              </button>
            ))}
          </div>

          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-faint)" }}>
            {filtered.length} member{filtered.length !== 1 ? "s" : ""} · {teams.length} team{teams.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Board */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div style={{ flex: 1, overflowX: "auto", overflowY: "hidden", padding: "14px 28px 20px" }}>
          <div style={{ display: "flex", gap: 12, height: "100%", alignItems: "flex-start", minWidth: "max-content" }}>

            {/* Unassigned column */}
            <UnassignedColumn users={unassigned} onMemberMenuClick={openMemberMenu} />

            {/* Team columns */}
            {teams.map(team => (
              <TeamCard
                key={team.id}
                team={team}
                members={filtered.filter(u => u.team_id === team.id)}
                onTeamMenuClick={openTeamMenu}
                onMemberMenuClick={openMemberMenu}
                onAddUser={(teamId) => setUserModal({ defaultTeamId: teamId })}
              />
            ))}

            {/* Add column button */}
            <button
              onClick={() => setTeamModal({ mode: "create" })}
              title="Create new team"
              style={{
                width: 38, alignSelf: "stretch",
                background: "none",
                border: "1px dashed var(--border)",
                borderRadius: 10,
                cursor: "pointer",
                color: "var(--text-faint)",
                fontSize: 22,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                transition: "border-color .15s, color .15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-faint)"; }}
            >+</button>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeUser && (
            <div style={{
              background: "var(--surface)",
              border: "1px solid var(--accent)",
              borderRadius: 8, padding: "8px 12px", width: 230,
              boxShadow: "0 12px 40px rgba(0,0,0,.18)",
              display: "flex", alignItems: "center", gap: 9,
            }}>
              <Avatar name={activeUser.full_name || activeUser.username} size={26} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                  {activeUser.full_name || activeUser.username}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "capitalize" }}>
                  {(activeUser.role || "").replace(/_/g, " ")}
                </div>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* ── Portal menus ── */}
      {memberMenu && menuUser && (
        <MemberMenu
          user={menuUser}
          x={memberMenu.x}
          y={memberMenu.y}
          onRemove={() => handleMemberRemove(memberMenu.userId)}
          onMoveToTeam={() => { setMoveDialog({ userId: memberMenu.userId }); setMemberMenu(null); }}
          onAssignLead={() => handleMemberAssignLead(memberMenu.userId)}
          onClose={() => setMemberMenu(null)}
        />
      )}
      {teamMenu && menuTeam && (
        <TeamMenu
          team={menuTeam}
          x={teamMenu.x}
          y={teamMenu.y}
          onEdit={() => { setTeamMenu(null); setTeamModal({ mode: "edit", team: menuTeam }); }}
          onDelete={() => { setTeamMenu(null); setDeleteTarget(menuTeam); }}
          onArchive={() => handleArchiveTeam(teamMenu.teamId)}
          onAssignLead={() => {
            setTeamMenu(null);
            setAssignLeadTarget(menuTeam);
          }}
          onViewActivity={() => handleViewActivity(teamMenu.teamId)}
          onAddUser={() => { setTeamMenu(null); setUserModal({ defaultTeamId: teamMenu.teamId }); }}
        />
      )}

      {/* ── Modals ── */}
      {teamModal && (
        <TeamFormModal
          mode={teamModal.mode}
          team={teamModal.team}
          members={users.filter(u => u.team_id === teamModal.team?.id)}
          onSave={handleSaveTeam}
          onAddUser={(teamId) => setUserModal({ defaultTeamId: teamId })}
          onClose={() => setTeamModal(null)}
        />
      )}
      {deleteTarget && (
        <DeleteTeamModal
          team={deleteTarget}
          teams={teams.filter(t => t.id !== deleteTarget.id)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
      {moveDialog && (
        <MoveToTeamDialog
          currentTeamId={users.find(u => u.id === moveDialog.userId)?.team_id}
          teams={teams}
          onConfirm={tId => handleMemberMoveToTeam(moveDialog.userId, tId)}
          onClose={() => setMoveDialog(null)}
        />
      )}
      {assignLeadTarget && (
        <AssignLeadDialog
          team={assignLeadTarget}
          members={users.filter(u => u.team_id === assignLeadTarget.id)}
          onConfirm={handleAssignLeadConfirm}
          onClose={() => setAssignLeadTarget(null)}
        />
      )}
      {userModal && (
        <UserModal
          isOpen={!!userModal}
          defaultTeamId={userModal.defaultTeamId}
          onClose={() => setUserModal(null)}
          onSave={fetchData}
        />
      )}
      {activityTeamId && (
        <ActivityLogModal
          teamName={activityTeam?.name || "Team"}
          logs={activityLogs}
          loading={loadingActivity}
          onClose={() => { setActivityTeamId(null); setActivityLogs([]); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Unassigned Column
// ─────────────────────────────────────────────────────────────────────────────
function UnassignedColumn({ users, onMemberMenuClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: "team-unassigned" });
  const borderColor = isOver ? "var(--accent)" : "var(--border)";

  return (
    <div style={{ width: 248, flexShrink: 0, height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{
        padding: "10px 12px",
        background: "var(--surface)",
        border: `1px solid ${borderColor}`,
        borderBottom: "none",
        borderRadius: "10px 10px 0 0",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        transition: "border-color .15s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "var(--text-dim)" }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--border)", flexShrink: 0 }} />
          Unassigned
        </div>
        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text-faint)", padding: "2px 6px", borderRadius: 5 }}>
          {users.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        style={{
          flex: 1, overflowY: "auto", padding: "6px",
          background: isOver ? "rgba(13,122,79,.04)" : "var(--surface)",
          border: `1px solid ${borderColor}`,
          borderTop: "none",
          borderRadius: "0 0 10px 10px",
          transition: "background .15s, border-color .15s",
          minHeight: 100,
        }}
      >
        {users.length === 0 ? (
          <div style={{
            height: "100%", minHeight: 80,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--text-faint)", fontSize: 11,
            border: "1px dashed var(--border)", borderRadius: 6, margin: 4,
          }}>
            Drop here to unassign
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {users.map(u => (
              <UserDraggable key={u.id} user={u} isLead={false} onMenuClick={onMemberMenuClick} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dropdown Menus
// ─────────────────────────────────────────────────────────────────────────────
function PortalMenu({ x, y, width = 172, children }) {
  const safeLeft = Math.min(x - width, window.innerWidth - width - 8);
  const safeTop  = Math.min(y + 4, window.innerHeight - 200);
  return (
    <div
      data-menu-portal="true"
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: "fixed",
        top: safeTop,
        left: safeLeft,
        width,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        boxShadow: "0 8px 28px rgba(0,0,0,.16)",
        zIndex: 9999,
        overflow: "hidden",
        fontSize: 12,
      }}
    >
      {children}
    </div>
  );
}

function MenuItem({ icon, label, danger, disabled, onClick }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        display: "flex", alignItems: "center", gap: 9,
        width: "100%", padding: "7px 12px",
        background: "none", border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 12, textAlign: "left", fontFamily: "inherit",
        color: disabled ? "var(--text-faint)" : danger ? "var(--danger)" : "var(--text)",
        transition: "background .1s",
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = "var(--surface-alt)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
    >
      <span style={{ width: 14, textAlign: "center", opacity: 0.55, flexShrink: 0 }}>{icon}</span>
      {label}
    </button>
  );
}

function MenuLabel({ text }) {
  return (
    <div style={{ padding: "7px 12px 4px", fontSize: 10, color: "var(--text-faint)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)", marginBottom: 2 }}>
      {text}
    </div>
  );
}

function MemberMenu({ user, x, y, onRemove, onMoveToTeam, onAssignLead }) {
  return (
    <PortalMenu x={x} y={y}>
      <MenuLabel text={user.full_name || user.username} />
      <div style={{ padding: "4px 0" }}>
        <MenuItem icon="★" label="Assign as Lead"    onClick={onAssignLead}  disabled={!user.team_id} />
        <MenuItem icon="→" label="Move to Team…"     onClick={onMoveToTeam} />
        <div style={{ margin: "4px 12px", borderTop: "1px solid var(--border)" }} />
        <MenuItem icon="−" label="Remove from Team"  onClick={onRemove}      disabled={!user.team_id} danger />
      </div>
    </PortalMenu>
  );
}

function TeamMenu({ team, x, y, onEdit, onDelete, onArchive, onAssignLead, onViewActivity, onAddUser }) {
  return (
    <PortalMenu x={x} y={y}>
      <MenuLabel text={team.name} />
      <div style={{ padding: "4px 0" }}>
        <MenuItem icon="✎"  label="Edit Team"          onClick={onEdit} />
        <MenuItem icon="＋" label="Add User"           onClick={onAddUser} />
        <MenuItem icon="★"  label="Assign Team Lead"   onClick={onAssignLead} />
        <MenuItem icon="↺"  label="View Activity"      onClick={onViewActivity} />
        <MenuItem icon="⊙"  label={team.is_archived ? "Restore Team" : "Archive Team"} onClick={onArchive} />
        <div style={{ margin: "4px 12px", borderTop: "1px solid var(--border)" }} />
        <MenuItem icon="✕"  label="Delete Team"        onClick={onDelete} danger />
      </div>
    </PortalMenu>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal Shell
// ─────────────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, width = 480, children }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(10,8,6,.6)", backdropFilter: "blur(4px)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: "100%", maxWidth: width, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "0 24px 80px rgba(0,0,0,.2)", overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 20, fontWeight: 400, color: "var(--text)" }}>{title}</span>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text-dim)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal Footer
// ─────────────────────────────────────────────────────────────────────────────
function ModalFooter({ onClose, label, submitting, danger }) {
  return (
    <div style={{ padding: "12px 24px", background: "var(--surface-alt)", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
      <button type="button" onClick={onClose} style={ghostBtn}>Cancel</button>
      <button type="submit" disabled={submitting} style={{ ...primaryBtn, ...(danger ? { background: "var(--danger)" } : {}), opacity: submitting ? 0.7 : 1 }}>
        {submitting ? "Saving…" : label}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Team Form Modal (Create / Edit)
// ─────────────────────────────────────────────────────────────────────────────
function TeamFormModal({ mode, team, onSave, onClose, members = [], onAddUser }) {
  const [form,   setForm]   = useState({ name: team?.name || "", description: team?.description || "", color: team?.color || "#0d7a4f" });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form, team?.id);
    setSaving(false);
  };

  return (
    <Modal title={mode === "create" ? "New Team" : "Edit Team"} onClose={onClose} width={500}>
      <form onSubmit={handleSubmit}>
        <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 14, maxHeight: "70vh", overflowY: "auto" }}>
          <Field label="Team Name *">
            <FocusInput required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. SpEx Team" />
          </Field>
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Briefly describe the team's purpose…"
              rows={3}
              style={{ ...inputStyle, height: "auto", padding: "8px 12px", resize: "vertical", lineHeight: 1.5 }}
            />
          </Field>
          <Field label="Colour">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
                style={{ width: 34, height: 34, border: "1px solid var(--border)", borderRadius: 7, cursor: "pointer", padding: 2, background: "var(--surface)" }} />
              <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>{form.color}</span>
            </div>
          </Field>

          {mode === "edit" && team && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 6 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500, letterSpacing: "0.02em", textTransform: "uppercase" }}>
                  Team Members ({members.length})
                </span>
                <button
                  type="button"
                  onClick={() => onAddUser?.(team.id)}
                  style={{
                    background: "none", border: "none", color: "var(--accent)",
                    fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0,
                    fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4
                  }}
                >
                  + Add User
                </button>
              </div>
              
              {members.length === 0 ? (
                <div style={{
                  padding: "16px", border: "1px dashed var(--border)", borderRadius: 8,
                  textAlign: "center", color: "var(--text-faint)", fontSize: 12
                }}>
                  No members in this team yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {members.map(m => (
                    <div key={m.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "8px 10px", background: "var(--surface-alt)", borderRadius: 8, border: "1px solid var(--border)"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Avatar name={m.full_name || m.username} size={24} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                            {m.full_name || m.username} {m.id === team.team_lead_id && <span style={{ color: "#f59e0b" }}>★</span>}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "capitalize" }}>
                            {(m.role || "").replace(/_/g, " ")}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <ModalFooter onClose={onClose} label={mode === "create" ? "Create Team" : "Save Changes"} submitting={saving} />
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete Team Modal
// ─────────────────────────────────────────────────────────────────────────────
function DeleteTeamModal({ team, teams, onClose, onConfirm }) {
  const [mode,      setMode]      = useState("choose"); // choose | move | clear
  const [destId,    setDestId]    = useState("");
  const hasMembers = (team.member_count || 0) > 0;

  const handleDelete = () => {
    if (hasMembers && mode === "move" && !destId) return;
    const dest = hasMembers && mode === "move" ? parseInt(destId) : undefined;
    onConfirm(team, dest);
  };

  return (
    <Modal title="Delete Team" onClose={onClose} width={480}>
      <div style={{ padding: "18px 24px" }}>
        {/* Team summary */}
        <div style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: team.color || "var(--accent)" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{team.name}</span>
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text-dim)" }}>
            <span><strong style={{ color: "var(--text)" }}>{team.member_count || 0}</strong> members</span>
            {team.team_lead_name && <span>Lead: <strong style={{ color: "var(--text)" }}>{team.team_lead_name}</strong></span>}
          </div>
        </div>

        {hasMembers ? (
          <>
            <p style={{ fontSize: 12, color: "var(--text)", margin: "0 0 14px" }}>
              This team has <strong>{team.member_count}</strong> member{team.member_count !== 1 ? "s" : ""}. Choose what to do before deleting:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "10px 12px", border: `1px solid ${mode === "move" ? "var(--accent)" : "var(--border)"}`, borderRadius: 8, background: mode === "move" ? "var(--accent-soft)" : "transparent", transition: "all .15s" }}>
                <input type="radio" name="dm" checked={mode === "move"} onChange={() => setMode("move")} style={{ marginTop: 1, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>Move all members to another team</div>
                  {mode === "move" && (
                    <select value={destId} onChange={e => setDestId(e.target.value)}
                      style={{ ...inputStyle, height: 32, padding: "0 8px" }}>
                      <option value="">— Select destination —</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.member_count || 0} members)</option>)}
                    </select>
                  )}
                </div>
              </label>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "10px 12px", border: `1px solid ${mode === "clear" ? "var(--accent)" : "var(--border)"}`, borderRadius: 8, background: mode === "clear" ? "var(--accent-soft)" : "transparent", transition: "all .15s" }}>
                <input type="radio" name="dm" checked={mode === "clear"} onChange={() => setMode("clear")} style={{ marginTop: 1, flexShrink: 0 }} />
                <div style={{ fontSize: 12, color: "var(--text)" }}>
                  <strong>Remove all members</strong>
                  <span style={{ color: "var(--text-faint)" }}> — they will appear in Unassigned</span>
                </div>
              </label>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>
            This team is empty. It will be permanently deleted.
          </p>
        )}
      </div>
      <div style={{ padding: "12px 24px", background: "var(--surface-alt)", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
        <button
          onClick={handleDelete}
          disabled={hasMembers && mode === "move" && !destId}
          style={{ ...primaryBtn, background: "var(--danger)", opacity: (hasMembers && mode === "move" && !destId) ? 0.45 : 1 }}
        >
          {hasMembers && mode === "move" ? "Move & Delete" : "Delete Team"}
        </button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Move to Team Dialog
// ─────────────────────────────────────────────────────────────────────────────
function MoveToTeamDialog({ currentTeamId, teams, onConfirm, onClose }) {
  const [sel, setSel] = useState("");
  const opts = teams.filter(t => t.id !== currentTeamId);
  return (
    <Modal title="Move to Team" onClose={onClose} width={400}>
      <div style={{ padding: "18px 24px" }}>
        <Field label="Destination Team">
          <select value={sel} onChange={e => setSel(e.target.value)} style={{ ...inputStyle, height: 36, padding: "0 10px" }}>
            <option value="">— Select team —</option>
            {opts.map(t => <option key={t.id} value={t.id}>{t.name} ({t.member_count || 0} members)</option>)}
          </select>
        </Field>
      </div>
      <div style={{ padding: "12px 24px", background: "var(--surface-alt)", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
        <button onClick={() => sel && onConfirm(parseInt(sel))} disabled={!sel} style={{ ...primaryBtn, opacity: sel ? 1 : 0.5 }}>Move Member</button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Assign Lead Dialog
// ─────────────────────────────────────────────────────────────────────────────
function AssignLeadDialog({ team, members, onConfirm, onClose }) {
  const [selectedIds, setSelectedIds] = useState(() => {
    if (team.team_leads && team.team_leads.length > 0) {
      return team.team_leads.map(l => l.id);
    }
    return team.team_lead_id ? [team.team_lead_id] : [];
  });

  const toggleSelect = (memberId) => {
    setSelectedIds(prev => 
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  return (
    <Modal title={`Assign Lead — ${team.name}`} onClose={onClose} width={420}>
      <div style={{ padding: "18px 24px" }}>
        <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "0 0 16px" }}>
          {members.length === 0
            ? "This team has no members yet."
            : "Select one or more team members to appoint as Team Lead(s):"}
        </p>
        {members.length > 0 && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            maxHeight: 240,
            overflowY: "auto",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 12,
            background: "var(--surface-alt)"
          }}>
            {members.map(m => {
              const isChecked = selectedIds.includes(m.id);
              return (
                <label key={m.id} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: isChecked ? "rgba(13,122,79,0.06)" : "var(--surface)",
                  border: `1px solid ${isChecked ? "var(--accent)" : "var(--border)"}`,
                  transition: "background 0.15s, border-color 0.15s"
                }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSelect(m.id)}
                    style={{ accentColor: "var(--accent)", width: 15, height: 15 }}
                  />
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                      {m.full_name || m.username}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "capitalize" }}>
                      {(m.role || "").replace(/_/g, " ")}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>
      <div style={{ padding: "12px 24px", background: "var(--surface-alt)", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
        <button
          onClick={() => onConfirm(team.id, selectedIds)}
          disabled={members.length === 0}
          style={{ ...primaryBtn, opacity: members.length === 0 ? 0.5 : 1 }}
        >
          Assign Lead(s)
        </button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity Log Modal
// ─────────────────────────────────────────────────────────────────────────────
const ACTION_LABEL = {
  member_moved:   "moved",
  member_removed: "removed",
  member_added:   "added",
  lead_assigned:  "assigned lead",
  team_renamed:   "renamed",
  team_deleted:   "deleted",
  team_archived:  "archived",
  team_created:   "created",
};

function ActivityLogModal({ teamName, logs, loading, onClose }) {
  return (
    <Modal title={`Activity — ${teamName}`} onClose={onClose} width={520}>
      <div style={{ maxHeight: 440, overflowY: "auto", padding: "12px 24px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "36px 0", color: "var(--text-faint)", fontSize: 12 }}>Loading…</div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 0", color: "var(--text-faint)", fontSize: 12 }}>No activity recorded yet</div>
        ) : (
          logs.map((log, i) => (
            <div key={log.id} style={{
              display: "flex", gap: 12, padding: "10px 0",
              borderBottom: i < logs.length - 1 ? "1px solid var(--border)" : "none",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", marginTop: 6, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>
                  <strong>{log.actor_name || "System"}</strong>
                  {" "}
                  <span style={{ color: "var(--text-dim)" }}>{ACTION_LABEL[log.action_type] || log.action_type}</span>
                  {log.user_name && <> <strong>{log.user_name}</strong></>}
                  {log.source_name && log.dest_name && (
                    <span style={{ color: "var(--text-faint)" }}> · {log.source_name} → {log.dest_name}</span>
                  )}
                </div>
                {log.notes && (
                  <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{log.notes}</div>
                )}
                <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 3 }}>
                  {new Date(log.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div style={{ padding: "12px 24px", background: "var(--surface-alt)", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
        <button onClick={onClose} style={ghostBtn}>Close</button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared small helpers
// ─────────────────────────────────────────────────────────────────────────────
function SearchBox({ value, onChange, placeholder }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 7, padding: "0 10px", height: 30, minWidth: 200 }}>
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="var(--text-faint)" strokeWidth="1.6" strokeLinecap="round"><circle cx="5" cy="5" r="4"/><path d="M9 9l2 2"/></svg>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ border: "none", outline: "none", fontSize: 12, background: "none", color: "var(--text)", fontFamily: "inherit", width: "100%" }} />
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500, letterSpacing: "0.02em" }}>{label}</span>
      {children}
    </label>
  );
}

function FocusInput({ value, onChange, placeholder, required, type = "text" }) {
  const [f, setF] = useState(false);
  return (
    <input type={type} value={value} required={required} placeholder={placeholder} onChange={onChange}
      onFocus={() => setF(true)} onBlur={() => setF(false)}
      style={{ ...inputStyle, borderColor: f ? "var(--accent)" : "var(--border)", boxShadow: f ? "0 0 0 3px var(--accent-soft)" : "none" }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Style constants
// ─────────────────────────────────────────────────────────────────────────────
const inputStyle = {
  height: 36, padding: "0 12px",
  border: "1px solid var(--border)", borderRadius: 8,
  background: "var(--surface)", color: "var(--text)",
  fontSize: 13, fontFamily: "var(--font-sans)",
  outline: "none", width: "100%", boxSizing: "border-box",
  transition: "border-color .15s, box-shadow .15s",
};

const primaryBtn = {
  display: "inline-flex", alignItems: "center", gap: 4,
  background: "var(--accent)", border: "none", color: "#fff",
  padding: "7px 14px", borderRadius: 7,
  fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
};

const ghostBtn = {
  background: "var(--surface)", border: "1px solid var(--border)",
  color: "var(--text)", fontSize: 12, fontWeight: 500,
  padding: "7px 14px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit",
};

const chip = {
  background: "var(--surface)", border: "1px solid var(--border)",
  color: "var(--text-dim)", fontSize: 11, padding: "3px 9px",
  borderRadius: 5, cursor: "pointer", fontFamily: "inherit",
  transition: "all .1s",
};

const chipActive = {
  background: "var(--accent)", borderColor: "var(--accent)", color: "#fff",
};
