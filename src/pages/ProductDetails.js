import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import cloudinaryService from "../services/cloudinaryService";
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
  const [reduceQuantities, setReduceQuantities] = useState({});
  
  // Image management states
  const [editingImage, setEditingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
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

  // Handle reduce quantity
  const handleReduceQuantity = async (productId, warehouseId) => {
    const reduceAmount = parseInt(reduceQuantities[productId] || 0);
    if (reduceAmount <= 0) {
      showToast("Please enter a valid quantity to reduce", "error");
      return;
    }

    const product = products.find(p => p.id === productId);
    if (reduceAmount > product.quantity) {
      showToast(`Cannot reduce by ${reduceAmount}. Current quantity is ${product.quantity}`, "error");
      return;
    }

    try {
      const productRef = doc(db, "products", productId);
      const newQuantity = product.quantity - reduceAmount;
      
      await updateDoc(productRef, { quantity: newQuantity });
      
      // Log the change
      await addDoc(collection(db, "stock_history"), {
        productName: product.name,
        partNumber: product.partNumber,
        modelNo: product.modelNo,
        warehouse: product.warehouse,
        change: `-${reduceAmount}`,
        user: auth.currentUser?.email || "Unknown",
        timestamp: serverTimestamp(),
      });
      
      // Clear the input
      setReduceQuantities(prev => ({ ...prev, [productId]: "" }));
      showToast(`Reduced ${reduceAmount} units from ${product.warehouse}`, "success");
    } catch (error) {
      console.error("Error reducing quantity:", error);
      showToast(`Error reducing quantity: ${error.message}`, "error");
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

  // Cancel image editing
  const cancelImageEdit = () => {
    setEditingImage(false);
    setSelectedImage(null);
    setImagePreview(null);
  };

  // Update product image
  const updateProductImage = async () => {
    if (!selectedImage) {
      showToast("Please select an image first", "error");
      return;
    }

    setUploadingImage(true);

    try {
      // Upload new image to Cloudinary
      const uploadResult = await cloudinaryService.uploadImage(selectedImage);
      
      if (!uploadResult.success) {
        showToast(`Error uploading image: ${uploadResult.error}`, "error");
        setUploadingImage(false);
        return;
      }

      // Update all products with the same name and part number
      const updatePromises = products.map(async (product) => {
        const productRef = doc(db, "products", product.id);
        await updateDoc(productRef, {
          imageUrl: uploadResult.url,
          imagePublicId: uploadResult.publicId,
          updatedAt: serverTimestamp(),
        });
      });

      await Promise.all(updatePromises);

      // Reset editing state
      setEditingImage(false);
      setSelectedImage(null);
      setImagePreview(null);
      setUploadingImage(false);

      showToast("Product image updated successfully!", "success");
    } catch (error) {
      console.error("Error updating image:", error);
      showToast(`Error updating image: ${error.message}`, "error");
      setUploadingImage(false);
    }
  };

  // Remove product image
  const removeProductImage = async () => {
    const confirmRemove = window.confirm("Are you sure you want to remove the product image?");
    if (!confirmRemove) return;

    setUploadingImage(true);

    try {
      // Update all products with the same name and part number to remove image
      const updatePromises = products.map(async (product) => {
        const productRef = doc(db, "products", product.id);
        await updateDoc(productRef, {
          imageUrl: null,
          imagePublicId: null,
          updatedAt: serverTimestamp(),
        });
      });

      await Promise.all(updatePromises);

      setUploadingImage(false);
      showToast("Product image removed successfully!", "success");
    } catch (error) {
      console.error("Error removing image:", error);
      showToast(`Error removing image: ${error.message}`, "error");
      setUploadingImage(false);
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
                
                {/* Product Basic Info and Image Section */}
                <div className="row mb-4">
                  <div className="col-md-8">
                    <p><strong>Product Name:</strong> {productName}</p>
                    <p><strong>Part Number:</strong> {partNumber}</p>
                  </div>
                  <div className="col-md-4">
                    {/* Display product image if available */}
                    {products.length > 0 && products[0].imageUrl ? (
                      <div className="text-center">
                        <img
                          src={products[0].imageUrl}
                          alt={productName}
                          style={{ 
                            maxWidth: "200px", 
                            maxHeight: "200px", 
                            objectFit: "cover",
                            border: "1px solid #ddd",
                            borderRadius: "8px",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                          }}
                          className="img-fluid"
                        />
                        <p className="text-muted mt-2 small">Product Image</p>
                        
                        {/* Image Management Buttons - Only for admin/manager */}
                        {(role === "admin" || role === "manager") && (
                          <div className="mt-2">
                            <button
                              className="btn btn-sm btn-outline-primary me-2"
                              onClick={() => setEditingImage(true)}
                              disabled={uploadingImage}
                            >
                              <i className="bi bi-pencil me-1"></i>
                              Edit Image
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={removeProductImage}
                              disabled={uploadingImage}
                            >
                              {uploadingImage ? (
                                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                              ) : (
                                <i className="bi bi-trash me-1"></i>
                              )}
                              Remove Image
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-muted">
                        <i className="bi bi-image" style={{ fontSize: "4rem", opacity: 0.3 }}></i>
                        <p className="mt-2 small">No image available</p>
                        
                        {/* Add Image Button - Only for admin/manager */}
                        {(role === "admin" || role === "manager") && (
                          <button
                            className="btn btn-sm btn-outline-success mt-2"
                            onClick={() => setEditingImage(true)}
                            disabled={uploadingImage}
                          >
                            <i className="bi bi-plus-circle me-1"></i>
                            Add Image
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Image Upload/Edit Section */}
                {editingImage && (role === "admin" || role === "manager") && (
                  <div className="row mb-4">
                    <div className="col-12">
                      <div className="card">
                        <div className="card-header">
                          <h6 className="mb-0">
                            <i className="bi bi-image me-2"></i>
                            {products[0]?.imageUrl ? 'Update Product Image' : 'Add Product Image'}
                          </h6>
                        </div>
                        <div className="card-body">
                          <div className="mb-3">
                            <label htmlFor="imageFile" className="form-label">Select New Image</label>
                            <input
                              id="imageFile"
                              type="file"
                              className="form-control"
                              accept="image/*"
                              onChange={handleImageSelect}
                            />
                            <small className="form-text text-muted">
                              Maximum file size: 5MB. Supported formats: JPG, PNG, GIF
                            </small>
                          </div>
                          
                          {imagePreview && (
                            <div className="mb-3">
                              <label className="form-label">Preview</label>
                              <div className="text-center">
                                <img
                                  src={imagePreview}
                                  alt="Preview"
                                  style={{ 
                                    maxWidth: "200px", 
                                    maxHeight: "200px", 
                                    objectFit: "cover",
                                    border: "1px solid #ddd",
                                    borderRadius: "4px"
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          
                          <div className="d-flex gap-2">
                            <button
                              className="btn btn-primary"
                              onClick={updateProductImage}
                              disabled={!selectedImage || uploadingImage}
                            >
                              {uploadingImage ? (
                                <>
                                  <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <i className="bi bi-check-circle me-1"></i>
                                  {products[0]?.imageUrl ? 'Update Image' : 'Add Image'}
                                </>
                              )}
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={cancelImageEdit}
                              disabled={uploadingImage}
                            >
                              <i className="bi bi-x-circle me-1"></i>
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="table-responsive">
                  <table className="table table-striped table-hover">
                    <thead>
                      <tr>
                        <th>Model No</th>
                        <th>Warehouse</th>
                        <th>Quantity</th>
                        {(role === "admin" || role === "manager") && <th>Add Quantity</th>}
                        {(role === "admin" || role === "manager") && <th>Reduce Quantity</th>}
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
                                  placeholder="Enter amount"
                                  value={reduceQuantities[product.id] || ""}
                                  onChange={(e) => setReduceQuantities(prev => ({ ...prev, [product.id]: e.target.value }))}
                                  style={{ width: "120px" }}
                                />
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleReduceQuantity(product.id, product.warehouse)}
                                  disabled={!reduceQuantities[product.id] || reduceQuantities[product.id] <= 0 || product.quantity <= 0}
                                >
                                  <i className="bi bi-dash-circle me-1"></i>
                                  Reduce
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