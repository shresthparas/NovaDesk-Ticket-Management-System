import React, { useState } from 'react';
import authService from '../services/authService';
import { useToast } from '../context/ToastContext';

const AuthForm = ({ onAuthSuccess }) => {
  const { toast } = useToast();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [resetPasswordMode, setResetPasswordMode] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const resetFormAndErrors = () => {
    setUsername('');
    setEmail('');
    setPassword('');
    setError('');
  };

  const toggleMode = (mode) => {
    setIsLoginMode(mode === 'login');
    setResetPasswordMode(false);
    resetFormAndErrors();
  };

  const enterResetPasswordMode = () => {
    setResetPasswordMode(true);
    setIsLoginMode(false);
    resetFormAndErrors();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (resetPasswordMode) {
      if (!email.trim()) {
        setError('Please enter your email address.');
        setIsLoading(false);
        return;
      }
      try {
        const response = await authService.forgotPassword(email);
        toast.success(response.message);
        toggleMode('login');
      } catch (err) {
        setError(err.message || 'Failed to send reset link.');
        toast.error(err.message);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!username.trim() || !password.trim() || (!isLoginMode && !email.trim())) {
      setError('Please fill in all required fields.');
      setIsLoading(false);
      return;
    }

    try {
      if (isLoginMode) {
        const userData = await authService.login(username, password);
        toast.success(`Welcome back, ${userData.username}!`);
        onAuthSuccess(userData.username);
      } else {
        await authService.register(username, email, password);
        toast.success('Registration successful! You can now log in.');
        setIsLoginMode(true);
        resetFormAndErrors();
      }
    } catch (err) {
      const msg = err.message || 'An unexpected error occurred.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const currentTitle = resetPasswordMode ? 'Reset Password' : (isLoginMode ? 'Welcome Back' : 'Create Account');
  const submitButtonText = resetPasswordMode ? 'Send Reset Link' : (isLoading ? 'Loading...' : (isLoginMode ? 'Login' : 'Sign Up'));

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>{currentTitle}</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
            {resetPasswordMode ? 'Enter your email to receive a reset link' : 'Please enter your details to continue'}
          </p>
        </div>

        {!resetPasswordMode && (
          <div className="auth-toggle-buttons">
            <button className={`btn ${isLoginMode ? 'active' : ''}`} onClick={() => toggleMode('login')} disabled={isLoading} type="button">Login</button>
            <button className={`btn ${!isLoginMode ? 'active' : ''}`} onClick={() => toggleMode('signup')} disabled={isLoading} type="button">Sign Up</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {!resetPasswordMode && (
            <div className="form-group">
              <label htmlFor="username">{isLoginMode ? 'Username or Email' : 'Username'}</label>
              <input type="text" id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={isLoginMode ? 'Enter username or email' : 'Choose a username'} disabled={isLoading} />
            </div>
          )}

          {(!isLoginMode || resetPasswordMode) && (
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email address" disabled={isLoading} />
            </div>
          )}

          {!resetPasswordMode && (
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" disabled={isLoading} />
            </div>
          )}

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="btn btn-primary btn-submit" disabled={isLoading}>{submitButtonText}</button>
        </form>

        <div className="auth-form-footer">
          {isLoginMode && !resetPasswordMode && (
            <button type="button" className="auth-link" onClick={enterResetPasswordMode} disabled={isLoading}>Forgot Password?</button>
          )}
          {resetPasswordMode && (
            <button type="button" className="auth-link" onClick={() => toggleMode('login')} disabled={isLoading}>Back to Login</button>
          )}
          
          {/* Switch to Staff Portal */}
          <div style={{ marginTop: '2.5rem' }}>
            <button 
              type="button" 
              onClick={() => window.location.href = '/staff'} 
              style={{ 
                width: '100%',
                background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.03), rgba(139, 92, 246, 0.08))',
                border: '1px solid rgba(139, 92, 246, 0.15)',
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
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'linear-gradient(90deg, rgba(139, 92, 246, 0.08), rgba(139, 92, 246, 0.15))';
                e.currentTarget.style.border = '1px solid rgba(139, 92, 246, 0.4)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(139, 92, 246, 0.15), inset 0 1px 0 rgba(255,255,255,0.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'linear-gradient(90deg, rgba(139, 92, 246, 0.03), rgba(139, 92, 246, 0.08))';
                e.currentTarget.style.border = '1px solid rgba(139, 92, 246, 0.15)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.05)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8b5cf6', boxShadow: '0 0 10px #8b5cf6' }}></div>
                <span>Are you a staff member?</span>
              </div>
              <span style={{ color: '#a78bfa', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                Staff Portal &rarr;
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;
