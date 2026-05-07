import { useDroppable } from '@dnd-kit/core';

export function TeamCard({ team, members }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `team-${team.id}`,
    data: { team }
  });

  return (
    <div style={{
      background: "var(--surface)",
      border: `1px solid ${isOver ? "var(--accent)" : "var(--border)"}`,
      borderRadius: 12,
      overflow: "hidden",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      transition: "border-color .2s",
    }}>
      {/* Card header */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: isOver ? "var(--accent-soft)" : "var(--surface)",
        transition: "background .2s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
          <span style={{
            width: 9, height: 9, borderRadius: "50%",
            background: team.color || "var(--accent)",
            flexShrink: 0,
          }} />
          {team.name}
        </div>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          background: "var(--surface-alt)",
          color: "var(--text-dim)",
          padding: "2px 7px",
          borderRadius: 6,
          border: "1px solid var(--border)",
        }}>
          {members.length}
        </span>
      </div>

      {/* Droppable body */}
      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          padding: "12px 16px",
          minHeight: 160,
          background: isOver ? "rgba(52,211,153,0.04)" : "transparent",
          transition: "background .2s",
        }}
      >
        {members.length === 0 ? (
          <div style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-faint)",
            fontSize: 12,
          }}>
            No members
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {members.map((member) => (
              <div key={member.id} className="team-member-item">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: "var(--surface-alt)",
                    color: "var(--text-dim)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 600, flexShrink: 0,
                  }}>
                    {(member.full_name || member.username || "?")[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {member.full_name || member.username}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "capitalize" }}>
                      {member.role}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
