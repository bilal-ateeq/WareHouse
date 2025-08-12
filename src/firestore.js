import { collection, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

// User requests a role change
export async function requestRoleChange(userId, requestedRole) {
  try {
    await addDoc(collection(db, "RoleChangeRequests"), {
      userId,
      requestedRole,
      status: "pending",
      requestedAt: serverTimestamp(),
    });
    alert("Role change request submitted for admin approval.");
  } catch (error) {
    console.error("Error requesting role change:", error);
  }
}

// Admin approves a role change
export async function approveRoleChange(requestId, userId, newRole, adminId) {
  try {
    await updateDoc(doc(db, "Users", userId), {
      role: newRole,
    });

    await updateDoc(doc(db, "RoleChangeRequests", requestId), {
      status: "approved",
      processedAt: serverTimestamp(),
      processedBy: adminId
    });

    alert("Role updated and request approved.");
  } catch (error) {
    console.error("Error approving role change:", error);
  }
}

// Admin rejects a role change
export async function rejectRoleChange(requestId, adminId) {
  try {
    await updateDoc(doc(db, "RoleChangeRequests", requestId), {
      status: "rejected",
      processedAt: serverTimestamp(),
      processedBy: adminId
    });
    alert("Request rejected.");
  } catch (error) {
    console.error("Error rejecting request:", error);
  }
}
