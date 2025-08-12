// src/pages/RoleRequestsPage.jsx
import React, { useEffect, useState } from "react";
import { db } from "../firestore"; // adjust path if needed
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext"; // your existing auth context

export default function RoleRequestsPage() {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    setLoading(true);
    const snapshot = await getDocs(collection(db, "roleRequests"));
    const data = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    setRequests(data);
    setLoading(false);
  };

  const handleApprove = async (req) => {
    try {
      // Update role in users collection
      const userRef = doc(db, "users", req.userId);
      await updateDoc(userRef, { role: req.requestedRole });

      // Remove the request from the queue
      await deleteDoc(doc(db, "roleRequests", req.id));

      alert(`Approved role change for ${req.email} to ${req.requestedRole}`);
      fetchRequests();
    } catch (error) {
      console.error("Error approving role:", error);
      alert("Failed to approve role change.");
    }
  };

  const handleReject = async (req) => {
    try {
      await deleteDoc(doc(db, "roleRequests", req.id));
      alert(`Rejected role change for ${req.email}`);
      fetchRequests();
    } catch (error) {
      console.error("Error rejecting role:", error);
      alert("Failed to reject role change.");
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Only allow admins to see this page
  if (currentUser?.role !== "admin") {
    return <p>Access denied — Admins only</p>;
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>Pending Role Change Requests</h2>
      {loading ? (
        <p>Loading...</p>
      ) : requests.length === 0 ? (
        <p>No pending requests</p>
      ) : (
        <table border="1" cellPadding="8" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Email</th>
              <th>Requested Role</th>
              <th>Current Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <tr key={req.id}>
                <td>{req.email}</td>
                <td>{req.requestedRole}</td>
                <td>{req.currentRole}</td>
                <td>
                  <button
                    onClick={() => handleApprove(req)}
                    style={{ marginRight: "8px" }}
                  >
                    Approve
                  </button>
                  <button onClick={() => handleReject(req)}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
