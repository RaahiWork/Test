import express from 'express'
import { Server } from "socket.io"
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'
import dotenv from 'dotenv'
import connectDB from './config/database.js'
import User from './models/User.js'
import mongoose from 'mongoose'
// --- Add AWS SDK v3 imports ---
import { S3Client, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3'
// --- Chat state management ---
import chatState from './chatState.js'

// Load environment variables
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3500
const ADMIN = "System"

const app = express()

// Connect to MongoDB
connectDB()

// --- AWS S3 CONFIGURATION ---
// (Set these in your .env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET)
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// Utility to list and log S3 bucket files
async function logS3BucketFiles() {
    const bucket = process.env.AWS_S3_BUCKET || 'vybchat-media';
    if (!bucket) {
        return;
    }
    try {
        const command = new ListObjectsV2Command({ Bucket: bucket });
        const data = await s3Client.send(command);
    } catch (err) {
        //
    }
}

// Utility to log a user's avatar PNG file in S3 (avatars/{username}/{username}.png)
async function logUserAvatar(username) {
    const bucket = process.env.AWS_S3_BUCKET || 'vybchat-media';
    if (!bucket) {
        return;
    }
    if (!username) {
        return;
    }
    const key = `avatars/${username}/${username}.png`;
    try {
        const command = new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: key
        });
        const data = await s3Client.send(command);
    } catch (err) {
        //
    }
}

// Add JSON parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Add CORS middleware before other routes - allow all origins for simplicity since we serve static files
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Use platform-independent path resolution with __dirname
const publicPath = path.join(__dirname, "public");
const emojisPath = path.join(publicPath, 'emojis');
const imagesPath = path.join(publicPath, 'images');

// Ensure both emojis and images directories exist
try {
    // Create the emojis directory if it doesn't exist
    await fs.mkdir(emojisPath, { recursive: true });
    
    // Create the images directory if it doesn't exist
    await fs.mkdir(imagesPath, { recursive: true });
      // Check if emojis directory is empty
    const files = await fs.readdir(emojisPath);
    if (files.length === 0) {
        //
    }
    
    // Ensure placeholder.gif exists in images directory
    const placeholderPath = path.join(imagesPath, 'placeholder.gif');
    try {
        await fs.access(placeholderPath);
    } catch {
        // Write a 1x1 transparent GIF if not present
        const transparentGif = Buffer.from(
            "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
            "base64"
        );        await fs.writeFile(placeholderPath, transparentGif);
    }
} catch (error) {
    //
}

// Expose the public directory
app.use(express.static(publicPath));



// --- Log S3 files on server startup ---
logS3BucketFiles();

// --- Log only admin user's avatar on server startup ---
logUserAvatar('admin');

// Add endpoint to list available emojis with minimal logging
app.get('/api/emojis', async (req, res) => {
    try {
        // Check if directory exists, if not create it
        try {
            await fs.access(emojisPath);
        } catch (error) {
            await fs.mkdir(emojisPath, { recursive: true });
            return res.json([]);
        }
        
        // Read directory contents
        const files = await fs.readdir(emojisPath);
        
        // Filter to include only image files
        const imageFiles = files.filter(file => {
            const extension = path.extname(file).toLowerCase();
            return ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(extension);
        });        
        res.json(imageFiles);
    } catch (error) {
        //
        res.status(500).json({ error: 'Failed to load emojis', details: error.message });
    }
});

