const express = require('express');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const supabase = require('../config/supabaseClient');
const { REPORTS_DIR, USERWISE_CSV } = require('../../../config/paths');
const router = express.Router();

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// 📊 Update User CSV (date, username, login_count, time_spent)
async function updateUserCSV(username, loginCount = 0, timeSpent = 0) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const userHeaders = ['date', 'username', 'login_count', 'time_spent'];

    // Ensure CSV file exists with headers
    if (!fs.existsSync(USERWISE_CSV)) {
      fs.writeFileSync(USERWISE_CSV, userHeaders.join(',') + '\n', 'utf8');
    }

    // Parse CSV
    const csvData = fs.readFileSync(USERWISE_CSV, 'utf8').trim().split('\n');
    const userRows = csvData.length > 1 ? csvData.slice(1).map(line => line.split(',')) : [];
    const headerIndex = Object.fromEntries(userHeaders.map((h, i) => [h, i]));

    // Find or create user row for today
    let userRow = userRows.find(r => 
      r[headerIndex['date']] === today && r[headerIndex['username']] === username
    );

    if (!userRow) {
      // Create new user row for today
      userRow = Array(userHeaders.length).fill('0');
      userRow[headerIndex['date']] = today;
      userRow[headerIndex['username']] = username;
      userRow[headerIndex['login_count']] = loginCount.toString();
      userRow[headerIndex['time_spent']] = timeSpent.toString();
      userRows.push(userRow);
    } else {
      // Update existing row
      if (loginCount > 0) {
        userRow[headerIndex['login_count']] = String(
          (parseInt(userRow[headerIndex['login_count']]) || 0) + loginCount
        );
      }
      if (timeSpent > 0) {
        userRow[headerIndex['time_spent']] = String(
          (parseInt(userRow[headerIndex['time_spent']]) || 0) + timeSpent
        );
      }
    }

    // Write updated CSV back
    const updatedCsv = [userHeaders.join(',')]
      .concat(userRows.map(r => r.join(',')))
      .join('\n')
      .trim() + '\n';

    fs.writeFileSync(USERWISE_CSV, updatedCsv, 'utf8');
    console.log(`✅ Userwise CSV updated for ${username} on ${today}`);
  } catch (err) {
    console.error('❌ Error updating user CSV:', err);
  }
}

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Middleware to check super admin level access (Super admin OR Sr. engineer OR old super_admin/admin)
const requireSuperAdminLevel = (req, res, next) => {
  if (req.user.role !== 'Super admin' && req.user.role !== 'Sr. engineer' && req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Super admin level access required' });
  }
  next();
};

// Middleware to check super admin only (Super admin OR old super_admin)
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'Super admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
};

// 🔐 Middleware to check Superadmin and Sr. Engineer only (for critical operations like Access Points management)
const requireSuperAdminOrSrEngineer = (req, res, next) => {
  if (req.user.role !== 'Super admin' && req.user.role !== 'super_admin' && req.user.role !== 'Sr. engineer') {
    return res.status(403).json({ error: 'Super admin or Sr. engineer access required' });
  }
  next();
};

// Alias for backward compatibility
const requireAdmin = requireSuperAdminLevel;

