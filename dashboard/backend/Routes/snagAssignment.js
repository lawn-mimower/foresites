const express = require('express');
const Router = express.Router();
const supabase = require('../config/supabaseClient');
const { authenticateToken, requireAdmin } = require('./auth');

// ✅ Get all snag assignments
Router.get('/assignments', authenticateToken, async (req, res) => {
  try {
    const { data: assignments, error } = await supabase
      .from('snag_assignment')
      .select('*')
      .order('assigned_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching assignments:', error);
      return res.status(500).json({ error: 'Failed to fetch assignments' });
    }

    res.json(assignments);
  } catch (err) {
    console.error('❌ Error fetching assignments:', err);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// ✅ Get assignments for current user
Router.get('/assignments/user', authenticateToken, async (req, res) => {
  try {
    const { data: assignments, error } = await supabase
      .from('snag_assignment')
      .select('*')
      .eq('assigned_user_id', req.user.user_id)
      .order('assigned_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching user assignments:', error);
      return res.status(500).json({ error: 'Failed to fetch assignments' });
    }

    res.json(assignments);
  } catch (err) {
    console.error('❌ Error fetching user assignments:', err);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// ✅ Create new assignment
Router.post('/assignments', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { snag_id, site_id, assigned_user_id } = req.body;

    if (!snag_id || !site_id || !assigned_user_id) {
      return res.status(400).json({ error: 'Missing required fields: snag_id, site_id, assigned_user_id' });
    }

    // Generate assignment_id
    const assignment_id = `assign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const { data: assignment, error } = await supabase
      .from('snag_assignment')
      .insert([
        {
          assignment_id,
          snag_id,
          site_id,
          assigned_user_id,
          status: 'open'
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating assignment:', error);
      return res.status(400).json({ error: 'Failed to create assignment' });
    }

    res.status(201).json({
      message: '✅ Assignment created successfully',
      assignment
    });
  } catch (err) {
    console.error('❌ Error creating assignment:', err);
    res.status(500).json({ error: 'Failed to create assignment' });
  }
});

// ✅ Update assignment status
Router.put('/assignments/:assignmentId', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { status, notes } = req.body;

    const updateData = { status };
    if (notes) updateData.notes = notes;
    
    if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    }

    const { data: updated, error } = await supabase
      .from('snag_assignment')
      .update(updateData)
      .eq('assignment_id', assignmentId)
      .select()
      .single();

    if (!updated || error) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json({
      message: '✅ Assignment updated',
      assignment: updated
    });
  } catch (err) {
    console.error('❌ Error updating assignment:', err);
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

// ✅ Upload proof for assignment
Router.put('/assignments/:assignmentId/proof', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { proof } = req.body;

    if (!proof) {
      return res.status(400).json({ error: 'Proof file path/URL is required' });
    }

    const { data: updated, error } = await supabase
      .from('snag_assignment')
      .update({
        proof,
        status: 'resolved',
        resolved_at: new Date().toISOString()
      })
      .eq('assignment_id', assignmentId)
      .select()
      .single();

    if (!updated || error) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json({
      message: '✅ Proof uploaded and assignment resolved',
      assignment: updated
    });
  } catch (err) {
    console.error('❌ Error uploading proof:', err);
    res.status(500).json({ error: 'Failed to upload proof' });
  }
});

// ✅ Get assignment proof
Router.get('/assignments/:assignmentId/proof', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const { data: assignment, error } = await supabase
      .from('snag_assignment')
      .select('assignment_id, proof, resolved_at')
      .eq('assignment_id', assignmentId)
      .single();

    if (!assignment || error) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json({
      assignment_id: assignment.assignment_id,
      proof: assignment.proof,
      resolved_at: assignment.resolved_at
    });
  } catch (err) {
    console.error('❌ Error fetching proof:', err);
    res.status(500).json({ error: 'Failed to fetch proof' });
  }
});

// ✅ Delete assignment
Router.delete('/assignments/:assignmentId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const { error } = await supabase
      .from('snag_assignment')
      .delete()
      .eq('assignment_id', assignmentId);

    if (error) {
      console.error('❌ Error deleting assignment:', error);
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json({ message: '✅ Assignment deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting assignment:', err);
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

module.exports = Router;
