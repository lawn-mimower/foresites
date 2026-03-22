require('dotenv').config();
const express=require('express');
const app=express();
const bodyparser=require('body-parser');
const session=require('express-session');
const path=require('path');
const cors=require('cors');


const PORT=9999;




app.use("/uploads", express.static(path.join(__dirname, "..", "..", "uploads")));

console.log("✅ Serving uploads from:", path.join(__dirname, "..", "..", "uploads"));

const dashboardRoutes=require('./Routes/fb');
const { router: authRoutes, createSuperAdmin } = require('./Routes/auth');
const todoRoutes = require('./Routes/todo');
const snagAssignmentRoutes = require('./Routes/snagAssignment');
const siteRoutes = require('./Routes/sites');
const employeeRoutes = require('./Routes/employee');
const reportRoutes=require('./Routes/reportRoutes');
const chatRoutes = require('./Routes/chatRoutes');
const impactMappingRoutes = require('./Routes/impactMapping');

app.use(cors({
  origin: (origin, callback) => callback(null, true),
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));


app.use(bodyparser.json());

// Security headers
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Strict transport security (HTTPS only)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // Content security policy
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;");
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Set to true in production with HTTPS
    httpOnly: true, // Prevent XSS attacks
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict' // CSRF protection
  }
}));

// exporting the routes

app.use('/api/dashboard',dashboardRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/snag-assignments', snagAssignmentRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/report',reportRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/impact-mapping', impactMappingRoutes);

app.get('/testpath', (req, res) => {
  res.send(path.join(__dirname, '..', 'uploads'));
});

// ✅ Supabase is now initialized via environment variables
console.log('✅ Backend ready - Using Supabase for database operations');

// 🔐 Initialize superadmin on startup
createSuperAdmin();

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://0.0.0.0:${PORT}`));