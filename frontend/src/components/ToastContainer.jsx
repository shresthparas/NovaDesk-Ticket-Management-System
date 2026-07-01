import React from 'react';
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaTimes } from 'react-icons/fa';
import { useToast } from '../context/ToastContext';

const icons = {
  success: FaCheckCircle,
  error: FaExclamationCircle,
  info: FaInfoCircle,
  warning: FaExclamationCircle,
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map(({ id, message, type }) => {
        const Icon = icons[type] || FaInfoCircle;
        return (
          <div key={id} className={`toast toast-${type}`}>
            <Icon className="toast-icon" />
            <span className="toast-message">{message}</span>
            <button className="toast-close" onClick={() => removeToast(id)} aria-label="Dismiss">
              <FaTimes size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
