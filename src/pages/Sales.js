import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { 
  collection, 
  onSnapshot, 
  doc, 
  getDoc, 
  updateDoc, 
  addDoc, 
  serverTimestamp 
} from "firebase/firestore";
import Toast from "../components/Toast";
import Sidebar from "../components/Sidebar";
import "../styles/global.css";

function Sales() {
  const navigate = useNavigate();
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  
  // Products and sales state
  const [products, setProducts] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [salePrice, setSalePrice] = useState(0);
  const [saleItems, setSaleItems] = useState([]);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Grouped products for selection
  const [groupedProducts, setGroupedProducts] = useState({});
  const [availableModels, setAvailableModels] = useState([]);
  const [availableWarehouses, setAvailableWarehouses] = useState([]);
  const [maxQuantity, setMaxQuantity] = useState(0);

  // Show toast notification
  const showToast = (message, type) => {
    setToast({ show: true, message, type });
  };

  // Close toast notification
  const closeToast = () => {
    setToast({ show: false, message: '', type: '' });
  };

  // Toggle sidebar
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Generate sequential invoice number starting from 1000
  const generateInvoiceNumber = async () => {
    try {
      // Get all invoices to find the highest invoice number
      const invoicesSnapshot = await onSnapshot(collection(db, "invoices"), () => {});
      const invoices = [];
      
      // Use a promise to get the data synchronously
      return new Promise((resolve) => {
        const unsubscribe = onSnapshot(collection(db, "invoices"), (snapshot) => {
          const invoiceNumbers = snapshot.docs
            .map(doc => doc.data().invoiceNumber)
            .filter(num => typeof num === 'string' && num.startsWith('INV-'))
            .map(num => parseInt(num.replace('INV-', '')))
            .filter(num => !isNaN(num));
          
          const highestNumber = invoiceNumbers.length > 0 ? Math.max(...invoiceNumbers) : 999;
          const nextNumber = highestNumber + 1;
          
          unsubscribe(); // Clean up the listener
          resolve(`INV-${nextNumber}`);
        });
      });
    } catch (error) {
      console.error("Error generating invoice number:", error);
      // Fallback to timestamp-based number
      return `INV-${Date.now()}`;
    }
  };

  // Fetch user role and check permissions
  useEffect(() => {
    const checkPermissions = async () => {
      if (auth.currentUser) {
        try {
          const userRef = doc(db, "users", auth.currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userRole = userSnap.data().role || "";
            setRole(userRole);
            
            // Redirect if not admin or manager
            if (userRole !== "admin" && userRole !== "manager") {
              showToast("You don't have permission to access this page", "error");
              setTimeout(() => navigate("/dashboard"), 2000);
            }
          } else {
            navigate("/dashboard");
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          navigate("/dashboard");
        }
      } else {
        navigate("/login");
      }
      setLoading(false);
    };
    
    checkPermissions();
  }, [navigate]);

  // Real-time listener for products
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "products"), (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setProducts(items);
      
      // Group products by name and part number and sort alphabetically
      const grouped = items.reduce((acc, product) => {
        if (!product.name || !product.partNumber) return acc;
        
        const key = `${product.name} (${product.partNumber})`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(product);
        return acc;
      }, {});
      
      // Sort the grouped products alphabetically by key
      const sortedGrouped = Object.keys(grouped)
        .sort((a, b) => a.localeCompare(b))
        .reduce((acc, key) => {
          acc[key] = grouped[key];
          return acc;
        }, {});
      
      setGroupedProducts(sortedGrouped);
    });
    
    return unsubscribe;
  }, []);

  // Update available models and warehouses when product is selected
  useEffect(() => {
    if (selectedProduct && groupedProducts[selectedProduct]) {
      const productVariants = groupedProducts[selectedProduct];
      
      // Get unique models and sort alphabetically
      const models = [...new Set(productVariants.map(p => p.modelNo))].filter(Boolean).sort();
      setAvailableModels(models);
      
      // Reset selections
      setSelectedModel("");
      setSelectedWarehouse("");
      setAvailableWarehouses([]);
      setMaxQuantity(0);
    } else {
      setAvailableModels([]);
      setSelectedModel("");
      setSelectedWarehouse("");
      setAvailableWarehouses([]);
      setMaxQuantity(0);
    }
  }, [selectedProduct, groupedProducts]);

  // Update available warehouses when model is selected
  useEffect(() => {
    if (selectedProduct && selectedModel && groupedProducts[selectedProduct]) {
      const productVariants = groupedProducts[selectedProduct];
      const modelVariants = productVariants.filter(p => p.modelNo === selectedModel);
      
      // Get warehouses with quantities
      const warehousesWithQty = modelVariants.map(p => ({
        warehouse: p.warehouse,
        quantity: p.quantity,
        id: p.id
      })).filter(w => w.quantity > 0);
      
      setAvailableWarehouses(warehousesWithQty);
      
      // Reset warehouse selection
      setSelectedWarehouse("");
      setMaxQuantity(0);
    } else {
      setAvailableWarehouses([]);
      setSelectedWarehouse("");
      setMaxQuantity(0);
    }
  }, [selectedModel, selectedProduct, groupedProducts]);

  // Update max quantity when warehouse is selected
  useEffect(() => {
    if (selectedWarehouse) {
      const warehouse = availableWarehouses.find(w => w.warehouse === selectedWarehouse);
      setMaxQuantity(warehouse ? warehouse.quantity : 0);
      setSaleQuantity(1);
    } else {
      setMaxQuantity(0);
    }
  }, [selectedWarehouse, availableWarehouses]);

  // Add item to sale
  const addToSale = () => {
    if (!selectedProduct || !selectedModel || !selectedWarehouse || !saleQuantity || !salePrice) {
      showToast("Please fill all fields", "error");
      return;
    }

    if (saleQuantity > maxQuantity) {
      showToast(`Maximum available quantity is ${maxQuantity}`, "error");
      return;
    }

    const warehouseData = availableWarehouses.find(w => w.warehouse === selectedWarehouse);
    const quantity = parseInt(saleQuantity);
    const unitPrice = parseFloat(salePrice);
    const itemTotal = unitPrice * quantity;
    
    const newItem = {
      id: Date.now() + Math.random(), // Temporary ID for cart
      productId: warehouseData.id,
      name: selectedProduct.split(' (')[0], // Extract name from "Name (PartNumber)"
      partNumber: selectedProduct.match(/\(([^)]+)\)/)[1], // Extract part number
      modelNo: selectedModel,
      warehouse: selectedWarehouse,
      quantity: quantity,
      unitPrice: unitPrice,
      total: itemTotal,
      maxAvailable: maxQuantity
    };

    setSaleItems([...saleItems, newItem]);
    
    // Reset form
    setSelectedProduct("");
    setSelectedModel("");
    setSelectedWarehouse("");
    setSaleQuantity(1);
    setSalePrice(0);
    
    showToast("Item added to sale", "success");
  };

  // Remove item from sale
  const removeFromSale = (itemId) => {
    setSaleItems(saleItems.filter(item => item.id !== itemId));
    showToast("Item removed from sale", "info");
  };

  // Generate invoice and update inventory
  const generateInvoice = async () => {
    if (saleItems.length === 0) {
      showToast("Please add at least one item to generate invoice", "error");
      return;
    }

    setProcessing(true);

    try {
      // Check if all items are still available
      for (const item of saleItems) {
        const productRef = doc(db, "products", item.productId);
        const productSnap = await getDoc(productRef);
        
        if (!productSnap.exists()) {
          throw new Error(`Product ${item.name} no longer exists`);
        }
        
        const currentProduct = productSnap.data();
        if (currentProduct.quantity < item.quantity) {
          throw new Error(`Insufficient quantity for ${item.name}. Available: ${currentProduct.quantity}, Required: ${item.quantity}`);
        }
      }

      // Update inventory quantities
      const updates = [];
      const stockLogs = [];
      
      for (const item of saleItems) {
        const productRef = doc(db, "products", item.productId);
        const productSnap = await getDoc(productRef);
        const currentProduct = productSnap.data();
        const newQuantity = currentProduct.quantity - item.quantity;
        
        updates.push(updateDoc(productRef, { quantity: newQuantity }));
        
        // Create stock log entry for inventory reduction
        stockLogs.push(addDoc(collection(db, "stock_history"), {
          productName: item.name,
          partNumber: item.partNumber,
          modelNo: item.modelNo,
          warehouse: item.warehouse,
          change: `-${item.quantity} (Sale)`,
          user: auth.currentUser?.email || "Unknown",
          timestamp: serverTimestamp(),
        }));
      }

      // Execute all updates
      await Promise.all([...updates, ...stockLogs]);

      // Create invoice data with proper invoice numbering
      const invoiceNumber = await generateInvoiceNumber();
      const invoice = {
        invoiceNumber: invoiceNumber,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        customerName: customerName || "Walk-in Customer",
        items: saleItems,
        totalItems: saleItems.reduce((sum, item) => sum + item.quantity, 0),
        totalAmount: saleItems.reduce((sum, item) => sum + item.total, 0),
        generatedBy: auth.currentUser?.email || "Unknown"
      };

      // Save invoice to database
      const invoiceRef = await addDoc(collection(db, "invoices"), {
        ...invoice,
        timestamp: serverTimestamp()
      });

      setInvoiceData(invoice);
      setShowInvoice(true);
      setSaleItems([]);
      setCustomerName(""); // Reset customer name
      
      showToast("Invoice generated successfully!", "success");
      
    } catch (error) {
      console.error("Error generating invoice:", error);
      showToast(`Error generating invoice: ${error.message}`, "error");
    } finally {
      setProcessing(false);
    }
  };

  // Print invoice
  const printInvoice = () => {
    window.print();
  };

  // Close invoice and return to sales
  const closeInvoice = () => {
    setShowInvoice(false);
    setInvoiceData(null);
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-content">
          <div className="text-center" style={{ padding: "2rem" }}>
            <div className="spinner-border text-primary" role="status" style={{ width: "3rem", height: "3rem" }}>
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3 text-muted">Loading sales...</p>
          </div>
        </div>
      </div>
    );
  }

  if (showInvoice && invoiceData) {
    return (
      <div className="invoice-container" style={{ padding: "2rem", backgroundColor: "#f8f9fa", minHeight: "100vh" }}>
        <div className="invoice-content" style={{ 
          maxWidth: "800px", 
          margin: "0 auto", 
          backgroundColor: "white", 
          padding: "2rem",
          borderRadius: "8px",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)"
        }}>
          {/* Invoice Header */}
          <div className="text-center mb-4">
            <h1 style={{ color: "#2c3e50", marginBottom: "0.5rem" }}>Nadeem Brothers Glass House & Auto Lights</h1>
            <h3 style={{ color: "#7f8c8d", marginBottom: "2rem" }}>SALES INVOICE</h3>
          </div>

          {/* Invoice Info */}
          <div className="row mb-4">
            <div className="col-md-6">
              <p><strong>Invoice Number:</strong> {invoiceData.invoiceNumber}</p>
              <p><strong>Date:</strong> {invoiceData.date}</p>
              <p><strong>Time:</strong> {invoiceData.time}</p>
              <p><strong>Customer Name:</strong> {invoiceData.customerName}</p>
            </div>
            <div className="col-md-6 text-md-end">
              <p><strong>Generated By:</strong> {invoiceData.generatedBy}</p>
            </div>
          </div>

          {/* Items Table */}
          <table className="table table-striped">
            <thead style={{ backgroundColor: "#34495e", color: "white" }}>
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
              {invoiceData.items.map((item, index) => (
                <tr key={index}>
                  <td>{item.name}</td>
                  <td>{item.partNumber}</td>
                  <td>{item.modelNo}</td>
                  <td>{item.warehouse}</td>
                  <td>{item.quantity}</td>
                  <td>PKR {item.unitPrice.toFixed(2)}</td>
                  <td><strong>PKR {item.total.toFixed(2)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Total */}
          <div className="text-end mt-4">
            <h4>Total Items: {invoiceData.items.reduce((sum, item) => sum + item.quantity, 0)}</h4>
            <h3 style={{ color: "#27ae60", fontWeight: "bold" }}>
              Grand Total: PKR {invoiceData.items.reduce((sum, item) => sum + item.total, 0).toFixed(2)}
            </h3>
          </div>

          {/* Action Buttons */}
          <div className="text-center mt-4 no-print">
            <button onClick={printInvoice} className="btn btn-primary me-3">
              <i className="bi bi-printer me-2"></i>
              Print Invoice
            </button>
            <button onClick={closeInvoice} className="btn btn-secondary">
              <i className="bi bi-arrow-left me-2"></i>
              Back to Sales
            </button>
          </div>
        </div>

        <style jsx>{`
          @media print {
            .no-print {
              display: none !important;
            }
            .invoice-container {
              background: white !important;
              padding: 0 !important;
            }
            .invoice-content {
              box-shadow: none !important;
              border-radius: 0 !important;
              max-width: none !important;
              margin: 0 !important;
            }
          }
        `}</style>
      </div>
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
                <i className="bi bi-cart3 me-2"></i>
                Sales Management
              </h1>
              <p className="mt-1 mb-0 text-muted">Create sales invoices and manage inventory</p>
            </div>
          </div>
          <div>
            <button 
              onClick={() => navigate("/dashboard")}
              className="btn btn-outline-primary"
            >
              <i className="bi bi-house me-2"></i>
              Dashboard
            </button>
          </div>
        </div>

        <div className="dashboard-content">
          {/* Customer Information */}
          <div className="dashboard-card mb-4">
            <div className="dashboard-header mb-4">
              <h2 className="dashboard-title">Customer Information</h2>
            </div>
            
            <div className="row">
              <div className="col-md-6 form-group mb-3">
                <label htmlFor="customerNameInput" className="form-label">
                  <i className="bi bi-person me-2"></i>
                  Customer Name
                </label>
                <input
                  id="customerNameInput"
                  type="text"
                  className="form-control"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name (optional)"
                />
              </div>
            </div>
          </div>

          {/* Add Product to Sale */}
          <div className="dashboard-card mb-4">
            <div className="dashboard-header mb-4">
              <h2 className="dashboard-title">Add Product to Sale</h2>
            </div>
            
            <div className="row">
              <div className="col-md-3 form-group mb-3">
                <label htmlFor="productSelect" className="form-label">
                  <i className="bi bi-box me-2"></i>
                  Product Name / Part Number
                </label>
                <select
                  id="productSelect"
                  className="form-select"
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                >
                  <option value="">Select Product...</option>
                  {Object.keys(groupedProducts).map(productKey => (
                    <option key={productKey} value={productKey}>
                      {productKey}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="col-md-2 form-group mb-3">
                <label htmlFor="modelSelect" className="form-label">
                  <i className="bi bi-gear me-2"></i>
                  Model Number
                </label>
                <select
                  id="modelSelect"
                  className="form-select"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={!selectedProduct}
                >
                  <option value="">Select Model...</option>
                  {availableModels.map(model => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="col-md-2 form-group mb-3">
                <label htmlFor="warehouseSelect" className="form-label">
                  <i className="bi bi-building me-2"></i>
                  Warehouse
                </label>
                <select
                  id="warehouseSelect"
                  className="form-select"
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                  disabled={!selectedModel}
                >
                  <option value="">Select Warehouse...</option>
                  {availableWarehouses.map(warehouse => (
                    <option key={warehouse.warehouse} value={warehouse.warehouse}>
                      {warehouse.warehouse} (Available: {warehouse.quantity})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="col-md-2 form-group mb-3">
                <label htmlFor="quantityInput" className="form-label">
                  <i className="bi bi-123 me-2"></i>
                  Quantity
                </label>
                <input
                  id="quantityInput"
                  type="number"
                  className="form-control"
                  min="1"
                  max={maxQuantity}
                  value={saleQuantity}
                  onChange={(e) => setSaleQuantity(e.target.value)}
                  disabled={!selectedWarehouse}
                  placeholder="Enter quantity"
                />
                {maxQuantity > 0 && (
                  <small className="text-muted">Max: {maxQuantity}</small>
                )}
              </div>
              
              <div className="col-md-2 form-group mb-3">
                <label htmlFor="priceInput" className="form-label">
                  <i className="bi bi-currency-dollar me-2"></i>
                  Unit Price (PKR)
                </label>
                <input
                  id="priceInput"
                  type="number"
                  className="form-control"
                  min="0"
                  step="0.01"
                  value={salePrice}
                  onChange={(e) => setSalePrice(parseFloat(e.target.value) || 0)}
                  disabled={!selectedWarehouse}
                  placeholder="Enter price"
                />
              </div>
              
              <div className="col-md-2 form-group mb-3 d-flex align-items-end">
                <button
                  onClick={addToSale}
                  className="btn btn-success w-100"
                  disabled={!selectedProduct || !selectedModel || !selectedWarehouse || !saleQuantity || saleQuantity > maxQuantity || !salePrice}
                >
                  <i className="bi bi-plus-circle me-2"></i>
                  Add to Sale
                </button>
              </div>
            </div>
          </div>

          {/* Sale Items */}
          {saleItems.length > 0 && (
            <div className="dashboard-card mb-4">
              <div className="dashboard-header mb-4 d-flex justify-content-between align-items-center">
                <h2 className="dashboard-title mb-0">Sale Items</h2>
                <button
                  onClick={generateInvoice}
                  className="btn btn-primary"
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Processing...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-receipt me-2"></i>
                      Generate Invoice
                    </>
                  )}
                </button>
              </div>
              
              <div className="table-responsive">
                <table className="table table-striped table-hover">
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>Part Number</th>
                      <th>Model No</th>
                      <th>Warehouse</th>
                      <th>Quantity</th>
                      <th>Unit Price</th>
                      <th>Total</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saleItems.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{item.partNumber}</td>
                        <td>{item.modelNo}</td>
                        <td>{item.warehouse}</td>
                        <td>
                          <span className="badge bg-primary">{item.quantity}</span>
                        </td>
                        <td>PKR {item.unitPrice.toFixed(2)}</td>
                        <td><strong>PKR {item.total.toFixed(2)}</strong></td>
                        <td>
                          <button
                            onClick={() => removeFromSale(item.id)}
                            className="btn btn-sm btn-danger"
                            title="Remove from sale"
                          >
                            <i className="bi bi-trash me-1"></i>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="text-end">
                <h4>Total Items: {saleItems.reduce((sum, item) => sum + item.quantity, 0)}</h4>
                <h3><strong>Grand Total: PKR {saleItems.reduce((sum, item) => sum + item.total, 0).toFixed(2)}</strong></h3>
              </div>
            </div>
          )}

          {/* Empty State */}
          {saleItems.length === 0 && (
            <div className="dashboard-card text-center">
              <div style={{ padding: "3rem" }}>
                <i className="bi bi-cart-x" style={{ fontSize: "4rem", color: "#6c757d" }}></i>
                <h3 className="mt-3 text-muted">No items in sale</h3>
                <p className="text-muted">Add products to start creating a sale invoice</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default Sales;