import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import ticketService from '../services/ticketService.js';
import { useToast } from '../context/ToastContext';
import { FaTimes, FaCloudUploadAlt } from 'react-icons/fa';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

Modal.setAppElement('#root');

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

const CreateTicketModal = ({ isOpen, onRequestClose, onSuccess, ticketToEdit, userRole, projects = [] }) => {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [status, setStatus] = useState('Open');
  const [assignedTo, setAssignedTo] = useState('');
  const [agents, setAgents] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [customSlaHours, setCustomSlaHours] = useState('');
  const [customFieldsData, setCustomFieldsData] = useState({});
  const [projectId, setProjectId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canAssign = userRole === 'admin' || userRole === 'agent';

  useEffect(() => {
    if (isOpen && canAssign && projectId) {
      // Need a way to fetch eligible agents. For creation, maybe we can fetch members of this project from backend
      // But we added getEligibleAssignees(id), wait... if ticket is not created, we can't use ticket ID.
      // We should use a new endpoint or get project members. Let's just fetch all agents and filter if possible,
      // or we can just fetch all agents for now since assigning on creation might not be fully project-scoped on frontend without a dedicated endpoint.
      // Wait, we can just let ticketService.getAgents() and we trust the admin/agent for now.
      ticketService.getAgents()
        .then((res) => setAgents(res.data))
        .catch(() => setAgents([]));
    } else {
      setAgents([]);
    }
  }, [isOpen, canAssign, projectId]);

  useEffect(() => {
    if (isOpen) {
      if (ticketToEdit) {
        setTitle(ticketToEdit.title || '');
        setDescription(ticketToEdit.description || '');
        setCategory(ticketToEdit.category || '');
        setPriority(ticketToEdit.priority || 'Medium');
        setStatus(ticketToEdit.status || 'Open');
        setAssignedTo(ticketToEdit.assigned_to || '');
        setProjectId(ticketToEdit.project_id || '');
      } else {
        setTitle('');
        setDescription('');
        setCategory('');
        setPriority('Medium');
        setStatus('Open');
        setAssignedTo('');
        setProjectId(projects.length > 0 ? projects[0].project_id : '');
      }
      setSelectedFiles([]);
      setCustomSlaHours('');
      setCustomFieldsData({});
      setError('');
    }
  }, [isOpen, ticketToEdit]);

  const handleFileChange = (e) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title || !description || !category) {
      setError('Title, Description, and Category are required.');
      return;
    }

    setSubmitting(true);
    try {
      if (ticketToEdit) {
        const updateData = { title, description, category, priority, project_id: projectId };
        if (canAssign) {
          updateData.status = status;
          updateData.assigned_to = assignedTo || '';
        }
        await ticketService.updateTicket(ticketToEdit.id, updateData);
        toast.success('Ticket updated successfully!');
      } else {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('category', category);
        formData.append('priority', priority);
        formData.append('project_id', projectId);
        if (customSlaHours) {
          formData.append('custom_sla_hours', parseInt(customSlaHours, 10));
        }
        if (Object.keys(customFieldsData).length > 0) {
          formData.append('custom_fields_data', JSON.stringify(customFieldsData));
        }
        selectedFiles.forEach(file => {
          formData.append('attachments', file);
        });
        await ticketService.createTicket(formData);
        toast.success('Ticket created successfully!');
      }
      onSuccess();
      onRequestClose();
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message;
      setError(`Operation failed: ${errorMessage}`);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const modalTitle = ticketToEdit ? 'Edit Ticket' : 'Create New Ticket';
  const submitButtonText = submitting ? 'Saving...' : (ticketToEdit ? 'Update Ticket' : 'Create Ticket');

  return (
    <Modal isOpen={isOpen} onRequestClose={onRequestClose} contentLabel={modalTitle} className="modal-content" overlayClassName="modal-overlay">
      <div className="modal-header">
        <h2>{modalTitle}</h2>
        <button onClick={onRequestClose} className="modal-close-button"><FaTimes /></button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Title</label>
          <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter ticket title" />
        </div>
        <div className="form-group">
          <label htmlFor="project">Project (Optional)</label>
          <select id="project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">No Project</option>
            {(projects || []).map(p => (
              <option key={p.project_id} value={p.project_id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="category">Category</label>
            <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="" disabled>Select Category</option>
              <option value="Auto-Detect (AI)">✨ Auto-Detect (AI)</option>
              <option value="Bug">Bug</option>
              <option value="Feedback">Feedback</option>
              <option value="Feature Request">Feature Request</option>
              <option value="support">Support</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="priority">Priority</label>
            <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="customSlaHours">Custom SLA (Hours) - Optional</label>
            <input type="number" id="customSlaHours" min="1" value={customSlaHours} onChange={(e) => setCustomSlaHours(e.target.value)} placeholder="e.g. 2" />
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: '60px' }}>
          <label htmlFor="description">Description</label>
          <ReactQuill 
            theme="snow"
            value={description}
            onChange={setDescription}
            placeholder="Describe your issue or feedback..."
            style={{ height: '150px' }}
          />
        </div>

        {category === 'Bug' && (
          <>
            <div className="form-group">
              <label>Steps to Reproduce</label>
              <textarea 
                value={customFieldsData.steps || ''} 
                onChange={(e) => setCustomFieldsData({...customFieldsData, steps: e.target.value})} 
                placeholder="1. Go to... 2. Click..." rows={2} 
              />
            </div>
            <div className="form-group">
              <label>Environment / OS</label>
              <input 
                type="text" 
                value={customFieldsData.environment || ''} 
                onChange={(e) => setCustomFieldsData({...customFieldsData, environment: e.target.value})} 
                placeholder="e.g. Windows 11, Chrome 120" 
              />
            </div>
          </>
        )}
        {category === 'Feature Request' && (
          <div className="form-group">
            <label>Business Impact</label>
            <select 
              value={customFieldsData.impact || ''} 
              onChange={(e) => setCustomFieldsData({...customFieldsData, impact: e.target.value})}
            >
              <option value="" disabled>Select Impact</option>
              <option value="High">High - Blocks revenue/users</option>
              <option value="Medium">Medium - Important enhancement</option>
              <option value="Low">Low - Nice to have</option>
            </select>
          </div>
        )}
        {(category === 'support' || category === 'Support') && (
          <div className="form-group">
            <label>Contact Phone (Optional)</label>
            <input 
              type="text" 
              value={customFieldsData.phone || ''} 
              onChange={(e) => setCustomFieldsData({...customFieldsData, phone: e.target.value})} 
              placeholder="+1 234 567 8900" 
            />
          </div>
        )}

        {ticketToEdit && canAssign && (
          <>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="status">Status</label>
                <select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              {userRole === 'admin' && (
                <div className="form-group">
                  <label htmlFor="assignedTo">Assign To</label>
                  <select id="assignedTo" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                    <option value="">Unassigned</option>
                    {projectId && projects?.find(p => p.project_id === projectId)?.members?.length > 0 
                      ? projects.find(p => p.project_id === projectId).members.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))
                      : agents.map((a) => (
                          <option key={a.username} value={a.username}>{a.username} ({a.role})</option>
                        ))
                    }
                  </select>
                </div>
              )}
            </div>
          </>
        )}

        {!ticketToEdit && (
          <div className="form-group">
            <label htmlFor="fileUpload">Upload Files (Optional)</label>
            <div className="file-upload-area">
              <input type="file" id="fileUpload" multiple onChange={handleFileChange} style={{ display: 'none' }} />
              <label htmlFor="fileUpload" className="btn btn-secondary upload-btn">
                <FaCloudUploadAlt /> Choose Files
              </label>
              {selectedFiles.length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  {selectedFiles.map((f, i) => (
                    <div key={i}>{f.name}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="modal-footer">
          <button type="button" onClick={onRequestClose} className="btn btn-secondary">Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>{submitButtonText}</button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateTicketModal;
