// models/message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    // For general community messages
    username: String, 
    
    // For private/group messages
    sender: String,
    recipient: String, // Can be a username or a group name
    group: String,

    // Common fields
    text: String,
    image: String,
    timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;