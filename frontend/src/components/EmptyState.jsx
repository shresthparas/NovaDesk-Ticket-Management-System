import React from 'react';
import { FaInbox, FaSearch, FaUserCheck } from 'react-icons/fa';

const variants = {
  default: {
    icon: FaInbox,
    title: 'No tickets yet',
    description: 'Create your first support ticket to get started.',
  },
  search: {
    icon: FaSearch,
    title: 'No matches found',
    description: 'Try adjusting your search or filter criteria.',
  },
  assigned: {
    icon: FaUserCheck,
    title: 'No assigned tickets',
    description: 'Tickets assigned to you will appear here.',
  },
};

export default function EmptyState({ variant = 'default', action }) {
  const { icon: Icon, title, description } = variants[variant] || variants.default;

  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
