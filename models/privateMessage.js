const mongoose = require('mongoose');

const privateMessageSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    recipient: { type: String, required: true },
    text: String,
    image: String,
    timestamp: { type: Date, default: Date.now }
});

const PrivateMessage = mongoose.model('PrivateMessage', privateMessageSchema);

module.exports = PrivateMessage;