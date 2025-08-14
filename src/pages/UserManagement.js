import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { onSnapshot, collection, doc, getDoc, deleteDoc } from "firebase/firestore";
import { changeUserRole, getPendingRoleRequests } from "../services/roleService";
import Toast from "../components/Toast";
import Sidebar from "../components/Sidebar";
import "../styles/global.css";

function UserManagement() {
  const navigate = useNavigate();
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  
  // User management states
  const [users, setUsers] = useState([]);
  const [processingUserId, setProcessingUserId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);

  // Show toast notification
  const showToast = (message, type) => {
    setToast({ show: true, message, type });
  };

  // Close toast notification
  const closeToast = () => {
    setToast({ show: false, message: '', type: '' });
  };

  // Toggle sidebar
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Fetch user role and check permissions
  useEffect(() => {
    const checkPermissions = async () => {
      if (auth.currentUser) {
        try {
          const userRef = doc(db, "users", auth.currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userRole = userSnap.data().role || "";
            setRole(userRole);
            
            // Redirect if not admin
            if (userRole !== "admin") {
              showToast("You don't have permission to access this page", "error");
              setTimeout(() => navigate("/dashboard"), 2000);
            }
          } else {
            navigate("/dashboard");
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          navigate("/dashboard");
        }
      } else {
        navigate("/login");
      }
      setLoading(false);
    };
    
    checkPermissions();
  }, [navigate]);

  // Fetch users and pending requests if admin
  useEffect(() => {
    if (role === "admin") {
      // Fetch users
      const userUnsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
        const allUsers = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUsers(allUsers);
      });
      
      // Fetch pending role requests
      const fetchPendingRequests = async () => {
        try {
          const requests = await getPendingRoleRequests();
          setPendingRequests(requests);
        } catch (error) {
          console.error("Error fetching pending role requests:", error);
        }
      };
      
      fetchPendingRequests();
      
      // Set up an interval to check for new requests every minute
      const requestInterval = setInterval(fetchPendingRequests, 60000);
      
      return () => {
        userUnsubscribe();
        clearInterval(requestInterval);
      };
    }
  }, [role]);

  // Handle direct role change (admin only)
  const handleDirectRoleChange = async (userId, newRole) => {
    setProcessingUserId(userId);
    
    try {
      const result = await changeUserRole(userId, newRole);
      
      if (result.success) {
        showToast(result.message, "success");
      } else {
        showToast(result.message, "error");
      }
    } catch (error) {
      showToast(`Error: ${error.message}`, "error");
    } finally {
      setProcessingUserId(null);
    }
  };

  // Delete user (admin only)
  const deleteUser = async (userId, userEmail) => {
    // Prevent admin from deleting themselves
    if (userId === auth.currentUser?.uid) {
      showToast("You cannot delete your own account", "error");
      return;
    }

    // Confirm deletion
    const confirmDelete = window.confirm(
      `Are you sure you want to delete user "${userEmail}"? This action cannot be undone.`
    );
    
    if (!confirmDelete) return;

    setDeletingUserId(userId);

    try {
      // Delete user document from Firestore
      await deleteDoc(doc(db, "users", userId));
      
      showToast(`User "${userEmail}" has been removed from the system.`, "success");

    } catch (error) {
      console.error("Error deleting user:", error);
      showToast(`Error deleting user: ${error.message}`, "error");
    } finally {
      setDeletingUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-content">
          <div className="text-center" style={{ padding: "2rem" }}>
            <div className="spinner-border text-primary" role="status" style={{ width: "3rem", height: "3rem" }}>
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3 text-muted">Loading user management...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Sidebar role={role} isOpen={sidebarOpen} onToggle={toggleSidebar} />
      
      <div className="main-content">
        {/* Toast Notification */}
        <Toast
          message={toast.message}
          type={toast.type}
          show={toast.show}
          onClose={closeToast}
        />
        
        {/* Header */}
        <div className="dashboard-header-with-sidebar">
          <div className="d-flex align-items-center">
            <button 
              className="sidebar-toggle-btn d-lg-none me-3"
              onClick={toggleSidebar}
            >
              <i className="bi bi-list"></i>
            </button>
            <div>
              <h1 className="dashboard-title mb-0">
                <i className="bi bi-people me-2"></i>
                User Management
              </h1>
              <p className="mt-1 mb-0 text-muted">Manage user roles and permissions</p>
            </div>
          </div>
          <div>
            <button 
              onClick={() => navigate("/admin/create-user")}
              className="btn btn-primary me-2"
            >
              <i className="bi bi-person-plus me-2"></i>
              Create User
            </button>
            <button 
              onClick={() => navigate("/dashboard")}
              className="btn btn-outline-primary"
            >
              <i className="bi bi-house me-2"></i>
              Dashboard
            </button>
          </div>
        </div>

        <div className="dashboard-content">
          {/* User Management Table */}
          <div className="dashboard-card mb-4">
            <div className="dashboard-header mb-4">
              <h2 className="dashboard-title">System Users</h2>
            </div>
            
            <div className="table-responsive">
              <table className="table table-striped table-hover">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Current Role</th>
                    <th>Change Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>{u.displayName || "N/A"}</td>
                      <td>
                        <span className={`badge ${
                          u.role === 'admin' ? 'bg-danger' : 
                          u.role === 'manager' ? 'bg-warning' : 
                          'bg-secondary'
                        }`}>
                          {u.role || "No role"}
                        </span>
                      </td>
                      <td>
                        <select
                          disabled={processingUserId === u.id}
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleDirectRoleChange(u.id, e.target.value);
                              e.target.value = "";
                            }
                          }}
                          className="form-select form-select-sm"
                          style={{
                            opacity: processingUserId === u.id ? 0.7 : 1,
                            minWidth: "120px"
                          }}
                        >
                          <option value="">Change Role</option>
                          <option value="viewer">Viewer</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td>
                        <button
                          onClick={() => deleteUser(u.id, u.email)}
                          disabled={deletingUserId === u.id || u.id === auth.currentUser?.uid}
                          className="btn btn-sm btn-outline-danger"
                          title={u.id === auth.currentUser?.uid ? "Cannot delete your own account" : "Delete user"}
                        >
                          {deletingUserId === u.id ? (
                            <span>
                              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                              Deleting...
                            </span>
                          ) : (
                            <>
                              <i className="bi bi-trash me-1"></i>
                              Delete
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Role Change Requests */}
          <div className="dashboard-card">
            <div className="dashboard-header mb-4">
              <h2 className="dashboard-title">Pending Role Change Requests</h2>
            </div>
            
            {pendingRequests.length === 0 ? (
              <div className="alert alert-info">
                <i className="bi bi-info-circle me-2"></i>
                No pending role change requests
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped table-hover">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Requested Role</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRequests.map((request) => (
                      <tr key={request.id}>
                        <td>{request.email}</td>
                        <td>
                          <span className={`badge ${
                            request.requestedRole === 'admin' ? 'bg-danger' : 
                            request.requestedRole === 'manager' ? 'bg-warning' : 
                            'bg-secondary'
                          }`}>
                            {request.requestedRole}
                          </span>
                        </td>
                        <td>
                          <span className="badge bg-warning">
                            {request.status}
                          </span>
                        </td>
                        <td>{request.timestamp?.toDate().toLocaleString() || "-"}</td>
                        <td>
                          <button 
                            onClick={() => navigate("/admin/role-requests")}
                            className="btn btn-sm btn-primary"
                          >
                            <i className="bi bi-eye me-1"></i>
                            View Details
                          </button>
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
    </>
  );
}

export default UserManagement;