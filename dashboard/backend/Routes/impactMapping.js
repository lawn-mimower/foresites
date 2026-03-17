const express = require('express');
const Router = express.Router();
const supabase = require('../config/supabaseClient');
const { authenticateToken, requireSuperAdmin } = require('./auth');

const DAILY_LIMIT = 12;

// GET / — Return all impact category mappings
Router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('impact_category_mapping')
      .select('*')
      .order('category');

    if (error) {
      console.error('Error fetching impact mappings:', error);
      return res.status(500).json({ error: 'Failed to fetch mappings' });
    }

    res.json(data || []);
  } catch (err) {
    console.error('Error fetching impact mappings:', err);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
});

// GET /remaining — Return remaining changes for current super admin today
Router.get('/remaining', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from('mapping_change_log')
      .select('*', { count: 'exact', head: true })
      .eq('changed_by', req.user.user_id)
      .gte('changed_at', todayStart.toISOString());

    if (error) {
      console.error('Error checking change count:', error);
      return res.status(500).json({ error: 'Failed to check remaining changes' });
    }

    res.json({ remaining: Math.max(0, DAILY_LIMIT - (count || 0)), limit: DAILY_LIMIT });
  } catch (err) {
    console.error('Error checking remaining:', err);
    res.status(500).json({ error: 'Failed to check remaining changes' });
  }
});

// PUT / — Update a category's impact level (rate-limited)
Router.put('/', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { category, impact_level } = req.body;

    if (!category || !impact_level) {
      return res.status(400).json({ error: 'category and impact_level are required' });
    }

    const validLevels = ['low', 'medium', 'high', 'critical'];
    if (!validLevels.includes(impact_level)) {
      return res.status(400).json({ error: `impact_level must be one of: ${validLevels.join(', ')}` });
    }

    // Check daily limit
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count, error: countError } = await supabase
      .from('mapping_change_log')
      .select('*', { count: 'exact', head: true })
      .eq('changed_by', req.user.user_id)
      .gte('changed_at', todayStart.toISOString());

    if (countError) {
      console.error('Error checking change count:', countError);
      return res.status(500).json({ error: 'Failed to verify rate limit' });
    }

    if ((count || 0) >= DAILY_LIMIT) {
      return res.status(429).json({
        error: `Daily limit reached. You can make ${DAILY_LIMIT} changes per day.`,
        remaining: 0,
      });
    }

    // Get current mapping to log old value
    const { data: current, error: fetchError } = await supabase
      .from('impact_category_mapping')
      .select('impact_level')
      .eq('category', category)
      .single();

    if (fetchError || !current) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (current.impact_level === impact_level) {
      return res.status(400).json({ error: 'New impact level is the same as current' });
    }

    // Update mapping
    const { error: updateError } = await supabase
      .from('impact_category_mapping')
      .update({
        impact_level,
        updated_at: new Date().toISOString(),
        updated_by: req.user.user_id,
      })
      .eq('category', category);

    if (updateError) {
      console.error('Error updating mapping:', updateError);
      return res.status(500).json({ error: 'Failed to update mapping' });
    }

    // Log the change
    await supabase
      .from('mapping_change_log')
      .insert([{
        changed_by: req.user.user_id,
        category,
        old_impact: current.impact_level,
        new_impact: impact_level,
      }]);

    const remaining = Math.max(0, DAILY_LIMIT - ((count || 0) + 1));
    res.json({ success: true, remaining });
  } catch (err) {
    console.error('Error updating impact mapping:', err);
    res.status(500).json({ error: 'Failed to update mapping' });
  }
});

module.exports = Router;
