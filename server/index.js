import express from 'express'
import { Server } from "socket.io"
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3500
const ADMIN = "Admin"

const app = express()

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

// Remove console logs for normal operations - only keep error logs

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

const expressServer = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
})

// state 
const UsersState = {
    users: [],
    setUsers: function (newUsersArray) {
        this.users = newUsersArray
    }
}

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
            io.to(room).emit('message', buildMsg(name, text))
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
                // Send to everyone in the room including sender
                io.to(room).emit('message', buildMsg(name, null, image));
            } catch (error) {
                console.error('Error sending image message:', error);
                socket.emit('message', buildMsg(ADMIN, `Error sending image: ${error.message}`));
            }
        } else {
            socket.emit('message', buildMsg(ADMIN, "You must join a room before sending images"));
        }
    });
    
    // Listen for activity 
    socket.on('activity', (name) => {
        const room = getUser(socket.id)?.room
        if (room) {
            socket.broadcast.to(room).emit('activity', name)
        }
    });
});

function buildMsg(name, text, image = null) {
    return {
        name,
        text,
        image, // Add image to the message object
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
    UsersState.setUsers([
        user,
        ...UsersState.users.filter(user => user.id !== id),
    ])
    return user
}

function userLeavesApp(id) {
    UsersState.setUsers(
        UsersState.users.filter(user => user.id !== id)
    );
}

function getUser(id) {
    return UsersState.users.find(user => user.id === id);
}

function getUsersInRoom(room) {
    return UsersState.users.filter(user => user.room === room);
}

function getAllActiveRooms() {
    return Array.from(new Set(UsersState.users.map(user => user.room)));
}