// User authentication endpoints
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Validate input
        if (!username || !password) {
            return res.status(400).json({ 
                error: 'Username and password are required' 
            });
        }
        
        // Check if user already exists (case-insensitive check)
        const existingUser = await User.findByUsername(username);
        if (existingUser) {
            return res.status(409).json({ 
                error: 'Username already taken' 
            });
        }
        
        // Create new user - store username in lowercase, preserve original case in displayName
        const trimmedUsername = username.trim();
        
        const user = new User({
            username: trimmedUsername.toLowerCase(), // Store in lowercase
            displayName: trimmedUsername, // Preserve original case
            password
        });
        
        await user.save();
        
        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: user._id,
                username: user.username,
                displayName: user.displayName, // Return the display name with preserved case
                createdAt: user.createdAt
            }
        });
          } catch (error) {
        //
        if (error.name === 'ValidationError') {
            const errorMessages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ 
                error: 'Validation failed',
                details: errorMessages 
            });
        }
        
        //
        res.status(500).json({ 
            error: 'Internal server error during registration' 
        });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Validate input
        if (!username || !password) {
            return res.status(400).json({ 
                error: 'Username and password are required' 
            });
        }
        
        // Find user
        const user = await User.findByUsername(username);
        if (!user) {
            return res.status(401).json({ 
                error: 'Invalid username or password' 
            });
        }
        
        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({ 
                error: 'Invalid username or password' 
            });
        }
        
        res.json({
            message: 'Login successful',
            user: {
                id: user._id,
                username: user.username,
                displayName: user.displayName, // Return the display name with preserved case
                createdAt: user.createdAt
            }
        });        
    } catch (error) {
        //
        res.status(500).json({ 
            error: 'Internal server error during login' 
        });
    }
});

// Get all users endpoint (for admin purposes)
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}, 'username displayName createdAt').sort({ createdAt: -1        });
        res.json({
            count: users.length,
            users
        });
    } catch (error) {
        //
        res.status(500).json({ 
            error: 'Failed to fetch users' 
        });
    }
});

// Add endpoint to search users by username (case-insensitive, partial match)
app.get('/api/search-users', async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        if (!q) return res.json({ users: [] });
        // Find users whose username or displayName contains the query (case-insensitive)
        const users = await User.find({
            $or: [
                { username: { $regex: q, $options: 'i' } },
                { displayName: { $regex: q, $options: 'i' } }
            ]
        }, 'username displayName createdAt').limit(20);
        // Always return displayName if available, else username
        const usersWithDisplayName = users.map(u => ({
            username: u.username,
            displayName: u.displayName || u.username,
            createdAt: u.createdAt
        }));
        res.json({ users: usersWithDisplayName });
    } catch (err) {
        res.status(500).json({ error: 'Failed to search users' });
    }
});

// --- Avatar upload endpoint ---
app.post('/api/avatar', async (req, res) => {
    //
    //
    //
    
    try {
        const { username, image } = req.body;
        //
        //
        
        if (!username || !image) {
            //
            return res.status(400).json({ error: 'Username and image are required.' });
        }
          // Validate base64 image
        const matches = image.match(/^data:image\/(png|jpeg|jpg|gif);base64,(.+)$/);
        if (!matches) {
            //
            return res.status(400).json({ error: 'Invalid image format.' });
        }
        
        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const bucket = process.env.AWS_S3_BUCKET || 'vybchat-media';
        
        //
        //
        //
        
        if (!bucket) {
            return res.status(500).json({ error: 'S3 bucket not configured.' });
        }
           // Ensure consistent username formatting - use lowercase for S3 path
        const normalizedUsername = username.toLowerCase();
        const key = `avatars/${normalizedUsername}/${normalizedUsername}.png`;
        //
        
        // Upload to S3
        const putCommand = new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: `image/png`,
        });
        
        //
        await s3Client.send(putCommand);
          // Return the S3 URL
        const s3Url = `https://${bucket}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${key}`;
        
        // Broadcast avatar update to all users in the same room as the uploader
        const uploadingUser = UsersState.users.find(user => user.name === username);
        if (uploadingUser && uploadingUser.room) {
            io.to(uploadingUser.room).emit('avatarUpdated', {
                username: username,
                avatarUrl: s3Url
            });
        }
        
        res.json({ success: true, url: s3Url });
    } catch (err) {
        //
        res.status(500).json({ error: 'Failed to upload avatar', details: err.message });
    }
});

const expressServer = app.listen(PORT, () => {
    //
})

// state 
const UsersState = {
    users: [],
    setUsers: function (newUsersArray) {
        this.users = newUsersArray
    }
}

// --- Room message history ---
const roomMessages = chatState.chatHistory;
const MAX_ROOM_HISTORY = 50;

const io = new Server(expressServer, {
    cors: {
        origin: process.env.NODE_ENV === "production" ? false : ["http://localhost:5500", "http://127.0.0.1:5500"]
    },
    pingTimeout: 60000, // Increase ping timeout to 60 seconds
    pingInterval: 25000 // Check connection every 25 seconds
})

