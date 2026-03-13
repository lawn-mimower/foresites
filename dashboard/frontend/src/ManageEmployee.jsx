import React, { useState, useEffect } from 'react';
import QRCode from "react-qr-code";
import "./css/manage-employee.css";
const API_URL = "http://localhost:9999/api/employee";

const initialForm = {
  name: '',
  phone: '',
  contractor: '',
  id: '',
  date: ''
};

export default function ManageEmployee() {
  const [form, setForm] = useState(initialForm);
  const [employees, setEmployees] = useState([]);
  const [editIndex, setEditIndex] = useState(null);

  useEffect(() => {
    // Fetch employees from backend
    fetch(API_URL)
      .then(res => res.json())
      .then(data => setEmployees(data))
      .catch(() => setEmployees([]));
  }, []);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (editIndex !== null) {
      // Update employee
      const emp = employees[editIndex];
      const res = await fetch(`${API_URL}/${emp._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        const updated = await res.json();
        const newList = [...employees];
        newList[editIndex] = updated;
        setEmployees(newList);
        setEditIndex(null);
        setForm(initialForm);
      }
    } else {
      // Add employee
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        const added = await res.json();
        setEmployees([...employees, added]);
        setForm(initialForm);
      }
    }
  };

  const handleEdit = idx => {
    setForm({
      name: employees[idx].name,
      phone: employees[idx].phone,
      contractor: employees[idx].contractor,
      id: employees[idx].id,
      date: employees[idx].date ? employees[idx].date.slice(0,10) : ''
    });
    setEditIndex(idx);
  };

  const handleDelete = async idx => {
    const emp = employees[idx];
    const res = await fetch(`${API_URL}/${emp._id}`, {
      method: "DELETE"
    });
    if (res.ok) {
      setEmployees(employees.filter((_, i) => i !== idx));
      if (editIndex === idx) setForm(initialForm);
    }
  };

  return (
    <div className="manage-employee">
      <h2>Manage Employees</h2>
      <form onSubmit={handleSubmit} className="employee-form">
        <label>Name
          <input name="name" value={form.name} onChange={handleChange} placeholder="Name" required />
        </label>
        <label>Phone Number
          <input name="phone" value={form.phone} onChange={handleChange} placeholder="Phone Number" required />
        </label>
        <label>Contractor Name
          <input name="contractor" value={form.contractor} onChange={handleChange} placeholder="Contractor Name" required />
        </label>
        <label>ID
          <input name="id" value={form.id} onChange={handleChange} placeholder="ID" required />
        </label>
        <label>Date of Joining
          <input name="date" value={form.date} onChange={handleChange} type="date" placeholder="Date of Joining" required />
        </label>
        <div style={{gridColumn:'span 2',textAlign:'center'}}>
          <button type="submit">{editIndex !== null ? 'Update' : 'Add'} Employee</button>
          {editIndex !== null && <button type="button" onClick={() => { setForm(initialForm); setEditIndex(null); }}>Cancel</button>}
        </div>
      </form>
      <div className="employee-list">
        <h3>Employee List</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Contractor</th>
              <th>ID</th>
              <th>Date of Joining</th>
              <th>QR Code</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, idx) => (
              <tr key={idx}>
                <td>{emp.name}</td>
                <td>{emp.phone}</td>
                <td>{emp.contractor}</td>
                <td>{emp.id}</td>
                <td>{emp.date}</td>
                <td>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
                    <QRCode value={`${emp.name}|${emp.contractor}|${emp.id}`} size={64} id={`qr-${emp._id || idx}`} />
                    <button style={{marginTop:8,padding:'4px 12px'}} onClick={() => {
                      const qr = document.getElementById(`qr-${emp._id || idx}`);
                      if (!qr) return;
                      const printWindow = window.open('', '', 'width=400,height=400');
                      printWindow.document.write('<html><head><title>Print QR</title></head><body style="display:flex;justify-content:center;align-items:center;height:100vh">');
                      printWindow.document.write(qr.outerHTML);
                      printWindow.document.write('</body></html>');
                      printWindow.document.close();
                      printWindow.focus();
                      setTimeout(() => printWindow.print(), 500);
                    }}>Print QR</button>
                  </div>
                </td>
                <td>
                  <button onClick={() => handleEdit(idx)}>Edit</button>
                  <button onClick={() => handleDelete(idx)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
