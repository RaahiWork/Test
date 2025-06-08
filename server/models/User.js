import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        lowercase: true, // Store username in lowercase
        minlength: [3, 'Username must be at least 3 characters long'],
        maxlength: [20, 'Username cannot exceed 20 characters'],
        match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
    },    displayName: {
        type: String,
        required: false, // Make it optional for migration
        trim: true,
        minlength: [3, 'Display name must be at least 3 characters long'],
        maxlength: [20, 'Display name cannot exceed 20 characters'],
        match: [/^[a-zA-Z0-9_]+$/, 'Display name can only contain letters, numbers, and underscores']
        // Remove the default function - we'll handle this in the server code
    },    avatarId: {
        type: String,
        unique: true,
        sparse: true, // Allow null values but require uniqueness when present
        default: null
    },
    avatarFormat: {
        type: String,
        enum: ['png', 'jpg', 'jpeg', 'gif'],
        default: null
    },
    avatarFilename: {
        type: String,
        default: null // Stores complete filename like "uuid.jpg"
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long']
    }
}, {
    timestamps: true // Adds createdAt and updatedAt fields
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) return next();
    
    try {
        // Hash password with cost of 12
        const hashedPassword = await bcrypt.hash(this.password, 12);
        this.password = hashedPassword;
        next();
    } catch (error) {
        next(error);
    }
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

// Static method to find user by username (now username is always lowercase)
userSchema.statics.findByUsername = function(username) {
    return this.findOne({ username: username.toLowerCase() });
};

// Transform output to remove password from JSON responses
userSchema.methods.toJSON = function() {
    const userObject = this.toObject();
    delete userObject.password;
    return userObject;
};

const User = mongoose.model('User', userSchema);

export default User;
