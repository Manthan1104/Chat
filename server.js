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

// Increase payload size limit for images
app.use(express.static('public'));
app.use(express.json({ limit: '10mb' }));


const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;

mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB connected successfully.'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Mongoose Schemas ---
const messageSchema = new mongoose.Schema({
    username: String,
    text: String,
    image: String, // Field for base64 encoded image
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    dob: { type: Date },
    joined: { type: Date, default: Date.now } // New field for join date
});
const User = mongoose.model('User', userSchema);

// --- Auth Middleware ---
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

// --- HTTP API Routes ---
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
        res.status(500).json({ error: 'An unexpected error occurred.' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { name, password } = req.body;
        const user = await User.findOne({ name });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ userId: user._id, name: user.name }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, name: user.name });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/check-user', async (req, res) => {
    try {
        const { name, email } = req.body;
        const queryConditions = [];
        if (name && name.trim() !== '') queryConditions.push({ name: name.trim() });
        if (email && email.trim() !== '') queryConditions.push({ email: email.trim() });
        if (queryConditions.length === 0) return res.status(200).json({ exists: false });
        const user = await User.findOne({ $or: queryConditions });
        res.status(200).json({ exists: !!user });
    } catch (error) {
        res.status(500).json({ error: 'Server error during user check.' });
    }
});

// New route to get user profile data
app.get('/api/user/:name', authenticateToken, async (req, res) => {
    try {
        const user = await User.findOne({ name: req.params.name }).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// --- WebSocket Server ---
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const clients = new Set();

wss.on('connection', async (ws) => {
    console.log('Client connected');
    clients.add(ws);

    try {
        const history = await Message.find().sort({ timestamp: 1 }).limit(50).exec();
        ws.send(JSON.stringify({ type: 'history', data: history }));
    } catch (err) {
        console.error('Error fetching chat history:', err);
    }

    ws.on('message', async (message) => {
        let parsedMessage;
        try {
            parsedMessage = JSON.parse(message);
        } catch (e) {
            return;
        }

        if (parsedMessage.type === 'message') {
            const newMessage = new Message({
                username: parsedMessage.username,
                text: parsedMessage.text,
                image: parsedMessage.image // Save image data
            });
            try {
                await newMessage.save();
            } catch (err) {
                console.error('Error saving message:', err);
            }
        }
        broadcast(JSON.stringify(parsedMessage), ws);
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

function broadcast(message, sender) {
    for (const client of clients) {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
}

server.listen(port, () => {
    console.log(`Server is listening on http://localhost:${port}`);
});
