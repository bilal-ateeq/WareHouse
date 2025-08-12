import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function CreateRequest() {
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) {
      alert("You must be logged in to create a request.");
      return;
    }

    await addDoc(collection(db, 'requests'), {
      productName,
      quantity: parseInt(quantity),
      status: 'pending',
      createdBy: user.uid,
      createdAt: new Date()
    });

    navigate('/requests');
  };

  return (
    <div>
      <h2>Create Stock Request</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Product Name"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="Quantity"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
        <button type="submit">Submit Request</button>
      </form>
    </div>
  );
}
