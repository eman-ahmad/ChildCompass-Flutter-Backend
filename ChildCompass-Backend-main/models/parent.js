const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const ParentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { 
        type: String, 
        unique: true, 
        required: true, 
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
    },
    
    verifiedEmail: { type: Boolean, default: false },
    password: { type: String, required: true },
    verificationCode: { type: String, required: false }, 
    verificationCodeExpiration: { type: Date, required: false },
    childConnectionStrings: [{ type: String }],  
    fcm: { type: String, default:'' },
});

ParentSchema.pre('save', async function (next) {
    try {
        if (this.isModified('password')) {
            const salt = await bcrypt.genSalt(10);
            this.password = await bcrypt.hash(this.password, salt);
        }
        next();
    } catch (err) {
        next(err);
    }
});


module.exports = mongoose.model('Parent', ParentSchema);
