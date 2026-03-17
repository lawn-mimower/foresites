const express = require('express');
const Router = express.Router();
const { randomUUID } = require('crypto');
const multer = require('multer');
const supabase = require('../config/supabaseClient');
const { authenticateToken, requireAdmin } = require('./auth');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const {
  sendAssignmentNotification,
  sendEscalationNotification,
  sendRejectionNotification,
  sendApprovalNotification,
} = require('../services/whatsapp');

// S3 client for proof uploads
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Multer: store in memory for S3 upload
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * Helper: Look up assignment with joined assignee, assigner, snag, and site info.
 * Used by notify/escalate endpoints to build WhatsApp messages.
 */
async function getAssignmentContext(assignmentId) {
  const { data, error } = await supabase
    .from('snag_assignment')
    .select(`
      assignment_id,
      snag_id,
      site_id,
      assigned_user_id,
      assigner_id,
      assigner_remarks,
      rejection_remarks,
      rejection_count,
      priority,
      assigned_user:website_user!assigned_user_id(username, phone_number, designation),
      assigner:website_user!assigner_id(username, designation),
      snag(id, feedback, category),
      site(site_name)
    `)
    .eq('assignment_id', assignmentId)
    .single();

  if (error || !data) return null;
  return {
    assignmentId: data.assignment_id,
    snagId: data.snag_id,
    username: data.assigned_user?.username || 'Team member',
    phone: data.assigned_user?.phone_number,
    assignerName: data.assigner?.username || '',
    assignerDesignation: data.assigner?.designation || '',
    siteName: data.site?.site_name || '',
    category: data.snag?.category || '',
    feedback: data.snag?.feedback || '',
    snagDbId: data.snag?.id || '',
    remarks: data.assigner_remarks || '',
    rejectionRemarks: data.rejection_remarks || '',
    rejectionCount: data.rejection_count || 0,
    priority: data.priority || '',
  };
}

