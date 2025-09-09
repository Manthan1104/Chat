const mongoose = require('mongoose');

const communityMessageSchema = new mongoose.Schema({
    username: { type: String, required: true },
    text: String,
    image: String,
    isGift: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
    reactions: [{
    emoji: String,
    user: String
}]
});

const CommunityMessage = mongoose.model('CommunityMessage', communityMessageSchema);

module.exports = CommunityMessage;