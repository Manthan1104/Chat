const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const CommunityMessage = require('./models/communityMessage');
const PrivateMessage = require('./models/privateMessage');
const User = require('./models/user');
const Group = require('./models/group');

const app = express();
const port = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected successfully.'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

// --- WebSocket Server ---
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const clients = new Map();

function broadcastOnlineUsers() {
    const onlineUsers = Array.from(clients.values(), client => ({
        name: client.name,
        profilePicture: client.profilePicture
    }));
    const message = JSON.stringify({ type: 'online_users', data: onlineUsers });
    for (const clientData of clients.values()) {
        if (clientData.ws.readyState === WebSocket.OPEN) {
            clientData.ws.send(message);
        }
    }
}

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', async (message) => {
        let parsedMessage;
        try {
            parsedMessage = JSON.parse(message);
        } catch (e) {
            console.error("Failed to parse message:", e);
            return;
        }

        if (parsedMessage.type !== 'authenticate' && !ws.user) return;

        switch(parsedMessage.type) {
            case 'authenticate':
                const user = await User.findOne({ name: parsedMessage.username });
                if (!user) return;
                ws.user = { name: user.name, role: user.role };
                clients.set(ws.user.name, { 
                    ws, 
                    name: ws.user.name,
                    role: ws.user.role, 
                    profilePicture: user.profilePicture 
                });
                console.log(`${ws.user.name} (${ws.user.role}) authenticated.`);
                broadcastOnlineUsers();
                try {
                    const history = await CommunityMessage.find({}).sort({ timestamp: 1 }).exec();
                    ws.send(JSON.stringify({ type: 'history', data: history }));
                } catch (err) { console.error('Error fetching history:', err); }
                break;

            case 'get_history':
                try {
                    const currentUser = ws.user.name;
                    const otherUser = parsedMessage.with;
                    let history;
                    if (otherUser === 'community') {
                        history = await CommunityMessage.find({}).sort({ timestamp: 1 }).exec();
                    } else {
                        history = await PrivateMessage.find({
                            $or: [
                                { sender: currentUser, recipient: otherUser },
                                { sender: otherUser, recipient: currentUser }
                            ]
                        }).sort({ timestamp: 1 }).exec();
                    }
                    ws.send(JSON.stringify({ type: 'chat_history', data: history }));
                } catch (err) { console.error('Error fetching specific history:', err); }
                break;

            case 'chat_request':
                const recipientSocket = clients.get(parsedMessage.to)?.ws;
                if (recipientSocket) {
                    recipientSocket.send(JSON.stringify({ type: 'incoming_request', from: ws.user.name }));
                }
                break;

            case 'request_response':
                const originalRequesterSocket = clients.get(parsedMessage.to)?.ws;
                if (originalRequesterSocket) {
                    originalRequesterSocket.send(JSON.stringify({
                        type: 'response_received',
                        from: ws.user.name,
                        response: parsedMessage.response
                    }));
                }
                break;

            case 'private_message':
                const recipientPrivateSocket = clients.get(parsedMessage.recipient)?.ws;
                if (recipientPrivateSocket) {
                    const newMessage = new PrivateMessage({
                        sender: ws.user.name,
                        recipient: parsedMessage.recipient,
                        text: parsedMessage.text,
                        image: parsedMessage.image,
                        isGift: parsedMessage.isGift || false
                    });
                    await newMessage.save();
                    recipientPrivateSocket.send(JSON.stringify({ type: 'private_message', data: newMessage }));
                    ws.send(JSON.stringify({ type: 'private_message', data: newMessage }));
                }
                break;

            case 'typing_start':
            case 'typing_stop':
                // Forward typing status without saving to DB
                if (parsedMessage.to === 'community') {
                    broadcast({ type: parsedMessage.type, from: ws.user.name }, ws); // Broadcast to all BUT sender
                } else {
                    const recipientSocket = clients.get(parsedMessage.to)?.ws;
                    if (recipientSocket) {
                        recipientSocket.send(JSON.stringify({ type: parsedMessage.type, from: ws.user.name }));
                    }
                }
                break;

            // NEW: Handle adding a reaction to a message
            case 'add_reaction':
                try {
                    const { messageId, messageType, emoji } = parsedMessage;
                    const Model = messageType === 'community' ? CommunityMessage : PrivateMessage;
                    const message = await Model.findById(messageId);

                    if (message) {
                        // Find if the user has already reacted
                        const existingReactionIndex = message.reactions.findIndex(r => r.user === ws.user.name);
                        if (existingReactionIndex > -1) {
                            // If they click the same emoji, remove reaction. Otherwise, update it.
                            if (message.reactions[existingReactionIndex].emoji === emoji) {
                                message.reactions.splice(existingReactionIndex, 1);
                            } else {
                                message.reactions[existingReactionIndex].emoji = emoji;
                            }
                        } else {
                            // Add new reaction
                            message.reactions.push({ emoji, user: ws.user.name });
                        }
                        await message.save();
                        // Broadcast the entire updated message
                        broadcast({ type: 'message_updated', data: message });
                    }
                } catch (err) { console.error("Error adding reaction:", err); }
                break;
                
            
            case 'message':
                const newMessage = new CommunityMessage({
                    username: ws.user.name,
                    text: parsedMessage.text,
                    image: parsedMessage.image,
                    isGift: parsedMessage.isGift || false
                });
                await newMessage.save();
                broadcast({ type: 'message', data: newMessage });
                break;

            case 'deleteMessage':
                try {
                    const { id, messageType } = parsedMessage;
                    const Model = messageType === 'community' ? CommunityMessage : PrivateMessage;
                    
                    const msgToDelete = await Model.findById(id);
                    if (!msgToDelete) return;

                    // Check permissions
                    const sender = msgToDelete.username || msgToDelete.sender;
                    if (ws.user.role === 'admin' || sender === ws.user.name) {
                        await Model.findByIdAndDelete(id);
                        // Notify all clients to remove the message from their UI
                        broadcast({ type: 'messageDeleted', id: id });
                    }
                } catch (err) {
                    console.error('Error deleting message:', err);
                }
                break;    
        }
    });

    ws.on('close', () => {
        if (ws.user) {
            clients.delete(ws.user.name);
            console.log(`${ws.user.name} disconnected.`);
            broadcastOnlineUsers();
        }
    });

    ws.on('error', (error) => console.error('WebSocket error:', error));
});

function broadcast(message) {
    const data = JSON.stringify(message);
    for (const clientData of clients.values()) {
        if (clientData && clientData.ws && clientData.ws.readyState === WebSocket.OPEN) {
            clientData.ws.send(data);
        }
    }
}

server.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});