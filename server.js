const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const Message = require('./models/message');

const app = express();
const port = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json({ limit: '10mb' })); // For handling large base64 images
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

// Use a Map to store connected clients: { username -> { ws, role } }
const clients = new Map();

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

        const senderInfo = clients.get(parsedMessage.username);

        switch(parsedMessage.type) {
            case 'authenticate':
                clients.set(parsedMessage.username, { ws, role: parsedMessage.role });
                console.log(`${parsedMessage.username} (${parsedMessage.role}) authenticated.`);
                try {
                    const history = await Message.find().sort({ timestamp: -1 }).limit(50).exec();
                    ws.send(JSON.stringify({ type: 'history', data: history.reverse() }));
                } catch (err) { console.error('Error fetching history:', err); }
                break;

            case 'message':
                const newMessage = new Message({
                    username: parsedMessage.username,
                    text: parsedMessage.text,
                    image: parsedMessage.image
                });
                await newMessage.save();
                broadcast({ type: 'message', data: newMessage });
                break;

            case 'deleteMessage':
                if (!senderInfo) return;
                try {
                    const msgToDelete = await Message.findById(parsedMessage.id);
                    if (msgToDelete && (senderInfo.role === 'admin' || msgToDelete.username === parsedMessage.username)) {
                        await Message.findByIdAndDelete(parsedMessage.id);
                        broadcast({ type: 'messageDeleted', id: parsedMessage.id });
                    }
                } catch (err) { console.error('Error deleting message:', err); }
                break;
            
            case 'clearChat':
                if (senderInfo && senderInfo.role === 'admin') {
                    await Message.deleteMany({});
                    broadcast({ type: 'chatCleared' });
                    console.log(`Chat cleared by admin: ${parsedMessage.username}`);
                }
                break;
        }
    });

    ws.on('close', () => {
        // Find and remove the client from the map on disconnect
        for (let [username, clientData] of clients.entries()) {
            if (clientData.ws === ws) {
                clients.delete(username);
                console.log(`${username} disconnected.`);
                break;
            }
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

/**
 * Broadcasts a message to all connected and authenticated clients.
 * This function is now more robust to prevent crashes.
 * @param {object} message - The message object to broadcast.
 */
function broadcast(message) {
    const data = JSON.stringify(message);
    for (const clientData of clients.values()) {
        // --- SAFETY CHECK ---
        // Ensure the client data and WebSocket connection exist and are open before sending
        if (clientData && clientData.ws && clientData.ws.readyState === WebSocket.OPEN) {
            clientData.ws.send(data);
        }
    }
}

server.listen(port, () => {
    console.log(`Server is listening on http://localhost:${port}`);
});

