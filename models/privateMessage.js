const mongoose = require('mongoose');

const privateMessageSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    recipient: { type: String, required: true },
    text: String,
    image: String,
    isGift: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
    reactions: [{
    emoji: String,
    user: String
}]
});

const PrivateMessage = mongoose.model('PrivateMessage', privateMessageSchema);

module.exports = PrivateMessage;