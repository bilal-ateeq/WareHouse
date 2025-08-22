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
import cloudinaryService from "../services/cloudinaryService";
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
  const [category, setCategory] = useState("auto"); // Changed default to auto
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  const [searchTerm, setSearchTerm] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");

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
      let imageUrl = null;
      let imagePublicId = null;
      
      // Upload image to Cloudinary if selected
      if (selectedImage) {
        setUploadingImage(true);
        const uploadResult = await cloudinaryService.uploadImage(selectedImage);
        
        if (!uploadResult.success) {
          showToast(`Error uploading image: ${uploadResult.error}`, "error");
          setUploadingImage(false);
          return;
        }
        
        imageUrl = uploadResult.url;
        imagePublicId = uploadResult.publicId;
        setUploadingImage(false);
      }
      
      await addDoc(collection(db, "products"), {
        name,
        partNumber,
        modelNo,
        warehouse,
        quantity: parseInt(quantity),
        category,
        imageUrl,
        imagePublicId,
        createdAt: serverTimestamp(),
      });
      
      await logStockChange(name, partNumber, modelNo, warehouse, `+${quantity} (New Product)`);
      
      // Clear form
      setName("");
      setPartNumber("");
      setModelNo("");
      setWarehouse("");
      setQuantity(0);
      setCategory("auto");
      setSelectedImage(null);
      setImagePreview(null);
      
      showToast(`Product "${name}" has been added successfully!`, "success");
    } catch (error) {
      console.error("Error adding product:", error);
      showToast(`Error adding product: ${error.message}`, "error");
    } finally {
      setUploadingImage(false);
    }
  };

  // Handle image selection
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showToast("Please select an image file", "error");
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showToast("Image size should be less than 5MB", "error");
        return;
      }
      
      setSelectedImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove selected image
  const removeSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
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

  // Group products by name, part number, and category to show totals
  const groupProductsByCategory = (category) => {
    return products
      .filter(product => (product.category || 'auto') === category) // Default to 'auto' for existing products
      .reduce((acc, product) => {
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
            category: product.category || 'auto',
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
  };

  // Get filtered products by category
  const getFilteredProductsByCategory = (category) => {
    const groupedProducts = groupProductsByCategory(category);
    const aggregatedProducts = Object.values(groupedProducts);
    
    return aggregatedProducts.filter((p) => {
      const matchesSearch =
        (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.partNumber && p.partNumber.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesWarehouse = !warehouseFilter || 
        p.warehouses.some(w => w.warehouse === warehouseFilter);
      
      return matchesSearch && matchesWarehouse;
    }).sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by name
  };

  const glassProducts = getFilteredProductsByCategory('glass');
  const autoProducts = getFilteredProductsByCategory('auto');

  // Render product table
  const renderProductTable = (groupedProducts, categoryTitle) => (
    <div className="mb-4">
      <h3 className="mb-3 text-primary">{categoryTitle}</h3>
      <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead>
            <tr>
              <th>Image</th>
              <th>Name</th>
              <th>Part Number</th>
              <th>Total Quantity</th>
              {(role === "admin" || role === "manager") && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {groupedProducts.length === 0 ? (
              <tr>
                <td colSpan={(role === "admin" || role === "manager") ? 5 : 4} className="text-center text-muted">
                  No {categoryTitle.toLowerCase()} products found
                </td>
              </tr>
            ) : (
              groupedProducts.map((p) => {
                // Find the first product with an image for this grouped item
                const productWithImage = products.find(product => 
                  product.name && p.name &&
                  product.partNumber && p.partNumber &&
                  product.name.toLowerCase() === p.name.toLowerCase() &&
                  product.partNumber.toLowerCase() === p.partNumber.toLowerCase() &&
                  product.imageUrl && product.imageUrl.trim() !== ''
                );
                
                return (
                  <tr key={p.id}>
                    <td style={{ width: "80px" }}>
                      {productWithImage?.imageUrl ? (
                        <img
                          src={productWithImage.imageUrl}
                          alt={p.name}
                          style={{ 
                            width: "60px", 
                            height: "60px", 
                            objectFit: "cover",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            cursor: "pointer"
                          }}
                          title={`Click to view ${p.name} details`}
                          onClick={() => navigate(`/product/${p.id}`)}
                        />
                      ) : (
                        <div 
                          style={{ 
                            width: "60px", 
                            height: "60px", 
                            backgroundColor: "#f8f9fa",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer"
                          }}
                          title={`Click to view ${p.name} details`}
                          onClick={() => navigate(`/product/${p.id}`)}
                        >
                          <i className="bi bi-image text-muted" style={{ fontSize: "1.5rem" }}></i>
                        </div>
                      )}
                    </td>
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
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

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
              <h1 className="dashboard-title mb-0">Nadeem Brothers Glass House & Auto Lights</h1>
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
                <div className="row mt-3">
                  <div className="col-md-4 form-group">
                    <label htmlFor="productCategory">Category</label>
                    <select
                      id="productCategory"
                      className="form-select"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      required
                    >
                      <option value="glass">Glass</option>
                      <option value="auto">Auto Parts</option>
                    </select>
                  </div>
                  <div className="col-md-8 form-group">
                    <label htmlFor="productImage">Product Image (Optional)</label>
                    <input
                      id="productImage"
                      type="file"
                      className="form-control"
                      accept="image/*"
                      onChange={handleImageSelect}
                    />
                    <small className="form-text text-muted">
                      Maximum file size: 5MB. Supported formats: JPG, PNG, GIF
                    </small>
                    {imagePreview && (
                      <div className="mt-3">
                        <div className="d-flex align-items-start gap-3">
                          <img
                            src={imagePreview}
                            alt="Selected product"
                            style={{ 
                              maxWidth: "150px", 
                              maxHeight: "150px", 
                              objectFit: "cover",
                              border: "1px solid #ddd",
                              borderRadius: "4px"
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={removeSelectedImage}
                          >
                            <i className="bi bi-trash me-1"></i>
                            Remove Image
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <button type="submit" className="btn btn-primary mt-3" disabled={uploadingImage}>
                  {uploadingImage ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                      Uploading...
                    </>
                  ) : (
                    "Add Product"
                  )}
                </button>
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

            {/* Product Inventory with Glass and Auto Parts sections */}
            {renderProductTable(glassProducts, "Glass Products")}
            {renderProductTable(autoProducts, "Auto Parts")}
          </div>
        </div>
      </div>
    </>
  );
}

export default Dashboard;
