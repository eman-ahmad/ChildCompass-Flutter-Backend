const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({

    chatId: {
        type: String,
    },

    senderId: {
        type: String,
        ref: 'Parent',
        required: true
    },
    receiverId: {
        type: String,
        ref: 'Parent',
        required: true
    },
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },
    read: {
        type: Boolean,
        default: false
    },
    // Additional metadata
    fcmDelivered: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: { 
        createdAt: 'timestamp', // Uses your preferred field name
        updatedAt: false        // Disabled since we don't need it
    }
});

// Pre-save hook to ensure consistent chatId format
MessageSchema.pre('save', function(next) {
    if (!this.chatId) {
        const participants = [this.senderId, this.receiverId]
            .map(id => id.toString())
            .sort();
        this.chatId = participants.join('_');
    }
    next();
});

// Indexes for optimal performance
MessageSchema.index({ chatId: 1, timestamp: -1 }); // For fetching chat history
MessageSchema.index({ senderId: 1, timestamp: -1 }); // For sender-specific queries
MessageSchema.index({ receiverId: 1, read: 1 }); // For unread message counts

// Static method to mark messages as read
MessageSchema.statics.markAsRead = async function(chatId, receiverId) {
    return this.updateMany(
        {
            chatId,
            receiverId,
            read: false
        },
        {
            $set: {
                read: true,
                readAt: new Date()
            }
        }
    );
};

// Static method to get unread count for a user
MessageSchema.statics.getUnreadCount = async function(receiverId) {
    return this.countDocuments({
        receiverId,
        read: false
    });
};

module.exports = mongoose.model('Message', MessageSchema);