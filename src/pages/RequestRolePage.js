// src/pages/RequestRolePage.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { createUserRoleRequest } from '../services/roleService';

const RequestRolePage = () => {
  const [currentRole, setCurrentRole] = useState('');
  const [requestedRole, setRequestedRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Fetch current user role
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            setCurrentRole(userDoc.data().role || 'none');
          }
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
      }
    };

    fetchUserRole();
  }, []);

  const handleSubmitRequest = async () => {
    setMessage({ text: '', type: '' });
    
    if (!requestedRole) {
      setMessage({ text: 'Please select a role to request', type: 'error' });
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await createUserRoleRequest(requestedRole);
      
      if (result.success) {
        setMessage({ text: result.message, type: 'success' });
        setRequestedRole(''); // Reset selection
      } else {
        setMessage({ text: result.message, type: 'error' });
      }
    } catch (error) {
      setMessage({ 
        text: `An error occurred: ${error.message}`, 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h1>Request Role Change</h1>
        <Link 
          to="/dashboard" 
          style={{ 
            padding: '8px 15px', 
            backgroundColor: '#4a6cf7', 
            color: 'white', 
            textDecoration: 'none', 
            borderRadius: '4px' 
          }}
        >
          Back to Dashboard
        </Link>
      </div>

      <div style={{ 
        padding: '20px', 
        border: '1px solid #ddd', 
        borderRadius: '8px', 
        backgroundColor: '#f9f9f9'
      }}>
        <p>Your current role: <strong>{currentRole}</strong></p>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Select the role you would like to request:
          </label>
          <select
            value={requestedRole}
            onChange={(e) => setRequestedRole(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '10px', 
              borderRadius: '4px',
              border: '1px solid #ddd'
            }}
            disabled={loading}
          >
            <option value="">-- Select role --</option>
            <option value="viewer">Viewer (View only access)</option>
            <option value="manager">Manager (Can manage inventory)</option>
            <option value="admin">Admin (Full access)</option>
          </select>
        </div>

        <button
          onClick={handleSubmitRequest}
          disabled={loading}
          style={{ 
            backgroundColor: '#4CAF50', 
            color: 'white', 
            border: 'none', 
            padding: '10px 15px', 
            borderRadius: '4px', 
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'Submitting...' : 'Submit Request'}
        </button>

        {message.text && (
          <div style={{ 
            marginTop: '15px', 
            padding: '10px', 
            borderRadius: '4px',
            backgroundColor: message.type === 'success' ? '#e8f5e9' : '#ffebee',
            color: message.type === 'success' ? '#2e7d32' : '#c62828'
          }}>
            {message.text}
          </div>
        )}
      </div>

      {/* Role descriptions */}
      <div style={{ 
        marginTop: '20px',
        padding: '15px', 
        border: '1px solid #ddd', 
        borderRadius: '8px', 
        backgroundColor: '#f9f9f9'
      }}>
        <h3 style={{ marginTop: '0' }}>Role Descriptions</h3>
        <ul style={{ paddingLeft: '20px' }}>
          <li><strong>Viewer:</strong> Can only view inventory levels and history. No ability to modify data.</li>
          <li><strong>Manager:</strong> Can add new products, update inventory levels, and view all data.</li>
          <li><strong>Admin:</strong> Full access to all system features, including user management.</li>
        </ul>
      </div>
    </div>
  );
};

export default RequestRolePage;