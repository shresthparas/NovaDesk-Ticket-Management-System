import React, { useState } from 'react';
import authService from '../services/authService';
import { useToast } from '../context/ToastContext';
import { FaUser, FaLock, FaEnvelope } from 'react-icons/fa';

const ProfileSettings = ({ currentUsername, onProfileUpdated }) => {
  const { toast } = useToast();
  
  const [email, setEmail] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (!email && !newPassword) {
      toast.error('No changes to update');
      return;
    }

    setLoading(true);
    try {
      await authService.updateProfile(email, oldPassword, newPassword);
      toast.success('Profile updated successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setEmail('');
      if (onProfileUpdated) onProfileUpdated();
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem' }}>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FaEnvelope /> Update Email Address
        </label>
        <input 
          type="email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          placeholder="New email address" 
          disabled={loading}
          style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text-pure)', outline: 'none' }}
        />
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FaLock /> Update Password
        </label>
        <input 
          type="password" 
          value={oldPassword} 
          onChange={(e) => setOldPassword(e.target.value)} 
          placeholder="Current password" 
          disabled={loading}
          style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text-pure)', outline: 'none' }}
        />
        <input 
          type="password" 
          value={newPassword} 
          onChange={(e) => setNewPassword(e.target.value)} 
          placeholder="New password (min 6 characters)" 
          disabled={loading}
          style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text-pure)', outline: 'none' }}
        />
        <input 
          type="password" 
          value={confirmPassword} 
          onChange={(e) => setConfirmPassword(e.target.value)} 
          placeholder="Confirm new password" 
          disabled={loading}
          style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text-pure)', outline: 'none' }}
        />
      </div>

      <button 
        type="submit" 
        disabled={loading}
        style={{
          marginTop: '1rem', padding: '14px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #a855f7, #6366f1)', color: 'white',
          fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s', opacity: loading ? 0.7 : 1,
          boxShadow: '0 4px 15px rgba(168, 85, 247, 0.3)'
        }}
      >
        {loading ? 'Saving...' : 'Save Profile Changes'}
      </button>
    </form>
  );
};

export default ProfileSettings;
