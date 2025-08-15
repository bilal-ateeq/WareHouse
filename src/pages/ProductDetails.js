import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import Toast from "../components/Toast";
import "../styles/global.css";

function ProductDetails() {
  const { productId } = useParams();
  const navigate = useNavigate();
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [role, setRole] = useState("");
  
  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  
  // Quantity management states
  const [addQuantities, setAddQuantities] = useState({});
  const [replaceQuantities, setReplaceQuantities] = useState({});
  
  // Product info
  const [productName, setProductName] = useState("");
  const [partNumber, setPartNumber] = useState("");

  // Show toast notification
  const showToast = (message, type) => {
    setToast({ show: true, message, type });
  };

  // Close toast notification
  const closeToast = () => {
    setToast({ show: false, message: '', type: '' });
  };

  // Fetch user role
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

  // Real-time listener for products
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "products"), (snapshot) => {
      const allProducts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      
      // Filter products that match the clicked product's name and part number
      if (allProducts.length > 0) {
        const referenceProduct = allProducts.find(p => p.id === productId);
        if (referenceProduct) {
          const matchingProducts = allProducts.filter(p => 
            p.name.toLowerCase() === referenceProduct.name.toLowerCase() &&
            p.partNumber.toLowerCase() === referenceProduct.partNumber.toLowerCase()
          ).sort((a, b) => a.warehouse.localeCompare(b.warehouse)); // Sort by warehouse alphabetically
          setProducts(matchingProducts);
          setProductName(referenceProduct.name);
          setPartNumber(referenceProduct.partNumber);
        }
      }
      setLoading(false);
    });
    
    return unsubscribe;
  }, [productId]);

  // Handle add quantity
  const handleAddQuantity = async (productId, warehouseId) => {
    const addAmount = parseInt(addQuantities[productId] || 0);
    if (addAmount <= 0) {
      showToast("Please enter a valid quantity to add", "error");
      return;
    }

    try {
      const productRef = doc(db, "products", productId);
      const product = products.find(p => p.id === productId);
      const newQuantity = product.quantity + addAmount;
      
      await updateDoc(productRef, { quantity: newQuantity });
      
      // Log the change
      await addDoc(collection(db, "stock_history"), {
        productName: product.name,
        partNumber: product.partNumber,
        modelNo: product.modelNo,
        warehouse: product.warehouse,
        change: `+${addAmount}`,
        user: auth.currentUser?.email || "Unknown",
        timestamp: serverTimestamp(),
      });
      
      // Clear the input
      setAddQuantities(prev => ({ ...prev, [productId]: "" }));
      showToast(`Added ${addAmount} units to ${product.warehouse}`, "success");
    } catch (error) {
      console.error("Error adding quantity:", error);
      showToast(`Error adding quantity: ${error.message}`, "error");
    }
  };

  // Handle replace quantity
  const handleReplaceQuantity = async (productId, warehouseId) => {
    const newAmount = parseInt(replaceQuantities[productId] || 0);
    if (newAmount < 0) {
      showToast("Please enter a valid quantity", "error");
      return;
    }

    try {
      const productRef = doc(db, "products", productId);
      const product = products.find(p => p.id === productId);
      const oldQuantity = product.quantity;
      
      await updateDoc(productRef, { quantity: newAmount });
      
      // Log the change
      await addDoc(collection(db, "stock_history"), {
        productName: product.name,
        partNumber: product.partNumber,
        modelNo: product.modelNo,
        warehouse: product.warehouse,
        change: `${oldQuantity} → ${newAmount} (Replaced)`,
        user: auth.currentUser?.email || "Unknown",
        timestamp: serverTimestamp(),
      });
      
      // Clear the input
      setReplaceQuantities(prev => ({ ...prev, [productId]: "" }));
      showToast(`Quantity in ${product.warehouse} updated to ${newAmount}`, "success");
    } catch (error) {
      console.error("Error replacing quantity:", error);
      showToast(`Error updating quantity: ${error.message}`, "error");
    }
  };

  // Handle back navigation
  const handleBack = () => {
    navigate("/dashboard");
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-content">
          <div className="text-center" style={{ padding: "2rem" }}>
            <div className="spinner-border text-primary" role="status" style={{ width: "3rem", height: "3rem" }}>
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3 text-muted">Loading product details...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        show={toast.show}
        onClose={closeToast}
      />
      
      <div className="dashboard-content">
        <div className="dashboard-header mb-4">
          <div>
            <h1 className="dashboard-title">
              <i className="bi bi-box-seam me-2"></i>
              Product Details
            </h1>
            <p className="mt-2 text-muted">Manage product quantities across warehouses</p>
          </div>
          <div>
            <button onClick={handleBack} className="btn btn-outline-primary">
              <i className="bi bi-arrow-left me-2"></i>
              Back to Dashboard
            </button>
          </div>
        </div>

        <div className="row">
          <div className="col-lg-12">
            <div className="dashboard-card">
              <div className="card-body">
                <h5 className="card-title mb-4">
                  <i className="bi bi-pencil-square me-2"></i>
                  Product Information
                </h5>
                <p><strong>Product Name:</strong> {productName}</p>
                <p><strong>Part Number:</strong> {partNumber}</p>

                <div className="table-responsive">
                  <table className="table table-striped table-hover">
                    <thead>
                      <tr>
                        <th>Model No</th>
                        <th>Warehouse</th>
                        <th>Quantity</th>
                        {(role === "admin" || role === "manager") && <th>Add Quantity</th>}
                        {(role === "admin" || role === "manager") && <th>Replace Quantity</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {products.map(product => (
                        <tr key={product.id}>
                          <td>{product.modelNo}</td>
                          <td>{product.warehouse}</td>
                          <td>
                            <span className={`${product.quantity <= 0 ? 'text-danger' : product.quantity < 10 ? 'text-warning' : 'text-success'}`}>
                              {product.quantity}
                            </span>
                          </td>
                          {(role === "admin" || role === "manager") && (
                            <td>
                              <div className="d-flex gap-2 align-items-center">
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  placeholder="Enter amount"
                                  value={addQuantities[product.id] || ""}
                                  onChange={(e) => setAddQuantities(prev => ({ ...prev, [product.id]: e.target.value }))}
                                  style={{ width: "120px" }}
                                />
                                <button
                                  className="btn btn-sm btn-success"
                                  onClick={() => handleAddQuantity(product.id, product.warehouse)}
                                  disabled={!addQuantities[product.id] || addQuantities[product.id] <= 0}
                                >
                                  <i className="bi bi-plus-circle me-1"></i>
                                  Add
                                </button>
                              </div>
                            </td>
                          )}
                          {(role === "admin" || role === "manager") && (
                            <td>
                              <div className="d-flex gap-2 align-items-center">
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  placeholder="New total"
                                  value={replaceQuantities[product.id] || ""}
                                  onChange={(e) => setReplaceQuantities(prev => ({ ...prev, [product.id]: e.target.value }))}
                                  style={{ width: "120px" }}
                                />
                                <button
                                  className="btn btn-sm btn-warning"
                                  onClick={() => handleReplaceQuantity(product.id, product.warehouse)}
                                  disabled={replaceQuantities[product.id] === "" || replaceQuantities[product.id] < 0}
                                >
                                  <i className="bi bi-arrow-repeat me-1"></i>
                                  Replace
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductDetails;