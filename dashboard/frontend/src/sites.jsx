import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { API_BASE } from "./config/api";
import './css/sites.css'
import { showToast } from "./Toast";

export function Sitewisefb() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const { apiCall } = useAuth();
  const [error, setError] = useState("");
  const API = `${API_BASE}/sites`;

  const refreshSites = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiCall(`${API}`);
      if (data && !data.error) {
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
  const [editValues, setEditValues] = useState({ site_name: "", site_manager: "", passphrase: "", date_of_start: "" });
  const startEdit = (site) => { 
    setEditingId(site.id); 
    setEditValues({ 
      site_name: site.site_name || "", 
      site_manager: site.site_manager || "", 
      passphrase: site.passphrase || "",
      date_of_start: site.date_of_start ? site.date_of_start.split('T')[0] : ""
    }); 
  };
  const cancelEdit = () => { setEditingId(null); setEditValues({ site_name: "", site_manager: "", passphrase: "", date_of_start: "" }); };
  const saveEdit = async (id) => {
    try {
      const response = await apiCall(`${API}/${id}`, {
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
      const response = await apiCall(`${API}/${id}`, { 
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
          <div className="sitecard" key={site.id}>
            <div className="site-status"></div>
            <img src={"https://thumbs.dreamstime.com/b/modern-residential-building-beautiful-recreation-area-modern-residential-building-recreation-area-131403554.jpg"} alt={site.site_name} />
            <div className="sitecard-content">
              {editingId === site.id ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <input value={editValues.site_name} onChange={(e)=>setEditValues(v=>({ ...v, site_name: e.target.value }))} placeholder="Site name" />
                  <input value={editValues.site_manager} onChange={(e)=>setEditValues(v=>({ ...v, site_manager: e.target.value }))} placeholder="Site Manager" />
                  <input value={editValues.passphrase} onChange={(e)=>setEditValues(v=>({ ...v, passphrase: e.target.value }))} placeholder="Passphrase" />
                  <input type="date" value={editValues.date_of_start} onChange={(e)=>setEditValues(v=>({ ...v, date_of_start: e.target.value }))} placeholder="Date of Start" />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={()=>saveEdit(site.id)} className="save-btn">Save</button>
                    <button onClick={cancelEdit} className="cancel-btn">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <h3>{site.site_name}</h3>
                  {site.site_manager && <h4 className="location">Manager: {site.site_manager}</h4>}
                  {site.passphrase && <p style={{fontSize: '0.9em', color: '#666'}}>Passphrase: {site.passphrase}</p>}
                  {site.date_of_start && <p style={{fontSize: '0.9em', color: '#666'}}>Started: {new Date(site.date_of_start).toLocaleDateString()}</p>}
                  <div className="site-actions" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => startEdit(site)} className="edit-btn">Edit</button>
                    <button onClick={() => deleteSite(site.id)} className="delete-btn">Delete</button>
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
