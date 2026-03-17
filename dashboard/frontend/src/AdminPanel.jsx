import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { showToast } from "./Toast";
import { API_BASE } from "./config/api";
import ImpactMappingPanel from "./components/ImpactMappingPanel";
import "./css/admin.css";

export function AdminPanel() {
  const { isSuperAdmin, apiCall } = useAuth();
  const [adminTab, setAdminTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser] = useState(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [showLoginHistory, setShowLoginHistory] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "Jr. engineer",
    department: "",
    designation: "",
    site_id: "",
    phone_number: ""
  });

  const roleOptions = [
    { value: "Super admin", label: "Super admin" },
    { value: "Sr. engineer", label: "Sr. engineer" },
    { value: "Jr. engineer", label: "Jr. engineer" },
    { value: "Trainee", label: "Trainee" },
    { value: "Safety", label: "Safety" },
    { value: "Site dw", label: "Site dw" },
    { value: "Podium", label: "Podium" },
    { value: "Store", label: "Store" },
    { value: "Sr. foreman", label: "Sr. foreman" },
    { value: "UWT & STP", label: "UWT & STP" }
  ];

  useEffect(() => {
    if (isSuperAdmin()) {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  const fetchUsers = async () => {
    try {
      const data = await apiCall(`${API_BASE}/auth/users`);

      if (data && !data.error) {
        setUsers(data.users);
      } else {
        showToast('Failed to fetch users', 'error');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      showToast('Network error', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchBuildings = async () => {
    try {
      const data = await apiCall(`${API_BASE}/sites`);
      
      if (data && !Array.isArray(data)) {
        showToast('Failed to fetch buildings', 'error');
      } else if (Array.isArray(data)) {
        setBuildings(data);
      }
    } catch (error) {
      console.error('Error fetching buildings:', error);
      showToast('Failed to load buildings', 'error');
    }
  };

  const handleOpenUserForm = () => {
    setFormData({
      username: "",
      email: "",
      password: "",
      role: "Jr. engineer",
      department: "",
      designation: "",
      site_id: "",
      phone_number: ""
    });
    fetchBuildings();
    setEditingUserId(null);
    setShowPassword(false);
    setShowUserForm(true);
  };

  const handleEditUser = (user) => {
    setFormData({
      username: user.username,
      email: user.email,
      password: "",
      role: user.role,
      department: user.department || "",
      designation: user.designation || "",
      site_id: user.site_id || "",
      phone_number: user.phone_number || ""
    });
    setEditingUserId(user.user_id);
    fetchBuildings();
    setShowUserForm(true);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingUserId) {
        // Edit user
        const updateData = {
          role: formData.role,
          department: formData.department,
          designation: formData.designation,
          site_id: formData.site_id && formData.site_id.trim() ? formData.site_id : null,
          phone_number: formData.phone_number
        };
        if (formData.password && formData.password.length >= 6) {
          updateData.password = formData.password;
        }

        const data = await apiCall(`${API_BASE}/auth/users/${editingUserId}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });

        if (data && !data.error) {
          showToast('User updated successfully', 'success');
          setShowUserForm(false);
          setShowPassword(false);
          setEditingUserId(null);
          setFormData({
            username: "",
            email: "",
            password: "",
            role: "Jr. engineer",
            department: "",
            designation: "",
            site_id: "",
            phone_number: ""
          });
          fetchUsers();
        } else {
          showToast(data?.error || 'Failed to update user', 'error');
        }
      } else {
        // Create new user
        const data = await apiCall(`${API_BASE}/auth/register`, {
          method: 'POST',
          body: JSON.stringify(formData),
        });

        if (data && !data.error) {
          showToast('User created successfully', 'success');
          setShowUserForm(false);
          setShowPassword(false);
          setFormData({
            username: "",
            email: "",
            password: "",
            role: "Jr. engineer",
            department: "",
            designation: "",
            site_id: "",
            phone_number: ""
          });
          fetchUsers();
        } else {
          showToast(data?.error || 'Failed to create user', 'error');
        }
      }
    } catch (error) {
      console.error('Error saving user:', error);
      showToast('Network error', 'error');
    } finally {
      setLoading(false);
    }
  };


  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await apiCall(`${API_BASE}/auth/users/${userId}`, {
        method: 'DELETE',
      });

      if (response && !response.error) {
        showToast('User deleted successfully', 'success');
        fetchUsers();
      } else {
        showToast('Failed to delete user', 'error');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      showToast('Network error', 'error');
    }
  };

  if (!isSuperAdmin()) {
    return (
      <div className="admin-panel">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>You need super admin privileges to access this panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>Admin Panel</h1>
        <p>Manage users and monitor system activity</p>
      </div>

      {/* Tab Bar */}
      <div className="admin-tabs">
        <button
          className={`admin-tab${adminTab === 'users' ? ' active' : ''}`}
          onClick={() => setAdminTab('users')}
        >
          User Management
        </button>
        <button
          className={`admin-tab${adminTab === 'impact' ? ' active' : ''}`}
          onClick={() => setAdminTab('impact')}
        >
          Impact Mapping
        </button>
      </div>

      {adminTab === 'impact' && <ImpactMappingPanel />}

      {adminTab === 'users' && <>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <button
          className="create-user-btn"
          onClick={() => handleOpenUserForm()}
        >
          Create New User
        </button>
      </div>

      <div className="admin-stats">
        <div className="stat-card">
          <h3>{users.length}</h3>
          <p>Total Users</p>
        </div>
        <div className="stat-card">
          <h3>{users.filter(u => u.role === 'Super admin' || u.role === 'Sr. engineer' || u.role === 'super_admin' || u.role === 'admin').length}</h3>
          <p>Admin Level Users</p>
        </div>
        <div className="stat-card">
          <h3>{users.filter(u => u.role !== 'Super admin' && u.role !== 'Sr. engineer' && u.role !== 'super_admin' && u.role !== 'admin').length}</h3>
          <p>Regular Users</p>
        </div>
        <div className="stat-card">
          <h3>{users.filter(u => u.department).length}</h3>
          <p>Users with Building Assigned</p>
        </div>
      </div>

      <div className="users-table">
        <h2>User Management</h2>
        {loading ? (
          <div className="loading">Loading users...</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Building</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.user_id}>
                    <td>
                      <div className="user-info">
                        <div className="user-avatar">
                          {user.username[0].toUpperCase()}
                        </div>
                        <div>
                          <strong>{user.username}</strong>
                        </div>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>{user.phone_number || '—'}</td>
                    <td>{user.department || '—'}</td>
                    <td>
                      <span className={`role-badge ${user.role}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td>
                      <div className="action-buttons">
                        {user.role !== 'super_admin' && user.role !== 'Super admin' && (
                          <button 
                            className="edit-btn"
                            onClick={() => handleEditUser(user)}
                            title="Edit User"
                          >
                            Edit
                          </button>
                        )}
                        {user.role !== 'super_admin' && user.role !== 'Super admin' && (
                          <button 
                            className="delete-btn"
                            onClick={() => handleDeleteUser(user.user_id)}
                            title="Delete User"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showUserForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{editingUserId ? 'Edit User' : 'Create New User'}</h2>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowUserForm(false);
                  setShowPassword(false);
                  setEditingUserId(null);
                }}
              >
                X
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="user-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    disabled={editingUserId ? true : false}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    disabled={editingUserId ? true : false}
                    required
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Password {editingUserId && '(Leave blank to keep current password)'}</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      required={!editingUserId}
                      style={{ width: '100%', paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '12px',
                        padding: '0 5px',
                        color: '#666',
                      }}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                  >
                    {roleOptions.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Phone Number (with country code, e.g. 918007953471)</label>
                  <input
                    type="text"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                    placeholder="e.g., 918007953471"
                  />
                </div>
                <div className="form-group">
                  <label>Designation</label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({...formData, designation: e.target.value})}
                    placeholder="e.g., Manager, Coordinator"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Building</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                  >
                    <option value="">-- Select Building --</option>
                    <option value="all">All</option>
                    {buildings.map((building) => (
                      <option key={building.id} value={building.site_name}>
                        {building.site_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => {
                  setShowUserForm(false);
                  setShowPassword(false);
                  setEditingUserId(null);
                  setFormData({
                    username: "",
                    email: "",
                    password: "",
                    role: "Jr. engineer",
                    department: "",
                    designation: "",
                    site_id: ""
                  });
                }}>
                  Cancel
                </button>
                <button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : editingUserId ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Login History Modal */}
      {showLoginHistory && selectedUser && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Login History - {selectedUser.user.username}</h2>
              <button
                className="close-btn"
                onClick={() => setShowLoginHistory(false)}
              >
                X
              </button>
            </div>
            <div className="login-history">
              <div className="user-summary">
                <p><strong>Email:</strong> {selectedUser.user.email}</p>
                <p><strong>Total Logins:</strong> {selectedUser.loginHistory.length}</p>
              </div>
              <div className="history-list">
                {selectedUser.loginHistory.map((login, index) => (
                  <div key={index} className="history-item">
                    <div className="login-time">
                      {new Date(login.loginTime).toLocaleString()}
                    </div>
                    <div className="login-details">
                      <p><strong>IP:</strong> {login.ipAddress || 'Unknown'}</p>
                      <p><strong>Device:</strong> {login.userAgent || 'Unknown'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      </>}
    </div>
  );
}
