const express = require('express');
const router = express.Router();

const FeedbackController = require('../chatbot/controller');

const VERIFY_TOKEN = 'MDC';

// GET route for webhook verification
router.get('/whatsapp/chatbot', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED ✅');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403); // Forbidden
        }
    } else {
        res.sendStatus(400); // Bad request
    }
});

// POST route for incoming messages
router.post('/whatsapp/chatbot', FeedbackController.receiveWhatsAppMessage);

// ✅ Export the router
module.exports = router;
