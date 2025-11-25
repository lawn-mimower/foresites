const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const User = require('../Models/User');
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

// Middleware to check admin role
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Middleware to check super admin role
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
};

// Register new user (admin only)
router.post('/register', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, email, password, role = 'user', profile } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(409).json({ error: 'User with this email or username already exists' });
    }

    // Create new user
    const newUser = new User({
      username,
      email,
      password,
      role,
      profile
    });

    await newUser.save();

    res.status(201).json({
      message: 'User created successfully',
      user: newUser.getPublicProfile()
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
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Add login record
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    await user.addLoginRecord(ipAddress, userAgent);

    // Update user CSV (increment login_count by 1)
    await updateUserCSV(user.username, 1, 0);

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout (client-side token removal)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user) {
      // Add logout record and calculate session duration
      await user.addLogoutRecord();
      
      // Get session duration from the most recent login record
      let timeSpent = 0;
      if (user.loginHistory && user.loginHistory.length > 0) {
        timeSpent = user.loginHistory[0].sessionDuration || 0;
      }
      
      // Update user CSV (add time_spent in minutes)
      if (timeSpent > 0) {
        await updateUserCSV(user.username, 0, timeSpent);
      }
    }
    
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.json({ message: 'Logout successful' }); // Still return success even if CSV update fails
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: user.getPublicProfile() });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { profile } = req.body;
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.profile = { ...user.profile, ...profile };
    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: user.getPublicProfile()
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

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Get all users (admin only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}, 'username email role isActive lastLogin createdAt profile')
      .sort({ createdAt: -1 });

    res.json({ users });
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user login history (admin only)
router.get('/users/:userId/login-history', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId, 'username email loginHistory');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        username: user.username,
        email: user.email
      },
      loginHistory: user.loginHistory
    });
  } catch (error) {
    console.error('Login history error:', error);
    res.status(500).json({ error: 'Failed to fetch login history' });
  }
});

// Update user status (admin only)
router.put('/users/:userId/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { isActive },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User status updated successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('User status update error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Delete user (super admin only)
router.delete('/users/:userId', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.userId);
    if (!user) {
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
      userId: req.user.userId,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role
    }
  });
});

module.exports = { router, authenticateToken, requireAdmin, requireSuperAdmin };
