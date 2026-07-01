import React, { useState, useEffect } from 'react';
import { FaEye, FaEdit, FaTrash, FaImage, FaUser, FaEllipsisV, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { format } from 'date-fns';
import ticketService, { getPriorityClass } from '../services/ticketService.js';
import EmptyState from './EmptyState';
import SlaTimer from './SlaTimer';

const TicketTable = ({ tickets, onEdit, onDelete, onView, userRole, showAssignee = false, emptyVariant = 'default' }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const ticketsPerPage = 6;

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMenuId(null);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  const totalPages = Math.ceil(tickets.length / ticketsPerPage);
  const indexOfLastTicket = currentPage * ticketsPerPage;
  const indexOfFirstTicket = indexOfLastTicket - ticketsPerPage;
  const currentTickets = tickets.slice(indexOfFirstTicket, indexOfLastTicket);

  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'open': return 'status-open';
      case 'in progress': return 'status-in-progress';
      case 'closed': return 'status-closed';
      default: return '';
    }
  };

  const getCategoryClass = (category) => {
    const lower = (category || '').toLowerCase();
    if (lower.includes('bug')) return 'badge-bug';
    if (lower.includes('feature')) return 'badge-feature';
    return 'badge-feedback';
  };

  if (tickets.length === 0) {
    return <EmptyState variant={emptyVariant} />;
  }

  return (
    <>
      <div className={`ticket-list ${showAssignee ? 'ticket-list-wide' : ''}`}>
        {currentTickets.map((ticket) => (
          <div className="ticket-item" key={ticket.id} onClick={() => onView(ticket)}>
            <div className="t-info">
              <div className="t-title">
                {ticket.title}
                {ticket.attachments && ticket.attachments.length > 0 && (
                  <span style={{ marginLeft: '8px', color: 'var(--text-tertiary)' }} title="Attachments">
                    <FaImage size={14} />
                  </span>
                )}
              </div>
              <div className="t-id">ID: {ticket.id.slice(-8)}</div>
            </div>

            <div>
              <span className={`badge ${getCategoryClass(ticket.category)}`}>{ticket.category}</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
              <span className={`badge priority-badge ${getPriorityClass(ticket.priority)}`}>
                {ticket.priority || 'Medium'}
              </span>
              <SlaTimer deadline={ticket.sla_deadline} isBreached={ticket.is_sla_breached} status={ticket.status} created={ticket.created} />
            </div>

            <div>
              <span className={`badge ${getStatusClass(ticket.status)}`}>{ticket.status}</span>
              {ticket.csat_rating && (
                <span style={{ marginLeft: '8px', color: '#eab308', fontSize: '0.9rem' }} title={`CSAT: ${ticket.csat_rating}/5 - ${ticket.csat_feedback || 'No feedback'}`}>
                  {'★'.repeat(ticket.csat_rating)}{'☆'.repeat(5 - ticket.csat_rating)}
                </span>
              )}
            </div>

            {showAssignee && (
              <div className="t-assignee">
                {ticket.assigned_to ? (
                  <><FaUser size={11} /> {ticket.assigned_to}</>
                ) : (
                  <span className="unassigned-label">Unassigned</span>
                )}
              </div>
            )}

            <div className="t-date">{format(new Date(ticket.created), 'MMM dd, yyyy')}</div>

            <div className="t-actions" style={{ position: 'relative' }}>
              <button 
                className="btn-icon" 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setActiveMenuId(activeMenuId === ticket.id ? null : ticket.id); 
                }} 
                title="Options"
              >
                <FaEllipsisV size={14} />
              </button>
              
              {activeMenuId === ticket.id && (
                <div className="dropdown-menu">
                  <button 
                    className="dropdown-item" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      onEdit(ticket); 
                      setActiveMenuId(null); 
                    }}
                  >
                    <FaEdit style={{ marginRight: '8px' }} /> Edit
                  </button>
                  {userRole === 'admin' && (
                    <button 
                      className="dropdown-item delete" 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        onDelete(ticket.id); 
                        setActiveMenuId(null); 
                      }}
                    >
                      <FaTrash style={{ marginRight: '8px' }} /> Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pagination" style={{ alignItems: 'center', gap: '1rem' }}>
          <button
            className="page-btn"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{ 
              opacity: currentPage === 1 ? 0.3 : 1, 
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            <FaChevronLeft />
          </button>
          
          <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Page <span style={{ color: 'var(--accent-blue)' }}>{currentPage}</span> of {totalPages}
          </span>
          
          <button
            className="page-btn"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{ 
              opacity: currentPage === totalPages ? 0.3 : 1, 
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            <FaChevronRight />
          </button>
        </div>
      )}
    </>
  );
};

export default TicketTable;