// ✅ Get all snag assignments (joins username from website_user)
Router.get('/assignments', authenticateToken, async (req, res) => {
  try {
    const { data: assignments, error } = await supabase
      .from('snag_assignment')
      .select('*, assigned_user:website_user!assigned_user_id(username, role)')
      .eq('is_active', true)
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

// ✅ Get assignments created by the current user ("Jobs I Assigned")
Router.get('/assignments/assigned-by-me', authenticateToken, async (req, res) => {
  try {
    const { data: assignments, error } = await supabase
      .from('snag_assignment')
      .select(`
        assignment_id,
        snag_id,
        site_id,
        assigned_user_id,
        assigner_id,
        assigned_at,
        resolved_at,
        proof,
        assigner_remarks,
        due_date,
        solution,
        status,
        priority,
        rejection_count,
        rejection_remarks,
        assigned_user:website_user!assigned_user_id(username, role),
        snag(id, feedback_type, feedback, transcription, image_url, status, category),
        site(id, site_name, site_manager)
      `)
      .eq('assigner_id', req.user.user_id)
      .eq('is_active', true)
      .order('assigned_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching assigned-by-me:', error);
      return res.status(500).json({ error: 'Failed to fetch assignments' });
    }

    // Flatten the assigned user info
    const flat = (assignments || []).map(a => ({
      ...a,
      assigned_username: a.assigned_user?.username || 'Unknown',
      assigned_role: a.assigned_user?.role || '',
      assigned_user: undefined,
    }));

    res.json(flat);
  } catch (err) {
    console.error('❌ Error fetching assigned-by-me:', err);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// ✅ Create new assignment
Router.post('/assignments', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { snag_id, site_id, assigned_user_id, assigner_remarks, due_date, priority } = req.body;

    if (!snag_id || !site_id || !assigned_user_id) {
      return res.status(400).json({ error: 'Missing required fields: snag_id, site_id, assigned_user_id' });
    }

    // Deactivate any existing active assignment on the same snag (single-assignee model)
    let inheritedPriority = null;
    const { data: existingAssignments, error: existingErr } = await supabase
      .from('snag_assignment')
      .select('assignment_id, priority')
      .eq('snag_id', snag_id)
      .eq('is_active', true);

    if (existingErr) {
      console.warn('⚠️ Error querying existing assignments (is_active column may be missing):', existingErr.message);
    }

    if (existingAssignments && existingAssignments.length > 0) {
      inheritedPriority = existingAssignments[0].priority;
      const ids = existingAssignments.map(a => a.assignment_id);
      const { error: deactivateErr } = await supabase
        .from('snag_assignment')
        .update({ is_active: false })
        .in('assignment_id', ids);
      if (deactivateErr) {
        console.warn('⚠️ Error deactivating old assignments:', deactivateErr.message);
      } else {
        console.log('✅ Deactivated', ids.length, 'existing assignment(s) for snag', snag_id);
      }
    }

    // Generate assignment_id as UUID
    const assignment_id = randomUUID();

    const assignmentData = {
      assignment_id,
      snag_id,
      site_id,
      assigned_user_id,
      assigner_id: req.user.user_id,
      status: 'in_progress',
      is_active: true,
    };

    // Add priority (use provided, or inherit from previous assignment)
    if (priority) {
      assignmentData.priority = priority;
    } else if (inheritedPriority) {
      assignmentData.priority = inheritedPriority;
    }

    // Add assigner_remarks if provided
    if (assigner_remarks && assigner_remarks.trim()) {
      assignmentData.assigner_remarks = assigner_remarks;
    }

    // Add due_date if provided
    if (due_date) {
      assignmentData.due_date = due_date;
    }

    console.log('📋 Inserting assignment:', JSON.stringify(assignmentData, null, 2));

    const { data: assignment, error } = await supabase
      .from('snag_assignment')
      .insert([assignmentData])
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating assignment:', JSON.stringify(error, null, 2));
      return res.status(400).json({ error: 'Failed to create assignment', details: error.message });
    }

    console.log('✅ Assignment created:', assignment?.assignment_id, 'is_active:', assignment?.is_active);

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
    const { status, notes, solution, due_date } = req.body;

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

    const updateData = {};
    if (status) updateData.status = status;
    if (notes) updateData.notes = notes;
    if (solution) updateData.solution = solution;
    if (due_date !== undefined) updateData.due_date = due_date || null;

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
    if (status) {
      const snagStatus = status === 'resolved' ? 'resolved' : 'pending';
      const { error: snagError } = await supabase
        .from('snag')
        .update({ status: snagStatus })
        .eq('id', assignment.snag_id);

      if (snagError) {
        console.warn('⚠️ Warning: Snag update failed', snagError);
      }
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

// ✅ Upload proof image for assignment (multipart file → S3)
Router.post('/assignments/:assignmentId/upload-proof', authenticateToken, upload.single('proof'), async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const bucketName = process.env.S3_BUCKET_NAME || 'mdconstructions';
    const s3Key = `images/proof/${assignmentId}/${file.originalname}`;

    // Upload to S3
    await s3.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    // Update assignment with proof key and set status to in_review
    const { data: updated, error } = await supabase
      .from('snag_assignment')
      .update({ proof: s3Key, status: 'in_review' })
      .eq('assignment_id', assignmentId)
      .select()
      .single();

    if (!updated || error) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json({
      message: '✅ Proof uploaded',
      assignment: updated,
      s3Key
    });
  } catch (err) {
    console.error('❌ Error uploading proof:', err);
    res.status(500).json({ error: 'Failed to upload proof' });
  }
});

// ✅ Upload proof for assignment (JSON body — legacy)
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
        priority,
        rejection_count,
        rejection_remarks,
        snag(id, feedback_type, feedback, transcription, image_url, status, category),
        site(id, site_name, site_manager)
      `)
      .eq('assigned_user_id', req.user.user_id)
      .eq('is_active', true)
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

// ✅ Notify — sends WhatsApp message based on type (assign, reject, approve)
Router.post('/notify', authenticateToken, async (req, res) => {
  const { assignment_id, type } = req.body;
  console.log(`📨 Notification type="${type}" for assignment=${assignment_id}`);

  // Respond immediately
  res.json({ success: true });

  // Fire-and-forget: look up assignment context and send WhatsApp
  try {
    const ctx = await getAssignmentContext(assignment_id);
    if (!ctx || !ctx.phone) {
      console.warn('⚠️ No phone number found for assignment:', assignment_id);
      return;
    }

    if (type === 'assign') {
      await sendAssignmentNotification(ctx.phone, ctx);
    } else if (type === 'reject') {
      await sendRejectionNotification(ctx.phone, ctx);
    } else if (type === 'approve') {
      await sendApprovalNotification(ctx.phone, ctx);
    }
  } catch (err) {
    console.error('❌ Notification send error (fire-and-forget):', err.message);
  }
});

// ✅ Escalate — sends WhatsApp escalation message
Router.post('/escalate', authenticateToken, async (req, res) => {
  const { assignment_id, escalation_remarks } = req.body;
  console.log(`🚨 Escalation for assignment=${assignment_id}: ${escalation_remarks}`);

  // Respond immediately
  res.json({ success: true });

  // Fire-and-forget
  try {
    const ctx = await getAssignmentContext(assignment_id);
    if (!ctx || !ctx.phone) {
      console.warn('⚠️ No phone number found for assignment:', assignment_id);
      return;
    }

    await sendEscalationNotification(ctx.phone, {
      ...ctx,
      escalationRemarks: escalation_remarks || '',
    });
  } catch (err) {
    console.error('❌ Escalation send error (fire-and-forget):', err.message);
  }
});

// GET /last-updated — Returns the latest modification timestamp across snags and assignments
Router.get('/last-updated', authenticateToken, async (req, res) => {
  try {
    const [snagResult, assignResult] = await Promise.all([
      supabase
        .from('snag')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('snag_assignment')
        .select('assigned_at, resolved_at')
        .order('assigned_at', { ascending: false })
        .limit(1),
    ]);

    const timestamps = [];

    if (snagResult.data?.[0]?.created_at) {
      timestamps.push(new Date(snagResult.data[0].created_at).getTime());
    }
    if (assignResult.data?.[0]) {
      const a = assignResult.data[0];
      if (a.assigned_at) timestamps.push(new Date(a.assigned_at).getTime());
      if (a.resolved_at) timestamps.push(new Date(a.resolved_at).getTime());
    }

    const latest = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null;
    res.json({ last_updated: latest });
  } catch (err) {
    console.error('Error fetching last-updated:', err);
    res.status(500).json({ error: 'Failed to fetch last-updated timestamp' });
  }
});

module.exports = Router;
