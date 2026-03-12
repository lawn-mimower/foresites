const express = require('express');
const Router = express.Router();
const supabase = require('../config/supabaseClient');
const { authenticateToken } = require('./auth');

// ✅ Get all todos for current user
Router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data: todos, error } = await supabase
      .from('todo')
      .select('*')
      .eq('user_id', req.user.user_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching todos:', error);
      return res.status(500).json({ error: 'Failed to fetch todos' });
    }

    res.json(todos);
  } catch (err) {
    console.error('❌ Error fetching todos:', err);
    res.status(500).json({ error: 'Failed to fetch todos' });
  }
});

// ✅ Get todos by status
Router.get('/status/:status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.params;

    const { data: todos, error } = await supabase
      .from('todo')
      .select('*')
      .eq('user_id', req.user.user_id)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching todos:', error);
      return res.status(500).json({ error: 'Failed to fetch todos' });
    }

    res.json(todos);
  } catch (err) {
    console.error('❌ Error fetching todos:', err);
    res.status(500).json({ error: 'Failed to fetch todos' });
  }
});

// ✅ Create new todo
Router.post('/', authenticateToken, async (req, res) => {
  try {
    const { action_item, notes = '', expected_closing_date = null, status = 'pending' } = req.body;

    if (!action_item) {
      return res.status(400).json({ error: 'action_item is required' });
    }

    const { data: todo, error } = await supabase
      .from('todo')
      .insert([
        {
          user_id: req.user.user_id,
          action_item,
          notes,
          expected_closing_date,
          status,
          open_date: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating todo:', error);
      return res.status(400).json({ error: 'Failed to create todo' });
    }

    res.status(201).json({
      message: '✅ Todo created successfully',
      todo
    });
  } catch (err) {
    console.error('❌ Error creating todo:', err);
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

// ✅ Update todo
Router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { action_item, status, notes, expected_closing_date } = req.body;

    const updateData = {};
    if (action_item) updateData.action_item = action_item;
    if (notes !== undefined) updateData.notes = notes;
    if (expected_closing_date !== undefined) updateData.expected_closing_date = expected_closing_date;
    if (status) {
      updateData.status = status;
      if (status === 'completed') {
        updateData.closed_date = new Date().toISOString();
      }
    }

    const { data: updated, error } = await supabase
      .from('todo')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', req.user.user_id)
      .select()
      .single();

    if (!updated || error) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    res.json({
      todo: updated
    });
  } catch (err) {
    console.error('❌ Error updating todo:', err);
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

// ✅ Mark todo as completed
Router.put('/todos/:todoId/complete', authenticateToken, async (req, res) => {
  try {
    const { todoId } = req.params;

    const { data: updated, error } = await supabase
      .from('todo')
      .update({
        status: 'completed',
        closed_date: new Date().toISOString()
      })
      .eq('id', todoId)
      .eq('user_id', req.user.user_id)
      .select()
      .single();

    if (!updated || error) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    res.json({
      message: '✅ Todo completed',
      todo: updated
    });
  } catch (err) {
    console.error('❌ Error completing todo:', err);
    res.status(500).json({ error: 'Failed to complete todo' });
  }
});

// ✅ Delete todo
Router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('todo')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.user_id);

    if (error) {
      console.error('❌ Error deleting todo:', error);
      return res.status(404).json({ error: 'Todo not found' });
    }

    res.json({ message: '✅ Todo deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting todo:', err);
    res.status(500).json({ error: 'Failed to delete todo' });
  }
});

module.exports = Router;
