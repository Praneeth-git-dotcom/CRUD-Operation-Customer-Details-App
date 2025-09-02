import React, { useEffect, useState } from 'react';
import api from '../api';
import { Link, useSearchParams } from 'react-router-dom';
import './CustomerListPage.css';

function CustomerListPage(){
  const [customers, setCustomers] = useState([]);
  const [meta, setMeta] = useState({ page:1, limit:10, total:0 });
  const [loading, setLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search') || '';
  const city = searchParams.get('city') || '';

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line
  }, [page, limit, search, city]);

  async function fetchCustomers(){
    setLoading(true);
    try{
      const res = await api.get('/customers', { params: { page, limit, search, city } });
      setCustomers(res.data.data);
      setMeta(res.data.meta);
    }catch(err){
      console.error(err);
      alert('Failed to fetch customers');
    }finally{ setLoading(false) }
  }

  function goToPage(p){
    searchParams.set('page', p);
    setSearchParams(searchParams);
  }

  function handleSearch(e){
    e.preventDefault();
    const q = e.target.search.value;
    if(q) searchParams.set('search', q); else searchParams.delete('search');
    searchParams.set('page', '1');
    setSearchParams(searchParams);
  }

  return (
    <div className='page-background'>
    <div className="card">
      <h2>Customers</h2>

      <form onSubmit={handleSearch} className="d-flex gap-2 mb-3">
  <input 
    name="search" 
    defaultValue={search} 
    className="form-control" 
    placeholder="Search by name or phone" 
  />
  <button className="btn btn-primary">Search</button>
  <Link to="/customers/new" className="btn btn-success">New Customer</Link>
</form>


      {loading ? <div>Loading...</div> : (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map(c=> (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.first_name} {c.last_name}</td>
                <td>{c.phone_number}</td>
                <td className="flex">
                  <Link to={`/customers/${c.id}`} className="btn btn-primary">View</Link>
                  <Link to={`/customers/${c.id}/edit`} className="btn btn-warning">Edit</Link>
                </td>
              </tr>
            ))}
            {customers.length===0 && (
              <tr><td colSpan={4}>No customers found</td></tr>
            )}
          </tbody>
        </table>
      )}

      <div className="mt-3 d-flex align-items-center gap-2">
  <button 
    disabled={meta.page<=1} 
    onClick={()=>goToPage(meta.page-1)} 
    className="btn btn-secondary"
  >
    Prev
  </button>

  <span>Page {meta.page} of {Math.ceil(meta.total/meta.limit)||1}</span>

  <button 
    disabled={meta.page*meta.limit>=meta.total} 
    onClick={()=>goToPage(meta.page+1)} 
    className="btn btn-secondary"
  >
    Next
  </button>
</div>
    </div>
    </div>
  );
}

export default CustomerListPage;