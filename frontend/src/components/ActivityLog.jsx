import React from 'react';
import { format } from 'date-fns';
import { FaHistory } from 'react-icons/fa';

const actionLabels = {
  created: 'Ticket created',
  updated: 'Field updated',
  assigned: 'Assignment changed',
  status_changed: 'Status changed',
  priority_changed: 'Priority changed',
  comment_added: 'Comment added',
};

export default function ActivityLog({ activities = [] }) {
  if (!activities.length) {
    return (
      <div className="activity-log-empty">
        <FaHistory />
        <span>No activity recorded yet.</span>
      </div>
    );
  }

  const sorted = [...activities].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  const stripHtml = (htmlString) => {
    if (!htmlString) return '';
    try {
      const doc = new DOMParser().parseFromString(htmlString, 'text/html');
      return doc.body.textContent || "";
    } catch (e) {
      return htmlString.replace(/<[^>]*>/g, '');
    }
  };

  return (
    <div className="activity-log">
      <h4><FaHistory /> Activity Log</h4>
      <ul className="activity-list">
        {sorted.map((entry, i) => {
          const isComment = entry.action === 'comment_added';
          const cleanComment = isComment ? stripHtml(entry.new_value) : '';

          return (
            <li key={i} className="activity-item">
              <div className="activity-dot" />
              <div className="activity-content">
                <div className="activity-header">
                  <strong>{actionLabels[entry.action] || entry.action}</strong>
                  <span>{format(new Date(entry.timestamp), 'MMM dd, p')}</span>
                </div>
                <p className="activity-meta">
                  by {entry.performed_by}
                  {!isComment && entry.field && entry.old_value !== undefined && (
                    <> — {entry.field}: <em>{entry.old_value || 'none'}</em> → <em>{entry.new_value || 'none'}</em></>
                  )}
                  {isComment && cleanComment && (
                    <> — "{cleanComment.length > 50 ? `${cleanComment.slice(0, 50)}…` : cleanComment}"</>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
