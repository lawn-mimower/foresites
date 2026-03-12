import React, { useEffect, useState } from "react";
import { showToast } from "./Toast";
import { useAuth } from "./AuthContext";
import "./css/addform.css";

export function Addform() {
  const [siteName, setSiteName] = useState("");
  const [siteManager, setSiteManager] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [dateOfStart, setDateOfStart] = useState("");
  const [sites, setSites] = useState([]);
  const [siteMsg, setSiteMsg] = useState("");

  const { apiCall, isSuperAdminOrSrEngineer } = useAuth();

  const API = "http://localhost:9999/api/sites";
  const canManageAccessPoints = isSuperAdminOrSrEngineer();

  // 🔄 Refresher
  const refreshSites = async () => {
    try {
      const data = await apiCall(`${API}`);
      if (data && !data.error) {
        setSites(Array.isArray(data) ? data : []);
      } else {
        setSites([]);
      }
    } catch (error) {
      console.error('Error fetching sites:', error);
      setSites([]);
    }
  };

  useEffect(() => {
    refreshSites();
  }, [apiCall]);

  // 🧩 Create Site
  const createSite = async (e) => {
    e.preventDefault();
    setSiteMsg("");
    try {
      const response = await apiCall(`${API}`, {
        method: "POST",
        body: JSON.stringify({
          site_name: siteName,
          site_manager: siteManager,
          passphrase: passphrase,
          date_of_start: dateOfStart || null
        }),
      });

      if (response && !response.error) {
        showToast("Site created successfully", "success");
        setSiteMsg("Site created successfully");
        setSiteName("");
        setSiteManager("");
        setPassphrase("");
        setDateOfStart("");
        refreshSites();
      } else {
        throw new Error("Failed to create site");
      }
    } catch (err) {
      showToast("Failed to create site", "error");
      setSiteMsg(`❌ ${err.message}`);
    }
  };

  // Update Site
  const updateSite = async (site) => {
    const site_name = prompt("Edit site name", site.site_name) ?? site.site_name;
    const site_manager = prompt("Edit site manager", site.site_manager || "") ?? site.site_manager;
    const passphrase_val = prompt("Edit passphrase", site.passphrase || "") ?? site.passphrase;
    const date_of_start = site.date_of_start ? site.date_of_start.split('T')[0] : "";

    try {
      const response = await apiCall(`${API}/${site.id}`, {
        method: "PUT",
        body: JSON.stringify({ site_name, site_manager, passphrase: passphrase_val, date_of_start }),
      });
      
      if (response && !response.error) {
        showToast("Site updated", "success");
        refreshSites();
      } else {
        showToast("Failed to update site", "error");
      }
    } catch (error) {
      console.error('Error updating site:', error);
      showToast("Failed to update site", "error");
    }
  };

  // Delete Site
  const deleteSite = async (id) => {
    if (!window.confirm("Delete this site?")) return;
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

  // 🧠 UI
  return (
    <div className="addform-container">
      <h1> Manage Access Points</h1>

      {!canManageAccessPoints && (
        <div style={{
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '1.5rem',
          color: '#c33',
          textAlign: 'center'
        }}>
          <h3>⛔ Access Restricted</h3>
          <p>Only Superadmin and Sr. Engineer can manage access points. You have view-only access.</p>
        </div>
      )}

      <div className="forms-wrapper">
        {/* Site Section */}
        <div className="form-card">
          <h2> Create Site</h2>
          {canManageAccessPoints ? (
            <form onSubmit={createSite} className="form-section">
              <label>Site Name</label>
              <input
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="Enter unique site name"
                required
              />

              <label>Site Manager</label>
              <input
                value={siteManager}
                onChange={(e) => setSiteManager(e.target.value)}
                placeholder="Manager name"
              />

              <label>Passphrase</label>
              <input
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Optional passphrase code"
              />

              <label>Date of Start</label>
              <input
                type="date"
                value={dateOfStart}
                onChange={(e) => setDateOfStart(e.target.value)}
              />

              <button type="submit" className="primary-btn">Add Site</button>
            </form>
          ) : (
            <p style={{ padding: '1rem', color: '#666', fontStyle: 'italic' }}>
              You don't have permission to create new sites.
            </p>
          )}

          {siteMsg && <p className="status-msg">{siteMsg}</p>}

          <h3>Existing Sites</h3>
          <ul className="list">
            {sites.map((s) => (
              <li key={s.id} className="list-item">
                <div style={{ flex: 1 }}>
                  <strong>{s.site_name}</strong>
                  {s.site_manager && <div style={{fontSize: '0.9em', color: '#666'}}>Manager: {s.site_manager}</div>}
                  {s.passphrase && <div style={{fontSize: '0.9em', color: '#666'}}>Passphrase: {s.passphrase}</div>}
                  {s.date_of_start && <div style={{fontSize: '0.85em', color: '#999'}}>Started: {new Date(s.date_of_start).toLocaleDateString()}</div>}
                </div>
                {canManageAccessPoints && (
                  <div className="actions">
                    <button onClick={() => updateSite(s)} className="edit-btn">Edit</button>
                    <button onClick={() => deleteSite(s.id)} className="delete-btn">Delete</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
