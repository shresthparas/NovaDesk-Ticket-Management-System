import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FaPlus, FaTicketAlt, FaChartPie, FaCog, FaSignOutAlt,
  FaBars, FaTimes, FaSun, FaMoon, FaHeadset, FaBell, FaFolder,
  FaComment, FaUserCheck, FaInfoCircle, FaDownload, FaUsers
} from 'react-icons/fa';
import ticketService from './services/ticketService.js';
import authService from './services/authService';
import TicketTable from './components/TicketTable.jsx';
import KanbanBoard from './components/KanbanBoard.jsx';
import CreateTicketModal from './components/CreateTicketModal.jsx';
import TicketDetailsModal from './components/TicketDetailsModal.jsx';
import AuthForm from './components/AuthForm.jsx';
import StaffAuthForm from './components/StaffAuthForm.jsx';
import ResetPasswordForm from './components/ResetPasswordForm.jsx';
import AnalyticsCharts from './components/AnalyticsCharts.jsx';
import AgentDashboard from './components/AgentDashboard.jsx';
import ToastContainer from './components/ToastContainer.jsx';
import ProjectManagement from './components/ProjectManagement.jsx';
import JoinProjectModal from './components/JoinProjectModal.jsx';
import UsersManagement from './components/UsersManagement.jsx';
import ProfileSettings from './components/ProfileSettings.jsx';
import { StatSkeleton, TicketListSkeleton } from './components/TicketSkeleton.jsx';
import EmptyState from './components/EmptyState.jsx';
import { useToast } from './context/ToastContext';
import { useTheme } from './context/ThemeContext';
import Modal from 'react-modal';

Modal.setAppElement('#root');

