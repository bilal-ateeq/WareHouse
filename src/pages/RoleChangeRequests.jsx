// src/pages/RoleChangeRequests.jsx
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { Link } from "react-router-dom";

const RoleChangeRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      // Simplified query without compound conditions that require an index
      const requestsSnapshot = await getDocs(collection(db, "roleChangeRequests"));
      
      // Filter and sort the data in JavaScript instead of using Firestore queries
      const data = requestsSnapshot.docs
        .map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate().toLocaleString() || "Unknown date"
        }))
        .filter(req => req.status === "pending" || !req.status) // Include both explicitly pending and those without status
        .sort((a, b) => {
          // Sort by createdAt timestamp in descending order if available
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });
      
      setRequests(data);
    } catch (error) {
      console.error("Error fetching role change requests:", error);
      alert("Error loading requests: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (requestId, userId, newRole) => {
    try {
      // Update user role in users collection
      await updateDoc(doc(db, "users", userId), { 
        role: newRole,
        roleUpdatedAt: new Date()
      });
      
      // Update request status to approved
      await updateDoc(doc(db, "roleChangeRequests", requestId), {
        status: "approved",
        processedAt: new Date()
      });
      
      alert(`Role change to ${newRole} approved successfully`);
      fetchRequests();
    } catch (error) {
      console.error("Error approving role change:", error);
      alert("Failed to approve role change: " + error.message);
    }
  };

  const handleRejection = async (requestId) => {
    try {
      // Update request status to rejected
      await updateDoc(doc(db, "roleChangeRequests", requestId), {
        status: "rejected",
        processedAt: new Date()
      });
      
      alert("Role change request rejected");
      fetchRequests();
    } catch (error) {
      console.error("Error rejecting role change:", error);
      alert("Failed to reject role change: " + error.message);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1>Role Change Requests</h1>
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
      
      <button 
        onClick={fetchRequests}
        style={{
          padding: "8px 15px",
          backgroundColor: "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: "4px",
          marginBottom: "20px",
          cursor: "pointer"
        }}
      >
        Refresh Requests
      </button>
      
      {loading ? (
        <p>Loading requests...</p>
      ) : requests.length === 0 ? (
        <p>No pending role change requests.</p>
      ) : (
        <div>
          {requests.map((req) => (
            <div 
              key={req.id} 
              style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "15px",
                marginBottom: "15px",
                backgroundColor: "#f9f9f9"
              }}
            >
              <p><strong>User:</strong> {req.email || req.userId}</p>
              <p><strong>Current Role:</strong> {req.currentRole || "Unknown"}</p>
              <p><strong>Requested Role:</strong> {req.requestedRole}</p>
              <p><strong>Requested At:</strong> {req.createdAt}</p>
              <p><strong>Requested By:</strong> {req.requestedByEmail || "Self"}</p>
              
              <div style={{ marginTop: "15px" }}>
                <button
                  onClick={() => handleApproval(req.id, req.userId, req.requestedRole)}
                  style={{
                    padding: "8px 15px",
                    backgroundColor: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    marginRight: "10px",
                    cursor: "pointer"
                  }}
                >
                  Approve
                </button>
                <button
                  onClick={() => handleRejection(req.id)}
                  style={{
                    padding: "8px 15px",
                    backgroundColor: "#f44336",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RoleChangeRequests;