// Register new user (super admin level only)
router.post('/register', authenticateToken, requireSuperAdminLevel, async (req, res) => {
  try {
    const { username, email, password, role = 'Jr. engineer', department, designation, site_id } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('website_user')
      .select('*')
      .or(`username.eq.${username},email.eq.${email}`)
      .maybeSingle();

    if (existingUser) {
      return res.status(409).json({ error: 'User with this email or username already exists' });
    }

    // Hash password
    const password_hash = await bcryptjs.hash(password, 12);

    // Create new user - convert empty site_id to null for UUID field
    const { data: newUser, error: insertError } = await supabase
      .from('website_user')
      .insert([
        {
          username,
          email: email.toLowerCase(),
          password_hash,
          role,
          department,
          designation,
          site_id: site_id && site_id.trim() ? site_id : null  // Convert empty string to null
        }
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Registration error:', insertError);
      return res.status(500).json({ error: 'Failed to create user' });
    }

    res.status(201).json({
      message: 'User created successfully',
      user: {
        user_id: newUser.user_id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
        designation: newUser.designation,
        site_id: newUser.site_id
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const { data: user, error: queryError } = await supabase
      .from('website_user')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (!user || queryError) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isPasswordValid = await bcryptjs.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update user CSV (increment login_count by 1)
    await updateUserCSV(user.username, 1, 0);

    // Generate JWT token
    const token = jwt.sign(
      {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role,
        department: user.department,
        designation: user.designation,
        site_id: user.site_id
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role,
        department: user.department,
        designation: user.designation,
        site_id: user.site_id,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout (client-side token removal)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Update user CSV with session end (would need session tracking in Supabase if needed)
    // For now, just clear client-side
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.json({ message: 'Logout successful' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('website_user')
      .select('*')
      .eq('user_id', req.user.user_id)
      .single();

    if (!user || error) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role,
        department: user.department,
        designation: user.designation,
        site_id: user.site_id,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { department, designation } = req.body;

    const { data: user, error } = await supabase
      .from('website_user')
      .update({ department, designation })
      .eq('user_id', req.user.user_id)
      .select()
      .single();

    if (!user || error) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role,
        department: user.department,
        designation: user.designation,
        site_id: user.site_id
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    // Get current user
    const { data: user, error: queryError } = await supabase
      .from('website_user')
      .select('*')
      .eq('user_id', req.user.user_id)
      .single();

    if (!user || queryError) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcryptjs.compare(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const new_password_hash = await bcryptjs.hash(newPassword, 12);

    // Update password
    const { data: updatedUser, error: updateError } = await supabase
      .from('website_user')
      .update({ password_hash: new_password_hash })
      .eq('user_id', req.user.user_id)
      .select()
      .single();

    if (updateError) {
      console.error('Password change error:', updateError);
      return res.status(500).json({ error: 'Failed to change password' });
    }

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Get all users (super admin level only)
router.get('/users', authenticateToken, requireSuperAdminLevel, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('website_user')
      .select('user_id, username, email, role, department, designation, site_id, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Users fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    res.json({ users });
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user status (toggle active/inactive - can be extended for Supabase)
router.put('/users/:userId/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;

    const { data: user, error } = await supabase
      .from('website_user')
      .update({ role })
      .eq('user_id', req.params.userId)
      .select()
      .single();

    if (!user || error) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User updated successfully',
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role,
        department: user.department,
        designation: user.designation
      }
    });
  } catch (error) {
    console.error('User update error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Update user (super admin level - update role, department, designation, site_id, password)
router.put('/users/:userId', authenticateToken, requireSuperAdminLevel, async (req, res) => {
  try {
    const { role, department, designation, site_id, password } = req.body;

    const updateData = {};
    if (role) updateData.role = role;
    if (department !== undefined) updateData.department = department;
    if (designation !== undefined) updateData.designation = designation;
    if (site_id !== undefined) updateData.site_id = site_id;
    
    // Update password if provided
    if (password && password.length >= 6) {
      const password_hash = await bcryptjs.hash(password, 12);
      updateData.password_hash = password_hash;
    }

    const { data: user, error } = await supabase
      .from('website_user')
      .update(updateData)
      .eq('user_id', req.params.userId)
      .select()
      .single();

    if (!user || error) {
      console.error('User update error:', error);
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User updated successfully',
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role,
        department: user.department,
        designation: user.designation,
        site_id: user.site_id
      }
    });
  } catch (error) {
    console.error('User update error:', error);
    res.status(500).json({ error: 'Failed to update user: ' + error.message });
  }
});

// Delete user (super admin only)
router.delete('/users/:userId', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('website_user')
      .delete()
      .eq('user_id', req.params.userId);

    if (error) {
      console.error('User deletion error:', error);
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('User deletion error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Verify token endpoint
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: {
      user_id: req.user.user_id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
      department: req.user.department,
      designation: req.user.designation,
      site_id: req.user.site_id
    }
  });
});

// 🔐 Auto-create superadmin user on startup
const createSuperAdmin = async () => {
  try {
    const defaultEmail = 'superadmin@admin.com';
    const defaultPassword = 'SuperAdmin@123';
    const defaultUsername = 'superadmin';

    // Check if superadmin already exists
    const { data: existing, error: checkError } = await supabase
      .from('website_user')
      .select('user_id')
      .eq('email', defaultEmail)
      .single();

    if (existing) {
      console.log('✅ Superadmin user already exists');
      return;
    }

    // Hash password
    const passwordHash = await bcryptjs.hash(defaultPassword, 12);

    // Create superadmin user with super_admin role
    const { data: newUser, error: createError } = await supabase
      .from('website_user')
      .insert([{
        username: defaultUsername,
        email: defaultEmail,
        password_hash: passwordHash,
        role: 'super_admin',
        department: 'Admin',
        designation: 'System Administrator',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating superadmin:', createError);
      return;
    }

    console.log('✅ Superadmin user created successfully');
    console.log('   Email:', defaultEmail);
    console.log('   Password:', defaultPassword);
    console.log('   ⚠️  Change this password in production!');
  } catch (error) {
    console.error('❌ Error in createSuperAdmin:', error);
  }
};

module.exports = { router, authenticateToken, requireSuperAdminLevel, requireSuperAdmin, requireSuperAdminOrSrEngineer, requireAdmin: requireSuperAdminLevel, createSuperAdmin };
