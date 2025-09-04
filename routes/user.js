// routes/user.js
const express = require('express');
const router = express.Router();
const User = require('../models/user');
const authenticateToken = require('../middlewares/authMiddleware');

// Get a user's profile information
router.get('/:name', authenticateToken, async (req, res) => {
    try {
        // Find user by name, but exclude the password from the result
        const user = await User.findOne({ name: req.params.name }).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Server error while fetching profile.' });
    }
});

// Update the current user's profile picture
router.post('/picture', authenticateToken, async (req, res) => {
    try {
        const { picture } = req.body;

        // --- ADDED: Basic validation for base64 image data ---
        if (!picture || !picture.startsWith('data:image/')) {
            return res.status(400).json({ error: 'Invalid image data provided.' });
        }

        await User.findOneAndUpdate({ name: req.user.name }, { profilePicture: picture });
        res.json({ message: 'Profile picture updated successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update profile picture.' });
    }
});

// --- CORRECTED: Update User Profile (Email ONLY) ---
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        // Only allow the email to be updated. The name is now fixed.
        const { email } = req.body;
        const loggedInUser = req.user;

        if (!email) {
            return res.status(400).json({ error: 'Email is required.' });
        }

        const userToUpdate = await User.findOne({ name: loggedInUser.name });
        if (!userToUpdate) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // --- CHANGED: Only the email is updated ---
        userToUpdate.email = email;

        await userToUpdate.save();
        
        // --- CHANGED: Return the full updated user object (minus password) ---
        const updatedUserResponse = {
            _id: userToUpdate._id,
            name: userToUpdate.name,
            email: userToUpdate.email,
            dob: userToUpdate.dob,
            joined: userToUpdate.joined,
            profilePicture: userToUpdate.profilePicture,
            role: userToUpdate.role
        };

        res.json({ 
            message: 'Profile updated successfully.', 
            user: updatedUserResponse 
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'This email is already taken.' });
        }
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});

module.exports = router;

