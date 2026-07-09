const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { signup, login, changePassword, forgotPassword, resetPassword, getProfile, updateProfile } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Validation middleware for password policy
const passwordValidation = [
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/[!@#$%^&*(),.?":{}|<>]/)
        .withMessage('Password must contain at least one special character')
        .matches(/[0-9]/)
        .withMessage('Password must contain at least one number')
        .matches(/[A-Z]/)
        .withMessage('Password must contain at least one uppercase letter')
];

// Helper to check validation results
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

router.post('/signup', ...passwordValidation, validate, signup);
router.post('/login', login);
router.post('/change-password', protect, body('newPassword').custom((value, { req }) => {
    // Re-use password validation for newPassword
    if (value.length < 8) throw new Error('Password must be at least 8 characters long');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) throw new Error('Password must contain at least one special character');
    if (!/[0-9]/.test(value)) throw new Error('Password must contain at least one number');
    if (!/[A-Z]/.test(value)) throw new Error('Password must contain at least one uppercase letter');
    return true;
}), validate, changePassword);

router.post('/forgot-password', forgotPassword);
router.post('/reset-password', body('newPassword').custom((value) => {
    if (value.length < 8) throw new Error('Password must be at least 8 characters long');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) throw new Error('Password must contain at least one special character');
    if (!/[0-9]/.test(value)) throw new Error('Password must contain at least one number');
    if (!/[A-Z]/.test(value)) throw new Error('Password must contain at least one uppercase letter');
    return true;
}), validate, resetPassword);

// Profile routes
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);

module.exports = router;
