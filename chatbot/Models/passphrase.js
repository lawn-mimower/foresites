//passphrase input check will be carried out here 
const mongoose = require('mongoose');

const passphraseSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        trim: true
    },
    site: {
        type: String,
        required: true,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('passphrase', passphraseSchema);
