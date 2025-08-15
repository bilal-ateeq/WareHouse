import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ProductDetails from "./pages/ProductDetails";
import CreateUser from "./pages/CreateUser";
import UserManagement from "./pages/UserManagement";
import Sales from "./pages/Sales";
import RequestRolePage from "./pages/RequestRolePage";
import RoleRequestsPage from "./pages/RoleRequestsPage";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // Fetch user role
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role || null);
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
        }
      } else {
        setUserRole(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Protected route component
  const ProtectedRoute = ({ element, requiredRole }) => {
    if (!user) {
      return <Navigate to="/login" />;
    }

    // If a specific role is required and user doesn't have it
    if (requiredRole && userRole !== requiredRole) {
      return <Navigate to="/dashboard" />;
    }

    return element;
  };

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />}
        />
        <Route
          path="/login"
          element={user ? <Navigate to="/dashboard" /> : <Login />}
        />
        <Route
          path="/dashboard"
          element={<ProtectedRoute element={<Dashboard />} />}
        />
        <Route
          path="/sales"
          element={<ProtectedRoute element={<Sales />} />}
        />
        <Route
          path="/product/:productId"
          element={<ProtectedRoute element={<ProductDetails />} />}
        />
        <Route
          path="/admin/user-management"
          element={
            <ProtectedRoute
              element={<UserManagement />}
              requiredRole="admin"
            />
          }
        />
        <Route
          path="/admin/create-user"
          element={
            <ProtectedRoute
              element={<CreateUser />}
              requiredRole="admin"
            />
          }
        />
        <Route
          path="/request-role"
          element={<ProtectedRoute element={<RequestRolePage />} />}
        />
        <Route
          path="/admin/role-requests"
          element={
            <ProtectedRoute
              element={<RoleRequestsPage />}
              requiredRole="admin"
            />
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
