import React, { useState, useEffect } from 'react';
import { FaClock } from 'react-icons/fa';

const SlaTimer = ({ deadline, isBreached, status, created }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [progressPercent, setProgressPercent] = useState(100);

  useEffect(() => {
    if (status === 'Closed' || status === 'Resolved') {
      setTimeLeft('Resolved');
      setProgressPercent(100);
      return;
    }
    if (isBreached) {
      setTimeLeft('Breached');
      setProgressPercent(0);
      return;
    }
    if (!deadline) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      let dateStr = deadline;
      if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
        dateStr += 'Z';
      }
      const target = new Date(dateStr).getTime();
      const difference = target - now;

      // Calculate progress percentage
      let start = now - (4 * 60 * 60 * 1000); // default 4 hours ago
      if (created) {
        let createdStr = created;
        if (typeof createdStr === 'string' && !createdStr.endsWith('Z') && !createdStr.includes('+')) {
          createdStr += 'Z';
        }
        start = new Date(createdStr).getTime();
      }
      const totalDuration = target - start;
      const elapsed = now - start;
      const percent = Math.max(0, Math.min(100, 100 - (elapsed / totalDuration) * 100));
      setProgressPercent(percent);

      if (difference <= 0) {
        setTimeLeft('Breached');
      } else {
        const hours = Math.floor(difference / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        let timeStr = '';
        if (hours > 0) timeStr += `${hours}h `;
        if (minutes > 0 || hours > 0) timeStr += `${minutes}m `;
        timeStr += `${seconds}s`;

        setTimeLeft(timeStr);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [deadline, isBreached, status, created]);

  if (!deadline) return null;
  if (status === 'Closed' || status === 'Resolved') return null;

  const isOverdue = timeLeft === 'Breached' || isBreached;
  const isUrgent = progressPercent < 20 && !isOverdue;

  let progressColor = '#34d399'; // green
  if (isOverdue) progressColor = '#ef4444'; // red
  else if (isUrgent) progressColor = '#f97316'; // orange

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: '85px' }}>
      <span 
        style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '4px',
          color: isOverdue ? '#f87171' : (isUrgent ? '#fb923c' : '#34d399'), 
          fontSize: '0.75rem', 
          fontWeight: '600',
          whiteSpace: 'nowrap',
          background: isOverdue ? 'rgba(239, 68, 68, 0.1)' : (isUrgent ? 'rgba(249, 115, 22, 0.1)' : 'rgba(16, 185, 129, 0.1)'),
          padding: '3px 8px',
          borderRadius: '6px',
          width: 'fit-content'
        }}
      >
        <FaClock size={10} />
        {isOverdue ? 'Breached' : timeLeft}
      </span>
      <div className="sla-progress-container">
        <div 
          className={`sla-progress-bar ${isUrgent || isOverdue ? 'urgent' : ''}`}
          style={{ width: `${progressPercent}%`, backgroundColor: progressColor }}
        />
      </div>
    </div>
  );
};

export default SlaTimer;
