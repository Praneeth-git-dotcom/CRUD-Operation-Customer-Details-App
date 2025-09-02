import React, { useRef, useEffect } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import 'bootstrap/dist/css/bootstrap.min.css';

import CustomerListPage from "./pages/CustomerListPage";
import CustomerFormPage from "./pages/CustomerFormPage";
import CustomerDetailPage from "./pages/CustomerDetailPage";
import "./App.css";

function App() {
  // ✅ Define refs
  const logoRef = useRef(null);
  const navRef = useRef(null);

  // ✅ Get location from React Router
  const location = useLocation();

  return (
    <div className="app-container">
      <header className="app-header">
        <Link to="/" className="logo" ref={logoRef}>
          Customer<span>Manager</span>
        </Link>
        <nav ref={navRef}>
          <Link
            to="/"
            className={location.pathname === "/" ? "active" : ""}
          >
            Customers
          </Link>
          <Link
            to="/customers/new"
            className={location.pathname === "/customers/new" ? "active" : ""}
          >
            New Customer
          </Link>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<CustomerListPage />} />
          <Route path="/customers/new" element={<CustomerFormPage />} />
          <Route
            path="/customers/:id/edit"
            element={<CustomerFormPage editMode />}
          />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
