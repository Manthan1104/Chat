const mongoose = require('mongoose');

const communityMessageSchema = new mongoose.Schema({
    username: { type: String, required: true },
    text: String,
    image: String,
    timestamp: { type: Date, default: Date.now }
});

const CommunityMessage = mongoose.model('CommunityMessage', communityMessageSchema);

module.exports = CommunityMessage;