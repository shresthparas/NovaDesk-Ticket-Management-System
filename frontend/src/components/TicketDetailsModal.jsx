import React, { useState } from 'react';
import Modal from 'react-modal';
import { FaTimes, FaPaperPlane, FaCloudUploadAlt, FaEdit, FaCheck, FaUserPlus } from 'react-icons/fa';
import ticketService, { getPriorityClass } from '../services/ticketService.js';
import ActivityLog from './ActivityLog';
import { format } from 'date-fns';
import { useToast } from '../context/ToastContext';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import SlaTimer from './SlaTimer';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', padding: '20px', background: 'white', borderRadius: '8px', zIndex: 9999 }}>
          <h3>Ticket Details Crashed</h3>
          <p>{this.state.error?.toString()}</p>
          <pre style={{ fontSize: '11px', whiteSpace: 'pre-wrap' }}>{this.state.errorInfo?.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const TicketDetailsModal = ({ isOpen, onRequestClose, ticket, currentUsername, currentUserRole, onCommentAdded }) => {
  const [commentText, setCommentText] = useState('');
  const [quillKey, setQuillKey] = useState(0);
  const quillRef = React.useRef(null);
  const { toast } = useToast();
  const [isPrivate, setIsPrivate] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const ws = React.useRef(null);
  const typingTimeouts = React.useRef({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showActivity, setShowActivity] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isEditingSla, setIsEditingSla] = useState(false);
  const [newSlaDeadline, setNewSlaDeadline] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [agents, setAgents] = useState([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [similarTickets, setSimilarTickets] = useState([]);
  const [csatRating, setCsatRating] = useState(5);
  const [csatFeedback, setCsatFeedback] = useState('');
  const [isCsatSubmitting, setIsCsatSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen && currentUserRole === 'admin' && ticket?.id) {
      ticketService.getEligibleAssignees(ticket.id)
        .then(res => setAgents(res.data))
        .catch(err => console.error("Failed to load eligible agents", err));
    }
  }, [isOpen, currentUserRole, ticket?.id]);

  React.useEffect(() => {
    if (isOpen && ticket?.id) {
      ticketService.getSimilarTickets(ticket.id)
        .then(res => setSimilarTickets(res.data))
        .catch(err => console.error("Failed to load similar tickets", err));
    }
  }, [isOpen, ticket?.id]);

  React.useEffect(() => {
    if (isOpen && ticket) {
      const wsUrl = ticketService.BASE_URL.replace(/^http/, 'ws') + '/api/ws/tickets';
      ws.current = new WebSocket(wsUrl);
      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === 'typing' && data.ticket_id === ticket.id && data.username !== currentUsername) {
          setTypingUsers(prev => {
            if (!prev.includes(data.username)) return [...prev, data.username];
            return prev;
          });
          
          if (typingTimeouts.current[data.username]) {
            clearTimeout(typingTimeouts.current[data.username]);
          }
          
          typingTimeouts.current[data.username] = setTimeout(() => {
             setTypingUsers(prev => prev.filter(u => u !== data.username));
          }, 3000);
        }
      };
      return () => {
        if (ws.current) ws.current.close();
        // Clear any pending timeouts
        Object.values(typingTimeouts.current).forEach(clearTimeout);
      };
    }
  }, [isOpen, ticket?.id, currentUsername]);

  if (!ticket) return null;

  const handleTyping = (content) => {
    setCommentText(content);
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ event: 'typing', ticket_id: ticket.id, username: currentUsername }));
    }
  };

  const handleEditSlaToggle = () => {
    if (!isEditingSla) {
      let dateStr = ticket.sla_deadline;
      if (dateStr) {
        if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
          dateStr += 'Z';
        }
        const localDate = new Date(dateStr);
        const tzOffset = localDate.getTimezoneOffset() * 60000;
        const localISOTime = new Date(localDate - tzOffset).toISOString().slice(0, 16);
        setNewSlaDeadline(localISOTime);
      } else {
        setNewSlaDeadline('');
      }
      setIsEditingSla(true);
    } else {
      setIsEditingSla(false);
    }
  };

  const handleSaveSla = async () => {
    try {
      const targetDate = new Date(newSlaDeadline);
      const updatedTicket = await ticketService.updateTicket(ticket.id, { sla_deadline: targetDate.toISOString() });
      onCommentAdded(updatedTicket);
      setIsEditingSla(false);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update SLA');
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    const cleanText = commentText.replace(/<[^>]*>?/gm, '').trim();
    if (!cleanText && selectedFiles.length === 0) return;

    // Save current text in case we need to restore on error
    const savedText = commentText;
    const savedFiles = [...selectedFiles];
    const savedPrivate = isPrivate;

    // Clear the editor INSTANTLY for snappy UX
    if (quillRef.current) {
      const editor = quillRef.current.getEditor ? quillRef.current.getEditor() : null;
      if (editor) editor.setContents([]);
    }
    setCommentText('');
    setQuillKey(prev => prev + 1);
    setSelectedFiles([]);
    setIsPrivate(false);

    setIsSubmitting(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('text', savedText);
      formData.append('is_private', savedPrivate);
      savedFiles.forEach(f => formData.append('attachments', f));
      
      const updatedTicket = await ticketService.addComment(ticket.id, formData);
      onCommentAdded(updatedTicket);
    } catch (err) {
      // Restore the text so the user doesn't lose their message
      setCommentText(savedText);
      setSelectedFiles(savedFiles);
      setIsPrivate(savedPrivate);
      setError(err.response?.data?.detail || 'Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClaimTicket = async () => {
    try {
      const updatedTicket = await ticketService.updateTicket(ticket.id, { assigned_to: currentUsername });
      onCommentAdded(updatedTicket);
    } catch (err) {
      setError('Failed to claim ticket');
    }
  };

  const handleAssignTicket = async (newAssignee) => {
    setIsAssigning(true);
    try {
      const updatedTicket = await ticketService.updateTicket(ticket.id, { assigned_to: newAssignee || null });
      onCommentAdded(updatedTicket);
      toast.success(newAssignee ? `Ticket assigned to ${newAssignee}` : 'Ticket unassigned');
    } catch (err) {
      toast.error('Failed to reassign ticket');
    } finally {
      setIsAssigning(false);
    }
  };

  const isImageFile = (filename) => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!isClosed) setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    if (!isClosed && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  };

  const handleGenerateAiReply = async () => {
    setIsGeneratingAi(true);
    try {
      const data = await ticketService.generateAiReply(ticket.id);
      setCommentText(data.reply);
    } catch (err) {
      toast.error('Failed to generate AI reply');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleCsatSubmit = async (e) => {
    e.preventDefault();
    setIsCsatSubmitting(true);
    try {
      await ticketService.submitCSAT(ticket.id, { csat_rating: csatRating, csat_feedback: csatFeedback });
      toast.success('Thank you for your feedback!');
      const updatedTicket = await ticketService.getTicket(ticket.id);
      onCommentAdded(updatedTicket.data || updatedTicket);
    } catch (err) {
      toast.error('Failed to submit CSAT rating');
    } finally {
      setIsCsatSubmitting(false);
    }
  };

  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'open': return 'status-open';
      case 'in progress': return 'status-in-progress';
      case 'closed': return 'status-closed';
      default: return '';
    }
  };

  const isClosed = ticket.status?.toLowerCase() === 'closed';

  return (
    <Modal isOpen={isOpen} onRequestClose={onRequestClose} contentLabel="Ticket Details" className="modal-content chat-modal" overlayClassName="modal-overlay">
      <ErrorBoundary>
      <div className="modal-header-modern">
        <div className="header-left">
          <h2>{ticket.title}</h2>
          <div className="header-badges">
            <span className={`badge ${getStatusClass(ticket.status)}`}>{ticket.status}</span>
            <span className={`badge priority-badge ${getPriorityClass(ticket.priority)}`}>{ticket.priority || 'Medium'}</span>
            
            {currentUserRole === 'admin' ? (
              <select 
                value={ticket.assigned_to || ''} 
                onChange={(e) => handleAssignTicket(e.target.value)}
                className="assignee-select-modern"
                disabled={isAssigning}
              >
                <option value="">Unassigned</option>
                {agents.map(agent => (
                  <option key={agent.username} value={agent.username}>
                    Assign: {agent.username}
                  </option>
                ))}
              </select>
            ) : (
              ticket.assigned_to ? (
                <span className="badge badge-assignee">Assigned: {ticket.assigned_to}</span>
              ) : (
                <span className="badge badge-assignee unassigned">Unassigned</span>
              )
            )}
            
            <small className="ticket-id">ID: {ticket.id.slice(-8)}</small>
          </div>
        </div>
        <div className="header-right">
          <div className="header-actions">
            {isEditingSla ? (
              <div className="sla-edit-wrapper">
                <input type="datetime-local" value={newSlaDeadline} onChange={(e) => setNewSlaDeadline(e.target.value)} className="sla-input" />
                <button className="btn-icon" onClick={handleSaveSla}><FaCheck color="#34d399" /></button>
                <button className="btn-icon" onClick={handleEditSlaToggle}><FaTimes color="#ef4444" /></button>
              </div>
            ) : (
              (ticket.sla_deadline || (currentUserRole === 'admin' && ticket.status !== 'Closed' && ticket.status !== 'Resolved')) && (
                <div 
                  className={`sla-display ${currentUserRole === 'admin' && ticket.status !== 'Closed' && ticket.status !== 'Resolved' ? 'clickable' : ''}`}
                  onClick={currentUserRole === 'admin' && ticket.status !== 'Closed' && ticket.status !== 'Resolved' ? handleEditSlaToggle : undefined}
                  title={currentUserRole === 'admin' ? "Click to Edit SLA" : undefined}
                >
                  <SlaTimer deadline={ticket.sla_deadline} isBreached={ticket.is_sla_breached} status={ticket.status} created={ticket.created} />
                  {!ticket.sla_deadline && currentUserRole === 'admin' && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginRight: '2px' }}>Set SLA</span>
                  )}
                  {currentUserRole === 'admin' && ticket.status !== 'Closed' && ticket.status !== 'Resolved' && (
                    <FaEdit size={12} style={{ color: 'var(--text-secondary)' }} />
                  )}
                </div>
              )
            )}
            
            {!ticket.assigned_to && (currentUserRole === 'admin' || currentUserRole === 'agent') && (
              <button className="btn-claim" onClick={handleClaimTicket}>
                <FaUserPlus size={12} style={{ marginRight: '6px' }} /> Claim
              </button>
            )}
          </div>
          <button onClick={onRequestClose} className="btn-close-modern"><FaTimes /></button>
        </div>
      </div>

      <div className="segmented-controls">
        <button className={`segmented-tab ${!showActivity ? 'active' : ''}`} onClick={() => setShowActivity(false)}>Conversation</button>
        <button className={`segmented-tab ${showActivity ? 'active' : ''}`} onClick={() => setShowActivity(true)}>Activity ({ticket.activity_log?.length || 0})</button>
      </div>

      {showActivity ? (
        <ActivityLog activities={ticket.activity_log} />
      ) : (
        <>
          <div className="chat-container">
            <div className={`chat-message ${(ticket.owner_username || '').toLowerCase() === (currentUsername || '').toLowerCase() ? 'my-message' : 'other-message'}`}>
              <div className="chat-bubble">
                <div className="chat-meta">
                  <strong>{ticket.owner_username || 'Unknown User'}</strong>
                  <span>{format(new Date(ticket.created || Date.now()), 'MMM dd, p')}</span>
                </div>
                <div className="markdown-body" style={{ marginTop: '8px' }} dangerouslySetInnerHTML={{ __html: ticket.description || '' }} />
                {ticket.custom_fields_data && Object.keys(ticket.custom_fields_data).length > 0 && (
                  <div className="custom-fields-display">
                    <h4>Additional Information</h4>
                    <div className="custom-fields-grid">
                      {Object.entries(ticket.custom_fields_data).map(([key, val]) => (
                        <div key={key}>
                          <strong>{key}: </strong> {val}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {similarTickets && similarTickets.length > 0 && (
                  <div className="similar-tickets-display" style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Similar Tickets</h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem' }}>
                      {similarTickets.map(t => (
                        <li key={t.id} style={{ marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-primary)' }}>{t.title}</span> <span className={`badge ${getStatusClass(t.status)}`} style={{ fontSize: '0.65rem', padding: '2px 4px' }}>{t.status}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {ticket.attachments && ticket.attachments.length > 0 && (
                  <div className="attachments-list" style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {ticket.attachments.map((url, i) => (
                      isImageFile(url) ? (
                        <a key={i} href={`${ticketService.BASE_URL}${url}`} target="_blank" rel="noopener noreferrer">
                          <img src={`${ticketService.BASE_URL}${url}`} alt={`Attachment ${i+1}`} className="attachment-thumbnail" />
                        </a>
                      ) : (
                        <a key={i} href={`${ticketService.BASE_URL}${url}`} target="_blank" rel="noopener noreferrer" className="badge" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                          Attachment {i + 1}
                        </a>
                      )
                    ))}
                  </div>
                )}
              </div>
            </div>

            {ticket.comments?.map((comment, index) => {
              const isMine = (comment.author_username || '').toLowerCase() === (currentUsername || '').toLowerCase();
              const isStaff = comment.author_role === 'admin' || comment.author_role === 'agent';

              return (
                <div key={index} className={`chat-message ${isMine ? 'my-message' : 'other-message'} ${isStaff ? 'admin-message' : ''} ${comment.is_private ? 'private-message' : ''}`}>
                  <div className="chat-bubble">
                    <div className="chat-meta">
                      <strong>{comment.author_username} {isStaff && <span className="admin-badge">{comment.author_role}</span>} {comment.is_private && <span className="badge" style={{ backgroundColor: '#fff3cd', color: '#856404', marginLeft: '4px' }}>Private Note</span>}</strong>
                      <span>{format(new Date(comment.created_at || comment.created || Date.now()), 'MMM dd, p')}</span>
                    </div>
                    <div className="markdown-body" style={{ marginTop: '8px' }} dangerouslySetInnerHTML={{ __html: comment.text || '' }} />
                    {comment.attachments && comment.attachments.length > 0 && (
                      <div className="attachments-list" style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {comment.attachments.map((url, i) => (
                          isImageFile(url) ? (
                            <a key={i} href={`${ticketService.BASE_URL}${url}`} target="_blank" rel="noopener noreferrer">
                              <img src={`${ticketService.BASE_URL}${url}`} alt={`Attachment ${i+1}`} className="attachment-thumbnail" />
                            </a>
                          ) : (
                            <a key={i} href={`${ticketService.BASE_URL}${url}`} target="_blank" rel="noopener noreferrer" className="badge" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                              Attachment {i + 1}
                            </a>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {error && <div className="form-error" style={{ padding: '0 1rem' }}>{error}</div>}

          <div className="chat-input-wrapper">
            {selectedFiles.length > 0 && (
              <div className="selected-files-preview">
                {selectedFiles.map((file, i) => (
                  <span key={i} className="file-chip" style={{ position: 'relative', overflow: 'hidden' }}>
                    {isImageFile(file.name) && (
                      <img src={URL.createObjectURL(file)} alt="preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', marginRight: '8px' }} />
                    )}
                    {file.name}
                    <FaTimes style={{ cursor: 'pointer', marginLeft: '6px' }} onClick={() => {
                      const newFiles = [...selectedFiles];
                      newFiles.splice(i, 1);
                      setSelectedFiles(newFiles);
                    }} />
                  </span>
                ))}
              </div>
            )}
            
            {isClosed && (
              <div className="closed-notice-container" style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', marginTop: '16px' }}>
                <span className="closed-notice">This ticket is closed. You can no longer add comments.</span>
                {(currentUsername || '').toLowerCase() === (ticket.owner_username || '').toLowerCase() && (
                  <div className="csat-section" style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    {ticket.csat_rating ? (
                      <div>
                        <strong>Your Rating: </strong> {ticket.csat_rating} / 5 <br/>
                        {ticket.csat_feedback && <em>"{ticket.csat_feedback}"</em>}
                      </div>
                    ) : (
                      <form onSubmit={handleCsatSubmit}>
                        <h4 style={{ margin: '0 0 8px 0' }}>Rate your support experience</h4>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          {[1,2,3,4,5].map(star => (
                            <label key={star} style={{ cursor: 'pointer', fontSize: '1.5rem', color: csatRating >= star ? '#eab308' : 'var(--border-color)' }}>
                              <input type="radio" value={star} checked={csatRating === star} onChange={() => setCsatRating(star)} style={{ display: 'none' }} />
                              ★
                            </label>
                          ))}
                        </div>
                        <input type="text" placeholder="Optional feedback..." value={csatFeedback} onChange={e => setCsatFeedback(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', marginBottom: '8px' }} />
                        <button type="submit" disabled={isCsatSubmitting} className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.9rem' }}>Submit Rating</button>
                      </form>
                    )}
                  </div>
                )}
                {currentUserRole !== 'user' && ticket.csat_rating && (
                  <div className="csat-section" style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <strong>Customer Rating: </strong> {ticket.csat_rating} / 5 <br/>
                    {ticket.csat_feedback && <em>"{ticket.csat_feedback}"</em>}
                  </div>
                )}
              </div>
            )}
            
            {typingUsers.length > 0 && !isClosed && (
              <div className="typing-indicator-wrapper" style={{ marginBottom: '8px' }}>
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
                <p className="typing-indicator-text">
                  {typingUsers.join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing
                </p>
              </div>
            )}
            
            {!isClosed && (
              <form className="floating-input-form" onSubmit={handleAddComment}>
                {isGeneratingAi && (
                  <div className="ai-loader">
                    ✨ AI is drafting a response...
                  </div>
                )}
                
                <div className="chat-actions-row" style={{ display: 'flex', gap: '12px', marginBottom: '8px', padding: '0 4px', alignItems: 'center' }}>
                  <button type="button" className="btn-ai-draft" onClick={handleGenerateAiReply} disabled={isGeneratingAi} title="Draft AI Response" style={{ display: 'flex', alignItems: 'center', gap: '6px', width: 'auto', padding: '6px 12px', borderRadius: '16px' }}>
                    ✨ <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>Draft AI Reply</span>
                  </button>
                  {(currentUserRole === 'admin' || currentUserRole === 'agent') && (
                    <label className="private-note-toggle" title="Private Note">
                      <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
                      <span className="toggle-slider"></span>
                      <span className="toggle-label" style={{ fontSize: '0.85rem' }}>Private Note</span>
                    </label>
                  )}
                </div>

                <div 
                  className={`floating-input-container ${isDragActive ? 'drag-active' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <label className="btn-attach">
                    <FaCloudUploadAlt size={20} />
                    <input type="file" multiple onChange={(e) => setSelectedFiles(prev => [...prev, ...Array.from(e.target.files)])} style={{ display: 'none' }} />
                  </label>
                  
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <ReactQuill 
                      ref={quillRef}
                      key={quillKey}
                      theme="snow"
                      value={commentText} 
                      onChange={handleTyping} 
                      placeholder="Type your message..." 
                      readOnly={isGeneratingAi}
                      className="message-input quill-message-input"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (!isSubmitting && !isGeneratingAi && (commentText.replace(/<[^>]*>?/gm, '').trim() || selectedFiles.length > 0)) {
                            handleAddComment(e);
                          }
                        }
                      }}
                    />
                  </div>
                  
                  <button type="submit" disabled={isSubmitting || isGeneratingAi || (!commentText.replace(/<[^>]*>?/gm, '').trim() && selectedFiles.length === 0)} className="btn-send">
                    <FaPaperPlane />
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
      </ErrorBoundary>
    </Modal>
  );
};

export default TicketDetailsModal;
