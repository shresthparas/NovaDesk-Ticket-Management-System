import React, { useState } from 'react';
import authService from '../services/authService';
import { useToast } from '../context/ToastContext';

const StaffAuthForm = ({ onAuthSuccess }) => {
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('agent');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!username.trim() || !password.trim()) {
      setError('Please fill in all required fields.');
      setIsLoading(false);
      return;
    }

    try {
      const userData = await authService.login(username, password);
      // Optional security check
      if (userData.role === 'user') {
          authService.logout();
          throw new Error('This portal is for staff only. Please log in on the main site.');
      }
      toast.success(`Welcome back, ${userData.username}!`);
      onAuthSuccess(userData.username);
    } catch (err) {
      const msg = err.message || 'An unexpected error occurred.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const currentTitle = 'Staff Portal Login';
  const submitButtonText = isLoading ? 'Loading...' : 'Login';

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ 
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle top glow line */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)' }}></div>

        <div className="auth-header">
          <h2 style={{ 
            background: 'linear-gradient(135deg, #93c5fd, #3b82f6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'inline-block',
            fontWeight: 800,
            letterSpacing: '-0.5px'
          }}>{currentTitle}</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
            Authorized personnel only
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" style={{ marginTop: '1.5rem' }}>
          <div className="form-group">
            <label htmlFor="staff-username">Username or Email</label>
            <input type="text" id="staff-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter username or email" disabled={isLoading} />
          </div>

          <div className="form-group">
            <label htmlFor="staff-role">Role</label>
            <select id="staff-role" value={role} onChange={(e) => setRole(e.target.value)} disabled={isLoading} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-pure)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}>
              <option value="agent" style={{ background: '#1e2430' }}>🎧 Support Agent</option>
              <option value="admin" style={{ background: '#1e2430' }}>🛡️ Administrator</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="staff-password">Password</label>
            <input type="password" id="staff-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" disabled={isLoading} />
          </div>

          {error && <p className="auth-error" style={{ color: '#ef4444' }}>{error}</p>}

          <button 
            type="submit" 
            className="btn btn-primary btn-submit" 
            disabled={isLoading} 
            style={{ 
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              boxShadow: '0 4px 15px rgba(37, 99, 235, 0.25)',
              border: 'none',
              fontWeight: 600,
              letterSpacing: '0.5px',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(37, 99, 235, 0.4)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(37, 99, 235, 0.25)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {submitButtonText}
          </button>
        </form>

        {/* Back to Customer Login */}
        <div style={{ marginTop: '2.5rem' }}>
          <button 
            type="button" 
            onClick={() => window.location.href = '/'} 
            style={{ 
              width: '100%',
              background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.05))',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '14px',
              padding: '16px',
              color: 'var(--text-secondary)',
              fontSize: '0.88rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.02)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'linear-gradient(90deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.08))';
              e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.05)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'linear-gradient(90deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.05))';
              e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.02)';
            }}
          >
            <span style={{ color: '#e2e8f0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              &larr; Customer Login
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>Return to main site</span>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#64748b' }}></div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaffAuthForm;
