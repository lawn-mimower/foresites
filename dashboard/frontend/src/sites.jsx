import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import './css/sites.css'
import { showToast } from "./Toast";

export function Sitewisefb() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const { apiCall } = useAuth();
  const [error, setError] = useState("");
  const API = "http://localhost:9999/api/dashboard";

  const refreshSites = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiCall(`${API}/sites`);
      if (response && !response.error) {
        const data = await response.json();
        setSites(Array.isArray(data) ? data : []);
      } else {
        setSites([]);
        setError("Failed to load sites");
      }
    } catch (error) {
      console.error('Error fetching sites:', error);
      setSites([]);
      setError("Failed to load sites");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSites();
  }, [apiCall]);

  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({ name: "", description: "" });
  const startEdit = (site) => { setEditingId(site._id); setEditValues({ name: site.name || "", description: site.description || "" }); };
  const cancelEdit = () => { setEditingId(null); setEditValues({ name: "", description: "" }); };
  const saveEdit = async (id) => {
    try {
      const response = await apiCall(`${API}/sites/${id}`, {
        method: "PUT",
        body: JSON.stringify(editValues)
      });
      
      if (response && !response.error) {
        showToast("Site updated", "success");
        refreshSites();
        cancelEdit();
      } else {
        showToast("Failed to update site", "error");
      }
    } catch (error) {
      console.error('Error saving site edit:', error);
      showToast("Failed to update site", "error");
    }
  };

  const deleteSite = async (id) => {
    try {
      const response = await apiCall(`${API}/sites/${id}`, { 
        method: "DELETE" 
      });
      
      if (response && !response.error) {
        showToast("Site deleted", "success");
        refreshSites();
      } else {
        showToast("Failed to delete site", "error");
      }
    } catch (error) {
      console.error('Error deleting site:', error);
      showToast("Failed to delete site", "error");
    }
  };

  return (
    <div className="sitewisefb">
      <h1>Site Wise Feedbacks</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {loading ? <p>Loading sites...</p> : null}
      {!loading && sites.length === 0 ? <p>No sites found. Add a site in Manage Access.</p> : null}
      <div className="sitebanner">
        {sites.map((site) => (
          <div className="sitecard" key={site._id}>
            <div className="site-status"></div>
            <img src={"https://thumbs.dreamstime.com/b/modern-residential-building-beautiful-recreation-area-modern-residential-building-recreation-area-131403554.jpg"} alt={site.name} />
            <div className="sitecard-content">
              {editingId === site._id ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <input value={editValues.name} onChange={(e)=>setEditValues(v=>({ ...v, name: e.target.value }))} placeholder="Site name" />
                  <input value={editValues.description} onChange={(e)=>setEditValues(v=>({ ...v, description: e.target.value }))} placeholder="Description" />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={()=>saveEdit(site._id)} className="save-btn">Save</button>
                    <button onClick={cancelEdit} className="cancel-btn">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <h3>{site.name}</h3>
                  {site.description && <h4 className="location">{site.description}</h4>}
                  <div className="site-actions" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => startEdit(site)} className="edit-btn">Edit</button>
                    <button onClick={() => deleteSite(site._id)} className="delete-btn">Delete</button>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
