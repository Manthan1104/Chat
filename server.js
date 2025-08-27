// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;

mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB connected successfully.'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Mongoose Schemas ---
const messageSchema = new mongoose.Schema({
    username: String,
    text: String,
    image: String,
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    dob: { type: Date },
    joined: { type: Date, default: Date.now },
    profilePicture: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' }
});
const User = mongoose.model('User', userSchema);

// --- Auth Middleware & API Routes ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

app.post('/api/signup', async (req, res) => {
    try {
        const { name, email, password, dob } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashedPassword, dob });
        await user.save();
        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Username or email already exists.' });
        }
        res.status(500).json({ error: 'An unexpected error occurred during registration.' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { name, password } = req.body;
        const user = await User.findOne({ name });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ userId: user._id, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, name: user.name, role: user.role });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

app.get('/api/user/:name', authenticateToken, async (req, res) => {
    try {
        const user = await User.findOne({ name: req.params.name }).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/user/picture', authenticateToken, async (req, res) => {
    try {
        const { picture } = req.body;
        await User.findOneAndUpdate({ name: req.user.name }, { profilePicture: picture });
        res.json({ message: 'Profile picture updated successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update profile picture.' });
    }
});

app.post('/api/check-user', async (req, res) => {
    try {
        const { name, email } = req.body;
        const queryConditions = [];
        if (name && name.trim() !== '') {
            queryConditions.push({ name: name.trim() });
        }
        if (email && email.trim() !== '') {
            queryConditions.push({ email: email.trim() });
        }
        if (queryConditions.length === 0) {
            return res.status(200).json({ exists: false });
        }
        const user = await User.findOne({ $or: queryConditions });
        res.status(200).json({ exists: !!user });
    } catch (error) {
        console.error("Check-user error:", error);
        res.status(500).json({ error: 'Server error during user check.' });
    }
});


// --- WebSocket Server ---
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const clients = new Map();

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', async (message) => {
        let parsedMessage;
        try {
            parsedMessage = JSON.parse(message);
        } catch (e) { return; }

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
                try {
                    const msgToDelete = await Message.findById(parsedMessage.id);
                    const senderInfo = clients.get(parsedMessage.username);
                    if (msgToDelete && (senderInfo.role === 'admin' || msgToDelete.username === parsedMessage.username)) {
                        await Message.findByIdAndDelete(parsedMessage.id);
                        broadcast({ type: 'messageDeleted', id: parsedMessage.id });
                    }
                } catch (err) { console.error('Error deleting message:', err); }
                break;
            
            case 'clearChat':
                try {
                    const senderInfo = clients.get(parsedMessage.username);
                    if (senderInfo && senderInfo.role === 'admin') {
                        await Message.deleteMany({});
                        broadcast({ type: 'chatCleared' });
                        console.log(`Chat cleared by admin: ${parsedMessage.username}`);
                    }
                } catch (err) { console.error('Error clearing chat:', err); }
                break;
        }
    });

    ws.on('close', () => {
        for (let [username, clientData] of clients.entries()) {
            if (clientData.ws === ws) {
                clients.delete(username);
                console.log(`${username} disconnected.`);
                break;
            }
        }
    });
});

function broadcast(message) {
    const data = JSON.stringify(message);
    for (const clientData of clients.values()) {
        if (clientData.ws.readyState === WebSocket.OPEN) {
            clientData.ws.send(data);
        }
    }
}

server.listen(port, () => {
    console.log(`Server is listening on http://localhost:${port}`);
});
