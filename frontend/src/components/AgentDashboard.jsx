import React, { useMemo } from 'react';
import { FaTasks, FaUserCheck, FaExclamationTriangle, FaClock } from 'react-icons/fa';
import AnalyticsCharts from './AnalyticsCharts';
import TicketTable from './TicketTable';
import EmptyState from './EmptyState';
import { TicketListSkeleton } from './TicketSkeleton';

export default function AgentDashboard({
  tickets,
  loading,
  onEdit,
  onDelete,
  onView,
  userRole,
  currentUsername,
  assignedFilter,
  onAssignedFilterChange,
  searchTerm,
  onSearchChange,
  filterCategory,
  onCategoryChange,
}) {
  const myAssigned = useMemo(
    () => tickets.filter((t) => t.assigned_to === currentUsername),
    [tickets, currentUsername]
  );
  const unassigned = useMemo(
    () => tickets.filter((t) => !t.assigned_to),
    [tickets]
  );
  const critical = useMemo(
    () => tickets.filter((t) => t.priority === 'Critical' && t.status?.toLowerCase() !== 'closed'),
    [tickets]
  );
  const inProgress = useMemo(
    () => tickets.filter((t) => t.status?.toLowerCase() === 'in progress'),
    [tickets]
  );

  const displayed = useMemo(() => {
    if (assignedFilter === 'my') {
      return tickets.filter((t) => t.assigned_to === currentUsername);
    }
    if (assignedFilter === 'unassigned') {
      return tickets.filter((t) => !t.assigned_to);
    }
    return tickets;
  }, [tickets, assignedFilter, currentUsername]);

  const filtered = useMemo(() => {
    let result = displayed;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (t) => t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
      );
    }
    if (filterCategory !== 'All Categories') {
      result = result.filter((t) => t.category === filterCategory);
    }
    return result;
  }, [displayed, searchTerm, filterCategory]);

  return (
    <>
      <div className="agent-banner">
        <FaTasks />
        <div>
          <strong>Agent Workspace</strong>
          <p>Manage assigned tickets, triage the queue, and resolve issues.</p>
        </div>
      </div>

      <div className="stats-grid stats-grid-agent">
        <div className="stat-card">
          <span className="stat-title"><FaUserCheck /> Assigned</span>
          <span className="stat-value" style={{ color: '#60a5fa' }}>{myAssigned.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-title"><FaClock /> Unassigned</span>
          <span className="stat-value" style={{ color: '#facc15' }}>{unassigned.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-title"><FaExclamationTriangle /> Critical Open</span>
          <span className="stat-value" style={{ color: '#ef4444' }}>{critical.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-title">In Progress</span>
          <span className="stat-value" style={{ color: '#22d3ee' }}>{inProgress.length}</span>
        </div>
      </div>

      <AnalyticsCharts tickets={tickets} />

      <div className="content-area">
        <div className="content-header">
          <h2 style={{ margin: 0 }}>Ticket Queue</h2>
          <div className="filter-row">
            <div className="assigned-filter">
              <button
                className={`filter-chip ${assignedFilter === 'all' ? 'active' : ''}`}
                onClick={() => onAssignedFilterChange('all')}
              >All</button>
              <button
                className={`filter-chip ${assignedFilter === 'my' ? 'active' : ''}`}
                onClick={() => onAssignedFilterChange('my')}
              >My Assigned</button>
              <button
                className={`filter-chip ${assignedFilter === 'unassigned' ? 'active' : ''}`}
                onClick={() => onAssignedFilterChange('unassigned')}
              >Unassigned</button>
            </div>
            <div className="search-filter-bar">
              <input type="search" placeholder="Search..." value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} />
              <select value={filterCategory} onChange={(e) => onCategoryChange(e.target.value)}>
                <option value="All Categories">All Categories</option>
                <option value="Bug">Bug</option>
                <option value="Feedback">Feedback</option>
                <option value="Feature Request">Feature Request</option>
                <option value="support">Support</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <TicketListSkeleton count={4} />
        ) : filtered.length === 0 ? (
          <EmptyState variant={assignedFilter === 'my' ? 'assigned' : searchTerm ? 'search' : 'default'} />
        ) : (
          <TicketTable
            tickets={filtered}
            onEdit={onEdit}
            onDelete={onDelete}
            onView={onView}
            userRole={userRole}
            showAssignee
          />
        )}
      </div>
    </>
  );
}