// --- Private Message Model ---
const privateMessageSchema = new mongoose.Schema({
    fromUser: { type: String, required: true },
    toUser: { type: String, required: true },
    text: { type: String, default: null },
    image: { type: String, default: null },
    voice: { type: String, default: null },
    time: { type: Date, default: Date.now }
}, { timestamps: true });

const PrivateMessage = mongoose.models.PrivateMessage || mongoose.model('PrivateMessage', privateMessageSchema);

io.on('connection', socket => {
    // Upon connection - only to user 
    socket.emit('message', buildMsg(ADMIN, "Welcome to Vyb Chat!"))
    
    // Handle keepalive pings from clients
    socket.on('keepalive', () => {
        // No response needed, just keeps the connection active
    });
    
    // Add handler for getRooms event
    socket.on('getRooms', () => {
        // Send rooms list to the requesting client
        socket.emit('roomList', {
            rooms: getAllActiveRooms()
        });
    });

    // Add handler for private messages
    socket.on('privateMessage', async ({ fromUser, toUser, text, image = null, voice = null }) => {
        // Save to MongoDB
        try {
            await PrivateMessage.create({
                fromUser,
                toUser,
                text,
                image,
                voice,
                time: new Date()
            });

            // Keep only the latest 50 messages between these two users
            const allIds = await PrivateMessage.find({
                $or: [
                    { fromUser, toUser },
                    { fromUser: toUser, toUser: fromUser }
                ]
            })
            .sort({ time: -1 })
            .skip(50)
            .select('_id')
            .lean();

            if (allIds.length > 0) {
                const idsToDelete = allIds.map(m => m._id);            await PrivateMessage.deleteMany({ _id: { $in: idsToDelete } });
            }
        } catch (err) {
            //
        }

        const messageData = {
            fromUser,
            toUser,
            text,
            image,
            voice,
            time: new Date().toISOString()
        };

        // Try to deliver in real-time if user is online
        const targetUser = UsersState.users.find(user => user.name === toUser);
        if (targetUser) {
            io.to(targetUser.id).emit('privateMessage', messageData);
        }
        // Always send confirmation back to sender
        socket.emit('privateMessageSent', messageData);
    });

    // Fetch last 50 private messages between two users
    socket.on('getPrivateHistory', async ({ userA, userB }) => {
        try {
            const messages = await PrivateMessage.find({
                $or: [
                    { fromUser: userA, toUser: userB },
                    { fromUser: userB, toUser: userA }
                ]
            })
            .sort({ time: -1 })
            .limit(50)
            .lean();
            // Send in chronological order
            socket.emit('privateHistory', {
                userA,
                userB,
                messages: messages.reverse()        });
        } catch (err) {
            //
            socket.emit('privateHistory', { userA, userB, messages: [] });
        }
    });

    // Provide recent private chats for sidebar
    socket.on('getRecentPrivateChats', async ({ user }) => {
        try {
            // Find the most recent message for each unique chat partner
            const pipeline = [
                {
                    $match: {
                        $or: [
                            { fromUser: user },
                            { toUser: user }
                        ]
                    }
                },
                {
                    $sort: { time: -1 }
                },
                {
                    $group: {
                        _id: {
                            $cond: [
                                { $eq: ["$fromUser", user] },
                                "$toUser",
                                "$fromUser"
                            ]
                        },
                        lastMessage: { $first: "$$ROOT" }
                    }
                },
                {
                    $sort: { "lastMessage.time": -1 }
                }
            ];
            const results = await PrivateMessage.aggregate(pipeline);

            // Fetch displayNames for all chat partners
            const usernames = results.map(r => r._id);
            const usersInfo = await User.find(
                { username: { $in: usernames.map(u => u.toLowerCase()) } },
                'username displayName'
            ).lean();
            const userDisplayNameMap = {};
            usersInfo.forEach(u => {
                userDisplayNameMap[u.username] = u.displayName || u.username;
            });

            const chats = results.map(r => ({
                username: r._id,
                displayName: userDisplayNameMap[r._id.toLowerCase()] || r._id,
                lastMessage: r.lastMessage
            }));
            socket.emit('recentPrivateChats', { chats });        } catch (err) {
            //
            socket.emit('recentPrivateChats', { chats: [] });
        }
    });

    // Add handler for getting online users for private messaging
    socket.on('getOnlineUsers', () => {
        const currentUser = getUser(socket.id);
        if (currentUser) {
            // Get all online users except the current user
            const onlineUsers = UsersState.users
                .filter(user => user.name !== currentUser.name)
                .map(user => ({ name: user.name, room: user.room }));
            
            socket.emit('onlineUsers', onlineUsers);
        }    });

    // Add handler for getting user list for specific room
    socket.on('getUserList', ({ room }) => {
        const currentUser = getUser(socket.id);
        if (currentUser && room) {
            // Send updated user list for the specified room
            socket.emit('userList', {
                users: getUsersInRoom(room)
            });
        }
    });

    socket.on('enterRoom', ({ name, room }) => {
        // leave previous room 
        const prevRoom = getUser(socket.id)?.room

        if (prevRoom) {
            socket.leave(prevRoom)
            io.to(prevRoom).emit('message', buildMsg(ADMIN, `${name} has left the room`))
        }

        const user = activateUser(socket.id, name, room)

        // Cannot update previous room users list until after the state update in activate user 
        if (prevRoom) {
            io.to(prevRoom).emit('userList', {
                users: getUsersInRoom(prevRoom)
            })
        }

        // join room 
        socket.join(user.room)

        // To user who joined 
        socket.emit('message', buildMsg(ADMIN, `You have joined the ${user.room} chat room`))

        // Send last 50 messages to the user
        if (roomMessages[user.room]) {
            const lastMsgs = roomMessages[user.room].slice(-50);
            lastMsgs.forEach(msg => {
                socket.emit('message', msg);
            });
        }

        // To everyone else 
        socket.broadcast.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} has joined the room`))

        // Update user list for room 
        io.to(user.room).emit('userList', {
            users: getUsersInRoom(user.room)
        })

        // Update rooms list for everyone 
        io.emit('roomList', {
            rooms: getAllActiveRooms()
        })
    });

    // When user disconnects - to all others 
    socket.on('disconnect', () => {
        const user = getUser(socket.id)
        userLeavesApp(socket.id)

        if (user) {
            io.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} has left the room`))

            io.to(user.room).emit('userList', {
                users: getUsersInRoom(user.room)
            })

            io.emit('roomList', {
                rooms: getAllActiveRooms()
            })
        }
    });    // Listening for a message event 
    socket.on('message', ({ name, text }) => {
        const room = getUser(socket.id)?.room
        if (room) {
            const msg = buildMsg(name, text);
            // Store in room history using chatState
            chatState.addMessage(room, msg);
            io.to(room).emit('message', msg)
        }
    });

    // Add handler for image messages
    socket.on('imageMessage', ({ name, image }) => {
        const room = getUser(socket.id)?.room;
        if (room) {
            // Validate image data format
            if (!image || !image.startsWith('data:image/')) {            //
                socket.emit('message', buildMsg(ADMIN, "Invalid image format. Please try again."));
                return;
            }            try {
                const msg = buildMsg(name, null, image);
                // Store in room history using chatState
                chatState.addMessage(room, msg);
                io.to(room).emit('message', msg);
            } catch (error) {
                //
                socket.emit('message', buildMsg(ADMIN, `Error sending image: ${error.message}`));
            }
        } else {
            socket.emit('message', buildMsg(ADMIN, "You must join a room before sending images"));
        }
    });

    // Add handler for voice messages in chat rooms
    socket.on('voiceMessage', ({ name, voice }) => {
        const room = getUser(socket.id)?.room;
        if (room) {
            if (!voice || !voice.startsWith('data:audio/')) {
                socket.emit('message', buildMsg(ADMIN, "Invalid voice message format."));
                return;
            }            try {
                const msg = buildMsg(name, null, null, voice);
                // Store in room history using chatState
                chatState.addMessage(room, msg);
                io.to(room).emit('message', msg);
            } catch (error) {
                socket.emit('message', buildMsg(ADMIN, `Error sending voice message: ${error.message}`));
            }
        } else {
            socket.emit('message', buildMsg(ADMIN, "You must join a room before sending voice messages"));
        }
    });
    
    // Listen for activity 
    socket.on('activity', (name) => {
        const room = getUser(socket.id)?.room
        if (room) {
            socket.broadcast.to(room).emit('activity', name)
        }
    });

    // --- WebRTC signaling for private voice calls ---
    socket.on('voiceCallOffer', ({ from, to, offer }) => {
        const targetUser = UsersState.users.find(user => user.name === to);
        if (targetUser) {
            io.to(targetUser.id).emit('voiceCallOffer', { from, to, offer });
        }
    });

    socket.on('voiceCallAnswer', ({ from, to, answer }) => {
        const targetUser = UsersState.users.find(user => user.name === to);
        if (targetUser) {
            io.to(targetUser.id).emit('voiceCallAnswer', { from, to, answer });
        }
    });

    socket.on('voiceCallCandidate', ({ from, to, candidate }) => {
        const targetUser = UsersState.users.find(user => user.name === to);
        if (targetUser) {
            io.to(targetUser.id).emit('voiceCallCandidate', { from, to, candidate });
        }
    });

    socket.on('voiceCallEnd', ({ from, to }) => {
        const targetUser = UsersState.users.find(user => user.name === to);
        if (targetUser) {
            io.to(targetUser.id).emit('voiceCallEnd', { from, to });
        }
    });

    socket.on('voiceCallDeclined', ({ from, to }) => {
        const targetUser = UsersState.users.find(user => user.name === to);
        if (targetUser) {
            io.to(targetUser.id).emit('voiceCallDeclined', { from, to });
        }
    });

    // --- Add clearRoom event handler for Admin ---
    socket.on('clearRoom', ({ room }) => {
        // Only allow Admin to clear
        const user = getUser(socket.id);
        if (!user || user.name !== 'Admin') return;
        if (!roomMessages[room]) return;
        roomMessages[room] = [];
        io.to(room).emit('clearRoom');
    });
});

