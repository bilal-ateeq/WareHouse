// src/pages/RoleRequestsPage.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPendingRoleRequests, processRoleRequest } from '../services/roleService';

const RoleRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });

  const fetchRequests = async () => {
    setLoading(true);
    setMessage({ text: '', type: '' });
    
    try {
      const pendingRequests = await getPendingRoleRequests();
      setRequests(pendingRequests);
      
      if (pendingRequests.length === 0) {
        setMessage({ 
          text: 'No pending role change requests found', 
          type: 'info' 
        });
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
      setMessage({ 
        text: `Error loading requests: ${error.message}`, 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleRequestAction = async (userId, action) => {
    setProcessingId(userId);
    setMessage({ text: '', type: '' });
    
    try {
      const result = await processRoleRequest(userId, action);
      
      if (result.success) {
        setMessage({ text: result.message, type: 'success' });
        // Remove the processed request from the list
        setRequests(prev => prev.filter(req => req.id !== userId));
      } else {
        setMessage({ text: result.message, type: 'error' });
      }
    } catch (error) {
      setMessage({ 
        text: `Error processing request: ${error.message}`, 
        type: 'error' 
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h1>Role Change Requests</h1>
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

      {message.text && (
        <div style={{ 
          marginBottom: '20px',
          padding: '10px', 
          borderRadius: '4px',
          backgroundColor: 
            message.type === 'success' ? '#e8f5e9' : 
            message.type === 'error' ? '#ffebee' : '#e3f2fd',
          color: 
            message.type === 'success' ? '#2e7d32' : 
            message.type === 'error' ? '#c62828' : '#0d47a1'
        }}>
          {message.text}
        </div>
      )}

      <button 
        onClick={fetchRequests}
        disabled={loading}
        style={{
          padding: '8px 15px',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          marginBottom: '20px',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1
        }}
      >
        {loading ? 'Loading...' : 'Refresh Requests'}
      </button>

      {loading ? (
        <p>Loading role change requests...</p>
      ) : (
        <div>
          {requests.length === 0 && !message.text ? (
            <p>No pending role change requests found.</p>
          ) : (
            requests.map(user => (
              <div 
                key={user.id} 
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '15px',
                  marginBottom: '15px',
                  backgroundColor: '#f9f9f9'
                }}
              >
                <div style={{ marginBottom: '15px' }}>
                  <p><strong>User:</strong> {user.email}</p>
                  <p><strong>Current Role:</strong> {user.roleRequest?.currentRole || 'None'}</p>
                  <p><strong>Requested Role:</strong> {user.roleRequest?.requestedRole}</p>
                  <p><strong>Requested On:</strong> {user.requestedAt.toLocaleString()}</p>
                </div>
                
                <div>
                  <button
                    onClick={() => handleRequestAction(user.id, 'approve')}
                    disabled={processingId === user.id}
                    style={{
                      padding: '8px 15px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      marginRight: '10px',
                      cursor: processingId === user.id ? 'not-allowed' : 'pointer',
                      opacity: processingId === user.id ? 0.7 : 1
                    }}
                  >
                    {processingId === user.id ? 'Processing...' : 'Approve'}
                  </button>
                  
                  <button
                    onClick={() => handleRequestAction(user.id, 'reject')}
                    disabled={processingId === user.id}
                    style={{
                      padding: '8px 15px',
                      backgroundColor: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: processingId === user.id ? 'not-allowed' : 'pointer',
                      opacity: processingId === user.id ? 0.7 : 1
                    }}
                  >
                    {processingId === user.id ? 'Processing...' : 'Reject'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default RoleRequestsPage;