// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const JWT_SECRET = process.env.JWT_SECRET;

router.post('/signup', async (req, res) => {
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

router.post('/login', async (req, res) => {
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

router.post('/check-user', async (req, res) => {
    try {
        const { name, email } = req.body;
        const queryConditions = [];
        if (name && name.trim() !== '') queryConditions.push({ name: name.trim() });
        if (email && email.trim() !== '') queryConditions.push({ email: email.trim() });

        if (queryConditions.length === 0) {
            return res.status(200).json({ exists: false });
        }
        
        const user = await User.findOne({ $or: queryConditions });
        res.status(200).json({ exists: !!user });
    } catch (error) {
        res.status(500).json({ error: 'Server error during user check.' });
    }
});

module.exports = router;
