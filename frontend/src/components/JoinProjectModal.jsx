import React, { useState } from 'react';
import Modal from 'react-modal';
import { FaTimes, FaPlus } from 'react-icons/fa';
import ticketService from '../services/ticketService';
import { useToast } from '../context/ToastContext';

const JoinProjectModal = ({ isOpen, onRequestClose, onSuccess }) => {
  const { toast } = useToast();
  const [joinCode, setJoinCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!joinCode) {
      toast.error('Project Code is required.');
      return;
    }

    try {
      setSubmitting(true);
      await ticketService.joinProject(joinCode.trim());
      toast.success('Successfully joined project!');
      setJoinCode('');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to join project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onRequestClose={onRequestClose} 
      contentLabel="Join Project" 
      className="modal-content" 
      overlayClassName="modal-overlay"
      style={{
        content: {
          maxWidth: '400px',
          height: 'fit-content',
          padding: '2rem'
        }
      }}
    >
      <div className="modal-header" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-pure)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FaPlus style={{ color: 'var(--accent-blue)', fontSize: '1.1rem' }} /> Join Project
        </h2>
        <button onClick={onRequestClose} className="modal-close-button"><FaTimes /></button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Project Code</label>
          <input 
            type="text" 
            placeholder="e.g. PRJ-XXXXXX" 
            value={joinCode} 
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            required 
            style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-focus)', background: 'rgba(0, 0, 0, 0.3)', color: 'var(--text-pure)', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s' }}
            onFocus={e => e.target.style.borderColor = 'var(--accent-blue)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-focus)'}
          />
        </div>

        <button 
          type="submit" 
          disabled={submitting}
          className="btn-submit" 
          style={{ width: '100%', padding: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700, border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', background: 'var(--accent-gradient)', color: 'white', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.2)', transition: 'all 0.2s' }}
        >
          {submitting ? 'Joining...' : 'Join Project'}
        </button>
      </form>
    </Modal>
  );
};

export default JoinProjectModal;
