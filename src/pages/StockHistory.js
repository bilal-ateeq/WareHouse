import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
import Sidebar from "../components/Sidebar";
import Toast from "../components/Toast";
import "../styles/global.css";

function StockHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [role, setRole] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  
  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  // Toggle sidebar
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Fetch role from Firestore
  useEffect(() => {
    const fetchRole = async () => {
      if (auth.currentUser) {
        try {
          const userRef = doc(db, "users", auth.currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setRole(userSnap.data().role || "");
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
        }
      }
    };
    fetchRole();
  }, []);

  // Real-time listener for stock history
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "stock_history"),
      (snapshot) => {
        const logs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        logs.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds);
        setHistory(logs);
      }
    );
    return unsubscribe;
  }, []);

  // Logout
  const logout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // Show toast notification
  const showToast = (message, type) => {
    setToast({ show: true, message, type });
  };

  // Close toast notification
  const closeToast = () => {
    setToast({ show: false, message: '', type: '' });
  };

  // Get unique warehouses for filter
  const warehouseOptions = [...new Set(history.map((log) => log.warehouse))].filter(Boolean);

  // Filter history based on search and filters
  const filteredHistory = history.filter((log) => {
    const matchesSearch = 
      (log.productName && log.productName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.partNumber && log.partNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.modelNo && log.modelNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.user && log.user.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesWarehouse = !warehouseFilter || log.warehouse === warehouseFilter;

    const matchesDate = !dateFilter || 
      (log.timestamp && log.timestamp.toDate().toISOString().split('T')[0] === dateFilter);

    return matchesSearch && matchesWarehouse && matchesDate;
  });

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
        
        {/* Header with sidebar toggle */}
        <div className="dashboard-header-with-sidebar">
          <div className="d-flex align-items-center">
            <button 
              className="sidebar-toggle-btn d-lg-none me-3"
              onClick={toggleSidebar}
            >
              <i className="bi bi-list"></i>
            </button>
            <div>
              <h1 className="dashboard-title mb-0">Stock Activity History</h1>
              <p className="mt-1 mb-0 text-muted">Track all inventory changes and updates</p>
            </div>
          </div>
          <div>
            <button onClick={logout} className="btn btn-outline-primary">Logout</button>
          </div>
        </div>

        <div className="dashboard-content">
          {/* Filters */}
          <div className="dashboard-card mb-4">
            <div className="dashboard-header mb-4">
              <h2 className="dashboard-title">Filter Stock Activity</h2>
            </div>
            <div className="row">
              <div className="col-md-4">
                <div className="form-group">
                  <label htmlFor="searchInput">Search</label>
                  <input
                    id="searchInput"
                    type="text"
                    className="form-control"
                    placeholder="Search by product, part number, model, or user"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="col-md-4">
                <div className="form-group">
                  <label htmlFor="warehouseFilter">Warehouse</label>
                  <select 
                    id="warehouseFilter"
                    className="form-select" 
                    value={warehouseFilter} 
                    onChange={(e) => setWarehouseFilter(e.target.value)}
                  >
                    <option value="">All Warehouses</option>
                    {warehouseOptions.map((warehouse, index) => (
                      <option key={index} value={warehouse}>{warehouse}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="col-md-4">
                <div className="form-group">
                  <label htmlFor="dateFilter">Date</label>
                  <input
                    id="dateFilter"
                    type="date"
                    className="form-control"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Stock History Table */}
          <div className="dashboard-card">
            <div className="dashboard-header mb-4">
              <h2 className="dashboard-title">Activity Records ({filteredHistory.length})</h2>
            </div>
            <div className="table-responsive">
              <table className="table table-striped table-hover">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Product</th>
                    <th>Part Number</th>
                    <th>Model No</th>
                    <th>Warehouse</th>
                    <th>Change</th>
                    <th>User</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center text-muted">
                        No stock activity records found
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((log) => (
                      <tr key={log.id}>
                        <td>{log.timestamp?.toDate().toLocaleString() || "-"}</td>
                        <td>{log.productName || "-"}</td>
                        <td>{log.partNumber || "-"}</td>
                        <td>{log.modelNo || "-"}</td>
                        <td>{log.warehouse || "-"}</td>
                        <td>
                          <span className={(String(log.change).includes('+') ? 'text-success' : 'text-danger')}>
                            {log.change || "-"}
                          </span>
                        </td>
                        <td>{log.user || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default StockHistory;