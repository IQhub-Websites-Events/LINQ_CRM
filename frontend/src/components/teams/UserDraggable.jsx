import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Avatar } from "../ui/Avatar";

const STATUS_DOT = { active: "#22c55e", inactive: "#94a3b8", suspended: "#ef4444" };

export function UserDraggable({ user, isLead, onMenuClick }) {
  const [hovered, setHovered] = useState(false);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `user-${user.id}`,
    data: { user },
  });

  const dotColor = STATUS_DOT[user.status] || "#94a3b8";
  const displayName = user.full_name || user.username || "?";

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.35 : 1,
        zIndex: isDragging ? 1000 : 1,
        position: "relative",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        {...listeners}
        {...attributes}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "6px 7px",
          borderRadius: 6,
          background: hovered ? "var(--surface-alt)" : "transparent",
          cursor: isDragging ? "grabbing" : "grab",
          transition: "background .1s",
          userSelect: "none",
        }}
      >
        {/* Drag dots */}
        <span style={{
          fontSize: 10,
          color: hovered ? "var(--text-faint)" : "transparent",
          flexShrink: 0,
          lineHeight: 1,
          transition: "color .1s",
          letterSpacing: "-1px",
        }}>⠿</span>

        <Avatar name={displayName} size={26} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: 1.3,
          }}>
            {displayName}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "capitalize", lineHeight: 1.2 }}>
            {user.custom_role_label || (user.role || "").replace(/_/g, " ")}
          </div>
        </div>

        {/* Status dot */}
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: dotColor, flexShrink: 0,
        }} />

        {/* Event count */}
        {(user.assigned_events_count > 0) && (
          <span style={{
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            color: "var(--text-faint)",
            background: "var(--surface-alt)",
            border: "1px solid var(--border)",
            padding: "1px 5px",
            borderRadius: 4,
            flexShrink: 0,
          }}>
            {user.assigned_events_count}e
          </span>
        )}

        {/* Lead star */}
        {isLead && (
          <span style={{ color: "#f59e0b", fontSize: 11, flexShrink: 0, lineHeight: 1 }}>★</span>
        )}

        {/* Actions button */}
        <button
          data-menu-portal="true"
          onMouseDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation();
            onMenuClick(user.id, e.currentTarget.getBoundingClientRect());
          }}
          style={{
            width: 22, height: 22,
            border: "none",
            background: hovered ? "var(--surface)" : "transparent",
            borderRadius: 4,
            cursor: "pointer",
            color: hovered ? "var(--text-dim)" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, lineHeight: 1,
            transition: "background .1s, color .1s",
            flexShrink: 0,
          }}
        >⋯</button>
      </div>
    </div>
  );
}
