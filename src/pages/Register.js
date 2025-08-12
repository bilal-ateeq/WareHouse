import React, { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from "react-router-dom";
import "../styles/global.css";
import warehouseLogo from "../assets/warehouse-logo.svg";
import UserRegister from "./UserRegister";

function Requests() {
  const [requests, setRequests] = useState([]);
  const [currentUserRole, setCurrentUserRole] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserRoleAndRequests = async () => {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          const userDoc = await getDocs(collection(db, "users"));
          const foundUser = userDoc.docs.find(doc => doc.data().uid === user.uid);
          if (foundUser) {
            setCurrentUserRole(foundUser.data().role);
          }

          const reqSnapshot = await getDocs(collection(db, 'requests'));
          setRequests(reqSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } else {
          // Redirect to login if not authenticated
          navigate('/login');
        }
      });
    };
    fetchUserRoleAndRequests();
  }, [navigate]);

  const handleApprove = async (id) => {
    await updateDoc(doc(db, 'requests', id), { status: 'approved' });
    setRequests(prev => prev.map(req => req.id === id ? { ...req, status: 'approved' } : req));
  };

  const handleReject = async (id) => {
    await updateDoc(doc(db, 'requests', id), { status: 'rejected' });
    setRequests(prev => prev.map(req => req.id === id ? { ...req, status: 'rejected' } : req));
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-content">
        <div className="dashboard-card">
          <div className="dashboard-header">
            <h2 className="dashboard-title">Stock Requests</h2>
            <button className="btn btn-outline-primary" onClick={handleBack}>
              Back to Dashboard
            </button>
          </div>

          {requests.length === 0 ? (
            <div className="alert alert-info">No requests found</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-hover">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.id}>
                      <td>{req.productName}</td>
                      <td>{req.quantity}</td>
                      <td>
                        <span className={`badge ${
                          req.status === 'approved' ? 'bg-success' : 
                          req.status === 'rejected' ? 'bg-danger' : 
                          'bg-warning'
                        }`} style={{
                          padding: '0.35em 0.65em',
                          fontSize: '0.75em',
                          fontWeight: '700',
                          borderRadius: '0.25rem',
                          color: 'white',
                          backgroundColor: 
                            req.status === 'approved' ? 'var(--secondary-color)' : 
                            req.status === 'rejected' ? 'var(--danger-color)' : 
                            'var(--warning-color)'
                        }}>
                          {req.status}
                        </span>
                      </td>
                      <td>
                        {currentUserRole === 'admin' && req.status === 'pending' && (
                          <div>
                            <button 
                              className="btn btn-secondary btn-sm mr-2"
                              onClick={() => handleApprove(req.id)}
                              style={{ marginRight: '0.5rem' }}
                            >
                              Approve
                            </button>
                            <button 
                              className="btn btn-danger btn-sm"
                              onClick={() => handleReject(req.id)}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserRegister;
