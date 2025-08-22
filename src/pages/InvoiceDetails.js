import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import Sidebar from "../components/Sidebar";
import Toast from "../components/Toast";
import "../styles/global.css";

function InvoiceDetails() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
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

  // Fetch invoice details
  useEffect(() => {
    const fetchInvoice = async () => {
      if (invoiceId) {
        try {
          const invoiceRef = doc(db, "invoices", invoiceId);
          const invoiceSnap = await getDoc(invoiceRef);
          if (invoiceSnap.exists()) {
            setInvoice({ id: invoiceSnap.id, ...invoiceSnap.data() });
          } else {
            showToast("Invoice not found", "error");
            navigate("/sales-history");
          }
        } catch (error) {
          console.error("Error fetching invoice:", error);
          showToast("Error loading invoice", "error");
          navigate("/sales-history");
        }
      }
      setLoading(false);
    };

    fetchInvoice();
  }, [invoiceId, navigate]);

  // Show toast notification
  const showToast = (message, type) => {
    setToast({ show: true, message, type });
  };

  // Close toast notification
  const closeToast = () => {
    setToast({ show: false, message: '', type: '' });
  };

  // Print invoice
  const printInvoice = () => {
    window.print();
  };

  if (loading) {
    return (
      <>
        <Sidebar role={role} isOpen={sidebarOpen} onToggle={toggleSidebar} />
        <div className="main-content">
          <div className="text-center" style={{ padding: "2rem" }}>
            <div className="spinner-border text-primary" role="status" style={{ width: "3rem", height: "3rem" }}>
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3 text-muted">Loading invoice...</p>
          </div>
        </div>
      </>
    );
  }

  if (!invoice) {
    return (
      <>
        <Sidebar role={role} isOpen={sidebarOpen} onToggle={toggleSidebar} />
        <div className="main-content">
          <div className="text-center" style={{ padding: "2rem" }}>
            <h3 className="text-muted">Invoice not found</h3>
            <button onClick={() => navigate("/sales-history")} className="btn btn-primary mt-3">
              Back to Sales History
            </button>
          </div>
        </div>
      </>
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
                <i className="bi bi-receipt me-2"></i>
                Invoice Details - {invoice.invoiceNumber}
              </h1>
              <p className="mt-1 mb-0 text-muted">View and print invoice details</p>
            </div>
          </div>
          <div>
            <button onClick={() => navigate("/sales-history")} className="btn btn-outline-secondary me-2">
              <i className="bi bi-arrow-left me-2"></i>
              Back to Sales History
            </button>
            <button onClick={printInvoice} className="btn btn-primary">
              <i className="bi bi-printer me-2"></i>
              Print Invoice
            </button>
          </div>
        </div>

        <div className="dashboard-content">
          {/* Invoice Content */}
          <div className="dashboard-card">
            <div className="invoice-content" style={{ padding: "2rem" }}>
              {/* Invoice Header */}
              <div className="text-center mb-4">
                <h2 className="text-primary mb-1">Nadeem Brothers Glass House & Auto Lights</h2>
                <h4 className="text-muted mb-4">SALES INVOICE</h4>
              </div>

              {/* Invoice Info */}
              <div className="row mb-4">
                <div className="col-md-6">
                  <div className="card">
                    <div className="card-body">
                      <h6 className="card-title">Invoice Information</h6>
                      <p className="mb-1"><strong>Invoice Number:</strong> {invoice.invoiceNumber}</p>
                      <p className="mb-1"><strong>Date:</strong> {invoice.date}</p>
                      <p className="mb-1"><strong>Time:</strong> {invoice.time}</p>
                      <p className="mb-1"><strong>Customer:</strong> {invoice.customerName || "Walk-in Customer"}</p>
                      <p className="mb-0"><strong>Generated By:</strong> {invoice.generatedBy}</p>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card">
                    <div className="card-body">
                      <h6 className="card-title">Sale Summary</h6>
                      <p className="mb-1"><strong>Total Items:</strong> {invoice.totalItems || invoice.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0}</p>
                      <p className="mb-1"><strong>Total Products:</strong> {invoice.items?.length || 0}</p>
                      <p className="mb-0"><strong>Grand Total:</strong> <span className="text-success fw-bold">PKR {(invoice.totalAmount || invoice.items?.reduce((sum, item) => sum + (item.total || 0), 0) || 0).toFixed(2)}</span></p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="card">
                <div className="card-header">
                  <h5 className="mb-0">Items Sold</h5>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-striped table-hover mb-0">
                      <thead className="table-dark">
                        <tr>
                          <th>Product Name</th>
                          <th>Part Number</th>
                          <th>Model No</th>
                          <th>Warehouse</th>
                          <th>Quantity</th>
                          <th>Unit Price</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoice.items?.map((item, index) => (
                          <tr key={index}>
                            <td>{item.name}</td>
                            <td>{item.partNumber}</td>
                            <td>{item.modelNo}</td>
                            <td>{item.warehouse}</td>
                            <td>
                              <span className="badge bg-primary">{item.quantity}</span>
                            </td>
                            <td>PKR {(item.unitPrice || 0).toFixed(2)}</td>
                            <td className="fw-bold">PKR {(item.total || 0).toFixed(2)}</td>
                          </tr>
                        )) || (
                          <tr>
                            <td colSpan="7" className="text-center text-muted py-4">No items found</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Total Section */}
              <div className="row mt-4">
                <div className="col-md-8"></div>
                <div className="col-md-4">
                  <div className="card bg-light">
                    <div className="card-body">
                      <div className="d-flex justify-content-between mb-2">
                        <span>Total Items:</span>
                        <span className="fw-bold">{invoice.totalItems || invoice.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0}</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="h5">Grand Total:</span>
                        <span className="h5 text-success fw-bold">PKR {(invoice.totalAmount || invoice.items?.reduce((sum, item) => sum + (item.total || 0), 0) || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center mt-4 text-muted">
                <small>
                  This invoice was generated on {invoice.timestamp?.toDate().toLocaleString() || new Date().toLocaleString()}
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          .sidebar, .dashboard-header-with-sidebar, .btn {
            display: none !important;
          }
          .main-content {
            margin-left: 0 !important;
            padding: 0 !important;
          }
          .dashboard-content {
            padding: 0 !important;
          }
          .dashboard-card {
            border: none !important;
            box-shadow: none !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </>
  );
}

export default InvoiceDetails;