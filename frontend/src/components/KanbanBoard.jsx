import React from 'react';
import { format } from 'date-fns';
import { FaEye, FaEdit, FaImage, FaTrash } from 'react-icons/fa';
import ticketService, { getPriorityClass } from '../services/ticketService.js';
import SlaTimer from './SlaTimer';

const KanbanBoard = ({ tickets, onEdit, onDelete, onView }) => {
  const columns = ['Open', 'In Progress', 'Closed'];

  const handleDragStart = (e, ticketId) => {
    e.dataTransfer.setData('text/plain', ticketId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('kanban-column-dragover');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('kanban-column-dragover');
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    e.currentTarget.classList.remove('kanban-column-dragover');
    const ticketId = e.dataTransfer.getData('text/plain');
    if (!ticketId) return;

    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket || ticket.status.toLowerCase() === newStatus.toLowerCase()) return;

    try {
      await ticketService.updateTicket(ticketId, { status: newStatus });
    } catch (err) {
      console.error('Failed to update ticket status:', err);
    }
  };

  const getCategoryClass = (category) => {
    const lower = category?.toLowerCase() || '';
    if (lower.includes('bug')) return 'badge-bug';
    if (lower.includes('feature')) return 'badge-feature';
    return 'badge-feedback';
  };

  return (
    <div className="kanban-board">
      {columns.map((status) => {
        const columnTickets = tickets.filter((t) => t.status?.toLowerCase() === status.toLowerCase());

        return (
          <div
            key={status}
            className="kanban-column"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status)}
          >
            <div className="kanban-column-header">
              <h3>{status}</h3>
              <span className="kanban-count">{columnTickets.length}</span>
            </div>

            <div className="kanban-cards">
              {columnTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="kanban-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, ticket.id)}
                  onClick={() => onView(ticket)}
                  style={{ 
                    cursor: 'pointer',
                    borderTop: `4px solid ${
                      ticket.priority?.toLowerCase() === 'critical' ? '#ef4444' : 
                      ticket.priority?.toLowerCase() === 'high' ? '#fb923c' : 
                      ticket.priority?.toLowerCase() === 'low' ? '#94a3b8' : '#60a5fa'
                    }` 
                  }}
                >
                  <div className="kanban-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '6px', overflow: 'hidden' }}>
                      <span className={`badge ${getCategoryClass(ticket.category)}`} style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{ticket.category}</span>
                      <span className={`badge priority-badge ${getPriorityClass(ticket.priority)}`} style={{ flexShrink: 0 }}>
                        {ticket.priority || 'Medium'}
                      </span>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <SlaTimer deadline={ticket.sla_deadline} isBreached={ticket.is_sla_breached} status={ticket.status} created={ticket.created} />
                    </div>
                  </div>

                  <div className="kanban-card-title">
                    {ticket.title}
                    {ticket.attachments && ticket.attachments.length > 0 && <FaImage style={{ marginLeft: '8px', color: 'var(--text-tertiary)', flexShrink: 0 }} size={14} title="Attachments" />}
                  </div>

                  <div className="kanban-card-footer">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ 
                        width: '32px', 
                        height: '32px', 
                        borderRadius: '50%', 
                        background: 'linear-gradient(135deg, #6366f1, #a855f7)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: '600',
                        fontSize: '0.8rem',
                        textTransform: 'uppercase',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                      }} title={ticket.assigned_to || ticket.owner_username || 'Unknown'}>
                        {(ticket.assigned_to || ticket.owner_username || 'U').charAt(0)}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="kanban-owner" style={{ color: '#f8fafc', fontWeight: '500', fontSize: '0.85rem', lineHeight: '1.2' }}>
                          {ticket.assigned_to || ticket.owner_username || 'Unknown'}
                        </span>
                        <small className="t-date" style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '2px' }}>
                          {format(new Date(ticket.created), 'MMM dd')}
                        </small>
                      </div>
                    </div>
                    <div className="t-actions">
                      <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onEdit(ticket); }} title="Edit"><FaEdit /></button>
                      <button className="btn-icon delete" onClick={(e) => { e.stopPropagation(); onDelete(ticket.id); }} title="Delete"><FaTrash /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanBoard;