function buildMsg(name, text, image = null, voice = null) {
    return {
        name,
        text,
        image,
        voice,
        time: new Intl.DateTimeFormat('default', {
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
        }).format(new Date())
    }
}

// User functions 
function activateUser(id, name, room) {
    const user = { id, name, room }
    // Remove any existing user with the same ID first, then add the new user
    UsersState.setUsers([
        user,
        ...UsersState.users.filter(user => user.id !== id)
    ])
    return user
}

function userLeavesApp(id) {
    UsersState.setUsers(
        UsersState.users.filter(user => user.id !== id)
    )
}

function getUser(id) {
    return UsersState.users.find(user => user.id === id)
}

function getUsersInRoom(room) {
    // Filter users by room
    const usersInRoom = UsersState.users.filter(user => user.room === room)
    
    // Remove duplicates by name (case-insensitive) since username is now always lowercase
    const uniqueUsers = new Map()
    
    usersInRoom.forEach(user => {
        const lowerName = user.name.toLowerCase()
        
        if (!uniqueUsers.has(lowerName)) {
            uniqueUsers.set(lowerName, user)
        }
    })
    
    return Array.from(uniqueUsers.values())
}

function getAllActiveRooms() {
    return Array.from(new Set(UsersState.users.map(user => user.room)))
}

// Graceful shutdown - save chat history before exit
async function saveAndExit() {
    process.stdout.write('\x1b[33m💾 Saving chat history before shutdown...\x1b[0m\n');
    try {
        const backupPath = path.join(__dirname, 'chat-backup.json');
        await fs.writeFile(backupPath, JSON.stringify(chatState.chatHistory, null, 2));
        process.stdout.write('\x1b[32m✅ Chat history saved successfully\x1b[0m\n');
    } catch (err) {
        process.stderr.write('\x1b[31m❌ Failed to save chat history: ' + err.message + '\x1b[0m\n');
    }
    process.exit(0);
}

// Handle graceful shutdown
process.on('SIGINT', saveAndExit);
process.on('SIGTERM', saveAndExit);
process.on('SIGUSR2', saveAndExit); // For nodemon restarts