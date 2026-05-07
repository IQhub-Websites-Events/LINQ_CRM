import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

export function UserDraggable({ user }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `user-${user.id}`,
    data: { user }
  });

  const getInitials = (name) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.45 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: isDragging ? 1000 : 1,
      }}
      {...listeners}
      {...attributes}
      className="user-draggable-card"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="avatar-initials">
          {getInitials(user.full_name || user.username || '?')}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="user-name">{user.full_name || user.username}</div>
          <div className="user-role">{user.role}</div>
        </div>
        {user.assigned_events?.length > 0 && (
          <div className="event-count-badge">{user.assigned_events.length}</div>
        )}
      </div>
    </div>
  );
}
