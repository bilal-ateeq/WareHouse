import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import Toast from "../components/Toast";
import "../styles/global.css";

function CreateUser() {
  const navigate = useNavigate();
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  
  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  
  // Form states
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState("viewer");

  // Show toast notification
  const showToast = (message, type) => {
    setToast({ show: true, message, type });
  };

  // Close toast notification
  const closeToast = () => {
    setToast({ show: false, message: '', type: '' });
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

  // Create new user
  const createNewUser = async (e) => {
    e.preventDefault();
    
    if (!newUserEmail || !newUserPassword || !newUserName) {
      showToast("Please fill all required fields", "error");
      return;
    }

    setCreating(true);

    try {
      // Create the user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, newUserEmail, newUserPassword);
      const newUser = userCredential.user;

      // Store additional user data in Firestore
      await setDoc(doc(db, "users", newUser.uid), {
        uid: newUser.uid,
        email: newUserEmail,
        displayName: newUserName,
        role: newUserRole,
        createdAt: new Date(),
        createdBy: auth.currentUser?.email || "Unknown"
      });

      showToast(`User ${newUserEmail} created successfully with role: ${newUserRole}`, "success");
      
      // Clear form
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserName("");
      setNewUserRole("viewer");

    } catch (error) {
      let errorMessage = error.message;
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "Email is already in use. Please use a different email.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "Password should be at least 6 characters.";
      }
      showToast(`Error creating user: ${errorMessage}`, "error");
    } finally {
      setCreating(false);
    }
  };

  // Handle back navigation
  const handleBack = () => {
    navigate("/dashboard");
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-content">
          <div className="text-center" style={{ padding: "2rem" }}>
            <div className="spinner-border text-primary" role="status" style={{ width: "3rem", height: "3rem" }}>
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3 text-muted">Checking permissions...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        show={toast.show}
        onClose={closeToast}
      />
      
      <div className="dashboard-content">
        <div className="dashboard-header mb-4">
          <div>
            <h1 className="dashboard-title">
              <i className="bi bi-person-plus-fill me-2"></i>
              Create New User
            </h1>
            <p className="mt-2 text-muted">Add a new user to the system</p>
          </div>
          <div>
            <button onClick={handleBack} className="btn btn-outline-primary">
              <i className="bi bi-arrow-left me-2"></i>
              Back to Dashboard
            </button>
          </div>
        </div>

        <div className="row justify-content-center">
          <div className="col-lg-8">
            <div className="dashboard-card">
              <div className="card-body">
                <h5 className="card-title mb-4">
                  <i className="bi bi-person-badge me-2"></i>
                  User Information
                </h5>

                <form onSubmit={createNewUser}>
                  <div className="row">
                    <div className="col-md-6 form-group mb-3">
                      <label htmlFor="newUserEmail" className="form-label">
                        <i className="bi bi-envelope me-2"></i>
                        Email Address *
                      </label>
                      <input
                        id="newUserEmail"
                        type="email"
                        className="form-control"
                        placeholder="Enter email address"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-md-6 form-group mb-3">
                      <label htmlFor="newUserPassword" className="form-label">
                        <i className="bi bi-lock me-2"></i>
                        Password *
                      </label>
                      <input
                        id="newUserPassword"
                        type="password"
                        className="form-control"
                        placeholder="Enter password (min 6 characters)"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        required
                        minLength="6"
                      />
                    </div>
                  </div>
                  
                  <div className="row">
                    <div className="col-md-6 form-group mb-3">
                      <label htmlFor="newUserName" className="form-label">
                        <i className="bi bi-person me-2"></i>
                        Full Name *
                      </label>
                      <input
                        id="newUserName"
                        type="text"
                        className="form-control"
                        placeholder="Enter full name"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-md-6 form-group mb-3">
                      <label htmlFor="newUserRole" className="form-label">
                        <i className="bi bi-shield-check me-2"></i>
                        Role *
                      </label>
                      <select
                        id="newUserRole"
                        className="form-select"
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value)}
                        required
                      >
                        <option value="viewer">Viewer - Can only view products</option>
                        <option value="manager">Manager - Can add/edit products</option>
                        <option value="admin">Admin - Full system access</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 d-flex gap-2">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={creating}
                    >
                      {creating ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Creating User...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-person-plus-fill me-2"></i>
                          Create User
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={handleBack}
                    >
                      <i className="bi bi-x-lg me-2"></i>
                      Cancel
                    </button>
                  </div>
                </form>

                <div className="mt-4 pt-4 border-top">
                  <h6 className="text-muted mb-3">
                    <i className="bi bi-info-circle me-2"></i>
                    Role Permissions
                  </h6>
                  <div className="row">
                    <div className="col-md-4">
                      <div className="card bg-light">
                        <div className="card-body">
                          <h6 className="card-title">
                            <span className="badge bg-secondary me-2">Viewer</span>
                          </h6>
                          <p className="card-text small">
                            • View product inventory<br/>
                            • View stock history<br/>
                            • Cannot modify data
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="card bg-light">
                        <div className="card-body">
                          <h6 className="card-title">
                            <span className="badge bg-warning me-2">Manager</span>
                          </h6>
                          <p className="card-text small">
                            • All viewer permissions<br/>
                            • Add/edit products<br/>
                            • Manage quantities
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="card bg-light">
                        <div className="card-body">
                          <h6 className="card-title">
                            <span className="badge bg-danger me-2">Admin</span>
                          </h6>
                          <p className="card-text small">
                            • All manager permissions<br/>
                            • User management<br/>
                            • Role assignments
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateUser;