import React from 'react';

export function StatSkeleton() {
  return (
    <div className="stat-card skeleton-card">
      <div className="skeleton skeleton-text-sm" />
      <div className="skeleton skeleton-value" />
    </div>
  );
}

export function TicketListSkeleton({ count = 4 }) {
  return (
    <div className="ticket-list">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="ticket-item skeleton-ticket">
          <div className="t-info">
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-id" />
          </div>
          <div className="skeleton skeleton-badge" />
          <div className="skeleton skeleton-badge" />
          <div className="skeleton skeleton-date" />
          <div className="skeleton skeleton-actions" />
        </div>
      ))}
    </div>
  );
}

export default TicketListSkeleton;
