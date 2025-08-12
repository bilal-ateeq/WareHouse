// src/services/roleService.js
import { db, auth } from '../firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc,
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';

/**
 * Create a new role change request by updating the user's own document
 * @param {string} requestedRole - The role being requested
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const createUserRoleRequest = async (requestedRole) => {
  try {
    // Validate input
    if (!requestedRole) {
      return { success: false, message: "No role selected" };
    }

    const user = auth.currentUser;
    if (!user) {
      return { success: false, message: "You must be logged in to request a role change" };
    }

    // Get current user's role
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return { success: false, message: "User profile not found" };
    }

    const currentRole = userDoc.data().role || "none";
    
    // Don't allow requesting the same role
    if (currentRole === requestedRole) {
      return { success: false, message: "You already have this role" };
    }

    // Update the user's own document with role request info
    // This is a simple update operation that should work with basic security rules
    await updateDoc(userRef, {
      roleRequest: {
        requestedRole: requestedRole,
        currentRole: currentRole,
        status: "pending",
        requestedAt: serverTimestamp()
      }
    });

    return { 
      success: true, 
      message: "Role change request submitted successfully"
    };
  } catch (error) {
    console.error("Error creating role request:", error);
    return { success: false, message: `Request failed: ${error.message}` };
  }
};

/**
 * Get all pending role requests
 * @returns {Promise<Array>} - List of role requests
 */
export const getPendingRoleRequests = async () => {
  try {
    // Get all users
    const usersSnapshot = await getDocs(collection(db, "users"));
    
    // Filter users that have pending role requests
    return usersSnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        email: doc.data().email,
        requestedAt: doc.data().roleRequest?.requestedAt?.toDate() || new Date(),
      }))
      .filter(user => user.roleRequest && user.roleRequest.status === "pending")
      .sort((a, b) => b.requestedAt - a.requestedAt);
  } catch (error) {
    console.error("Error fetching role requests:", error);
    throw error;
  }
};

/**
 * Process a role change request (approve or reject)
 * @param {string} userId - User ID of the request subject
 * @param {string} action - "approve" or "reject"
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const processRoleRequest = async (userId, action) => {
  try {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return { success: false, message: "User not found" };
    }
    
    const userData = userDoc.data();
    const roleRequest = userData.roleRequest;
    
    if (!roleRequest) {
      return { success: false, message: "No role request found for this user" };
    }
    
    // If approved, update user's role
    if (action === "approve") {
      await updateDoc(userRef, {
        role: roleRequest.requestedRole,
        roleUpdatedAt: serverTimestamp(),
        roleRequest: {
          ...roleRequest,
          status: "approved",
          processedAt: serverTimestamp(),
          processedBy: auth.currentUser?.email || "admin"
        }
      });
      
      return { success: true, message: `Role change to ${roleRequest.requestedRole} approved successfully` };
    } else {
      // Just update the request status to rejected
      await updateDoc(userRef, {
        roleRequest: {
          ...roleRequest,
          status: "rejected",
          processedAt: serverTimestamp(),
          processedBy: auth.currentUser?.email || "admin"
        }
      });
      
      return { success: true, message: "Role change request rejected" };
    }
  } catch (error) {
    console.error(`Error ${action}ing role request:`, error);
    return { success: false, message: `Failed to ${action} request: ${error.message}` };
  }
};

/**
 * Change a user's role directly (admin function)
 * @param {string} userId - User ID to update
 * @param {string} newRole - New role to assign
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const changeUserRole = async (userId, newRole) => {
  try {
    const userRef = doc(db, "users", userId);
    
    // Get user data
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      return { success: false, message: "User not found" };
    }
    
    const oldRole = userDoc.data().role || "none";
    
    // Update user's role directly
    await updateDoc(userRef, {
      role: newRole,
      roleUpdatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.email || "unknown"
    });
    
    return { success: true, message: `User role updated to ${newRole} successfully` };
  } catch (error) {
    console.error("Error changing user role:", error);
    return { success: false, message: `Failed to update role: ${error.message}` };
  }
};