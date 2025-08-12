import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  getDoc,
  getDocs
} from "firebase/firestore";
import { changeUserRole, getPendingRoleRequests } from "../services/roleService";
import "../styles/global.css";
import warehouseLogo from "../assets/warehouse-logo.svg";

function Dashboard() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [price, setPrice] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [history, setHistory] = useState([]);

  const [role, setRole] = useState("");
  const [users, setUsers] = useState([]); // for admin to manage
  const [processingUserId, setProcessingUserId] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  // For admin notifications
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showNotification, setShowNotification] = useState(false);

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

  // If admin → fetch all users and pending role requests
  useEffect(() => {
    if (role === "admin") {
      // Fetch users
      const userUnsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
        const allUsers = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUsers(allUsers);
      });
      
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
        userUnsubscribe();
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
  const logStockChange = async (productName, sku, warehouse, change) => {
    await addDoc(collection(db, "stock_history"), {
      productName,
      sku,
      warehouse,
      change,
      user: auth.currentUser?.email || "Unknown",
      timestamp: serverTimestamp(),
    });
  };

  // Add product
  const addProduct = async (e) => {
    e.preventDefault();
    if (!name || !sku || !warehouse) {
      alert("Please fill all fields");
      return;
    }
    await addDoc(collection(db, "products"), {
      name,
      sku,
      warehouse,
      quantity: parseInt(quantity),
      price: parseFloat(price),
      createdAt: serverTimestamp(),
    });
    await logStockChange(name, sku, warehouse, `+${quantity} (New Product)`);
    setName("");
    setSku("");
    setWarehouse("");
    setQuantity(0);
    setPrice(0);
  };

  // Update quantity
  const updateQuantity = async (id, change) => {
    const productRef = doc(db, "products", id);
    const product = products.find((p) => p.id === id);
    if (product) {
      const newQty = product.quantity + change;
      if (newQty < 0) return;
      await updateDoc(productRef, { quantity: newQty });
      await logStockChange(product.name, product.sku, product.warehouse, change);
    }
  };

  // Handle direct role change (admin only)
  const handleDirectRoleChange = async (userId, newRole) => {
    setMessage({ text: '', type: '' });
    setProcessingUserId(userId);
    
    try {
      const result = await changeUserRole(userId, newRole);
      
      if (result.success) {
        setMessage({ text: result.message, type: 'success' });
      } else {
        setMessage({ text: result.message, type: 'error' });
      }
    } catch (error) {
      setMessage({ 
        text: `Error: ${error.message}`, 
        type: 'error' 
      });
    } finally {
      setProcessingUserId(null);
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

  const warehouseOptions = [...new Set(products.map((p) => p.warehouse))];

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesWarehouse = warehouseFilter
      ? p.warehouse === warehouseFilter
      : true;
    return matchesSearch && matchesWarehouse;
  });

  return (
    <div className="dashboard-container">
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
                  className="btn btn-primary mr-2"
                  style={{ marginRight: "10px" }}
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

        <div className="dashboard-header mb-4">
          <div>
            <h1 className="dashboard-title">Warehouse Dashboard</h1>
            <p className="mt-2">Logged in as: <strong>{role || "No role assigned"}</strong></p>
          </div>
          <div>
            {/* Only show request role button for non-admin users */}
            {role !== "admin" && (
              <button 
                onClick={navigateToRequestRole}
                className="btn btn-secondary mr-2"
                style={{ marginRight: "10px" }}
              >
                Request Role Change
              </button>
            )}
            <button onClick={logout} className="btn btn-outline-primary">Logout</button>
          </div>
        </div>

        {/* Display messages */}
        {message.text && (
          <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'} mb-4`}>
            {message.text}
          </div>
        )}

        {/* ADMIN: User Management */}
        {role === "admin" && (
          <div className="dashboard-card mb-4">
            <div className="dashboard-header mb-4">
              <h2 className="dashboard-title">User Management</h2>
            </div>
            
            {/* Admin Actions Menu */}
            <div className="card mb-4">
              <div className="card-header">
                <h3 className="mb-0" style={{ fontSize: "1.25rem" }}>Admin Actions</h3>
              </div>
              <div className="card-body">
                <Link 
                  to="/admin/role-requests" 
                  className="btn btn-secondary"
                >
                  Manage Role Change Requests
                </Link>
              </div>
            </div>
            
            <div className="table-responsive">
              <table className="table table-striped table-hover">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Current Role</th>
                    <th>Change Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>{u.role || "No role"}</td>
                      <td>
                        <select
                          disabled={processingUserId === u.id}
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleDirectRoleChange(u.id, e.target.value);
                              e.target.value = "";
                            }
                          }}
                          className="form-select"
                          style={{
                            opacity: processingUserId === u.id ? 0.7 : 1
                          }}
                        >
                          <option value="">Change Role</option>
                          <option value="viewer">Viewer</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pending Role Change Requests */}
            <div className="mt-4">
              <h2 className="mb-3">Pending Role Change Requests</h2>
              {pendingRequests.length === 0 ? (
                <div className="alert alert-info">No pending requests</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped table-hover">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Requested Role</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingRequests.map((request) => (
                        <tr key={request.id}>
                          <td>{request.email}</td>
                          <td>{request.requestedRole}</td>
                          <td>
                            <span className="badge" style={{
                              backgroundColor: 'var(--warning-color)',
                              color: 'white',
                              padding: '0.35em 0.65em',
                              fontSize: '0.75em',
                              fontWeight: '700',
                              borderRadius: '0.25rem'
                            }}>
                              {request.status}
                            </span>
                          </td>
                          <td>{request.timestamp?.toDate().toLocaleString() || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
                  <label htmlFor="productSku">SKU</label>
                  <input 
                    id="productSku"
                    type="text" 
                    className="form-control" 
                    placeholder="Enter SKU" 
                    value={sku} 
                    onChange={(e) => setSku(e.target.value)} 
                    required 
                  />
                </div>
              </div>
              <div className="row mt-3">
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
                <div className="col-md-4 form-group">
                  <label htmlFor="productPrice">Price</label>
                  <input 
                    id="productPrice"
                    type="number" 
                    className="form-control" 
                    placeholder="Enter price" 
                    value={price} 
                    onChange={(e) => setPrice(e.target.value)} 
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
            <div className="form-group mr-3" style={{ marginRight: "15px", flexGrow: 1 }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search by name or SKU"
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
                  <th>SKU</th>
                  <th>Warehouse</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  {(role === "admin" || role === "manager") && <th>Adjust</th>}
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.sku}</td>
                    <td>{p.warehouse}</td>
                    <td>
                      <span className={`${p.quantity <= 0 ? 'text-danger' : p.quantity < 10 ? 'text-warning' : 'text-success'}`}>
                        {p.quantity}
                      </span>
                    </td>
                    <td>${p.price.toFixed(2)}</td>
                    {(role === "admin" || role === "manager") && (
                      <td>
                        <button 
                          className="btn btn-sm btn-secondary mr-2" 
                          onClick={() => updateQuantity(p.id, 1)}
                          style={{ marginRight: "5px" }}
                        >
                          +1
                        </button>
                        <button 
                          className="btn btn-sm btn-outline-danger" 
                          onClick={() => updateQuantity(p.id, -1)} 
                          disabled={p.quantity <= 0}
                        >
                          -1
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
                  <th>SKU</th>
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
                    <td>{log.sku}</td>
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
  );
}

export default Dashboard;
