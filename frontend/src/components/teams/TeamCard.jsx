import { useDroppable } from "@dnd-kit/core";
import { UserDraggable } from "./UserDraggable";

export function TeamCard({ team, members, onTeamMenuClick, onMemberMenuClick }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `team-${team.id}`,
    data: { team },
  });

  const borderColor = isOver ? "var(--accent)" : "var(--border)";

  return (
    <div style={{
      width: 248,
      flexShrink: 0,
      height: "100%",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Column header */}
      <div style={{
        padding: "10px 12px",
        background: "var(--surface)",
        border: `1px solid ${borderColor}`,
        borderBottom: "none",
        borderRadius: "10px 10px 0 0",
        transition: "border-color .15s",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          marginBottom: team.team_lead_name ? 5 : 0,
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text)",
            overflow: "hidden",
            minWidth: 0,
          }}>
            <span style={{
              width: 9, height: 9, borderRadius: "50%",
              background: team.color || "var(--accent)",
              flexShrink: 0,
            }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {team.name}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <span style={{
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              background: "var(--surface-alt)",
              border: "1px solid var(--border)",
              color: "var(--text-faint)",
              padding: "2px 6px",
              borderRadius: 5,
            }}>
              {members.length}
            </span>
            <button
              data-menu-portal="true"
              onMouseDown={e => e.stopPropagation()}
              onClick={e => {
                e.stopPropagation();
                onTeamMenuClick(team.id, e.currentTarget.getBoundingClientRect());
              }}
              style={{
                width: 24, height: 24,
                border: "none",
                background: "none",
                cursor: "pointer",
                color: "var(--text-faint)",
                borderRadius: 5,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, lineHeight: 1,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text-faint)"; }}
            >⋯</button>
          </div>
        </div>

        {/* Team lead indicator */}
        {team.team_lead_name && (
          <div style={{
            fontSize: 10,
            color: "var(--text-faint)",
            display: "flex",
            alignItems: "center",
            gap: 4,
            paddingLeft: 16,
          }}>
            <span style={{ color: "#f59e0b", fontSize: 10 }}>★</span>
            <span>{team.team_lead_name}</span>
          </div>
        )}
      </div>

      {/* Droppable body */}
      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "6px",
          background: isOver ? "rgba(13,122,79,.04)" : "var(--surface)",
          border: `1px solid ${borderColor}`,
          borderTop: "none",
          borderRadius: "0 0 10px 10px",
          transition: "background .15s, border-color .15s",
          minHeight: 100,
        }}
      >
        {members.length === 0 ? (
          <div style={{
            height: "100%",
            minHeight: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-faint)",
            fontSize: 11,
            border: "1px dashed var(--border)",
            borderRadius: 6,
            margin: 4,
          }}>
            Drop members here
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {members.map(member => (
              <UserDraggable
                key={member.id}
                user={member}
                isLead={member.id === team.team_lead_id}
                onMenuClick={onMemberMenuClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
