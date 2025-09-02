import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import './CustomerFormPage.css';

function CustomerFormPage({ editMode }){
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ first_name:'', last_name:'', phone_number:'' });
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    if (id) load();
    // eslint-disable-next-line
  }, [id]);

  async function load(){
    setLoading(true);
    try{
      const res = await api.get(`/customers/${id}`);
      const data = res.data.data;
      setForm({ first_name: data.first_name, last_name: data.last_name, phone_number: data.phone_number });
    }catch(err){ console.error(err); alert('Failed'); }
    finally{ setLoading(false); }
  }

  function handleChange(e){ setForm(prev => ({...prev, [e.target.name]: e.target.value})); }

  async function handleSubmit(e){
    e.preventDefault();
    // client-side validation
    if(!form.first_name || !form.last_name || !form.phone_number){ return alert('Fill required fields'); }
    try{
      if (id){
        await api.put(`/customers/${id}`, form);
        alert('Updated');
        navigate(`/customers/${id}`);
      } else {
        const res = await api.post('/customers', form);
        alert('Created');
        navigate(`/customers/${res.data.data.id}`);
      }
    }catch(err){
      console.error(err);
      const msg = err?.response?.data?.message || 'Server error';
      alert(msg);
    }
  }

  return (
    <div className="page-background">
    <div className="card">
      <h2>{id ? 'Edit Customer' : 'New Customer'}</h2>
      {loading ? <div>Loading...</div> : (
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>First Name</label>
            <input name="first_name" value={form.first_name} onChange={handleChange} className="input" />
          </div>
          <div className="form-row">
            <label>Last Name</label>
            <input name="last_name" value={form.last_name} onChange={handleChange} className="input" />
          </div>
          <div className="form-row">
            <label>Phone</label>
            <input name="phone_number" value={form.phone_number} onChange={handleChange} className="input" />
          </div>
          <div className="form-row">
            <button className="button primary">Save</button>
          </div>
        </form>
      )}
    </div>
    </div>
  );
}

export default CustomerFormPage;