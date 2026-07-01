import React, { useState, useEffect, useCallback } from 'react';
import { FaUserShield, FaUserTie, FaUser, FaTrash, FaSearch, FaSync, FaEnvelope, FaCalendarAlt, FaExclamationTriangle, FaPlus, FaTimes } from 'react-icons/fa';
import ticketService from '../services/ticketService';
import authService from '../services/authService';
import { useToast } from '../context/ToastContext';

const ROLE_CONFIG = {
  admin: { label: 'Admin', icon: FaUserShield, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)', gradient: 'linear-gradient(135deg, #a855f7, #7c3aed)' },
  agent: { label: 'Agent', icon: FaUserTie, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)' },
  user:  { label: 'User',  icon: FaUser,       color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', gradient: 'linear-gradient(135deg, #10b981, #059669)' },
};

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #6366f1, #a855f7)',
  'linear-gradient(135deg, #f43f5e, #ec4899)',
  'linear-gradient(135deg, #f59e0b, #f97316)',
  'linear-gradient(135deg, #10b981, #14b8a6)',
  'linear-gradient(135deg, #3b82f6, #6366f1)',
  'linear-gradient(135deg, #ef4444, #f97316)',
];

const getAvatarGradient = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
};

const UsersManagement = ({ currentUsername, onlineUsers = [] }) => {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [updatingRole, setUpdatingRole] = useState(null);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('agent');
  const [createLoading, setCreateLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ticketService.getAllUsers();
      setUsers(res.data);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleRoleChange = async (username, newRole) => {
    setUpdatingRole(username);
    try {
      await ticketService.updateUserRole(username, newRole);
      setUsers(prev => prev.map(u => u.username === username ? { ...u, role: newRole } : u));
      toast.success(`${username} is now a${newRole === 'admin' ? 'n' : ''} ${newRole}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update role');
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleDelete = async (username) => {
    try {
      await ticketService.deleteUser(username);
      setUsers(prev => prev.filter(u => u.username !== username));
      setConfirmDelete(null);
      toast.success(`User "${username}" has been removed`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete user');
      setConfirmDelete(null);
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!newUsername.trim() || !newEmail.trim() || !newPassword.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    setCreateLoading(true);
    try {
      await authService.registerStaff(newUsername, newEmail, newPassword, newRole, 'NOVA2026');
      toast.success(`User ${newUsername} created as ${newRole}`);
      setShowCreateModal(false);
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('agent');
      fetchUsers();
    } catch (err) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  const filtered = users.filter(u => {
    const matchSearch = u.username.toLowerCase().includes(search.toLowerCase()) || 
                        (u.email || '').toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const roleCounts = { admin: 0, agent: 0, user: 0 };
  users.forEach(u => { if (roleCounts[u.role] !== undefined) roleCounts[u.role]++; });

  return (
    <div className="content-area" style={{ width: '100%', padding: '2rem 2.5rem' }}>
      
      {/* Header */}
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', 
        marginBottom: '2.5rem', paddingBottom: '1.5rem',
        borderBottom: '1px solid var(--border)',
      }}>
        <div>
          <h1 style={{ 
            fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem',
            background: 'linear-gradient(135deg, #a855f7, #6366f1, #3b82f6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Users & Roles
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Manage your team members, assign roles, and control access levels
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px', 
              borderRadius: '12px', background: 'linear-gradient(135deg, #a855f7, #6366f1)',
              color: 'white', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', border: 'none',
              transition: 'all 0.2s ease', boxShadow: '0 4px 15px rgba(168, 85, 247, 0.3)'
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(168, 85, 247, 0.4)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(168, 85, 247, 0.3)'; }}
          >
            <FaPlus size={13} /> Add Staff
          </button>
          <button
            onClick={fetchUsers}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px', 
              borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--text-pure)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = '#a855f7'; e.currentTarget.style.background = 'rgba(168, 85, 247, 0.08)'; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; }}
          >
            <FaSync size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Role Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
        {Object.entries(ROLE_CONFIG).map(([role, config]) => {
          const Icon = config.icon;
          const isActive = roleFilter === role;
          return (
            <div
              key={role}
              onClick={() => setRoleFilter(roleFilter === role ? 'all' : role)}
              style={{
                background: isActive 
                  ? `linear-gradient(145deg, ${config.bg}, rgba(0,0,0,0.1))` 
                  : 'linear-gradient(145deg, rgba(30, 36, 48, 0.7), rgba(18, 22, 30, 0.85))',
                border: `1px solid ${isActive ? config.color + '66' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: '16px',
                padding: '1.5rem',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                gap: '1.25rem',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: isActive 
                  ? `0 8px 30px ${config.color}22` 
                  : '0 4px 15px rgba(0,0,0,0.15)',
              }}
              onMouseOver={(e) => { 
                e.currentTarget.style.transform = 'translateY(-3px)'; 
                e.currentTarget.style.boxShadow = `0 12px 30px ${config.color}33`;
              }}
              onMouseOut={(e) => { 
                e.currentTarget.style.transform = 'translateY(0)'; 
                e.currentTarget.style.boxShadow = isActive ? `0 8px 30px ${config.color}22` : '0 4px 15px rgba(0,0,0,0.15)';
              }}
            >
              {/* Decorative background glow */}
              <div style={{
                position: 'absolute', top: '-20px', right: '-20px',
                width: '80px', height: '80px', borderRadius: '50%',
                background: config.gradient, opacity: 0.08, filter: 'blur(20px)',
              }} />
              <div style={{
                width: '52px', height: '52px', borderRadius: '14px',
                background: config.gradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 6px 20px ${config.color}44`,
                flexShrink: 0,
              }}>
                <Icon size={24} color="white" />
              </div>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-pure)', lineHeight: 1 }}>
                  {roleCounts[role]}
                </div>
                <div style={{ 
                  fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', 
                  letterSpacing: '0.08em', fontWeight: 600, marginTop: '4px',
                }}>
                  {config.label}s
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        background: 'linear-gradient(145deg, rgba(30, 36, 48, 0.7), rgba(18, 22, 30, 0.85))',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '14px', padding: '14px 20px', marginBottom: '1.5rem',
        transition: 'border-color 0.2s',
      }}>
        <FaSearch size={16} color="var(--text-tertiary)" />
        <input
          type="text"
          placeholder="Search by username or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-pure)', fontSize: '0.95rem',
          }}
        />
        {roleFilter !== 'all' && (
          <button onClick={() => setRoleFilter('all')} style={{
            background: ROLE_CONFIG[roleFilter]?.bg, color: ROLE_CONFIG[roleFilter]?.color,
            border: `1px solid ${ROLE_CONFIG[roleFilter]?.color}44`, borderRadius: '8px', 
            padding: '5px 14px', fontSize: '0.78rem',
            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            transition: 'all 0.2s',
          }}>
            {ROLE_CONFIG[roleFilter]?.label}s ✕
          </button>
        )}
        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Users as Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
          <FaSync size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem' }} />
          <div>Loading users...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
          <FaUser size={32} style={{ marginBottom: '1rem', opacity: 0.3 }} />
          <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>No users found</div>
          <div style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Try adjusting your search or filters</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map((user) => {
            const config = ROLE_CONFIG[user.role] || ROLE_CONFIG.user;
            const isSelf = user.username === currentUsername;
            const Icon = config.icon;
            return (
              <div
                key={user._id || user.username}
                style={{
                  background: 'linear-gradient(145deg, rgba(30, 36, 48, 0.7), rgba(18, 22, 30, 0.85))',
                  border: `1px solid ${isSelf ? '#a855f744' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: '16px',
                  padding: '1.25rem 1.5rem',
                  transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseOver={(e) => { 
                  e.currentTarget.style.borderColor = config.color + '44';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.2)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseOut={(e) => { 
                  e.currentTarget.style.borderColor = isSelf ? '#a855f744' : 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Subtle role indicator line at top */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                  background: config.gradient, opacity: 0.6,
                }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  {/* Avatar */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: '52px', height: '52px', borderRadius: '50%',
                      background: getAvatarGradient(user.username),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 700, fontSize: '1.2rem', textTransform: 'uppercase',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                      border: '2px solid rgba(255,255,255,0.1)',
                    }}>
                      {user.username.charAt(0)}
                    </div>
                    {onlineUsers.includes(user.username) && (
                      <div style={{
                        position: 'absolute', bottom: '-2px', right: '-2px',
                        width: '14px', height: '14px', borderRadius: '50%',
                        background: '#10b981', border: '2px solid #1e2430',
                        boxShadow: '0 0 10px rgba(16, 185, 129, 0.6)',
                        zIndex: 2
                      }} title="Online" />
                    )}
                  </div>

                  {/* User Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-pure)', fontSize: '1.05rem' }}>
                        {user.username}
                      </span>
                      {isSelf && (
                        <span style={{
                          fontSize: '0.6rem', fontWeight: 700, color: '#a855f7', letterSpacing: '0.05em',
                          background: 'rgba(168, 85, 247, 0.15)', padding: '3px 10px', borderRadius: '20px',
                          border: '1px solid rgba(168, 85, 247, 0.3)',
                        }}>YOU</span>
                      )}
                      {/* Role Badge */}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        fontSize: '0.7rem', fontWeight: 600, color: config.color,
                        background: config.bg, padding: '3px 10px', borderRadius: '20px',
                        border: `1px solid ${config.color}33`,
                      }}>
                        <Icon size={10} /> {config.label}
                      </span>
                    </div>
                    <div style={{ 
                      display: 'flex', alignItems: 'center', gap: '6px', 
                      color: 'var(--text-secondary)', fontSize: '0.85rem',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      <FaEnvelope size={11} style={{ flexShrink: 0, opacity: 0.5 }} />
                      {user.email || '—'}
                    </div>
                  </div>

                  {/* Role Selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.username, e.target.value)}
                      disabled={isSelf || updatingRole === user.username}
                      style={{
                        background: 'rgba(255,255,255,0.05)', 
                        color: 'var(--text-pure)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '10px', padding: '8px 14px',
                        fontSize: '0.85rem', fontWeight: 600, 
                        cursor: isSelf ? 'not-allowed' : 'pointer',
                        outline: 'none', width: '140px',
                        opacity: isSelf ? 0.4 : 1,
                        transition: 'border-color 0.2s',
                      }}
                    >
                      <option value="user">👤 User</option>
                      <option value="agent">🎧 Agent</option>
                      <option value="admin">🛡️ Admin</option>
                    </select>

                    {/* Delete Button */}
                    <button
                      onClick={() => !isSelf && setConfirmDelete(user.username)}
                      disabled={isSelf}
                      title={isSelf ? 'Cannot delete yourself' : `Delete ${user.username}`}
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: 'none',
                        border: '1px solid transparent',
                        cursor: isSelf ? 'not-allowed' : 'pointer',
                        color: isSelf ? 'var(--text-tertiary)' : '#ef4444',
                        opacity: isSelf ? 0.2 : 0.6,
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onMouseOver={(e) => {
                        if (!isSelf) {
                          e.currentTarget.style.opacity = '1';
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                          e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!isSelf) {
                          e.currentTarget.style.opacity = '0.6';
                          e.currentTarget.style.background = 'none';
                          e.currentTarget.style.borderColor = 'transparent';
                        }
                      }}
                    >
                      <FaTrash size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            background: 'linear-gradient(145deg, rgba(23, 27, 38, 0.98), rgba(13, 16, 23, 0.99))',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '24px',
            padding: '2.5rem',
            maxWidth: '460px',
            width: '90%',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
            textAlign: 'center',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              border: '2px solid rgba(239, 68, 68, 0.3)',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)',
            }}>
              <FaExclamationTriangle size={28} color="#ef4444" />
            </div>
            
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-pure)', marginBottom: '0.75rem' }}>
              Delete Account
            </h3>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '2.25rem' }}>
              Are you sure you want to permanently delete the account for <strong style={{ color: 'var(--text-pure)', fontWeight: 700 }}>{confirmDelete}</strong>? This action cannot be undone.
            </p>
            
            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', width: '100%' }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#94a3b8',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '12px 24px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.color = '#fff'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 24px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)',
                  transition: 'all 0.2s ease',
                }}
                onMouseOver={(e) => { e.currentTarget.style.boxShadow = '0 6px 22px rgba(239, 68, 68, 0.45)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseOut={(e) => { e.currentTarget.style.boxShadow = '0 4px 15px rgba(239, 68, 68, 0.3)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Staff Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px',
            padding: '2.5rem', width: '90%', maxWidth: '460px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)', position: 'relative'
          }}>
            <button
              onClick={() => setShowCreateModal(false)}
              style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '5px' }}
            >
              <FaTimes size={18} />
            </button>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '1.5rem', color: 'var(--text-pure)' }}>Add Staff Member</h2>
            <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Username</label>
                <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required disabled={createLoading} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text-pure)' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Email</label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required disabled={createLoading} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text-pure)' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Role</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)} disabled={createLoading} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text-pure)' }}>
                  <option value="agent">Support Agent</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required disabled={createLoading} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text-pure)' }} />
              </div>
              <button
                type="submit" disabled={createLoading}
                style={{
                  marginTop: '1rem', padding: '14px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #a855f7, #6366f1)', color: 'white',
                  fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s', opacity: createLoading ? 0.7 : 1
                }}
              >
                {createLoading ? 'Creating...' : 'Create Staff Member'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersManagement;
