const express = require('express');
const Router = express.Router();
const supabase = require('../config/supabaseClient');
const { authenticateToken, requireAdmin, requireSuperAdminOrSrEngineer } = require('./auth');

// ✅ Get all sites
Router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data: sites, error } = await supabase
      .from('site')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching sites:', error);
      return res.status(500).json({ error: 'Failed to fetch sites' });
    }

    res.json(sites);
  } catch (err) {
    console.error('❌ Error fetching sites:', err);
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

// ✅ Get single site
Router.get('/:siteId', authenticateToken, async (req, res) => {
  try {
    const { siteId } = req.params;

    const { data: site, error } = await supabase
      .from('site')
      .select('*')
      .eq('id', siteId)
      .single();

    if (!site || error) {
      return res.status(404).json({ error: 'Site not found' });
    }

    res.json(site);
  } catch (err) {
    console.error('❌ Error fetching site:', err);
    res.status(500).json({ error: 'Failed to fetch site' });
  }
});

// ✅ Create new site (Superadmin and Sr. Engineer only)
Router.post('/', authenticateToken, requireSuperAdminOrSrEngineer, async (req, res) => {
  try {
    const { site_name, site_manager, passphrase, date_of_start } = req.body;

    if (!site_name) {
      return res.status(400).json({ error: 'site_name is required' });
    }

    const { data: site, error } = await supabase
      .from('site')
      .insert([
        {
          site_name,
          site_manager,
          passphrase,
          date_of_start
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating site:', error);
      return res.status(400).json({ error: 'Failed to create site' });
    }

    res.status(201).json({
      message: '✅ Site created successfully',
      site
    });
  } catch (err) {
    console.error('❌ Error creating site:', err);
    res.status(500).json({ error: 'Failed to create site' });
  }
});

// ✅ Update site (Superadmin and Sr. Engineer only)
Router.put('/:siteId', authenticateToken, requireSuperAdminOrSrEngineer, async (req, res) => {
  try {
    const { siteId } = req.params;
    const { site_name, site_manager, passphrase, date_of_start } = req.body;

    const updateData = {};
    if (site_name) updateData.site_name = site_name;
    if (site_manager) updateData.site_manager = site_manager;
    if (passphrase) updateData.passphrase = passphrase;
    if (date_of_start) updateData.date_of_start = date_of_start;

    const { data: updated, error } = await supabase
      .from('site')
      .update(updateData)
      .eq('id', siteId)
      .select()
      .single();

    if (!updated || error) {
      return res.status(404).json({ error: 'Site not found' });
    }

    res.json({
      message: '✅ Site updated',
      site: updated
    });
  } catch (err) {
    console.error('❌ Error updating site:', err);
    res.status(500).json({ error: 'Failed to update site' });
  }
});

// ✅ Delete site (Superadmin and Sr. Engineer only)
Router.delete('/:siteId', authenticateToken, requireSuperAdminOrSrEngineer, async (req, res) => {
  try {
    const { siteId } = req.params;

    const { error } = await supabase
      .from('site')
      .delete()
      .eq('id', siteId);

    if (error) {
      console.error('❌ Error deleting site:', error);
      return res.status(404).json({ error: 'Site not found' });
    }

    res.json({ message: '✅ Site deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting site:', err);
    res.status(500).json({ error: 'Failed to delete site' });
  }
});

// ✅ Site-wise Report - Aggregate feedback by site and category
Router.get('/report/sitewise', authenticateToken, async (req, res) => {
  try {
    const { data: snags, error } = await supabase
      .from('snag')
      .select(`
        *,
        site(site_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching snags for report:', error);
      return res.status(500).json({ error: 'Failed to fetch report data' });
    }

    // Aggregate by site
    const siteMap = {};
    snags.forEach((snag) => {
      const siteName = snag.site?.site_name || 'Unknown';
      const category = snag.category || 'miscellaneous';
      const status = snag.status || 'pending';

      if (!siteMap[siteName]) {
        siteMap[siteName] = {
          site_name: siteName,
          safety_compliance_raised: 0,
          design_conflicts_raised: 0,
          resource_blockers_raised: 0,
          workflow_issues_raised: 0,
          miscellaneous_raised: 0,
          safety_compliance_solved: 0,
          design_conflicts_solved: 0,
          resource_blockers_solved: 0,
          workflow_issues_solved: 0,
          miscellaneous_solved: 0,
        };
      }

      const categoryKey = `${category}_raised`;
      const solvedKey = `${category}_solved`;

      if (siteMap[siteName][categoryKey] !== undefined) {
        siteMap[siteName][categoryKey]++;
        if (status === 'resolved') {
          siteMap[siteName][solvedKey]++;
        }
      }
    });

    // Calculate totals
    const report = Object.values(siteMap).map((site) => ({
      ...site,
      total_raised: (site.safety_compliance_raised || 0) + (site.design_conflicts_raised || 0) + (site.resource_blockers_raised || 0) + (site.workflow_issues_raised || 0) + (site.miscellaneous_raised || 0),
      total_solved: (site.safety_compliance_solved || 0) + (site.design_conflicts_solved || 0) + (site.resource_blockers_solved || 0) + (site.workflow_issues_solved || 0) + (site.miscellaneous_solved || 0),
    }));

    report.forEach((site) => {
      site.total_pending = site.total_raised - site.total_solved;
    });

    res.json(report);
  } catch (err) {
    console.error('❌ Error generating sitewise report:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ✅ Day-wise Report - Feedback by date
Router.get('/report/daywise', authenticateToken, async (req, res) => {
  try {
    const { data: snags, error } = await supabase
      .from('snag')
      .select(`
        *,
        site(site_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching snags for daywise report:', error);
      return res.status(500).json({ error: 'Failed to fetch report data' });
    }

    // Aggregate by date and site
    const dayMap = {};
    snags.forEach((snag) => {
      const date = snag.created_at.split('T')[0];
      const siteName = snag.site?.site_name || 'Unknown';
      const category = snag.category || 'miscellaneous';
      const status = snag.status || 'pending';

      const key = `${date}|${siteName}`;
      if (!dayMap[key]) {
        dayMap[key] = {
          date,
          site_name: siteName,
          feedback_ids: [],
          safety_compliance_raised: 0,
          design_conflicts_raised: 0,
          resource_blockers_raised: 0,
          workflow_issues_raised: 0,
          miscellaneous_raised: 0,
          safety_compliance_solved: 0,
          design_conflicts_solved: 0,
          resource_blockers_solved: 0,
          workflow_issues_solved: 0,
          miscellaneous_solved: 0,
        };
      }

      dayMap[key].feedback_ids.push(snag.id);
      const categoryKey = `${category}_raised`;
      const solvedKey = `${category}_solved`;

      if (dayMap[key][categoryKey] !== undefined) {
        dayMap[key][categoryKey]++;
        if (status === 'resolved') {
          dayMap[key][solvedKey]++;
        }
      }
    });

    // Calculate totals
    const report = Object.values(dayMap).map((day) => ({
      ...day,
      feedback_ids: day.feedback_ids.join('|'),
      total_raised: (day.safety_compliance_raised || 0) + (day.design_conflicts_raised || 0) + (day.resource_blockers_raised || 0) + (day.workflow_issues_raised || 0) + (day.miscellaneous_raised || 0),
      total_solved: (day.safety_compliance_solved || 0) + (day.design_conflicts_solved || 0) + (day.resource_blockers_solved || 0) + (day.workflow_issues_solved || 0) + (day.miscellaneous_solved || 0),
    }));

    report.forEach((day) => {
      day.total_pending = day.total_raised - day.total_solved;
    });

    res.json(report);
  } catch (err) {
    console.error('❌ Error generating daywise report:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ✅ User-wise Report - Feedback by user/reporter
Router.get('/report/userwise', authenticateToken, async (req, res) => {
  try {
    const { data: snags, error } = await supabase
      .from('snag')
      .select(`
        *,
        site(site_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching snags for userwise report:', error);
      return res.status(500).json({ error: 'Failed to fetch report data' });
    }

    // Aggregate by user/reporter
    const userMap = {};
    snags.forEach((snag) => {
      const reporter = snag.reporter_name || 'Unknown';
      const siteName = snag.site?.site_name || 'Unknown';
      const category = snag.category || 'miscellaneous';
      const status = snag.status || 'pending';

      const key = reporter;
      if (!userMap[key]) {
        userMap[key] = {
          reporter_name: reporter,
          site_name: siteName,
          total_feedback: 0,
          resolved: 0,
          pending: 0,
          categories: {
            safety_compliance: 0,
            design_conflicts: 0,
            resource_blockers: 0,
            workflow_issues: 0,
            miscellaneous: 0,
          },
        };
      }

      userMap[key].total_feedback++;
      userMap[key].categories[category]++;
      if (status === 'resolved') {
        userMap[key].resolved++;
      } else {
        userMap[key].pending++;
      }
    });

    const report = Object.values(userMap);

    res.json(report);
  } catch (err) {
    console.error('❌ Error generating userwise report:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

module.exports = Router;
