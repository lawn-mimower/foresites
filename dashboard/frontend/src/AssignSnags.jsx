import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { showToast } from "./Toast";
import { API_BASE } from "./config/api";
import S3Image from "./components/S3Image";
import "./css/meetzone.css";

export function AssignSnags() {
  const [snags, setSnags] = useState([]);
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSnag, setSelectedSnag] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const { apiCall, user } = useAuth();

  const API = API_BASE;

  useEffect(() => {
    if (user?.site_id) {
      fetchSnags();
      fetchUsers();
      fetchAssignments();
    } else {
      showToast("❌ Site information not found", "error");
    }
  }, [apiCall, user]);

  // ✅ Fetch unresolved snags for the site
  const fetchSnags = async () => {
    setLoading(true);
    try {
      console.log(`📌 Fetching snags for site: ${user.site_id}`);
      const data = await apiCall(
        `${API}/snag-assignments/site/${user.site_id}/unresolved-snags`
      );
      
      console.log('📌 Snags response:', data);
      
      if (!data || data.error) {
        console.error('❌ Error fetching snags:', data?.error || data?.message);
        setSnags([]);
        return;
      }

      const snagsData = Array.isArray(data) ? data : [];
      console.log(`✅ Loaded ${snagsData.length} snags`);
      setSnags(snagsData);
    } catch (err) {
      console.error("Error fetching snags:", err);
      setSnags([]);
      showToast("Failed to load snags", "error");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fetch users in the site
  const fetchUsers = async () => {
    try {
      console.log(`📌 Fetching users for site: ${user.site_id}`);
      const data = await apiCall(
        `${API}/snag-assignments/site/${user.site_id}/users`
      );
      
      console.log('📌 Users response:', data);
      
      if (!data || data.error) {
        console.error('❌ Error fetching users:', data?.error || data?.message);
        setUsers([]);
        showToast("Failed to load team members", "error");
        return;
      }

      const usersData = Array.isArray(data) ? data : [];
      console.log(`✅ Loaded ${usersData.length} users`);
      setUsers(usersData);
    } catch (err) {
      console.error("Error fetching users:", err);
      setUsers([]);
      showToast("Failed to load users", "error");
    }
  };

  // ✅ Fetch existing assignments
  const fetchAssignments = async () => {
    try {
      const data = await apiCall(
        `${API}/snag-assignments/assignments`
      );
      if (!data || data.error) {
        setAssignments([]);
        return;
      }

      const assignmentsData = Array.isArray(data) 
        ? data.filter(a => a.site_id === user.site_id)
        : [];
      setAssignments(assignmentsData);
    } catch (err) {
      console.error("Error fetching assignments:", err);
      setAssignments([]);
    }
  };

  // ✅ Assign snag to user
  const handleAssignSnag = async () => {
    if (!selectedSnag || !selectedUser) {
      showToast("⚠️ Please select both a snag and a user", "warning");
      return;
    }

    setAssigning(true);
    try {
      const response = await apiCall(
        `${API}/snag-assignments/assignments`,
        {
          method: "POST",
          body: JSON.stringify({
            snag_id: selectedSnag.id,
            site_id: user.site_id,
            assigned_user_id: selectedUser.user_id,
          }),
        }
      );

      if (response && !response.error) {
        showToast("✅ Snag assigned successfully!", "success");
        setSelectedSnag(null);
        setSelectedUser(null);
        fetchSnags();
        fetchAssignments();
      } else {
        showToast("❌ Failed to assign snag", "error");
      }
    } catch (err) {
      console.error("Error assigning snag:", err);
      showToast("Error assigning snag", "error");
    } finally {
      setAssigning(false);
    }
  };

  // ✅ Get assigned users for a snag
  const getAssignedUsers = (snagId) => {
    return assignments
      .filter(a => a.snag_id === snagId)
      .map(a => {
        const assignedUser = users.find(u => u.user_id === a.assigned_user_id);
        return assignedUser?.username || "Unknown User";
      });
  };

  const unassignedSnags = snags.filter(
    s => !assignments.some(a => a.snag_id === s.id)
  );

  return (
    <div className="container">
      <div className="page-header">
        <h1>📋 Assign Snags to Users</h1>
        <p className="subtitle">Assign feedback items to team members in {user?.profile?.firstName || "your building"}</p>
      </div>

      {/* Stats */}
      <div className="stats-section">
        <div className="stat-card">
          <h3>{snags.length}</h3>
          <p>Total Snags</p>
        </div>
        <div className="stat-card">
          <h3>{unassignedSnags.length}</h3>
          <p>Unassigned</p>
        </div>
        <div className="stat-card">
          <h3>{users.length}</h3>
          <p>Team Members</p>
        </div>
      </div>

      {/* Assignment Form */}
      <div className="assignment-form">
        <h2>🎯 Create New Assignment</h2>
        
        <div className="form-section">
          <label>Select a Snag</label>
          <select
            value={selectedSnag?.id || ""}
            onChange={(e) => {
              const snag = snags.find(s => s.id === e.target.value);
              setSelectedSnag(snag);
            }}
            disabled={unassignedSnags.length === 0}
          >
            <option value="">-- Choose a snag --</option>
            {unassignedSnags.map((snag) => (
              <option key={snag.id} value={snag.id}>
                {snag.feedback_type} - {snag.feedback?.substring(0, 50)}...
              </option>
            ))}
          </select>

          {selectedSnag && (
            <div className="snag-preview">
              <p><strong>Type:</strong> {selectedSnag.feedback_type}</p>
              <p><strong>Feedback:</strong> {selectedSnag.feedback}</p>
              {selectedSnag.transcription && (
                <p><strong>Transcription:</strong> {selectedSnag.transcription}</p>
              )}
            </div>
          )}
        </div>

        <div className="form-section">
          <label>Select Team Member</label>
          <select
            value={selectedUser?.user_id || ""}
            onChange={(e) => {
              const user = users.find(u => u.user_id === e.target.value);
              setSelectedUser(user);
            }}
            disabled={users.length === 0}
          >
            <option value="">-- Choose a user --</option>
            {users.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.username} ({u.role})
              </option>
            ))}
          </select>

          {selectedUser && (
            <div className="user-preview">
              <p><strong>Username:</strong> {selectedUser.username}</p>
              <p><strong>Email:</strong> {selectedUser.email}</p>
              <p><strong>Role:</strong> {selectedUser.role}</p>
            </div>
          )}
        </div>

        <button
          className="primary-btn"
          onClick={handleAssignSnag}
          disabled={!selectedSnag || !selectedUser || assigning}
        >
          {assigning ? "⏳ Assigning..." : "➕ Assign Snag"}
        </button>
      </div>

      {/* All Snags with Assignments */}
      <div className="snags-list">
        <h2>📌 All Snags Status</h2>

        {loading && <div className="loading-state">Loading snags...</div>}

        {!loading && snags.length === 0 && (
          <div className="empty-state">
            <p>No unresolved snags in this site</p>
          </div>
        )}

        {!loading &&
          snags.map((snag) => {
            const assignedUsers = getAssignedUsers(snag.id);
            return (
              <div key={snag.id} className={`snag-card ${assignedUsers.length > 0 ? "assigned" : "unassigned"}`}>
                <div className="snag-header">
                  <h3>{snag.feedback_type}</h3>
                  {assignedUsers.length > 0 && (
                    <span className="assigned-badge">✅ Assigned</span>
                  )}
                  {assignedUsers.length === 0 && (
                    <span className="unassigned-badge">⏳ Unassigned</span>
                  )}
                </div>

                <div className="snag-content">
                  <p><strong>Feedback:</strong> {snag.feedback}</p>
                  {snag.transcription && (
                    <p><strong>Transcription:</strong> {snag.transcription}</p>
                  )}
                  {snag.image_url && (
                    <S3Image
                      src={snag.image_url}
                      apiCall={apiCall}
                      apiBase={API_BASE}
                      alt="Snag Image"
                      className="snag-image"
                    />
                  )}
                </div>

                {assignedUsers.length > 0 && (
                  <div className="assigned-users">
                    <p><strong>Assigned to:</strong></p>
                    <ul>
                      {assignedUsers.map((username, idx) => (
                        <li key={idx}>👤 {username}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="snag-date">
                  Created: {new Date(snag.created_at).toLocaleDateString()}
                </p>
              </div>
            );
          })}
      </div>
    </div>
  );
}
