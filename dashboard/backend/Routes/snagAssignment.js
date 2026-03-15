const express = require('express');
const Router = express.Router();
const { randomUUID } = require('crypto');
const supabase = require('../config/supabaseClient');
const { authenticateToken, requireAdmin } = require('./auth');

// ✅ Get all snag assignments (joins username from website_user)
Router.get('/assignments', authenticateToken, async (req, res) => {
  try {
    const { data: assignments, error } = await supabase
      .from('snag_assignment')
      .select('*, assigned_user:website_user!assigned_user_id(username, role)')
      .order('assigned_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching assignments:', error);
      return res.status(500).json({ error: 'Failed to fetch assignments' });
    }

    // Flatten the joined user data
    const flat = (assignments || []).map(a => ({
      ...a,
      username: a.assigned_user?.username || 'Unknown',
      assigned_role: a.assigned_user?.role || '',
      assigned_user: undefined,
    }));

    res.json(flat);
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
    const { snag_id, site_id, assigned_user_id, assigner_remarks, due_date } = req.body;

    if (!snag_id || !site_id || !assigned_user_id) {
      return res.status(400).json({ error: 'Missing required fields: snag_id, site_id, assigned_user_id' });
    }

    // Generate assignment_id as UUID
    const assignment_id = randomUUID();

    const assignmentData = {
      assignment_id,
      snag_id,
      site_id,
      assigned_user_id,
      status: 'open'
    };

    // Add assigner_remarks if provided
    if (assigner_remarks && assigner_remarks.trim()) {
      assignmentData.assigner_remarks = assigner_remarks;
    }

    // Add due_date if provided
    if (due_date) {
      assignmentData.due_date = due_date;
    }

    const { data: assignment, error } = await supabase
      .from('snag_assignment')
      .insert([assignmentData])
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
    const { status, notes, solution } = req.body;

    // First, get the assignment to find the snag_id
    const { data: assignment, error: fetchError } = await supabase
      .from('snag_assignment')
      .select('snag_id')
      .eq('assignment_id', assignmentId)
      .single();

    if (fetchError || !assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const { rejection_remarks } = req.body;

    const updateData = { status };
    if (notes) updateData.notes = notes;
    if (solution) updateData.solution = solution;

    if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    }

    // Handle rejection flow: save remarks and increment rejection_count
    if (rejection_remarks) {
      updateData.rejection_remarks = rejection_remarks;
      // Fetch current rejection_count so we can increment
      const { data: current } = await supabase
        .from('snag_assignment')
        .select('rejection_count')
        .eq('assignment_id', assignmentId)
        .single();
      updateData.rejection_count = ((current?.rejection_count) || 0) + 1;
    }

    // Update the assignment
    const { data: updated, error } = await supabase
      .from('snag_assignment')
      .update(updateData)
      .eq('assignment_id', assignmentId)
      .select()
      .single();

    if (!updated || error) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Also update the main snag table status (snag only has pending/resolved)
    const snagStatus = status === 'resolved' ? 'resolved' : 'pending';
    const snagUpdateData = { status: snagStatus };

    const { error: snagError } = await supabase
      .from('snag')
      .update(snagUpdateData)
      .eq('id', assignment.snag_id);

    if (snagError) {
      console.warn('⚠️ Warning: Snag update failed', snagError);
      // Don't fail the request, just warn
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

// ✅ Get user's assigned jobs with snag and site details
Router.get('/user/assigned-jobs', authenticateToken, async (req, res) => {
  try {
    const { data: assignments, error } = await supabase
      .from('snag_assignment')
      .select(`
        assignment_id,
        snag_id,
        site_id,
        assigned_user_id,
        assigned_at,
        resolved_at,
        proof,
        assigner_remarks,
        due_date,
        solution,
        status,
        snag(id, feedback_type, feedback, transcription, image_url, status, category),
        site(id, site_name, site_manager)
      `)
      .eq('assigned_user_id', req.user.user_id)
      .order('assigned_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching assigned jobs:', error);
      return res.status(500).json({ error: 'Failed to fetch assigned jobs' });
    }

    res.json(assignments);
  } catch (err) {
    console.error('❌ Error fetching assigned jobs:', err);
    res.status(500).json({ error: 'Failed to fetch assigned jobs' });
  }
});

// ✅ Get unresolved snags for a specific site (for Sr. Engineer assignment)
Router.get('/site/:siteId/unresolved-snags', authenticateToken, async (req, res) => {
  try {
    const { siteId } = req.params;
    
    console.log(`📌 Fetching unresolved snags for site: ${siteId}`);
    
    const { data: snags, error } = await supabase
      .from('snag')
      .select('*')
      .eq('site_id', siteId)
      .neq('status', 'resolved')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching snags:', error);
      return res.status(500).json({ error: 'Failed to fetch snags', details: error.message });
    }

    console.log(`✅ Found ${snags?.length || 0} unresolved snags for site ${siteId}`);
    
    res.json(snags || []);
  } catch (err) {
    console.error('❌ Error fetching snags:', err);
    res.status(500).json({ error: 'Failed to fetch snags', details: err.message });
  }
});

// ✅ Get users for a specific site (for Sr. Engineer assignment)
Router.get('/site/:siteId/users', authenticateToken, async (req, res) => {
  try {
    const { siteId } = req.params;
    
    console.log(`📌 Fetching users for site: ${siteId}`);
    
    const { data: users, error } = await supabase
      .from('website_user')
      .select('*')
      .eq('site_id', siteId);

    if (error) {
      console.error('❌ Error fetching users:', error);
      return res.status(500).json({ error: 'Failed to fetch users', details: error.message });
    }

    // Filter out super admins
    const filteredUsers = users.filter(u => 
      u.role !== 'Super admin' && u.role !== 'super_admin'
    );

    console.log(`✅ Found ${filteredUsers.length} users for site ${siteId}`);
    
    res.json(filteredUsers);
  } catch (err) {
    console.error('❌ Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
});

// ✅ Get all assignable users (fallback when no site_id on user)
Router.get('/users/all', authenticateToken, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('website_user')
      .select('user_id, username, role, site_id');

    if (error) {
      console.error('❌ Error fetching all users:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    const filteredUsers = (users || []).filter(u =>
      u.role !== 'Super admin' && u.role !== 'super_admin'
    );

    res.json(filteredUsers);
  } catch (err) {
    console.error('❌ Error fetching all users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ✅ Notify stub (future: wire to WhatsApp Business API)
Router.post('/notify', authenticateToken, async (req, res) => {
  const { assignment_id, type } = req.body;
  console.log(`📨 [STUB] Notification type="${type}" for assignment=${assignment_id}`);
  res.json({ success: true, stub: true });
});

// ✅ Escalate stub (future: wire to WhatsApp Business API)
Router.post('/escalate', authenticateToken, async (req, res) => {
  const { assignment_id, escalation_remarks } = req.body;
  console.log(`🚨 [STUB] Escalation for assignment=${assignment_id}: ${escalation_remarks}`);
  res.json({ success: true, stub: true });
});

module.exports = Router;
