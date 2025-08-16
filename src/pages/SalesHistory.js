import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
import Sidebar from "../components/Sidebar";
import Toast from "../components/Toast";
import "../styles/global.css";

function SalesHistory() {
  const navigate = useNavigate();
  const [salesHistory, setSalesHistory] = useState([]);
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

  // Real-time listener for invoices (grouped sales)
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "invoices"),
      (snapshot) => {
        const invoices = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        invoices.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds);
        setSalesHistory(invoices);
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

  // Get unique warehouses for filter - extract from invoice items
  const warehouseOptions = [...new Set(
    salesHistory.flatMap(invoice => 
      invoice.items ? invoice.items.map(item => item.warehouse) : []
    )
  )].filter(Boolean);

  // Filter sales history based on search and filters
  const filteredSalesHistory = salesHistory.filter((invoice) => {
    const matchesSearch = 
      (invoice.invoiceNumber && invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (invoice.generatedBy && invoice.generatedBy.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (invoice.items && invoice.items.some(item => 
        (item.name && item.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.partNumber && item.partNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.modelNo && item.modelNo.toLowerCase().includes(searchTerm.toLowerCase()))
      ));

    const matchesWarehouse = !warehouseFilter || 
      (invoice.items && invoice.items.some(item => item.warehouse === warehouseFilter));

    const matchesDate = !dateFilter || 
      (invoice.timestamp && invoice.timestamp.toDate().toISOString().split('T')[0] === dateFilter);

    return matchesSearch && matchesWarehouse && matchesDate;
  });

  // Calculate total sales amount for filtered results
  const totalSalesAmount = filteredSalesHistory.reduce((total, invoice) => {
    const invoiceTotal = invoice.totalAmount || invoice.items?.reduce((sum, item) => sum + (item.total || 0), 0) || 0;
    return total + invoiceTotal;
  }, 0);

  // Handle invoice click to navigate to dedicated page
  const handleInvoiceClick = (invoice) => {
    navigate(`/invoice/${invoice.id}`);
  };

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
              <h1 className="dashboard-title mb-0">Sales Activity History</h1>
              <p className="mt-1 mb-0 text-muted">Track all sales transactions and customer orders</p>
            </div>
          </div>
          <div>
            <button onClick={logout} className="btn btn-outline-primary">Logout</button>
          </div>
        </div>

        <div className="dashboard-content">
          {/* Summary Cards */}
          <div className="row mb-4">
            <div className="col-md-4">
              <div className="dashboard-card">
                <div className="dashboard-header">
                  <h3 className="dashboard-title">Total Sales</h3>
                </div>
                <div className="dashboard-metric">
                  <span className="metric-value">{filteredSalesHistory.length}</span>
                  <span className="metric-label">Transactions</span>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="dashboard-card">
                <div className="dashboard-header">
                  <h3 className="dashboard-title">Total Revenue</h3>
                </div>
                <div className="dashboard-metric">
                  <span className="metric-value">PKR {totalSalesAmount.toFixed(2)}</span>
                  <span className="metric-label">Total Amount</span>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="dashboard-card">
                <div className="dashboard-header">
                  <h3 className="dashboard-title">Average Sale</h3>
                </div>
                <div className="dashboard-metric">
                  <span className="metric-value">
                    PKR {filteredSalesHistory.length > 0 ? (totalSalesAmount / filteredSalesHistory.length).toFixed(2) : '0.00'}
                  </span>
                  <span className="metric-label">Per Transaction</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="dashboard-card mb-4">
            <div className="dashboard-header mb-4">
              <h2 className="dashboard-title">Filter Sales Activity</h2>
            </div>
            <div className="row">
              <div className="col-md-4">
                <div className="form-group">
                  <label htmlFor="searchInput">Search</label>
                  <input
                    id="searchInput"
                    type="text"
                    className="form-control"
                    placeholder="Search by product, customer, or user"
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

          {/* Sales History Table */}
          <div className="dashboard-card">
            <div className="dashboard-header mb-4">
              <h2 className="dashboard-title">Sales Records ({filteredSalesHistory.length})</h2>
            </div>
            <div className="table-responsive">
              <table className="table table-striped table-hover">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Invoice Number</th>
                    <th>Items Summary</th>
                    <th>Total Items</th>
                    <th>Total Amount</th>
                    <th>Generated By</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSalesHistory.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center text-muted">
                        No sales records found
                      </td>
                    </tr>
                  ) : (
                    filteredSalesHistory.map((invoice) => (
                      <tr key={invoice.id} style={{ cursor: 'pointer' }}>
                        <td>{invoice.timestamp?.toDate().toLocaleString() || "-"}</td>
                        <td>
                          <span className="badge bg-primary">{invoice.invoiceNumber || "-"}</span>
                        </td>
                        <td>
                          {invoice.items && invoice.items.length > 0 ? (
                            <div>
                              {invoice.items.slice(0, 2).map((item, index) => (
                                <small key={index} className="d-block text-muted">
                                  {item.quantity}x {item.name} ({item.partNumber})
                                </small>
                              ))}
                              {invoice.items.length > 2 && (
                                <small className="text-muted">
                                  +{invoice.items.length - 2} more item(s)
                                </small>
                              )}
                            </div>
                          ) : "-"}
                        </td>
                        <td>
                          <span className="badge bg-info">
                            {invoice.totalItems || invoice.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0}
                          </span>
                        </td>
                        <td className="text-success fw-bold">
                          PKR {(invoice.totalAmount || invoice.items?.reduce((sum, item) => sum + (item.total || 0), 0) || 0).toFixed(2)}
                        </td>
                        <td>{invoice.generatedBy || "-"}</td>
                        <td>
                          <button
                            onClick={() => handleInvoiceClick(invoice)}
                            className="btn btn-sm btn-outline-primary"
                            title="View Invoice Details"
                          >
                            <i className="bi bi-eye me-1"></i>
                            View Invoice
                          </button>
                        </td>
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

export default SalesHistory;