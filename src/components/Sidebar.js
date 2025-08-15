import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/Sidebar.css';

const Sidebar = ({ role, isOpen, onToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      path: '/dashboard',
      icon: 'bi-house-door',
      label: 'Dashboard',
      roles: ['admin', 'manager', 'viewer']
    },
    {
      path: '/sales',
      icon: 'bi-cart3',
      label: 'Sales',
      roles: ['admin', 'manager']
    },
    {
      path: '/admin/user-management',
      icon: 'bi-people',
      label: 'User Management',
      roles: ['admin']
    },
    {
      path: '/admin/create-user',
      icon: 'bi-person-plus',
      label: 'Create User',
      roles: ['admin']
    },
    {
      path: '/admin/role-requests',
      icon: 'bi-person-check',
      label: 'Role Requests',
      roles: ['admin']
    }
  ];

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(role)
  );

  return (
    <>
      {/* Sidebar */}
      <div className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <i className="bi bi-boxes me-2"></i>
            <span>Stock Manager</span>
          </div>
          <button 
            className="sidebar-toggle d-lg-none"
            onClick={onToggle}
          >
            <i className="bi bi-x"></i>
          </button>
        </div>
        
        <nav className="sidebar-nav">
          <ul className="nav flex-column">
            {filteredMenuItems.map((item) => (
              <li key={item.path} className="nav-item">
                <button
                  className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                  onClick={() => {
                    navigate(item.path);
                    if (window.innerWidth < 992) {
                      onToggle();
                    }
                  }}
                >
                  <i className={`${item.icon} me-2`}></i>
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <i className="bi bi-person-circle me-2"></i>
            <span className="user-role">{role || 'No role'}</span>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isOpen && <div className="sidebar-overlay" onClick={onToggle}></div>}
    </>
  );
};

export default Sidebar;