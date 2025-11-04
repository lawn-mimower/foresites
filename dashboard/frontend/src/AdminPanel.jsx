import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { showToast } from "./Toast";
import "./css/admin.css";

export function AdminPanel() {
  const { user, token, isSuperAdmin, apiCall } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [showLoginHistory, setShowLoginHistory] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "user",
    profile: {
      firstName: "",
      lastName: "",
      phone: "",
      department: ""
    }
  });

  useEffect(() => {
    if (isSuperAdmin()) {
      fetchUsers();
    }
  }, [isSuperAdmin]);

  const fetchUsers = async () => {
    try {
      const response = await apiCall('http://localhost:9999/api/auth/users');
      
      if (response && !response.error) {
        const data = await response.json();
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

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiCall('http://localhost:9999/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      if (response && !response.error) {
        const data = await response.json();
        showToast('User created successfully', 'success');
        setShowUserForm(false);
        setFormData({
          username: "",
          email: "",
          password: "",
          role: "user",
          profile: {
            firstName: "",
            lastName: "",
            phone: "",
            department: ""
          }
        });
        fetchUsers();
      } else {
        showToast('Failed to create user', 'error');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      showToast('Network error', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      const response = await apiCall(`http://localhost:9999/api/auth/users/${userId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (response && !response.error) {
        showToast(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`, 'success');
        fetchUsers();
      } else {
        showToast('Failed to update user status', 'error');
      }
    } catch (error) {
      console.error('Error updating user status:', error);
      showToast('Network error', 'error');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await apiCall(`http://localhost:9999/api/auth/users/${userId}`, {
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

  const fetchLoginHistory = async (userId) => {
    try {
      const response = await apiCall(`http://localhost:9999/api/auth/users/${userId}/login-history`);

      if (response && !response.error) {
        const data = await response.json();
        setSelectedUser(data);
        setShowLoginHistory(true);
      } else {
        showToast('Failed to fetch login history', 'error');
      }
    } catch (error) {
      console.error('Error fetching login history:', error);
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
        <button 
          className="create-user-btn"
          onClick={() => setShowUserForm(true)}
        >
          ➕ Create New User
        </button>
      </div>

      <div className="admin-stats">
        <div className="stat-card">
          <h3>{users.length}</h3>
          <p>Total Users</p>
        </div>
        <div className="stat-card">
          <h3>{users.filter(u => u.isActive).length}</h3>
          <p>Active Users</p>
        </div>
        <div className="stat-card">
          <h3>{users.filter(u => u.role === 'admin' || u.role === 'super_admin').length}</h3>
          <p>Admins</p>
        </div>
        <div className="stat-card">
          <h3>{users.filter(u => u.lastLogin).length}</h3>
          <p>Users with Login History</p>
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
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id}>
                    <td>
                      <div className="user-info">
                        <div className="user-avatar">
                          {user.profile?.firstName ? user.profile.firstName[0] : user.username[0]}
                        </div>
                        <div>
                          <strong>{user.username}</strong>
                          {user.profile?.firstName && (
                            <p>{user.profile.firstName} {user.profile.lastName}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`role-badge ${user.role}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="history-btn"
                          onClick={() => fetchLoginHistory(user._id)}
                          title="View Login History"
                        >
                          History
                        </button>
                        <button 
                          className={`toggle-btn ${user.isActive ? 'deactivate' : 'activate'}`}
                          onClick={() => handleToggleUserStatus(user._id, user.isActive)}
                          title={user.isActive ? 'Deactivate User' : 'Activate User'}
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        {user.role !== 'super_admin' && (
                          <button 
                            className="delete-btn"
                            onClick={() => handleDeleteUser(user._id)}
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
              <h2>Create New User</h2>
              <button 
                className="close-btn"
                onClick={() => setShowUserForm(false)}
              >
                ✕
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
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    value={formData.profile.firstName}
                    onChange={(e) => setFormData({
                      ...formData, 
                      profile: {...formData.profile, firstName: e.target.value}
                    })}
                  />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    value={formData.profile.lastName}
                    onChange={(e) => setFormData({
                      ...formData, 
                      profile: {...formData.profile, lastName: e.target.value}
                    })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={formData.profile.phone}
                    onChange={(e) => setFormData({
                      ...formData, 
                      profile: {...formData.profile, phone: e.target.value}
                    })}
                  />
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <input
                    type="text"
                    value={formData.profile.department}
                    onChange={(e) => setFormData({
                      ...formData, 
                      profile: {...formData.profile, department: e.target.value}
                    })}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowUserForm(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={loading}>
                  {loading ? 'Creating...' : 'Create User'}
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
                ✕
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
    </div>
  );
}
