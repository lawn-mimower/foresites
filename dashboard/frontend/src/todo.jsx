import { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import './css/todo.css';

export function Todo() {
  const { apiCall, user } = useAuth();
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    action_item: '',
    notes: '',
    expected_closing_date: ''
  });

  // Fetch todos on component mount
  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiCall('/api/todos');
      setTodos(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to fetch todos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const addTodo = async (e) => {
    e.preventDefault();
    if (!formData.action_item.trim()) return;

    try {
      const response = await apiCall('/api/todos', {
        method: 'POST',
        body: JSON.stringify({
          action_item: formData.action_item,
          notes: formData.notes,
          expected_closing_date: formData.expected_closing_date || null,
          status: 'pending'
        })
      });
      
      if (response.todo) {
        setTodos([response.todo, ...todos]);
        setFormData({ action_item: '', notes: '', expected_closing_date: '' });
        setShowForm(false);
      }
    } catch (err) {
      setError('Failed to create todo');
      console.error(err);
    }
  };

  const toggleTodo = async (todo) => {
    try {
      const newStatus = todo.status === 'pending' ? 'completed' : 'pending';
      const response = await apiCall(`/api/todos/${todo.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          action_item: todo.action_item,
          notes: todo.notes,
          status: newStatus,
          expected_closing_date: todo.expected_closing_date
        })
      });

      if (response.todo) {
        setTodos(todos.map(t => t.id === todo.id ? response.todo : t));
      }
    } catch (err) {
      setError('Failed to update todo');
      console.error(err);
    }
  };

  const updateTodo = async (id, formData) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    try {
      const response = await apiCall(`/api/todos/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          action_item: formData.action_item || todo.action_item,
          notes: formData.notes || todo.notes || '',
          status: todo.status,
          expected_closing_date: formData.expected_closing_date || todo.expected_closing_date
        })
      });

      if (response.todo) {
        setTodos(todos.map(t => t.id === id ? response.todo : t));
      }
    } catch (err) {
      setError('Failed to update todo');
      console.error(err);
    }
  };

  const deleteTodo = async (id) => {
    if (!window.confirm('Are you sure you want to delete this todo?')) return;

    try {
      await apiCall(`/api/todos/${id}`, {
        method: 'DELETE'
      });
      setTodos(todos.filter(t => t.id !== id));
    } catch (err) {
      setError('Failed to delete todo');
      console.error(err);
    }
  };

  // Filter todos based on current filter
  const filteredTodos = todos.filter(todo => {
    if (filter === 'pending') return todo.status === 'pending';
    if (filter === 'completed') return todo.status === 'completed';
    return true;
  });

  const stats = {
    total: todos.length,
    pending: todos.filter(t => t.status === 'pending').length,
    completed: todos.filter(t => t.status === 'completed').length
  };

  return (
    <div className="todo-container">
      <div className="todo-header">
        <h1>📋 My Action Items</h1>
        <p className="user-name">for {user?.username || 'User'}</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Stats */}
      <div className="todo-stats">
        <div className="stat-card">
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Total Items</div>
        </div>
        <div className="stat-card pending">
          <div className="stat-number">{stats.pending}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card completed">
          <div className="stat-number">{stats.completed}</div>
          <div className="stat-label">Completed</div>
        </div>
      </div>

      {/* Add New Todo */}
      <div className="add-todo-section">
        {!showForm ? (
          <button onClick={() => setShowForm(true)} className="btn-new-todo">
            + New Action Item
          </button>
        ) : (
          <form onSubmit={addTodo} className="todo-form-expanded">
            <div className="form-group">
              <label>Action Item *</label>
              <input
                type="text"
                name="action_item"
                value={formData.action_item}
                onChange={handleFormChange}
                placeholder="Enter action item..."
                className="form-input"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Notes / Description</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleFormChange}
                placeholder="Add any notes or description..."
                className="form-textarea"
                rows="3"
              />
            </div>
            <div className="form-group">
              <label>Expected Closing Date</label>
              <input
                type="date"
                name="expected_closing_date"
                value={formData.expected_closing_date}
                onChange={handleFormChange}
                className="form-input"
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-submit">Create Item</button>
              <button type="button" onClick={() => {
                setShowForm(false);
                setFormData({ action_item: '', notes: '', expected_closing_date: '' });
              }} className="btn-cancel-form">Cancel</button>
            </div>
          </form>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        <button
          className={`tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({stats.total})
        </button>
        <button
          className={`tab ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Pending ({stats.pending})
        </button>
        <button
          className={`tab ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          Completed ({stats.completed})
        </button>
      </div>

      {/* Todo List */}
      <div className="todo-list">
        {loading ? (
          <div className="loading">Loading todos...</div>
        ) : filteredTodos.length === 0 ? (
          <div className="empty-state">
            <p>No {filter !== 'all' ? filter : ''} action items yet.</p>
            <p className="empty-hint">Create one to get started! 🚀</p>
          </div>
        ) : (
          filteredTodos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={toggleTodo}
              onUpdate={updateTodo}
              onDelete={deleteTodo}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TodoItem({ todo, onToggle, onUpdate, onDelete }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    action_item: todo.action_item,
    notes: todo.notes || '',
    expected_closing_date: todo.expected_closing_date || ''
  });

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = () => {
    if (editForm.action_item.trim()) {
      onUpdate(todo.id, editForm);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditForm({
      action_item: todo.action_item,
      notes: todo.notes || '',
      expected_closing_date: todo.expected_closing_date || ''
    });
    setIsEditing(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const isOverdue = () => {
    if (!todo.expected_closing_date || todo.status === 'completed') return false;
    return new Date(todo.expected_closing_date) < new Date();
  };

  return (
    <div className={`todo-item ${todo.status === 'completed' ? 'completed' : ''} ${isOverdue() ? 'overdue' : ''}`}>
      <div className="todo-item-header">
        <div className="todo-item-checkbox-section">
          <input
            type="checkbox"
            checked={todo.status === 'completed'}
            onChange={() => onToggle(todo)}
            className="todo-checkbox"
          />
        </div>

        <div className="todo-item-main">
          {isEditing ? (
            <div className="todo-edit-form">
              <input
                type="text"
                name="action_item"
                value={editForm.action_item}
                onChange={handleEditChange}
                className="edit-input-main"
                autoFocus
              />
              <textarea
                name="notes"
                value={editForm.notes}
                onChange={handleEditChange}
                placeholder="Notes..."
                className="edit-input-notes"
                rows="2"
              />
              <input
                type="date"
                name="expected_closing_date"
                value={editForm.expected_closing_date}
                onChange={handleEditChange}
                className="edit-input-date"
              />
              <div className="edit-form-actions">
                <button onClick={handleSave} className="btn-save-edit">Save</button>
                <button onClick={handleCancel} className="btn-cancel-edit">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="todo-title-section">
                <span className={`status-indicator ${todo.status}`}></span>
                <div className="todo-title-content" onClick={() => setIsExpanded(!isExpanded)}>
                  <h3 className="todo-title">{todo.action_item}</h3>
                  {todo.notes && <p className="todo-preview">{todo.notes.substring(0, 100)}...</p>}
                </div>
              </div>

              <div className="todo-dates-row">
                <div className="date-badge">
                  <span className="date-label">📅 Open:</span>
                  <span className="date-value">{formatDate(todo.open_date)}</span>
                </div>
                {todo.expected_closing_date && (
                  <div className="date-badge" style={{borderColor: isOverdue() ? '#ff6b6b' : undefined}}>
                    <span className="date-label">🎯 Expected:</span>
                    <span className="date-value">{formatDate(todo.expected_closing_date)}</span>
                    {isOverdue() && <span className="overdue-tag">Overdue</span>}
                  </div>
                )}
                {todo.status === 'completed' && todo.closed_date && (
                  <div className="date-badge completed">
                    <span className="date-label">✓ Closed:</span>
                    <span className="date-value">{formatDate(todo.closed_date)}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {!isEditing && (
          <div className="todo-item-actions">
            <button
              onClick={() => setIsEditing(true)}
              className="btn-action btn-edit"
              title="Edit"
            >
              ✏️
            </button>
            <button
              onClick={() => onDelete(todo.id)}
              className="btn-action btn-delete"
              title="Delete"
            >
              🗑️
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="btn-action btn-expand"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          </div>
        )}
      </div>

      {isExpanded && !isEditing && (
        <div className="todo-item-details">
          {todo.notes && (
            <div className="detail-section">
              <h4>Notes</h4>
              <p>{todo.notes}</p>
            </div>
          )}
          <div className="detail-section">
            <h4>Timeline</h4>
            <ul className="timeline">
              <li><strong>Opened:</strong> {formatDate(todo.open_date)}</li>
              {todo.expected_closing_date && <li><strong>Expected Close:</strong> {formatDate(todo.expected_closing_date)}</li>}
              {todo.status === 'completed' && todo.closed_date && <li><strong>Closed:</strong> {formatDate(todo.closed_date)}</li>}
              {todo.status === 'pending' && todo.expected_closing_date && (
                <li><strong>Days Remaining:</strong> {Math.ceil((new Date(todo.expected_closing_date) - new Date()) / (1000 * 60 * 60 * 24))} days</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
