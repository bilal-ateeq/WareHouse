// src/utils/requestRoleChange.js
import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { collection, addDoc, serverTimestamp, getDoc, doc } from "firebase/firestore";
import { Link } from "react-router-dom";

export const requestRoleChange = async (userId, newRole) => {
  try {
    // Get the current user's role
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    const currentRole = userSnap.exists() ? userSnap.data().role : "unknown";
    
    // Create the request
    await addDoc(collection(db, "roleChangeRequests"), {
      userId: userId,
      email: userSnap.data().email,
      currentRole: currentRole,
      requestedRole: newRole,
      requestedBy: auth.currentUser.uid,
      requestedByEmail: auth.currentUser.email,
      status: "pending",
      createdAt: serverTimestamp(),
    });
    
    return { success: true, message: "Role change request submitted for approval." };
  } catch (error) {
    console.error("Error requesting role change:", error);
    return { success: false, message: "Failed to submit request: " + error.message };
  }
};

const RequestRoleChangePage = () => {
  const [requestedRole, setRequestedRole] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRole = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const docRef = doc(db, "users", user.uid);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            setCurrentRole(snap.data().role || "No role assigned");
          }
        } catch (error) {
          console.error("Error fetching role:", error);
        }
      }
    };
    fetchRole();
  }, []);

  const submitRequest = async () => {
    const user = auth.currentUser;
    if (!requestedRole || !user) {
      setMessage("❌ Please select a role to request");
      return;
    }
    
    if (requestedRole === currentRole) {
      setMessage("❌ You already have this role");
      return;
    }
    
    setLoading(true);
    try {
      await addDoc(collection(db, "roleChangeRequests"), {
        userId: user.uid,
        email: user.email,
        currentRole,
        requestedRole,
        status: "pending",
        createdAt: serverTimestamp()
      });
      setMessage("✅ Request submitted for admin approval");
      setRequestedRole("");
    } catch (error) {
      console.error("Error submitting request:", error);
      setMessage(`❌ Failed to submit request: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2>Request Role Change</h2>
        <Link 
          to="/dashboard" 
          style={{ 
            padding: "8px 15px", 
            backgroundColor: "#4a6cf7", 
            color: "white", 
            textDecoration: "none", 
            borderRadius: "4px" 
          }}
        >
          Back to Dashboard
        </Link>
      </div>
      
      <div style={{ padding: "15px", border: "1px solid #ddd", borderRadius: "8px", backgroundColor: "#f9f9f9" }}>
        <p>Your current role: <strong>{currentRole}</strong></p>
        <p style={{ marginBottom: "15px" }}>Select the role you would like to request:</p>
        
        <select
          value={requestedRole}
          onChange={(e) => setRequestedRole(e.target.value)}
          style={{ 
            width: "100%", 
            padding: "8px", 
            marginBottom: "15px", 
            borderRadius: "4px",
            border: "1px solid #ddd"
          }}
        >
          <option value="">-- Select new role --</option>
          <option value="manager">Manager</option>
          <option value="staff">Staff</option>
          <option value="viewer">Viewer</option>
          <option value="admin">Admin</option>
        </select>
        
        <button
          onClick={submitRequest}
          disabled={loading}
          style={{ 
            backgroundColor: "#4CAF50", 
            color: "white", 
            padding: "10px 15px", 
            border: "none", 
            borderRadius: "4px", 
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? "Submitting..." : "Submit Request"}
        </button>
        
        {message && (
          <p style={{ 
            marginTop: "15px", 
            padding: "10px", 
            borderRadius: "4px",
            backgroundColor: message.includes("✅") ? "#e8f5e9" : "#ffebee"
          }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default RequestRoleChangePage;
