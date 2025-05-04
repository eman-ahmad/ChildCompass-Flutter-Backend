const express = require('express');
const Message = require('../models/message'); // Your message model
const Parent = require('../models/parent'); // Your parent model
const Child = require('../models/child');
const router = express.Router();
const admin = require('../config/firebase-admin'); 


// Send message endpoint
router.post('/send', async (req, res) => {

    try {
        console.log('[DEBUG] Received request to /send with body:', req.body);
        
        const { senderId, receiverId, content ,senderName } = req.body;

        // Validate input
        if (!senderId || !receiverId || !content) {
            console.log('[DEBUG] Validation failed - missing required fields:', {
                senderIdPresent: !!senderId,
                receiverIdPresent: !!receiverId,
                contentPresent: !!content
            });
            return res.status(400).json({ error: 'Missing required fields' });
        }

        console.log('[DEBUG] Creating new message with:', { senderId, receiverId, content });
        
        // Create and save message
        const message = new Message({
            senderId,
            receiverId,
            content
        });
        await message.save();
        console.log('[DEBUG] Message saved successfully with ID:', message._id);

        // Get receiver's FCM token
        console.log('[DEBUG] Looking up receiver with email:', receiverId);
        var receiver = await Parent.findOne({ email:receiverId });
        
        if (!receiver) {
            console.log('[DEBUG] Receiver not found as Parent, trying as Child with connectionString:', receiverId);
            receiver = await Child.findOne({ connectionString:receiverId });
            
            if(!receiver) {
                console.log('[DEBUG] Receiver not found as either Parent or Child');
                return res.status(404).json({ error: 'Receiver not found' });
            }   
        }
        
        console.log('[DEBUG] Found receiver:', {
            type: receiver.constructor.modelName, // Shows if Parent or Child
            fcmTokenPresent: !!receiver.fcm,
            fcmToken: receiver.fcm ? '(exists)' : 'null'
        });

        // Send push notification if FCM token exists
        if (receiver.fcm && receiver.fcm.trim() !== '') {
            console.log('[DEBUG] Valid FCM token found, attempting to send notification');
            
            try {
                const notificationPayload = {
                    token: receiver.fcm,
                    notification: {
                        title: `New message from ${senderName}`,
                        body: content.length > 30 ? content.substring(0, 30) + '...' : content
                    },
                    data: {
                        type: 'message',
                        messageId: message._id.toString(),
                        chatId: message.chatId,
                        senderId: senderId,
                        content:content
                    }
                };
                
                console.log('[DEBUG] Sending FCM payload:', notificationPayload);
                
                await admin.messaging().send(notificationPayload);
                console.log('[DEBUG] FCM notification sent successfully');
                
                // Update message FCM status
                message.fcmDelivered = true;
                await message.save();
                console.log('[DEBUG] Updated message FCM status to delivered');
            } catch (fcmError) {
                console.error('[DEBUG] FCM error:', {
                    error: fcmError,
                    stack: fcmError.stack,
                    message: fcmError.message
                });
                // Continue even if FCM fails - message is still saved
            }
        } else {
            console.log('[DEBUG] No valid FCM token available, skipping notification');
        }

        console.log('[DEBUG] Sending success response with message:', message);
        res.status(201).json(message);
    } catch (error) {
        console.error('[DEBUG] Error in /send endpoint:', {
            error: error,
            stack: error.stack,
            message: error.message
        });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get chat history endpoint
router.get('/history', async (req, res) => {
    console.log("Chat History Endpoint Hit...");
    try {
        const { user1, user2 } = req.query;
        
        if (!user1 || !user2) {
            return res.status(400).json({ error: 'Missing user IDs' });
        }

        const chatId = [user1, user2].sort().join('_');
        const messages = await Message.find({ chatId })
                                    .sort({ timestamp: -1 })
                                    .limit(100); // Get last 100 messages

        res.json(messages.reverse()); // Return oldest first
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Mark messages as read endpoint
router.post('/mark-read', async (req, res) => {
    try {
        const { chatId, userId } = req.body;

        if (!chatId || !userId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const result = await Message.updateMany(
            { 
                chatId,
                receiverId: userId,
                read: false 
            },
            { 
                $set: { 
                    read: true,
                    readAt: new Date() 
                } 
            }
        );

        res.json({ updatedCount: result.modifiedCount });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get unread message count
router.get('/unread-count/:userId', async (req, res) => {
    try {
        const count = await Message.countDocuments({
            receiverId: req.params.userId,
            read: false
        });

        res.json({ count });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;