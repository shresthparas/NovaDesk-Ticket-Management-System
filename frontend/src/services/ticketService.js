
import axios from 'axios';
import authService from './authService';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8090";
const API_URL = `${BASE_URL}/api/tickets/`;
const PROJECTS_URL = `${BASE_URL}/api/projects/`;

const api = axios.create();

api.interceptors.request.use(
  (config) => {
    const token = authService.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const getAllTickets = (searchTerm, selectedCategory, options = {}) => {
  const params = new URLSearchParams();
  if (searchTerm?.trim()) params.append('search', searchTerm.trim());
  if (selectedCategory && selectedCategory !== 'All Categories') {
    params.append('category', selectedCategory);
  }
  if (options.myAssigned) params.append('my_assigned', 'true');
  if (options.assignedTo) params.append('assigned_to', options.assignedTo);
  if (options.projectId) params.append('project_id', options.projectId);
  return api.get(API_URL, { params });
};

const getAgents = () => api.get(API_URL + 'agents');
const getEligibleAssignees = (id) => api.get(`${API_URL}${id}/eligible-assignees`);

const createTicket = (formData) => api.post(API_URL, formData);

const getTicket = (id) => api.get(API_URL + id);

const updateTicket = async (id, ticketData) => {
  const response = await api.put(API_URL + id, ticketData);
  return response.data;
};

const deleteTicket = (id) => api.delete(API_URL + id);

const addComment = async (id, formData) => {
  const token = authService.getToken();
  const response = await axios.post(`${API_URL}${id}/comments`, formData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

const generateAiReply = async (id) => {
  const response = await api.get(`${API_URL}${id}/ai-reply`);
  return response.data;
};

const getNotifications = () => api.get(`${BASE_URL}/api/notifications/`);
const markNotificationRead = (id) => api.put(`${BASE_URL}/api/notifications/${id}/read`);
const deleteNotification = (id) => api.delete(`${BASE_URL}/api/notifications/${id}`);
const clearNotifications = () => api.delete(`${BASE_URL}/api/notifications/`);

export default {
  getAllTickets,
  getAgents,
  getEligibleAssignees,
  createTicket,
  getTicket,
  updateTicket,
  deleteTicket,
  addComment,
  generateAiReply,
  getNotifications,
  markNotificationRead,
  deleteNotification,
  clearNotifications,
  exportTicketsCSV: () => api.get(API_URL + 'export/csv', { responseType: 'blob' }),
  submitCSAT: (id, data) => api.post(`${API_URL}${id}/csat`, data),
  getSimilarTickets: (id) => api.get(`${API_URL}${id}/similar`),
  getProjects: () => api.get(PROJECTS_URL),
  createProject: (data) => api.post(PROJECTS_URL, data),
  joinProject: (projectId) => api.post(`${PROJECTS_URL}join`, { project_id: projectId }),
  addProjectMember: (projectId, username) => api.post(`${PROJECTS_URL}${projectId}/members`, { username }),
  getAllUsers: () => api.get(`${BASE_URL}/api/users`),
  updateUserRole: (username, role) => api.put(`${BASE_URL}/api/users/${username}/role`, { role }),
  deleteUser: (username) => api.delete(`${BASE_URL}/api/users/${username}`),
  BASE_URL,
};

export function getPriorityClass(priority) {
  switch (priority?.toLowerCase()) {
    case 'low': return 'priority-low';
    case 'medium': return 'priority-medium';
    case 'high': return 'priority-high';
    case 'critical': return 'priority-critical';
    default: return 'priority-medium';
  }
}
