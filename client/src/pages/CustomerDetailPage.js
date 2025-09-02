import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import './CustomerDetailPage.css';

function CustomerDetailPage(){
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [id]);

  async function load(){
    setLoading(true);
    try{
      const res = await api.get(`/customers/${id}`);
      setCustomer(res.data.data);
    }catch(err){ console.error(err); alert('Failed to load'); }
    finally{ setLoading(false); }
  }

  async function handleDelete(){
    if(!window.confirm('Delete this customer?')) return;
    try{
      await api.delete(`/customers/${id}`);
      alert('Deleted');
      navigate('/');
    }catch(err){ console.error(err); alert('Delete failed'); }
  }

  return (
    <div className="card p-4">
      <button
        onClick={() => navigate(-1)} // takes user back
        className="back-button"
      >
        ⬅ Back
      </button>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Customer Details</h2>
        <div>
          <Link to={`/customers/${id}/edit`} className="btn btn-primary me-2">Edit</Link>
          <button onClick={handleDelete} className="btn btn-danger">Delete</button>
        </div>
      </div>

      {loading ? <div>Loading...</div> : (
        customer ? (
          <div>
            <div className="customer-info">
              <p><strong>ID:</strong> {customer.id}</p>
              <p><strong>Name:</strong> {customer.first_name} {customer.last_name}</p>
              <p><strong>Phone:</strong> {customer.phone_number}</p>
              <h3>Addresses</h3>
              <AddressManager customerId={customer.id} addresses={customer.addresses} onChange={load} />
            </div>
          </div>
        ) : <div>Customer not found</div>
      )}
    </div>
  );
}

function AddressManager({ customerId, addresses = [], onChange }){
  const [list, setList] = useState(addresses);
  const [showForm, setShowForm] = useState(false);

  useEffect(()=>{ setList(addresses); }, [addresses]);

  async function addAddress(data){
    try{
      await api.post(`/customers/${customerId}/addresses`, data);
      alert('Address added');
      setShowForm(false);
      onChange();
    }catch(err){ console.error(err); alert('Failed to add address'); }
  }

  async function deleteAddress(id){
    if(!window.confirm('Delete address?')) return;
    try{
      await api.delete(`/addresses/${id}`);
      alert('Deleted');
      onChange();
    }catch(err){ console.error(err); alert('Failed'); }
  }

  return (
    <div>
      
      {showForm && <AddressForm onSubmit={addAddress} />}

      <table className="table table-striped">
        <thead>
          <tr><th>ID</th><th>Details</th><th>City</th><th>State</th><th>Pin</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {list.map(a=> (
            <tr key={a.id}>
              <td>{a.id}</td>
              <td>{a.address_details}</td>
              <td>{a.city}</td>
              <td>{a.state}</td>
              <td>{a.pin_code}</td>
              <td>
                    <button
      className="btn btn-warning btn-sm me-2"
      onClick={() => {

        const field = prompt(
          'Enter the field you want to edit (e.g., address_details, city, pincode):'
        );

        if (field && a[field] !== undefined) {

          const newValue = prompt(`Edit ${field}`, a[field]);

          if (newValue !== null) {
            api
              .put(`/addresses/${a.id}`, { [field]: newValue })
              .then(() => onChange());
          }
        } else {
          alert("Invalid field name or field doesn't exist!");
        }
      }}
    >
      Edit
    </button>

                <button
                  className="btn btn-danger btn-sm"
                  onClick={()=>deleteAddress(a.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {list.length===0 && <tr><td colSpan={6}>No addresses</td></tr>}
        </tbody>
      </table>

      <button onClick={()=>setShowForm(s=>!s)} className="btn btn-success mb-3">
        {showForm ? 'Cancel' : 'Add Address'}
      </button>
    </div>
  );
}

function AddressForm({ onSubmit }){
  const [form, setForm] = useState({ address_details:'', city:'', state:'', pin_code:'' });
  function change(e){ setForm(s=>({...s,[e.target.name]:e.target.value})); }
  function submit(e){ e.preventDefault(); if(!form.address_details) return alert('Enter details'); onSubmit(form); }
  return (
    <form onSubmit={submit} className="mb-3">
      <div className="mb-2">
        <input name="address_details" value={form.address_details} onChange={change} placeholder="Address details" className="form-control"/>
      </div>
      <div className="row g-2 mb-2">
        <div className="col"><input name="city" value={form.city} onChange={change} placeholder="City" className="form-control" /></div>
        <div className="col"><input name="state" value={form.state} onChange={change} placeholder="State" className="form-control" /></div>
        <div className="col"><input name="pin_code" value={form.pin_code} onChange={change} placeholder="Pin code" className="form-control" /></div>
      </div>
      <button className="btn btn-primary">Save Address</button>
    </form>
  );
}

export default CustomerDetailPage;
