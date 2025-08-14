import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  getDoc,
  deleteDoc
} from "firebase/firestore";
import { getPendingRoleRequests } from "../services/roleService";
import Toast from "../components/Toast";
import Sidebar from "../components/Sidebar";
import "../styles/global.css";
import warehouseLogo from "../assets/warehouse-logo.svg";

function Dashboard() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [name, setName] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [modelNo, setModelNo] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [deletingProductId, setDeletingProductId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  const [searchTerm, setSearchTerm] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [history, setHistory] = useState([]);

  const [role, setRole] = useState("");
  
  // For admin notifications
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showNotification, setShowNotification] = useState(false);

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

  // If admin → fetch pending role requests for notifications only
  useEffect(() => {
    if (role === "admin") {
      // Fetch pending role requests
      const fetchPendingRequests = async () => {
        try {
          const requests = await getPendingRoleRequests();
          setPendingRequests(requests);
          
          // Show notification if there are pending requests
          if (requests.length > 0) {
            setShowNotification(true);
          }
        } catch (error) {
          console.error("Error fetching pending role requests:", error);
        }
      };
      
      fetchPendingRequests();
      
      // Set up an interval to check for new requests every minute
      const requestInterval = setInterval(fetchPendingRequests, 60000);
      
      return () => {
        clearInterval(requestInterval);
      };
    }
  }, [role]);

  // Logout
  const logout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // Real-time listener for products
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "products"), (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setProducts(items);
    });
    return unsubscribe;
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

  // Log stock changes
  const logStockChange = async (productName, partNumber, modelNo, warehouse, change) => {
    await addDoc(collection(db, "stock_history"), {
      productName,
      partNumber,
      modelNo,
      warehouse,
      change,
      user: auth.currentUser?.email || "Unknown",
      timestamp: serverTimestamp(),
    });
  };

  // Add product
  const addProduct = async (e) => {
    e.preventDefault();
    
    if (!name || !partNumber || !modelNo || !warehouse) {
      showToast("Please fill all required fields", "error");
      return;
    }
    
    // Check for duplicate products
    const duplicateProduct = products.find(product => 
      product.name.toLowerCase() === name.toLowerCase() &&
      product.partNumber.toLowerCase() === partNumber.toLowerCase() &&
      product.modelNo.toLowerCase() === modelNo.toLowerCase() &&
      product.warehouse.toLowerCase() === warehouse.toLowerCase()
    );
    
    if (duplicateProduct) {
      showToast(
        `A product with these details already exists. Please edit the existing entry: "${duplicateProduct.name}" instead of creating a duplicate.`,
        "warning"
      );
      return;
    }
    
    try {
      await addDoc(collection(db, "products"), {
        name,
        partNumber,
        modelNo,
        warehouse,
        quantity: parseInt(quantity),
        createdAt: serverTimestamp(),
      });
      
      await logStockChange(name, partNumber, modelNo, warehouse, `+${quantity} (New Product)`);
      
      // Clear form
      setName("");
      setPartNumber("");
      setModelNo("");
      setWarehouse("");
      setQuantity(0);
      
      showToast(`Product "${name}" has been added successfully!`, "success");
    } catch (error) {
      console.error("Error adding product:", error);
      showToast(`Error adding product: ${error.message}`, "error");
    }
  };

  // Update quantity
  const updateQuantity = async (id, change) => {
    const productRef = doc(db, "products", id);
    const product = products.find((p) => p.id === id);
    if (product) {
      const newQty = product.quantity + change;
      if (newQty < 0) return;
      await updateDoc(productRef, { quantity: newQty });
      await logStockChange(product.name, product.partNumber, product.modelNo, product.warehouse, change);
    }
  };

  // Delete product (admin and manager only)
  const deleteProduct = async (id, productName) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete "${productName}"? This action cannot be undone.`
    );
    
    if (!confirmDelete) return;

    setDeletingProductId(id);
    
    try {
      const product = products.find((p) => p.id === id);
      
      // Delete product from Firestore
      await deleteDoc(doc(db, "products", id));
      
      // Log the deletion
      await logStockChange(
        product.name, 
        product.partNumber, 
        product.modelNo, 
        product.warehouse, 
        "Product Deleted"
      );
      
      showToast(`Product "${productName}" has been deleted successfully!`, "success");
    } catch (error) {
      console.error("Error deleting product:", error);
      showToast(`Error deleting product: ${error.message}`, "error");
    } finally {
      setDeletingProductId(null);
    }
  };

  // Dismiss notification
  const dismissNotification = () => {
    setShowNotification(false);
  };

  // Navigate to role requests page
  const navigateToRoleRequests = () => {
    navigate("/admin/role-requests");
    setShowNotification(false);
  };

  // Navigate to role request page
  const navigateToRequestRole = () => {
    navigate("/request-role");
  };

  // Show toast notification
  const showToast = (message, type) => {
    setToast({ show: true, message, type });
  };

  // Close toast notification
  const closeToast = () => {
    setToast({ show: false, message: '', type: '' });
  };

  const warehouseOptions = [...new Set(products.map((p) => p.warehouse))];

  // Group products by name and part number to show totals
  const groupedProducts = products.reduce((acc, product) => {
    // Skip products with missing required fields
    if (!product.name || !product.partNumber) {
      return acc;
    }
    
    const key = `${product.name.toLowerCase()}_${product.partNumber.toLowerCase()}`;
    
    if (!acc[key]) {
      acc[key] = {
        id: product.id, // Use first product's ID for navigation
        name: product.name,
        partNumber: product.partNumber,
        totalQuantity: 0,
        warehouses: []
      };
    }
    
    acc[key].totalQuantity += (product.quantity || 0);
    acc[key].warehouses.push({
      id: product.id,
      modelNo: product.modelNo || 'N/A',
      warehouse: product.warehouse || 'Unknown',
      quantity: product.quantity || 0
    });
    
    return acc;
  }, {});

  const aggregatedProducts = Object.values(groupedProducts);

  const filteredProducts = aggregatedProducts.filter((p) => {
    const matchesSearch =
      (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.partNumber && p.partNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
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
              <h1 className="dashboard-title mb-0">Warehouse Dashboard</h1>
              <p className="mt-1 mb-0 text-muted">Logged in as: <strong>{role || "No role assigned"}</strong></p>
            </div>
          </div>
          <div>
            {/* Only show request role button for non-admin users */}
            {role !== "admin" && (
              <button 
                onClick={navigateToRequestRole}
                className="btn btn-secondary me-2"
              >
                Request Role Change
              </button>
            )}
            <button onClick={logout} className="btn btn-outline-primary">Logout</button>
          </div>
        </div>

        <div className="dashboard-content">
          {/* Admin Role Change Notification Alert */}
          {role === "admin" && showNotification && pendingRequests.length > 0 && (
            <div className="alert alert-warning mb-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h3 className="mb-2">
                    <span style={{ marginRight: "10px" }}>🔔</span>
                    New Role Change Requests
                  </h3>
                  <p className="mb-0">
                    You have {pendingRequests.length} pending role change {pendingRequests.length === 1 ? 'request' : 'requests'} that need your attention.
                  </p>
                </div>
                <div>
                  <button 
                    onClick={navigateToRoleRequests}
                    className="btn btn-primary me-2"
                  >
                    View Requests
                  </button>
                  <button 
                    onClick={dismissNotification}
                    className="btn btn-outline-primary"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add Product Form - Only for admin and manager */}
          {(role === "admin" || role === "manager") && (
            <div className="dashboard-card mb-4">
              <div className="dashboard-header mb-4">
                <h2 className="dashboard-title">Add New Product</h2>
              </div>
              <form onSubmit={addProduct}>
                <div className="row">
                  <div className="col-md-6 form-group">
                    <label htmlFor="productName">Product Name</label>
                    <input 
                      id="productName"
                      type="text" 
                      className="form-control" 
                      placeholder="Enter product name" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="col-md-6 form-group">
                    <label htmlFor="productPartNumber">Part Number</label>
                    <input 
                      id="productPartNumber"
                      type="text" 
                      className="form-control" 
                      placeholder="Enter part number" 
                      value={partNumber} 
                      onChange={(e) => setPartNumber(e.target.value)} 
                      required 
                    />
                  </div>
                </div>
                <div className="row mt-3">
                  <div className="col-md-4 form-group">
                    <label htmlFor="productModelNo">Model No</label>
                    <input 
                      id="productModelNo"
                      type="text" 
                      className="form-control" 
                      placeholder="Enter model number" 
                      value={modelNo} 
                      onChange={(e) => setModelNo(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="col-md-4 form-group">
                    <label htmlFor="productWarehouse">Warehouse</label>
                    <input 
                      id="productWarehouse"
                      type="text" 
                      className="form-control" 
                      placeholder="Enter warehouse location" 
                      value={warehouse} 
                      onChange={(e) => setWarehouse(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="col-md-4 form-group">
                    <label htmlFor="productQuantity">Initial Quantity</label>
                    <input 
                      id="productQuantity"
                      type="number" 
                      className="form-control" 
                      placeholder="Enter quantity" 
                      value={quantity} 
                      onChange={(e) => setQuantity(e.target.value)} 
                      required 
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary mt-3">Add Product</button>
              </form>
            </div>
          )}

          {/* Search & Filter - Available to all users */}
          <div className="dashboard-card mb-4">
            <div className="dashboard-header mb-4">
              <h2 className="dashboard-title">Product Inventory</h2>
            </div>
            <div className="d-flex mb-3">
              <div className="form-group me-3" style={{ flexGrow: 1 }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by name or part number"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ minWidth: "200px" }}>
                <select 
                  className="form-select" 
                  value={warehouseFilter} 
                  onChange={(e) => setWarehouseFilter(e.target.value)}
                >
                  <option value="">All Warehouses</option>
                  {warehouseOptions.map((wh, index) => (
                    <option key={index} value={wh}>{wh}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Product List - All users can see this */}
            <div className="table-responsive">
              <table className="table table-striped table-hover">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Part Number</th>
                    <th>Total Quantity</th>
                    {(role === "admin" || role === "manager") && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <button 
                          className="btn btn-link p-0 text-start text-decoration-none"
                          onClick={() => navigate(`/product/${p.id}`)}
                          style={{ color: "#0056b3", fontWeight: "500" }}
                        >
                          {p.name}
                        </button>
                      </td>
                      <td>{p.partNumber}</td>
                      <td>
                        <span className={`${p.totalQuantity <= 0 ? 'text-danger' : p.totalQuantity < 10 ? 'text-warning' : 'text-success'}`}>
                          {p.totalQuantity}
                        </span>
                      </td>
                      {(role === "admin" || role === "manager") && (
                        <td>
                          <button 
                            className="btn btn-sm btn-danger"
                            onClick={() => deleteProduct(p.warehouses[0].id, p.name)}
                            disabled={deletingProductId === p.warehouses[0].id}
                            title="Delete product permanently"
                          >
                            {deletingProductId === p.warehouses[0].id ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                Deleting...
                              </>
                            ) : (
                              <>
                                <i className="bi bi-trash me-1"></i>
                                Delete
                              </>
                            )}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Stock Activity History - All users can see this */}
          <div className="dashboard-card">
            <div className="dashboard-header mb-4">
              <h2 className="dashboard-title">Stock Activity History</h2>
            </div>
            <div className="table-responsive">
              <table className="table table-striped table-hover">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Part Number</th>
                    <th>Model No</th>
                    <th>Warehouse</th>
                    <th>Change</th>
                    <th>User</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((log) => (
                    <tr key={log.id}>
                      <td>{log.productName}</td>
                      <td>{log.partNumber}</td>
                      <td>{log.modelNo}</td>
                      <td>{log.warehouse}</td>
                      <td>
                        <span className={(String(log.change).includes('+') ? 'text-success' : 'text-danger')}>
                          {log.change}
                        </span>
                      </td>
                      <td>{log.user}</td>
                      <td>{log.timestamp?.toDate().toLocaleString() || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Dashboard;
