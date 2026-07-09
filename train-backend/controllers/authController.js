const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
        expiresIn: '30d',
    });
};

// @desc    Register a new user
// @route   POST /api/auth/signup
const signup = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Please add all fields' });
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
        return res.status(400).json({ message: 'User already exists' });
    }

    try {
        // Create user
        const user = await User.create({
            email,
            password
        });

        if (user) {
            res.status(201).json({
                _id: user.id,
                email: user.email,
                token: generateToken(user._id),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        console.error("Signup error STACK:", error.stack);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
const login = async (req, res) => {
    const { email, password } = req.body;

    // Check for user email
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
        res.json({
            _id: user.id,
            email: user.email,
            token: generateToken(user._id),
        });
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
};

// @desc    Change password
// @route   POST /api/auth/change-password
const changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        return res.status(400).json({ message: 'Please provide old and new passwords' });
    }

    try {
        const user = await User.findById(req.user._id);

        if (user && (await user.matchPassword(oldPassword))) {
            user.password = newPassword; // the pre-save hook handles hashing
            await user.save();
            res.json({ message: 'Password changed successfully' });
        } else {
            res.status(401).json({ message: 'Invalid old password' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Forgot password (dummy token generation for now)
// @route   POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate a random token
        const resetToken = Math.random().toString(36).substring(2, 15);
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        await user.save();
        
        // In a real app, send this via email. We'll return it for testing purposes.
        res.json({ message: 'Password reset token generated', resetToken });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
const updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            user.firstName = req.body.firstName || user.firstName;
            user.lastName = req.body.lastName || user.lastName;
            user.gender = req.body.gender || user.gender;
            user.dob = req.body.dob || user.dob;
            user.nationality = req.body.nationality || user.nationality;
            user.maritalStatus = req.body.maritalStatus || user.maritalStatus;
            user.city = req.body.city || user.city;
            user.state = req.body.state || user.state;
            user.passportNo = req.body.passportNo || user.passportNo;
            user.passportExpiry = req.body.passportExpiry || user.passportExpiry;
            user.issuingCountry = req.body.issuingCountry || user.issuingCountry;
            user.panCard = req.body.panCard || user.panCard;

            const updatedUser = await user.save();
            res.json({
                _id: updatedUser.id,
                email: updatedUser.email,
                firstName: updatedUser.firstName,
                lastName: updatedUser.lastName,
                message: 'Profile updated successfully'
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    signup,
    login,
    changePassword,
    forgotPassword,
    resetPassword,
    getProfile,
    updateProfile
};
