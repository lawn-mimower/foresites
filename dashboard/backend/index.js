const express=require('express');
const app=express();
const mongoose=require('mongoose');
const bodyparser=require('body-parser');
const session=require('express-session');
const path=require('path');
const cors=require('cors');
const MONGOURL='mongodb://abhishekdevelop04_db_user:OCo27RyqFn7wAbLK@ac-v6mdxgy-shard-00-00.lbt0hzv.mongodb.net:27017,ac-v6mdxgy-shard-00-01.lbt0hzv.mongodb.net:27017,ac-v6mdxgy-shard-00-02.lbt0hzv.mongodb.net:27017/?replicaSet=atlas-115nke-shard-0&ssl=true&authSource=admin';
const PORT=9999;


const csvPath='./MD-report-data.csv';

app.use("/uploads", express.static(path.join(__dirname, "..", "..", "uploads")));

console.log("✅ Serving uploads from:", path.join(__dirname, "..", "..", "uploads"));

const dashboardRoutes=require('./Routes/fb');
const { router: authRoutes } = require('./Routes/auth');
const User = require('./Models/User');




app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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


app.get('/testpath', (req, res) => {
  res.send(path.join(__dirname, '..', 'uploads'));
});


//connect to db
(async () => {
  try {
    await mongoose.connect(MONGOURL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected via Mongoose!");
    
    // Create super admin if it doesn't exist
    await User.createSuperAdmin();
  } catch (error) {
    console.error("❌ Unable to connect to MongoDB:", error);
  }
})();





app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));