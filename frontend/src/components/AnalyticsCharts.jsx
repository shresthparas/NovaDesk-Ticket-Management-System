import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import Modal from 'react-modal';
import { FaTimes } from 'react-icons/fa';

const STATUS_COLORS = { Open: '#facc15', 'In Progress': '#22d3ee', Closed: '#34d399' };
const CATEGORY_COLORS = ['#60a5fa', '#a78bfa', '#f87171', '#34d399', '#fb923c'];
const PRIORITY_COLORS = { Low: '#94a3b8', Medium: '#60a5fa', High: '#fb923c', Critical: '#ef4444' };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function AnalyticsCharts({ tickets }) {
  const [isCsatModalOpen, setIsCsatModalOpen] = useState(false);
  const [isSlaModalOpen, setIsSlaModalOpen] = useState(false);
  const [isResolutionModalOpen, setIsResolutionModalOpen] = useState(false);

  const statusData = useMemo(() => {
    const counts = { Open: 0, 'In Progress': 0, Closed: 0 };
    tickets.forEach((t) => {
      const s = t.status || 'Open';
      if (counts[s] !== undefined) counts[s]++;
      else counts['Open']++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  const categoryData = useMemo(() => {
    const counts = {};
    tickets.forEach((t) => {
      const cat = t.category || 'Other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  const priorityData = useMemo(() => {
    const counts = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    tickets.forEach((t) => {
      const p = t.priority || 'Medium';
      if (counts[p] !== undefined) counts[p]++;
      else counts['Medium']++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  const timelineData = useMemo(() => {
    const days = 7;
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = startOfDay(subDays(new Date(), i));
      const label = format(day, 'MMM dd');
      const count = tickets.filter((t) => {
        const created = startOfDay(new Date(t.created));
        return created.getTime() === day.getTime();
      }).length;
      result.push({ name: label, tickets: count });
    }
    return result;
  }, [tickets]);

  const metrics = useMemo(() => {
    let slaMet = 0;
    let closedCount = 0;
    let totalResolutionTime = 0; // in hours
    let totalCsat = 0;
    let csatCount = 0;

    tickets.forEach(t => {
      let isBreached = t.is_sla_breached;
      if (!isBreached && t.sla_deadline && t.status !== 'Closed' && t.status !== 'Resolved') {
        let dateStr = t.sla_deadline;
        if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) dateStr += 'Z';
        if (new Date(dateStr).getTime() < new Date().getTime()) isBreached = true;
      }
      
      if (!isBreached) slaMet++;
      
      if (t.csat_rating) {
        totalCsat += t.csat_rating;
        csatCount++;
      }
      
      if (t.status === 'Closed' || t.status === 'Resolved') {
        const closedLogs = t.activity_log?.filter(log => log.action === 'status_changed' && (log.new_value === 'Closed' || log.new_value === 'Resolved'));
        if (closedLogs && closedLogs.length > 0) {
          const closedTime = new Date(closedLogs[closedLogs.length - 1].timestamp);
          const createdTime = new Date(t.created);
          const hours = (closedTime - createdTime) / (1000 * 60 * 60);
          totalResolutionTime += hours;
          closedCount++;
        }
      }
    });

    const slaCompliance = tickets.length ? Math.round((slaMet / tickets.length) * 100) : 100;
    const avgResolutionTime = closedCount ? (totalResolutionTime / closedCount).toFixed(1) : 0;
    const avgCsat = csatCount ? (totalCsat / csatCount).toFixed(1) : 'N/A';

    return { slaCompliance, avgResolutionTime, avgCsat, csatCount, slaMet };
  }, [tickets]);

  const csatTickets = useMemo(() => {
    return tickets.filter(t => t.csat_rating !== undefined && t.csat_rating !== null);
  }, [tickets]);

  const slaTickets = useMemo(() => {
    return tickets.filter(t => t.sla_deadline).map(t => {
      let isBreached = t.is_sla_breached;
      if (!isBreached && t.sla_deadline && t.status !== 'Closed' && t.status !== 'Resolved') {
        let dateStr = t.sla_deadline;
        if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) dateStr += 'Z';
        if (new Date(dateStr).getTime() < new Date().getTime()) isBreached = true;
      }
      return {
        ...t,
        isSlaBreached: isBreached
      };
    });
  }, [tickets]);

  const resolvedTickets = useMemo(() => {
    const list = [];
    tickets.forEach(t => {
      if (t.status === 'Closed' || t.status === 'Resolved') {
        const closedLogs = t.activity_log?.filter(log => log.action === 'status_changed' && (log.new_value === 'Closed' || log.new_value === 'Resolved'));
        if (closedLogs && closedLogs.length > 0) {
          const closedTime = new Date(closedLogs[closedLogs.length - 1].timestamp);
          const createdTime = new Date(t.created);
          const hours = (closedTime - createdTime) / (1000 * 60 * 60);
          list.push({
            ...t,
            resolutionHours: hours.toFixed(1),
            resolvedAt: closedTime
          });
        }
      }
    });
    return list;
  }, [tickets]);

  if (tickets.length === 0) return null;

  return (
    <div style={{ marginTop: '2.5rem' }}>
      <h2 style={{ 
        marginBottom: '1.75rem', 
        color: 'var(--text-pure)', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.75rem',
        fontSize: '1.4rem',
        fontWeight: '700',
        letterSpacing: '-0.01em'
      }}>
        Ticket Insights & Analytics
      </h2>
      <div className="stats-grid" style={{ marginBottom: '2rem', gridTemplateColumns: 'repeat(3, 1fr)', gridAutoFlow: 'row' }}>
        <div 
          className="stat-card stat-card-sla" 
          style={{ borderLeft: '4px solid #34d399', cursor: 'pointer' }}
          onClick={() => setIsSlaModalOpen(true)}
        >
          <span className="stat-title">SLA Compliance</span>
          <span className="stat-value">{metrics.slaCompliance}%</span>
        </div>
        <div 
          className="stat-card stat-card-resolution" 
          style={{ borderLeft: '4px solid #8b5cf6', cursor: 'pointer' }}
          onClick={() => setIsResolutionModalOpen(true)}
        >
          <span className="stat-title">Avg Resolution Time</span>
          <span className="stat-value">{metrics.avgResolutionTime} hrs</span>
        </div>
        <div 
          className="stat-card stat-card-csat" 
          style={{ 
            borderLeft: '4px solid #eab308', 
            cursor: 'pointer'
          }}
          onClick={() => setIsCsatModalOpen(true)}
        >
          <span className="stat-title">Avg CSAT Rating</span>
          <span className="stat-value">{metrics.avgCsat} <span style={{fontSize:'1rem', color: 'var(--text-secondary)'}}>({metrics.csatCount} reviews)</span></span>
        </div>
      </div>
      <div className="charts-grid">
        <div className="chart-card">
        <h3>Tickets by Status</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label>
              {statusData.map((entry) => (
                <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#888'} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Tickets by Category</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={categoryData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
            <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" name="Tickets" radius={[6, 6, 0, 0]}>
              {categoryData.map((_, i) => (
                <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Tickets by Priority</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={priorityData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} width={60} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" name="Tickets" radius={[0, 6, 6, 0]}>
              {priorityData.map((entry) => (
                <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] || '#888'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card chart-card-wide">
        <h3>Tickets Created (Last 7 Days)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={timelineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
            <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="tickets" name="Created" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      </div>

      <Modal
        isOpen={isCsatModalOpen}
        onRequestClose={() => setIsCsatModalOpen(false)}
        contentLabel="CSAT Ratings List"
        className="modal-content chat-modal"
        overlayClassName="modal-overlay"
      >
        <div className="modal-header-modern">
          <div className="header-left">
            <h2>CSAT Reviews History</h2>
            <span className="badge" style={{ backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}>
              Average: {metrics.avgCsat} / 5.0
            </span>
          </div>
          <button onClick={() => setIsCsatModalOpen(false)} className="btn-close-modern">
            <FaTimes />
          </button>
        </div>
        <div style={{ padding: '1.5rem', maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {csatTickets.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>No customer reviews submitted yet.</p>
          ) : (
            csatTickets.map(t => (
              <div 
                key={t.id} 
                style={{ 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  border: '1px solid var(--border-subtle)', 
                  borderRadius: '12px', 
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ color: 'var(--text-pure)', fontSize: '1rem' }}>{t.owner_username || 'Anonymous Customer'}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      Ticket: <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{t.title}</span>
                    </div>
                  </div>
                  <div style={{ color: '#eab308', fontSize: '1.2rem', letterSpacing: '2px' }}>
                    {'★'.repeat(t.csat_rating)}{'☆'.repeat(5 - t.csat_rating)}
                  </div>
                </div>
                {t.csat_feedback ? (
                  <p style={{ 
                    margin: 0, 
                    fontStyle: 'italic', 
                    color: 'var(--text-primary)', 
                    background: 'rgba(255, 255, 255, 0.03)', 
                    padding: '10px 14px', 
                    borderRadius: '8px', 
                    borderLeft: '3px solid #eab308',
                    fontSize: '0.95rem',
                    lineHeight: '1.4'
                  }}>
                    "{t.csat_feedback}"
                  </p>
                ) : (
                  <em style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>No written feedback provided.</em>
                )}
              </div>
            ))
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isSlaModalOpen}
        onRequestClose={() => setIsSlaModalOpen(false)}
        contentLabel="SLA Compliance List"
        className="modal-content chat-modal"
        overlayClassName="modal-overlay"
      >
        <div className="modal-header-modern">
          <div className="header-left">
            <h2>SLA Compliance History</h2>
            <span className="badge" style={{ backgroundColor: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
              Complied: {metrics.slaMet} / {slaTickets.length} tickets ({metrics.slaCompliance}%)
            </span>
          </div>
          <button onClick={() => setIsSlaModalOpen(false)} className="btn-close-modern">
            <FaTimes />
          </button>
        </div>
        <div style={{ padding: '1.5rem', maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {slaTickets.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>No tickets with active SLA deadlines found.</p>
          ) : (
            slaTickets.map(t => (
              <div 
                key={t.id} 
                style={{ 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  border: '1px solid var(--border-subtle)', 
                  borderRadius: '12px', 
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ color: 'var(--text-pure)', fontSize: '1rem' }}>{t.title}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      Priority: <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{t.priority}</span> | Category: <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{t.category}</span>
                    </div>
                  </div>
                  <span className={`badge ${t.isSlaBreached ? 'status-closed' : 'status-open'}`} style={{ 
                    backgroundColor: t.isSlaBreached ? 'rgba(239, 68, 68, 0.15)' : 'rgba(52, 211, 153, 0.15)', 
                    color: t.isSlaBreached ? '#ef4444' : '#34d399',
                    fontWeight: 600
                  }}>
                    {t.isSlaBreached ? 'BREACHED' : 'COMPLIED'}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.5rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Deadline: {format(new Date(t.sla_deadline), 'MMM dd, yyyy p')}</span>
                  <span>Owner: {t.owner_username}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isResolutionModalOpen}
        onRequestClose={() => setIsResolutionModalOpen(false)}
        contentLabel="Resolution Time List"
        className="modal-content chat-modal"
        overlayClassName="modal-overlay"
      >
        <div className="modal-header-modern">
          <div className="header-left">
            <h2>Ticket Resolution Time Logs</h2>
            <span className="badge" style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>
              Average: {metrics.avgResolutionTime} hours ({resolvedTickets.length} tickets resolved)
            </span>
          </div>
          <button onClick={() => setIsResolutionModalOpen(false)} className="btn-close-modern">
            <FaTimes />
          </button>
        </div>
        <div style={{ padding: '1.5rem', maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {resolvedTickets.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>No resolved or closed tickets found.</p>
          ) : (
            resolvedTickets.map(t => (
              <div 
                key={t.id} 
                style={{ 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  border: '1px solid var(--border-subtle)', 
                  borderRadius: '12px', 
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ color: 'var(--text-pure)', fontSize: '1rem' }}>{t.title}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      Assignee: <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{t.assigned_to || 'Unassigned'}</span> | Owner: <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{t.owner_username}</span>
                    </div>
                  </div>
                  <span className="badge" style={{ 
                    backgroundColor: 'rgba(139, 92, 246, 0.15)', 
                    color: '#8b5cf6',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }}>
                    {t.resolutionHours} hrs
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.5rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Created: {format(new Date(t.created), 'MMM dd, yyyy p')}</span>
                  <span>Resolved: {format(new Date(t.resolvedAt), 'MMM dd, yyyy p')}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
