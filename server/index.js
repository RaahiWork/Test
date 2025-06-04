import express from 'express'
import { Server } from "socket.io"
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'
import dotenv from 'dotenv'
import connectDB from './config/database.js'
import User from './models/User.js'

// Load environment variables
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3500
const ADMIN = "System"

const app = express()

// Connect to MongoDB
connectDB()

// Add JSON parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Add CORS middleware before other routes - hardcode the specific origin
app.use((req, res, next) => {
    // Hardcode the origin for the specific client
    res.header('Access-Control-Allow-Origin', 'http://127.0.0.1:5500');
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
        console.warn('No emojis found. Add emoji images to:', emojisPath);
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
        );
        await fs.writeFile(placeholderPath, transparentGif);
    }
} catch (error) {
    console.error('Error ensuring directories exist:', error);
}

// Expose the public directory
app.use(express.static(publicPath));

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
        console.error('Error reading emoji directory:', error);
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
        
        // console.log('Saved user:', {
        //     id: user._id,
        //     username: user.username,
        //     displayName: user.displayName
        // });
        
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
        console.error('Registration error details:', error);
        if (error.name === 'ValidationError') {
            const errorMessages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ 
                error: 'Validation failed',
                details: errorMessages 
            });
        }
        
        console.error('Registration error:', error);
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
        console.error('Login error:', error);
        res.status(500).json({ 
            error: 'Internal server error during login' 
        });
    }
});

// Get all users endpoint (for admin purposes)
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}, 'username displayName createdAt').sort({ createdAt: -1 });
        res.json({
            count: users.length,
            users
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ 
            error: 'Failed to fetch users' 
        });
    }
});

const expressServer = app.listen(PORT, () => {
    //console.log(`🚀 Server running on port ${PORT}`)
})

// state 
const UsersState = {
    users: [],
    setUsers: function (newUsersArray) {
        this.users = newUsersArray
    }
}

// --- Room message history ---
const roomMessages = {};
const MAX_ROOM_HISTORY = 50;

const io = new Server(expressServer, {
    cors: {
        origin: process.env.NODE_ENV === "production" ? false : ["http://localhost:5500", "http://127.0.0.1:5500"]
    },
    pingTimeout: 60000, // Increase ping timeout to 60 seconds
    pingInterval: 25000 // Check connection every 25 seconds
})

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
    socket.on('privateMessage', ({ fromUser, toUser, text, image = null, voice = null }) => {
        //console.log('Private message received:', { fromUser, toUser, text: text ? 'Text message' : null, image: image ? 'Image data' : null });
        
        // Find the target user's socket
        const targetUser = UsersState.users.find(user => user.name === toUser);
        
        if (targetUser) {
            const messageData = {
                fromUser,
                toUser,
                text,
                image,
                voice,
                time: new Intl.DateTimeFormat('default', {
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                }).format(new Date())
            };
            
            // Send message to target user
            io.to(targetUser.id).emit('privateMessage', messageData);
            
            // Send confirmation back to sender
            socket.emit('privateMessageSent', messageData);
            
            //console.log(`Private message sent from ${fromUser} to ${toUser}`);
        } else {
            // User not found or offline
            //console.log(`User ${toUser} not found or offline`);
            socket.emit('privateMessageError', {
                error: `User ${toUser} is not online`,
                toUser
            });
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
    });

    // Listening for a message event 
    socket.on('message', ({ name, text }) => {
        const room = getUser(socket.id)?.room
        if (room) {
            const msg = buildMsg(name, text);
            // Store in room history
            if (!roomMessages[room]) roomMessages[room] = [];
            roomMessages[room].push(msg);
            if (roomMessages[room].length > MAX_ROOM_HISTORY) {
                roomMessages[room].splice(0, roomMessages[room].length - MAX_ROOM_HISTORY);
            }
            io.to(room).emit('message', msg)
        }
    });

    // Add handler for image messages
    socket.on('imageMessage', ({ name, image }) => {
        const room = getUser(socket.id)?.room;
        if (room) {
            // Validate image data format
            if (!image || !image.startsWith('data:image/')) {
                console.error('Invalid image data format');
                socket.emit('message', buildMsg(ADMIN, "Invalid image format. Please try again."));
                return;
            }
            try {
                const msg = buildMsg(name, null, image);
                // Store in room history
                if (!roomMessages[room]) roomMessages[room] = [];
                roomMessages[room].push(msg);
                if (roomMessages[room].length > MAX_ROOM_HISTORY) {
                    roomMessages[room].splice(0, roomMessages[room].length - MAX_ROOM_HISTORY);
                }
                io.to(room).emit('message', msg);
            } catch (error) {
                console.error('Error sending image message:', error);
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
            }
            try {
                const msg = buildMsg(name, null, null, voice);
                // Store in room history
                if (!roomMessages[room]) roomMessages[room] = [];
                roomMessages[room].push(msg);
                if (roomMessages[room].length > MAX_ROOM_HISTORY) {
                    roomMessages[room].splice(0, roomMessages[room].length - MAX_ROOM_HISTORY);
                }
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