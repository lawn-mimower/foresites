import React, { useEffect, useState } from "react";
import { showToast } from "./Toast";
import { useAuth } from "./AuthContext";
import "./css/addform.css";

export function Addform() {
  const [siteName, setSiteName] = useState("");
  const [siteDesc, setSiteDesc] = useState("");
  const [sites, setSites] = useState([]);
  const [siteMsg, setSiteMsg] = useState("");

  const [passCode, setPassCode] = useState("");
  const [passSite, setPassSite] = useState("");
  const [passphrases, setPassphrases] = useState([]);
  const [passMsg, setPassMsg] = useState("");
  const { apiCall } = useAuth();

  const API = "http://localhost:9999/api/dashboard";

  // 🔄 Refreshers
  const refreshSites = async () => {
    try {
      const response = await apiCall(`${API}/sites`);
      if (response && !response.error) {
        const data = await response.json();
        setSites(Array.isArray(data) ? data : []);
      } else {
        setSites([]);
      }
    } catch (error) {
      console.error('Error fetching sites:', error);
      setSites([]);
    }
  };

  const refreshPassphrases = async () => {
    try {
      const response = await apiCall(`${API}/passphrases`);
      if (response && !response.error) {
        const data = await response.json();
        setPassphrases(Array.isArray(data) ? data : []);
      } else {
        setPassphrases([]);
      }
    } catch (error) {
      console.error('Error fetching passphrases:', error);
      setPassphrases([]);
    }
  };

  useEffect(() => {
    refreshSites();
    refreshPassphrases();
  }, [apiCall]);

  // 🧩 Create Site
  const createSite = async (e) => {
    e.preventDefault();
    setSiteMsg("");
    try {
      const response = await apiCall(`${API}/sites`, {
        method: "POST",
        body: JSON.stringify({ name: siteName, description: siteDesc }),
      });

      if (response && !response.error) {
        showToast("Site created successfully", "success");
        setSiteMsg("Site created successfully");
        setSiteName("");
        setSiteDesc("");
        refreshSites();
      } else {
        throw new Error("Failed to create site");
      }
    } catch (err) {
      showToast("Failed to create site", "error");
      setSiteMsg(`❌ ${err.message}`);
    }
  };

  // 🧩 Create Passphrase
  const createPassphrase = async (e) => {
    e.preventDefault();
    setPassMsg("");
    try {
      const response = await apiCall(`${API}/passphrases`, {
        method: "POST",
        body: JSON.stringify({ code: passCode, site: passSite }),
      });

      if (response && !response.error) {
        showToast("Passphrase created successfully", "success");
        setPassMsg("Passphrase created successfully");
        setPassCode("");
        setPassSite("");
        refreshPassphrases();
      } else {
        throw new Error("Failed to create passphrase");
      }
    } catch (err) {
      showToast("Failed to create passphrase", "error");
      setPassMsg(`❌ ${err.message}`);
    }
  };

  // Update / Delete Helpers
  const updateSite = async (site) => {
    const name = prompt("Edit site name", site.name) ?? site.name;
    const description = prompt("Edit description", site.description || "") ?? site.description;

    try {
      const response = await apiCall(`${API}/sites/${site._id}`, {
        method: "PUT",
        body: JSON.stringify({ name, description }),
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

  const deleteSite = async (id) => {
    if (!window.confirm("Delete this site?")) return;
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

  const updatePassphrase = async (p) => {
    const code = prompt("Edit passphrase code", p.code) ?? p.code;
    const site = prompt("Edit site name", p.site) ?? p.site;

    try {
      const response = await apiCall(`${API}/passphrases/${p._id}`, {
        method: "PUT",
        body: JSON.stringify({ code, site }),
      });
      
      if (response && !response.error) {
        showToast("Passphrase updated", "success");
        refreshPassphrases();
      } else {
        showToast("Failed to update passphrase", "error");
      }
    } catch (error) {
      console.error('Error updating passphrase:', error);
      showToast("Failed to update passphrase", "error");
    }
  };

  const deletePassphrase = async (id) => {
    if (!window.confirm("Delete this passphrase?")) return;
    try {
      const response = await apiCall(`${API}/passphrases/${id}`, { 
        method: "DELETE" 
      });
      
      if (response && !response.error) {
        showToast("Passphrase deleted", "success");
        refreshPassphrases();
      } else {
        showToast("Failed to delete passphrase", "error");
      }
    } catch (error) {
      console.error('Error deleting passphrase:', error);
      showToast("Failed to delete passphrase", "error");
    }
  };

  // 🧠 UI
  return (
    <div className="addform-container">
      <h1> Manage Access Points</h1>

      <div className="forms-wrapper">
        {/* Site Section */}
        <div className="form-card">
          <h2> Create Site</h2>
          <form onSubmit={createSite} className="form-section">
            <label>Site Name</label>
            <input
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="Enter unique site name"
              required
            />

            <label>Description</label>
            <input
              value={siteDesc}
              onChange={(e) => setSiteDesc(e.target.value)}
              placeholder="Optional description"
            />

            <button type="submit" className="primary-btn">Add Site</button>
          </form>
          {siteMsg && <p className="status-msg">{siteMsg}</p>}

          <h3>Existing Sites</h3>
          <ul className="list">
            {sites.map((s) => (
              <li key={s._id} className="list-item">
                <span>
                  <strong>{s.name}</strong>
                  {s.description ? ` — ${s.description}` : ""}
                </span>
                <div className="actions">
                  <button onClick={() => updateSite(s)} className="edit-btn">Edit</button>
                  <button onClick={() => deleteSite(s._id)} className="delete-btn">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Passphrase Section */}
        <div className="form-card">
          <h2> Create Passphrase</h2>
          <form onSubmit={createPassphrase} className="form-section">
            <label>Passphrase Code</label>
            <input
              value={passCode}
              onChange={(e) => setPassCode(e.target.value)}
              placeholder="Enter passphrase code"
              required
            />

            <label>Associated Site</label>
            <input
              value={passSite}
              onChange={(e) => setPassSite(e.target.value)}
              placeholder="Site name"
              required
            />

            <button type="submit" className="primary-btn">Add Passphrase</button>
          </form>
          {passMsg && <p className="status-msg">{passMsg}</p>}

          <h3>Existing Passphrases</h3>
          <ul className="list">
            {passphrases.map((p) => (
              <li key={p._id} className="list-item">
                <span>
                  <strong>{p.code}</strong> → {p.site}
                </span>
                <div className="actions">
                  <button onClick={() => updatePassphrase(p)} className="edit-btn">Edit</button>
                  <button onClick={() => deletePassphrase(p._id)} className="delete-btn">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
