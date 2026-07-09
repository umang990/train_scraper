const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 8
    },
    // Profile Fields
    firstName: { type: String, trim: true, default: '' },
    lastName: { type: String, trim: true, default: '' },
    gender: { type: String, enum: ['Male', 'Female', 'Other', ''], default: '' },
    dob: { type: String, default: '' },
    nationality: { type: String, default: 'Indian' },
    maritalStatus: { type: String, enum: ['Single', 'Married', ''], default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    // Documents
    passportNo: { type: String, trim: true, default: '' },
    passportExpiry: { type: String, default: '' },
    issuingCountry: { type: String, default: '' },
    panCard: { type: String, trim: true, default: '' },

    resetPasswordToken: String,
    resetPasswordExpires: Date
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function() {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
