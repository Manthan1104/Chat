// routes/user.js
const express = require('express');
const router = express.Router();
const User = require('../models/user'); // We will create this model file next
const authenticateToken = require('../middlewares/authMiddleware');

// Get a user's profile information
// This is used for the profile page
router.get('/:name', authenticateToken, async (req, res) => {
    try {
        const user = await User.findOne({ name: req.params.name }).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Update the current user's profile picture
router.post('/picture', authenticateToken, async (req, res) => {
    try {
        const { picture } = req.body;
        // req.user.name comes from the decoded JWT in the middleware
        await User.findOneAndUpdate({ name: req.user.name }, { profilePicture: picture });
        res.json({ message: 'Profile picture updated successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update profile picture.' });
    }
});

module.exports = router;
