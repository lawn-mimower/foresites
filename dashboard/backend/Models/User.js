const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['admin', 'super_admin', 'user'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  loginHistory: [{
    loginTime: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String
  }],
  profile: {
    firstName: String,
    lastName: String,
    phone: String,
    department: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Update updatedAt field before saving
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Add login record
userSchema.methods.addLoginRecord = function(ipAddress, userAgent) {
  this.lastLogin = Date.now();
  this.loginHistory.unshift({
    loginTime: Date.now(),
    ipAddress,
    userAgent
  });
  
  // Keep only last 10 login records
  if (this.loginHistory.length > 10) {
    this.loginHistory = this.loginHistory.slice(0, 10);
  }
  
  return this.save();
};

// Get public profile (without sensitive data)
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.loginHistory;
  return userObject;
};

// Static method to create super admin
userSchema.statics.createSuperAdmin = async function() {
  const existingSuperAdmin = await this.findOne({ role: 'super_admin' });
  
  if (!existingSuperAdmin) {
    const superAdmin = new this({
      username: 'superadmin',
      email: 'admin@mdconsultants.com',
      password: 'SuperAdmin123!',
      role: 'super_admin',
      profile: {
        firstName: 'Super',
        lastName: 'Admin',
        department: 'Administration'
      }
    });
    
    await superAdmin.save();
    console.log('✅ Super Admin created successfully');
    return superAdmin;
  }
  
  return existingSuperAdmin;
};

module.exports = mongoose.model('User', userSchema);
