const express = require('express'); 
const app = express(); 
const dotenv = require('dotenv'); 
dotenv.config(); 
const chatbotRoutes = require('./route.js');
const { supabase } = require('./db');

// Connection details
const PORT = process.env.PORT;

app.use(express.json());

// Allow CORS
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,PATCH,POST,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    next();
});

// Routes
app.use('/api', chatbotRoutes);

// Supabase Connection Test
supabase.auth.getSession()
    .then(() => console.log('✅ Connected to Supabase'))
    .catch(err => console.error('❌ Supabase connection error:', err));

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
