//site name will be stored here for the user input check

const mongoose = require('mongoose');

const siteSchema = new mongoose.Schema({
    siteCode:{
        type:String,
        required:true,
        unique:true
    },
    name: {
        type: String,
        required: true,
        unique: true,      // ensures no duplicate site names
        trim: true
    },
    description: {
        type: String,
        default: ""
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('sitename', siteSchema);
