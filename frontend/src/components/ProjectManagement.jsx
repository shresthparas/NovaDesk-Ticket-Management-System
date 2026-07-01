import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import ticketService from '../services/ticketService';
import { useToast } from '../context/ToastContext';
import { FaPlus, FaUsers, FaFolderOpen, FaTimes, FaUser } from 'react-icons/fa';

Modal.setAppElement('#root');

const ProjectManagement = ({ userRole, tickets = [], onJoinClick }) => {
  const { toast } = useToast();
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const renderMemberAvatars = (members = []) => {
    return (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {members.slice(0, 3).map((member, i) => (
          <div 
            key={member} 
            title={member}
            style={{ 
              width: '22px', 
              height: '22px', 
              borderRadius: '50%', 
              background: i % 2 === 0 ? 'var(--accent-gradient)' : 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontSize: '0.65rem', 
              fontWeight: 800, 
              color: 'white', 
              border: '2px solid #121214',
              marginLeft: i > 0 ? '-6px' : '0',
              zIndex: 10 - i,
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              textTransform: 'uppercase'
            }}
          >
            {member.slice(0, 2)}
          </div>
        ))}
        {members.length > 3 && (
          <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginLeft: '4px', fontWeight: 700 }}>+{members.length - 3}</span>
        )}
      </div>
    );
  };
  const [selectedMembers, setSelectedMembers] = useState([]);
  
  // Modal states for project details
  const [selectedProject, setSelectedProject] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    fetchProjects();
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await ticketService.getProjects();
      setProjects(res.data);
    } catch {
      toast.error('Failed to load projects.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await ticketService.getAgents();
      setAvailableUsers(res.data);
    } catch (e) {
      console.error('Failed to load users for project management', e);
    }
  };

  const toggleMemberSelection = (username) => {
    if (selectedMembers.includes(username)) {
      setSelectedMembers(selectedMembers.filter(m => m !== username));
    } else {
      setSelectedMembers([...selectedMembers, username]);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await ticketService.createProject({
        name: name.trim(),
        description: description.trim(),
        members: selectedMembers,
      });
      toast.success('Project created successfully!');
      setName('');
      setDescription('');
      setSelectedMembers([]);
      fetchProjects();
    } catch {
      toast.error('Failed to create project.');
    }
  };

  const handleCardClick = (proj) => {
    setSelectedProject(proj);
    setIsDetailsModalOpen(true);
  };

  return (
    <div className="project-management-container" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem 0' }}>
      
      {/* Single Unified Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: '700', margin: 0, color: 'var(--text-pure)' }}>
          Projects
        </h2>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {isAdmin && (
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="btn-top btn-top-primary"
            >
              <FaPlus /> Create Project
            </button>
          )}
          <button 
            onClick={onJoinClick}
            className="btn-top btn-top-secondary"
          >
            <FaPlus /> Join Project
          </button>
        </div>
      </div>

      {/* Projects List Grid */}
      <div className="projects-list-container" style={{ width: '100%', paddingTop: '1rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: '600', marginBottom: '1.5rem', marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
          <FaFolderOpen style={{ color: 'var(--accent-purple)' }} /> Active Projects
        </h3>
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div className="spinner" style={{ border: '3px solid rgba(255,255,255,0.05)', borderTop: '3px solid var(--accent-blue)', borderRadius: '50%', width: '30px', height: '30px', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }}></div>
            Loading projects...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', width: '100%' }}>
            {projects.map((proj, idx) => {
              const borderGradients = [
                'linear-gradient(to bottom, #3b82f6, #6366f1)',
                'linear-gradient(to bottom, #8b5cf6, #d946ef)',
                'linear-gradient(to bottom, #06b6d4, #3b82f6)',
                'linear-gradient(to bottom, #ec4899, #f43f5e)',
                'linear-gradient(to bottom, #f59e0b, #eab308)'
              ];
              const cardAccent = borderGradients[idx % borderGradients.length];
              return (
                <div 
                  key={proj.project_id} 
                  className="project-card" 
                  onClick={() => handleCardClick(proj)}
                  style={{ '--card-accent': cardAccent, cursor: 'pointer', padding: '1.25rem', border: '1px solid var(--border-subtle)', borderRadius: '12px', background: 'rgba(255,255,255,0.02)' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                      Code: {proj.project_id}
                    </span>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0, color: 'var(--text-pure)' }}>
                      {proj.name}
                    </h3>
                  </div>
                  
                  {(() => {
                    const projTickets = tickets.filter(t => t.project_id === proj.project_id);
                    const closedCount = projTickets.filter(t => t.status?.toLowerCase() === 'closed').length;
                    const percent = projTickets.length > 0 ? Math.round((closedCount / projTickets.length) * 100) : 0;
                    return (
                      <>
                        {projTickets.length > 0 && (
                          <div style={{ marginTop: '0.75rem', width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 500 }}>
                              <span>Progress</span>
                              <span>{percent}%</span>
                            </div>
                            <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${percent}%`, height: '100%', background: cardAccent, borderRadius: '3px', transition: 'width 0.3s ease' }}></div>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', marginTop: '1rem', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <FaUsers size={14} style={{ color: 'var(--text-tertiary)' }} />
                      <span><strong>{proj.members?.length || 0}</strong> members</span>
                    </div>
                    {renderMemberAvatars(proj.members)}
                  </div>
                </div>
              );
            })}
            {projects.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '5rem 2rem', textAlign: 'center', border: '2px dashed var(--border-subtle)', borderRadius: '12px', color: 'var(--text-tertiary)', background: 'rgba(0, 0, 0, 0.1)' }}>
                <FaFolderOpen size={40} style={{ marginBottom: '1rem', color: 'var(--text-tertiary)', opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: '600' }}>No active projects</p>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>Create a project to get started.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {isAdmin && (
        <Modal
          isOpen={isCreateModalOpen}
          onRequestClose={() => setIsCreateModalOpen(false)}
          contentLabel="Create New Project"
          className="modal-content"
          overlayClassName="modal-overlay"
        >
          <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '700', margin: 0, color: 'var(--text-pure)' }}>
              Create New Project
            </h2>
            <button onClick={() => setIsCreateModalOpen(false)} className="modal-close-button" style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaTimes size={16} /></button>
          </div>
          <form onSubmit={(e) => { handleCreateProject(e); setIsCreateModalOpen(false); }}>
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontWeight: 700, display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Project Name</label>
              <input 
                type="text" 
                className="project-input"
                placeholder="e.g. Alpha Development" 
                value={name} 
                onChange={e => setName(e.target.value)}
                required 
              />
            </div>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontWeight: 700, display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</label>
              <textarea 
                className="project-input"
                placeholder="Brief description of the project" 
                value={description} 
                onChange={e => setDescription(e.target.value)}
                rows={3}
                style={{ resize: 'none' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label style={{ fontWeight: 700, display: 'block', marginBottom: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assign Members</label>
              <div className="member-select-list" style={{ background: 'none', border: 'none', padding: 0, maxHeight: 'none' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', padding: '2px', width: '100%' }}>
                  {availableUsers.map(user => {
                    const isSelected = selectedMembers.includes(user.username);
                    return (
                      <div 
                        key={user.username}
                        onClick={() => toggleMemberSelection(user.username)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          background: isSelected ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                          border: `1px solid ${isSelected ? 'var(--accent-purple)' : 'rgba(255, 255, 255, 0.08)'}`,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          userSelect: 'none'
                        }}
                      >
                        <div style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: isSelected ? 'var(--accent-gradient)' : 'rgba(255, 255, 255, 0.1)',
                          color: 'white',
                          fontSize: '0.6rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textTransform: 'uppercase'
                        }}>
                          {user.username.slice(0, 2)}
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isSelected ? 'var(--text-pure)' : 'var(--text-secondary)' }}>
                          {user.username}
                        </span>
                      </div>
                    );
                  })}
                  {availableUsers.length === 0 && <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>No users found.</span>}
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                onClick={() => setIsCreateModalOpen(false)}
                className="btn btn-secondary" 
                style={{ padding: '0.75rem 1.25rem', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-submit" 
                style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700, border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', background: 'var(--accent-gradient)', color: 'white', boxShadow: '0 4px 15px rgba(139, 92, 246, 0.2)' }}
              >
                Create Project
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Project Details Modal */}
      {selectedProject && (
        <Modal
          isOpen={isDetailsModalOpen}
          onRequestClose={() => setIsDetailsModalOpen(false)}
          contentLabel="Project Details"
          className="modal-content"
          overlayClassName="modal-overlay"
          style={{
            content: {
              maxWidth: '500px',
              height: 'fit-content',
              padding: '2rem'
            }
          }}
        >
          <div className="modal-header" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-pure)' }}>
              Project Details
            </h2>
            <button onClick={() => setIsDetailsModalOpen(false)} className="modal-close-button"><FaTimes /></button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <span className="stat-title" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Project Name</span>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-pure)', margin: '0.25rem 0 0' }}>{selectedProject.name}</h3>
            </div>

            <div>
              <span className="stat-title" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Project Code</span>
              <div style={{ marginTop: '0.25rem' }}>
                <code style={{ fontSize: '0.95rem', color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.1)', padding: '0.3rem 0.6rem', borderRadius: '6px', fontWeight: '600' }}>
                  {selectedProject.project_id}
                </code>
              </div>
            </div>

            <div>
              <span className="stat-title" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Description</span>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                {selectedProject.description || 'No description provided.'}
              </p>
            </div>

            <div>
              <span className="stat-title" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '0.75rem' }}>
                Members ({selectedProject.members?.length || 0})
              </span>
              {selectedProject.members && selectedProject.members.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', padding: '2px' }}>
                  {selectedProject.members.map(member => (
                    <div 
                      key={member}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)'
                      }}
                    >
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: 'var(--accent-gradient)',
                        color: 'white',
                        fontSize: '0.6rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textTransform: 'uppercase'
                      }}>
                        {member.slice(0, 2)}
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {member}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', display: 'block', padding: '0.75rem 1rem', border: '1px solid var(--border-subtle)', borderRadius: '8px', background: 'rgba(0, 0, 0, 0.2)' }}>No members.</span>
              )}
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default ProjectManagement;
