const express = require('express'); 
const app = express(); 
const mongoose = require('mongoose'); 
const dotenv = require('dotenv'); 
dotenv.config(); 
const chatbotRoutes = require('./route.js');

// Connection details
const PORT = process.env.PORT ;
const MONGO_URI = process.env.MONGO_URI;

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

// MongoDB Connection
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
