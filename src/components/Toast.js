import React, { useState, useEffect } from 'react';
import '../styles/Toast.css';

const Toast = ({ message, type, show, onClose }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000); // Auto close after 4 seconds

      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <i className="bi bi-check-circle-fill"></i>;
      case 'error':
        return <i className="bi bi-x-circle-fill"></i>;
      case 'warning':
        return <i className="bi bi-exclamation-triangle-fill"></i>;
      case 'info':
        return <i className="bi bi-info-circle-fill"></i>;
      default:
        return <i className="bi bi-info-circle-fill"></i>;
    }
  };

  return (
    <div className={`toast-notification toast-${type} ${show ? 'toast-show' : ''}`}>
      <div className="toast-content">
        <div className="toast-icon">
          {getIcon()}
        </div>
        <div className="toast-message">
          {message}
        </div>
        <button className="toast-close" onClick={onClose}>
          <i className="bi bi-x"></i>
        </button>
      </div>
    </div>
  );
};

export default Toast;