function App() {
  const { toast } = useToast();
  const { theme, toggleTheme, isDark } = useTheme();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ticketToEdit, setTicketToEdit] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [ticketToView, setTicketToView] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All Categories');
  const [assignedFilter, setAssignedFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  
  // Settings States
  const [settingsAnimations, setSettingsAnimations] = useState(true);
  const [settingsCompact, setSettingsCompact] = useState(false);
  const [settingsEmail, setSettingsEmail] = useState(true);
  const [settingsAlerts, setSettingsAlerts] = useState(true);
  const [settingsSlack, setSettingsSlack] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(authService.isAuthenticated());
  const [loggedInUsername, setLoggedInUsername] = useState(localStorage.getItem('username') || '');
  const [userRole, setUserRole] = useState(authService.getRole());
  const [resetToken, setResetToken] = useState(null);
  const [userEmail, setUserEmail] = useState('');

  const fetchUserProfile = async () => {
    try {
      const profile = await authService.getProfile();
      setUserEmail(profile.email || '');
    } catch (e) {
      console.error('Failed to fetch profile:', e);
    }
  };

  const isStaff = userRole === 'admin' || userRole === 'agent';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) setResetToken(token);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    const wsUrl = ticketService.BASE_URL.replace(/^http/, 'ws') + '/api/ws/tickets?username=' + encodeURIComponent(loggedInUsername);
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'ticket_updated') {
          const updatedTicket = data.ticket;
          setTickets((prev) => prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t)));
          setTicketToView((prev) => (prev && prev.id === updatedTicket.id ? updatedTicket : prev));
        } else if (data.event === 'ticket_created') {
          const newTicket = data.ticket;
          if (isStaff || newTicket.owner_username === loggedInUsername) {
            setTickets((prev) => {
              if (prev.find((t) => t.id === newTicket.id)) return prev;
              return [newTicket, ...prev];
            });
          }
        } else if (data.event === 'new_notification') {
          const newNotif = data.notification;
          if (newNotif.username === loggedInUsername) {
            setNotifications(prev => [newNotif, ...prev]);
            toast.info(`New Notification: ${newNotif.message}`);
          }
        } else if (data.event === 'online_status') {
          setOnlineUsers(data.online_users || []);
        }
      } catch (err) {
        console.error('WebSocket error:', err);
      }
    };
    return () => { if (ws.readyState === 1) ws.close(); };
  }, [isLoggedIn, userRole, loggedInUsername, isStaff]);

  const fetchTickets = useCallback(async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    try {
      const options = {};
      if (assignedFilter === 'my') options.myAssigned = true;
      if (assignedFilter === 'unassigned') options.assignedTo = 'unassigned';
      if (selectedProject) options.projectId = selectedProject;
      const response = await ticketService.getAllTickets('', 'All Categories', options);
      const sorted = response.data.sort((a, b) => new Date(b.created) - new Date(a.created));
      setTickets(sorted);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
      if (error.response?.status === 401) handleLogout();
      else toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, assignedFilter, selectedProject, toast]);

  useEffect(() => {
    if (!resetToken) fetchTickets();
  }, [fetchTickets, resetToken]);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await ticketService.getProjects();
      setProjects(res.data);
    } catch (err) {
      console.error("Failed to load projects", err);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchProjects();
    }
  }, [isLoggedIn, fetchProjects]);

  const handleJoinProject = async () => {
    const code = window.prompt('Enter Project Code:');
    if (!code) return;
    try {
      await ticketService.joinProject(code.trim());
      toast.success('Successfully joined project!');
      fetchProjects();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to join project');
    }
  };

  const fetchNotifications = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const res = await ticketService.getNotifications();
      const mapped = res.data.map(n => ({ ...n, id: n.id || n._id }));
      setNotifications(mapped);
    } catch (e) { console.error('Failed to load notifications', e); }
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) fetchNotifications();
  }, [isLoggedIn, fetchNotifications]);

  const markNotifRead = async (id) => {
    try {
      await ticketService.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) { console.error(e); }
  };

  const markAllNotifsRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    try {
      await Promise.all(unread.map(n => ticketService.markNotificationRead(n.id)));
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    } catch (err) {
      console.error(err);
      toast.error('Failed to mark all notifications as read');
    }
  };

  const deleteNotif = async (e, id) => {
    e.stopPropagation();
    try {
      await ticketService.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Notification deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete notification');
    }
  };

  const clearAllNotifs = async () => {
    try {
      await ticketService.clearNotifications();
      setNotifications([]);
      toast.success('All notifications cleared');
    } catch (err) {
      console.error(err);
      toast.error('Failed to clear notifications');
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const displayedTickets = useMemo(() => {
    let result = tickets;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (t) => t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
      );
    }
    if (filterCategory !== 'All Categories') {
      result = result.filter((t) => t.category === filterCategory);
    }
    if (assignedFilter === 'my' && activeTab !== 'Agent Queue') {
      result = result.filter((t) => t.assigned_to === loggedInUsername);
    }
    return result;
  }, [tickets, filterCategory, searchTerm, assignedFilter, loggedInUsername, activeTab]);

  const totalTickets = tickets.length;
  const openTickets = tickets.filter((t) => t.status?.toLowerCase() === 'open').length;
  const inProgressTickets = tickets.filter((t) => t.status?.toLowerCase() === 'in progress').length;
  const closedTickets = tickets.filter((t) => t.status?.toLowerCase() === 'closed').length;
  const criticalTickets = tickets.filter((t) => t.priority === 'Critical' && t.status?.toLowerCase() !== 'closed').length;

  const handleNewTicketClick = () => { setTicketToEdit(null); setIsModalOpen(true); };
  const handleEditClick = (ticket) => { setTicketToEdit(ticket); setIsModalOpen(true); };
  const handleViewClick = useCallback((ticket) => { setTicketToView(ticket); setIsViewModalOpen(true); }, []);

  const handleCommentAdded = useCallback((updatedTicket) => {
    setTickets((prev) => prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t)));
    setTicketToView(updatedTicket);
  }, []);

  const handleDeleteTicket = async (id) => {
    if (!window.confirm('Are you sure you want to delete this ticket?')) return;
    try {
      await ticketService.deleteTicket(id);
      toast.success('Ticket deleted');
      fetchTickets();
    } catch (error) {
      toast.error('Failed to delete ticket');
    }
  };

  const handleFormSuccess = useCallback(() => { fetchTickets(); setIsModalOpen(false); }, [fetchTickets]);

  const handleAuthSuccess = useCallback((username) => {
    setIsLoggedIn(true);
    setLoggedInUsername(username);
    const role = authService.getRole();
    setUserRole(role);
    setActiveTab(role === 'agent' ? 'Agent Queue' : 'Dashboard');
    fetchTickets();
    setTimeout(() => fetchUserProfile(), 100);
  }, [fetchTickets, fetchUserProfile]);

  const handleLogout = useCallback(() => {
    authService.logout();
    setIsLoggedIn(false);
    setLoggedInUsername('');
    setUserEmail('');
    setUserRole('user');
    setTickets([]);
    setSidebarOpen(false);
  }, []);

  const navigate = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    if (tab === 'Settings') fetchUserProfile();
  };

  const navItems = useMemo(() => {
    const items = [];
    if (userRole === 'agent') {
      items.push({ id: 'Agent Queue', icon: FaHeadset, label: 'Agent Queue' });
    } else {
      items.push({ id: 'Dashboard', icon: FaChartPie, label: 'Dashboard' });
    }
    items.push({ id: 'All Tickets', icon: FaTicketAlt, label: 'All Tickets' });
    items.push({ id: 'Projects', icon: FaFolder, label: 'Projects' });
    if (userRole === 'admin') {
      items.push({ id: 'Users', icon: FaUsers, label: 'Users & Roles' });
    }
    items.push({ id: 'Settings', icon: FaCog, label: 'Settings' });
    return items;
  }, [userRole]);

  if (resetToken) return (<><ResetPasswordForm token={resetToken} /><ToastContainer /></>);
  if (!isLoggedIn) {
    if (window.location.pathname === '/staff') {
      return (<><StaffAuthForm onAuthSuccess={handleAuthSuccess} /><ToastContainer /></>);
    }
    return (<><AuthForm onAuthSuccess={handleAuthSuccess} /><ToastContainer /></>);
  }
  const exportToCSV = async () => {
    try {
      const response = await ticketService.exportTicketsCSV();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `tickets_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export CSV', error);
      toast.error('Failed to export tickets.');
    }
  };

  return (
    <div className="app-layout">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-icon-wrapper"><FaTicketAlt /></div>
          <span className="brand-text">NovaDesk</span>
          <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <FaTimes />
          </button>
        </div>

        <nav className="nav-menu">
          {navItems.map(({ id, icon: Icon, label }) => (
            <div key={id} className={`nav-item ${activeTab === id ? 'active' : ''}`} onClick={() => navigate(id)}>
              <Icon /> {label}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="avatar">{loggedInUsername.charAt(0).toUpperCase()}</div>
            <div className="user-info">
              <span>{loggedInUsername}</span>
              <small style={{ textTransform: 'capitalize' }}>{userRole}</small>
            </div>
            <button className="logout-btn-icon" onClick={handleLogout} title="Logout" aria-label="Logout">
              <FaSignOutAlt />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <div className="top-bar">
          <div className="top-bar-left">
            <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <FaBars />
            </button>
            <h1 className="page-title">{activeTab}</h1>
          </div>
          <div className="top-bar-right" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {Array.isArray(projects) && projects.length > 0 && (
              <select 
                className="project-select" 
                value={selectedProject} 
                onChange={(e) => setSelectedProject(e.target.value)}
              >
                <option value="">All Projects</option>
                {projects.map(p => (
                  <option key={p.project_id} value={p.project_id}>{p.name}</option>
                ))}
              </select>
            )}
            <button className="btn-secondary" onClick={exportToCSV}>
              <FaDownload /> Export CSV
            </button>
            <button className="btn-new-ticket" onClick={handleNewTicketClick}>
              <FaPlus /> New Ticket
            </button>
            <div className="notification-wrapper" style={{ position: 'relative' }}>
              <button className="btn-icon" onClick={() => setIsNotifOpen(!isNotifOpen)}>
                <FaBell />
                {unreadCount > 0 && <span className="badge-count">{unreadCount}</span>}
              </button>
              {isNotifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h4 style={{ margin: 0, fontWeight: 700, color: 'var(--text-pure)' }}>Notifications</h4>
                      {unreadCount > 0 && (
                        <span style={{ fontSize: '0.7rem', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-light)', padding: '2px 6px', borderRadius: '12px', fontWeight: 600 }}>
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <button onClick={() => setIsNotifOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '50%', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'} onMouseOut={e => e.currentTarget.style.background = 'none'}><FaTimes /></button>
                  </div>
                  <div className="notif-list">
                    {notifications.length === 0 ? (
                      <p style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>No notifications yet</p>
                    ) : (
                      notifications.map(n => {
                        const getIcon = () => {
                          const msg = n.message.toLowerCase();
                          if (msg.includes('comment')) return <FaComment style={{ color: 'var(--accent-cyan)' }} />;
                          if (msg.includes('assigned') || msg.includes('assign')) return <FaUserCheck style={{ color: 'var(--accent-purple)' }} />;
                          return <FaTicketAlt style={{ color: 'var(--accent-blue)' }} />;
                        };
                        return (
                          <div key={n.id} className={`notif-item ${!n.is_read ? 'unread' : ''}`} onClick={() => { markNotifRead(n.id); navigate('All Tickets'); setIsNotifOpen(false); }} style={{ position: 'relative', paddingRight: '2.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.75rem', alignItems: 'flex-start' }}>
                              <div style={{ marginTop: '0.2rem' }}>{getIcon()}</div>
                              <div>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-pure)', lineHeight: '1.4' }}>{n.message}</p>
                                <small style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>{new Date(n.created_at).toLocaleString()}</small>
                              </div>
                            </div>
                            <button 
                              onClick={(e) => deleteNotif(e, n.id)}
                              style={{ 
                                position: 'absolute', 
                                right: '1rem', 
                                top: '50%', 
                                transform: 'translateY(-50%)', 
                                background: 'none', 
                                border: 'none', 
                                color: 'var(--text-tertiary)', 
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '4px',
                                transition: 'color 0.2s, background 0.2s'
                              }}
                              onMouseOver={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                              onMouseOut={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'none'; }}
                              title="Delete notification"
                            >
                              <FaTimes size={12} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <div className="notif-footer">
                      {unreadCount > 0 ? (
                        <button onClick={markAllNotifsRead} className="notif-footer-btn read-all-btn">
                          Mark all as read
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', paddingLeft: '8px' }}>All caught up!</span>
                      )}
                      <button onClick={clearAllNotifs} className="notif-footer-btn clear-all-btn">
                        Clear all
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {activeTab === 'Agent Queue' && userRole === 'agent' && (
          <AgentDashboard
            tickets={tickets}
            loading={loading}
            onEdit={handleEditClick}
            onDelete={handleDeleteTicket}
            onView={handleViewClick}
            userRole={userRole}
            currentUsername={loggedInUsername}
            assignedFilter={assignedFilter}
            onAssignedFilterChange={setAssignedFilter}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            filterCategory={filterCategory}
            onCategoryChange={setFilterCategory}
          />
        )}
        {activeTab === 'Dashboard' && userRole !== 'agent' && (
          <>
            <p style={{ 
              marginBottom: '2rem', 
              color: 'var(--text-secondary)', 
              fontSize: '1.25rem',
              fontWeight: '500',
              letterSpacing: '0.01em'
            }}>
              Track, prioritize, and resolve support tickets with real-time insights.
            </p>
            <div className="stats-grid">
              {loading ? (
                Array.from({ length: userRole === 'admin' ? 5 : 4 }).map((_, i) => <StatSkeleton key={i} />)
              ) : (
                <>
                  <div className="stat-card">
                    <span className="stat-title">Total Tickets</span>
                    <span className="stat-value">{totalTickets}</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-title">Open</span>
                    <span className="stat-value stat-open">{openTickets}</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-title">In Progress</span>
                    <span className="stat-value stat-progress">{inProgressTickets}</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-title">Closed</span>
                    <span className="stat-value stat-closed">{closedTickets}</span>
                  </div>
                  {userRole === 'admin' && (
                    <div className="stat-card">
                      <span className="stat-title">Critical Open</span>
                      <span className="stat-value stat-critical">{criticalTickets}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {userRole === 'admin' && !loading && tickets.length > 0 && (
              <AnalyticsCharts tickets={tickets} />
            )}

            <div className="content-area">
              <div className="content-header">
                <h2 style={{ margin: 0 }}>Recent Activity</h2>
                <div className="filter-row">
                  {isStaff && (
                    <div className="assigned-filter">
                      <button className={`filter-chip ${assignedFilter === 'all' ? 'active' : ''}`} onClick={() => setAssignedFilter('all')}>All</button>
                      <button className={`filter-chip ${assignedFilter === 'my' ? 'active' : ''}`} onClick={() => setAssignedFilter('my')}>My Assigned</button>
                      <button className={`filter-chip ${assignedFilter === 'unassigned' ? 'active' : ''}`} onClick={() => setAssignedFilter('unassigned')}>Unassigned</button>
                    </div>
                  )}
                  <div className="search-filter-bar">
                    <input type="search" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                      <option value="All Categories">All Categories</option>
                      <option value="Bug">Bug</option>
                      <option value="Feedback">Feedback</option>
                      <option value="Feature Request">Feature Request</option>
                      <option value="support">Support</option>
                    </select>
                  </div>
                </div>
              </div>

              {loading ? (
                <TicketListSkeleton count={4} />
              ) : (
                <TicketTable
                  tickets={displayedTickets}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteTicket}
                  onView={handleViewClick}
                  userRole={userRole}
                  showAssignee={isStaff}
                  emptyVariant={assignedFilter === 'my' ? 'assigned' : searchTerm ? 'search' : 'default'}
                />
              )}
            </div>
          </>
        )}

        {activeTab === 'All Tickets' && (
          <>
            <p style={{ 
              marginBottom: '2rem', 
              color: 'var(--text-secondary)', 
              fontSize: '1.25rem',
              fontWeight: '500',
              letterSpacing: '0.01em'
            }}>
              Seamlessly manage, filter, and track every active ticket across all your projects.
            </p>
            <div className="content-area kanban-content-area">
            <div className="content-header kanban-header" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'stretch', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>Ticket Management</h2>
                {userRole === 'admin' && (
                  <div className="view-toggle">
                    <button className={`btn btn-secondary ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>List</button>
                    <button className={`btn btn-secondary ${viewMode === 'board' ? 'active' : ''}`} onClick={() => setViewMode('board')}>Board</button>
                  </div>
                )}
              </div>
              <div className="filter-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                {isStaff && (
                  <select 
                    className="filter-select-modern" 
                    value={assignedFilter} 
                    onChange={(e) => setAssignedFilter(e.target.value)}
                    style={{ width: '180px' }}
                  >
                    <option value="all">All Tickets</option>
                    <option value="my">My Assigned</option>
                    <option value="unassigned">Unassigned</option>
                  </select>
                )}
                <div className="search-filter-bar" style={{ display: 'flex', gap: '0.75rem', flex: isStaff ? '0 1 500px' : '1', justifyContent: 'flex-end', marginLeft: 'auto' }}>
                  <input type="search" placeholder="Search tickets..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ flex: 1, minWidth: '180px' }} />
                  <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ width: '180px' }}>
                    <option value="All Categories">All Categories</option>
                    <option value="Bug">Bug</option>
                    <option value="Feedback">Feedback</option>
                    <option value="Feature Request">Feature Request</option>
                    <option value="support">Support</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="view-content-wrapper">
              {loading ? (
                <TicketListSkeleton count={4} />
              ) : viewMode === 'list' || userRole !== 'admin' ? (
                <TicketTable
                  tickets={displayedTickets}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteTicket}
                  onView={handleViewClick}
                  userRole={userRole}
                  showAssignee={isStaff}
                  emptyVariant={searchTerm ? 'search' : 'default'}
                />
              ) : displayedTickets.length === 0 ? (
                <EmptyState variant="search" />
              ) : (
                <KanbanBoard tickets={displayedTickets} onEdit={handleEditClick} onDelete={handleDeleteTicket} onView={handleViewClick} />
              )}
            </div>
          </div>
          </>
        )}

        {activeTab === 'Users' && userRole === 'admin' && (
          <UsersManagement currentUsername={loggedInUsername} onlineUsers={onlineUsers} />
        )}

        {activeTab === 'Settings' && (
          <div className="content-area settings-panel" style={{ maxWidth: '100%', margin: '0 auto', gap: '2.5rem' }}>
            
            {/* Account Profile Card */}
            <div className="settings-section">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-pure)', marginBottom: '1rem' }}>Account Profile</h2>
              <div className="settings-card" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2rem', alignItems: 'center', padding: '2rem' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 800, color: 'white', boxShadow: '0 8px 24px rgba(139, 92, 246, 0.25)' }}>
                  {loggedInUsername.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-pure)' }}>{loggedInUsername}</h3>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Email: <span style={{ color: 'var(--text-primary)' }}>{userEmail || 'Loading...'}</span>
                  </p>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Role: <span style={{ color: 'var(--accent-light)', fontWeight: 600, textTransform: 'capitalize' }}>{userRole}</span>
                  </p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Member since: June 2026</p>
                </div>
              </div>
              
              <ProfileSettings currentUsername={loggedInUsername} onProfileUpdated={fetchUserProfile} />
            </div>

            {/* Appearance & Layout Card */}
            <div className="settings-section">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-pure)', marginBottom: '1rem' }}>Appearance Settings</h2>
              <div className="settings-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="theme-toggle-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '1.25rem' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-pure)' }}>Dark Mode Theme</p>
                    <small style={{ color: 'var(--text-secondary)' }}>{isDark ? 'Ultra-Premium Dark Mode is active' : 'Clean Light Mode is active'}</small>
                  </div>
                  <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle theme">
                    {isDark ? <FaSun /> : <FaMoon />}
                    {isDark ? 'Light Mode' : 'Dark Mode'}
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '1.25rem' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-pure)' }}>Animations & Transitions</p>
                    <small style={{ color: 'var(--text-secondary)' }}>Smooth interactive micro-animations across dashboards</small>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={settingsAnimations} onChange={(e) => setSettingsAnimations(e.target.checked)} />
                    <span className="slider"></span>
                  </label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-pure)' }}>Compact Side Navigation</p>
                    <small style={{ color: 'var(--text-secondary)' }}>Minimize the sidebar layout for maximum dashboard workspace</small>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={settingsCompact} onChange={(e) => setSettingsCompact(e.target.checked)} />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
            </div>

            {/* Notification Preferences */}
            <div className="settings-section">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-pure)', marginBottom: '1rem' }}>Notification Preferences</h2>
              <div className="settings-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '1.25rem' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-pure)' }}>Email Alerts</p>
                    <small style={{ color: 'var(--text-secondary)' }}>Send ticket creations, changes, and SLA breach updates via background mailers</small>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={settingsEmail} onChange={(e) => setSettingsEmail(e.target.checked)} />
                    <span className="slider"></span>
                  </label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '1.25rem' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-pure)' }}>Desktop Browser Notifications</p>
                    <small style={{ color: 'var(--text-secondary)' }}>Show local push notifications when new tickets are assigned</small>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={settingsAlerts} onChange={(e) => setSettingsAlerts(e.target.checked)} />
                    <span className="slider"></span>
                  </label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-pure)' }}>Slack Webhooks Integration</p>
                    <small style={{ color: 'var(--text-secondary)' }}>Forward high-priority support updates to configured Slack channels</small>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={settingsSlack} onChange={(e) => setSettingsSlack(e.target.checked)} />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
            </div>

            {/* System Info & Status */}
            <div className="settings-section">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-pure)', marginBottom: '1rem' }}>System & Infrastructure</h2>
              <div className="settings-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', padding: '1.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>FastAPI backend status</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }}></span>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-pure)' }}>Online (v2.4.0)</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Database cluster</span>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-pure)', marginTop: '0.25rem' }}>MongoDB & Redis cache</strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Celery background worker</span>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-pure)', marginTop: '0.25rem' }}>Active (0 tasks in queue)</strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Environment context</span>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-pure)', marginTop: '0.25rem' }}>Dockerized containers</strong>
                </div>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'Projects' && (
          <>
            <p style={{ 
              marginBottom: '2rem', 
              color: 'var(--text-secondary)', 
              fontSize: '1.25rem',
              fontWeight: '500',
              letterSpacing: '0.01em'
            }}>
              Create, join, and organize projects to keep your support efforts perfectly structured.
            </p>
            <div className="content-area">
              <ProjectManagement userRole={userRole} tickets={tickets} onJoinClick={() => setIsJoinModalOpen(true)} key={projects.length} />
            </div>
          </>
        )}
      </main>

      <CreateTicketModal isOpen={isModalOpen} onRequestClose={() => setIsModalOpen(false)} onSuccess={handleFormSuccess} ticketToEdit={ticketToEdit} userRole={userRole} projects={projects} />
      <TicketDetailsModal isOpen={isViewModalOpen} onRequestClose={() => setIsViewModalOpen(false)} ticket={ticketToView} onCommentAdded={handleCommentAdded} currentUserRole={userRole} currentUsername={loggedInUsername} />
      <JoinProjectModal isOpen={isJoinModalOpen} onRequestClose={() => setIsJoinModalOpen(false)} onSuccess={() => { setIsJoinModalOpen(false); fetchProjects(); }} />
      <ToastContainer />
    </div>
  );
}

export default App;
