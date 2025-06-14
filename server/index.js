import express from 'express'
import { Server } from "socket.io"
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'
import dotenv from 'dotenv'
import connectDB from './config/database.js'
import User from './models/User.js'
import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
// --- Add AWS SDK v3 imports ---
import { S3Client, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3'
import { fromInstanceMetadata, fromEnv } from '@aws-sdk/credential-providers'
// --- Chat state management ---
import chatState from './chatState.js'
import jwt from 'jsonwebtoken'
import { AccessToken } from 'livekit-server-sdk';
// --- AI Bot Manager ---
import AIBotManager from './ai-bots.js';
// --- Import logger ---
import logger from './utils/logger.js'

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
// For local/Render: Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY in .env
// For EC2: Use IAM roles (set EC2_ENV=true)
// For other cloud: Set AWS_REGION, AWS_S3_BUCKET as needed
const isEC2 = process.env.EC2_ENV === "true"
const hasEnvCreds = !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY

let credentialsProvider

if (isEC2) {
  // Use IAM role from EC2 metadata service
  credentialsProvider = fromInstanceMetadata()
} else if (hasEnvCreds) {
  // Use credentials from .env (Render or local)
  credentialsProvider = fromEnv()
} else {
  throw new Error("❌ No valid AWS credentials or IAM role found.")
}

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: credentialsProvider,
})

// Utility to list and log S3 bucket files
// async function logS3BucketFiles() {
//     const bucket = process.env.AWS_S3_BUCKET || 'vybchat-media';
//     if (!bucket) {
//         logger.warn('No S3 bucket configured for listing files');
//         return;
//     }
//     try {
//         const command = new ListObjectsV2Command({ Bucket: bucket });
//         const data = await s3Client.send(command);
//         logger.info(`S3 bucket ${bucket} contains ${data.Contents?.length || 0} files`);
//     } catch (err) {
//         logger.error('Failed to list S3 bucket files', err, { bucket });
//     }
// }

// Utility to log a user's avatar PNG file in S3 (avatars/{username}/{username}.png)
async function logUserAvatar(username) {
    const bucket = process.env.AWS_S3_BUCKET || 'vybchat-media';
    if (!bucket) {
        logger.warn('No S3 bucket configured for avatar check');
        return;
    }
    if (!username) {
        logger.warn('No username provided for avatar check');
        return;
    }
    const key = `avatars/${username}/${username}.png`;
    try {
        const command = new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: key
        });
        const data = await s3Client.send(command);
        if (data.Contents?.length > 0) {
            logger.info(`Avatar found for user ${username}`);
        } else {
            logger.info(`No avatar found for user ${username}`);
        }
    } catch (err) {
        logger.error(`Failed to check avatar for user ${username}`, err, { bucket, key });
    }
}

// Replace the generic logS3BucketFiles function with a more focused one
// that only checks the avatars directory we know we have access to
async function logAvatarsDirectory() {
    const bucket = process.env.AWS_S3_BUCKET || 'vybchat-media';
    if (!bucket) {
        logger.warn('No S3 bucket configured for checking avatars directory');
        return;
    }
    
    try {
        // Only list avatars directory with a limited number of objects
        const command = new ListObjectsV2Command({ 
            Bucket: bucket,
            Prefix: 'avatars/',
            MaxKeys: 20 // Limit to 20 objects for efficiency
        });
        
        const data = await s3Client.send(command);
        
        if (data.Contents && data.Contents.length > 0) {
            logger.info(`S3 avatars directory contains ${data.Contents.length} files`);
            
            // Only log the first few items if there are many
            if (data.Contents.length > 0) {
                const sampleKeys = data.Contents.slice(0, 3).map(item => item.Key);
                logger.debug('Sample avatar paths:', { sampleKeys });
            }
        } else {
            logger.warn('S3 avatars directory appears to be empty');
        }
    } catch (err) {
        logger.error('Failed to list avatars directory', err, { bucket, prefix: 'avatars/' });
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
// logS3BucketFiles();

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
        });          res.json(imageFiles);
    } catch (error) {
        //
        res.status(500).json({ error: 'Failed to load emojis', details: error.message });
    }
});

// Add endpoint to get feature flags and configuration
app.get('/api/config', (req, res) => {
    try {
        const config = {
            enableStream: process.env.EnableStream === 'true' || process.env.EnableStream === '1',
            version: '1.0.0'
        };
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get configuration' });
    }
});

// User authentication endpoints
app.post('/api/register', async (req, res) => {
    try {
        logger.info('Registration attempt', { ip: req.ip });
        const { username, password } = req.body;
        
        // Validate input
        if (!username || !password) {
            logger.warn('Registration failed: Missing username or password', { username: username || 'empty' });
            return res.status(400).json({ 
                error: 'Username and password are required' 
            });
        }
        
        // Check if username is reserved for AI bots
        const { default: AIBotManager } = await import('./ai-bots.js');
        const isAIReserved = AIBotManager.isReservedAIName(username);
        
        if (isAIReserved) {
            logger.warn('Registration attempt with reserved AI bot name', { username });
            return res.status(400).json({ 
                error: 'This username is reserved for AI assistants. Please choose a different username.' 
            });
        }
        
        // Check if user already exists (case-insensitive check)
        const existingUser = await User.findByUsername(username);
        if (existingUser) {
            logger.warn('Registration failed: Username already taken', { username });
            return res.status(409).json({ 
                error: 'Username already taken' 
            });
        }
        
        // Create new user - store username in lowercase, preserve original case in displayName
        const trimmedUsername = username.trim();
        logger.info('Creating new user', { username: trimmedUsername });
        
        const user = new User({
            username: trimmedUsername.toLowerCase(), // Store in lowercase
            displayName: trimmedUsername, // Preserve original case
            password
        });
        
        await user.save();
        logger.info('User registered successfully', { 
            userId: user._id, 
            username: user.username,
            displayName: user.displayName
        });
        
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
        logger.error('Registration error', error, { 
            errorName: error.name, 
            errorCode: error.code 
        });
        
        if (error.name === 'ValidationError') {
            const errorMessages = Object.values(error.errors).map(err => err.message);
            logger.warn('Validation error during registration', { details: errorMessages });
            return res.status(400).json({ 
                error: 'Validation failed',
                details: errorMessages 
            });
        }
        
        // Check for MongoDB duplicate key error
        if (error.name === 'MongoServerError' && error.code === 11000) {
            logger.error('MongoDB duplicate key error', error, {
                keyPattern: error.keyPattern,
                keyValue: error.keyValue
            });
            return res.status(409).json({ 
                error: 'Username already exists or duplicate key error',
                details: `Duplicate key: ${Object.keys(error.keyValue || {}).join(', ')}` 
            });
        }
        
        logger.error('Unhandled error during registration', error);
        res.status(500).json({ 
            error: 'Internal server error during registration',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
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
    try {
        const { username, image } = req.body;
        
        if (!username || !image) {
            logger.warn('Avatar upload missing required fields', { 
                hasUsername: !!username, 
                hasImage: !!image 
            });
            return res.status(400).json({ error: 'Username and image are required.' });
        }
        
        // Find the user in database
        const user = await User.findByUsername(username);
        if (!user) {
            logger.warn('Avatar upload for non-existent user', { username });
            return res.status(404).json({ error: 'User not found.' });
        }
        
        // Validate base64 image
        const matches = image.match(/^data:image\/(png|jpeg|jpg|gif);base64,(.+)$/);
        if (!matches) {
            logger.warn('Invalid image format for avatar upload', { username });
            return res.status(400).json({ error: 'Invalid image format.' });
        }
        
        const originalFormat = matches[1];
        const ext = originalFormat === 'jpeg' ? 'jpg' : originalFormat;
        const buffer = Buffer.from(matches[2], 'base64');
        const bucket = process.env.AWS_S3_BUCKET || 'vybchat-media';
        
        if (!bucket) {
            logger.error('S3 bucket not configured for avatar upload', null, { username });
            return res.status(500).json({ error: 'S3 bucket not configured.' });
        }
        
        // Generate or reuse avatar UUID
        let avatarId = user.avatarId;
        if (!avatarId) {
            avatarId = uuidv4();
            logger.debug('Generated new avatarId for user', { username, avatarId });
        } else {
            logger.debug('Reusing existing avatarId', { username, avatarId });
        }
        
        // Use username folder with UUID filename and original format preserved
        const normalizedUsername = username.toLowerCase();
        const key = `avatars/${normalizedUsername}/${avatarId}.${ext}`;
        
        logger.info('Uploading avatar to S3', { 
            username, 
            format: ext, 
            bucket, 
            key 
        });
        
        // Upload to S3
        const putCommand = new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: `image/${originalFormat}`,
        });
        
        await s3Client.send(putCommand);
        
        // Update user's avatar info in database
        user.avatarId = avatarId;
        user.avatarFormat = ext;
        user.avatarFilename = `${avatarId}.${ext}`;
        await user.save();
        
        logger.info('Avatar updated successfully', {
            username,
            avatarId,
            format: ext,
            filename: user.avatarFilename
        });
        
        // Return the S3 URL
        const s3Url = `https://${bucket}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${key}`;
        
        // Broadcast avatar update to all users in the same room as the uploader
        const uploadingUser = UsersState.users.find(user => user.name === username);
        if (uploadingUser && uploadingUser.room) {
            io.to(uploadingUser.room).emit('avatarUpdated', {
                username: username,
                avatarUrl: s3Url,
                avatarId: avatarId,
                format: ext, // Include format information for proper caching
                filename: `${avatarId}.${ext}`
            });
        }
        
        res.json({ 
            success: true, 
            url: s3Url,
            avatarId: avatarId,
            format: ext,
            filename: `${avatarId}.${ext}`
        });
    } catch (err) {
        logger.error('Avatar upload error', err, { 
            username: req.body?.username,
            errorCode: err.code,
            errorName: err.name
        });
        res.status(500).json({ error: 'Failed to upload avatar', details: err.message });
    }
});

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_SECRET_KEY;
const wsUrl = process.env.LIVEKIT_WS_URL;

// --- Get user avatar info endpoint ---
app.get('/api/user/:username/avatar', async (req, res) => {
    try {
        const { username } = req.params;
        
        if (!username) {
            return res.status(400).json({ error: 'Username is required.' });
        }
          // Find the user in database
        const user = await User.findByUsername(username);
        if (!user || !user.avatarId || !user.avatarFormat || !user.avatarFilename) {
            return;
        }
        
        const bucket = process.env.AWS_S3_BUCKET || 'vybchat-media';
        const normalizedUsername = username.toLowerCase();
        const s3Url = `https://${bucket}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/avatars/${normalizedUsername}/${user.avatarFilename}`;
        
        res.json({
            success: true,
            avatarUrl: s3Url,
            avatarId: user.avatarId,
            format: user.avatarFormat,
            filename: user.avatarFilename
        });
    } catch (err) {
        console.error('Get avatar info error:', err);
        res.status(500).json({ error: 'Failed to get avatar info', details: err.message });
    }
});

// --- Manual backup endpoint for remote servers ---
app.post('/api/backup', async (req, res) => {
    try {
        console.log('🔧 Manual backup requested via API');
        
        if (!chatState || !chatState.chatHistory) {
            return res.status(400).json({ error: 'No chat state available' });
        }
        
        const backupPath = path.join(__dirname, 'chat-backup.json');
        const timestampedBackupPath = path.join(__dirname, `chat-backup-manual-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
        
        const backupData = JSON.stringify(chatState.chatHistory, null, 2);
        await fs.writeFile(backupPath, backupData);
        await fs.writeFile(timestampedBackupPath, backupData);
        
        const messageCount = Object.values(chatState.chatHistory).reduce((total, roomMsgs) => total + (roomMsgs?.length || 0), 0);
        const roomCount = Object.keys(chatState.chatHistory).length;
        
        console.log(`✅ Manual backup completed: ${roomCount} rooms, ${messageCount} messages`);
        
        res.json({
            success: true,
            message: 'Backup completed successfully',
            stats: {
                rooms: roomCount,
                messages: messageCount,
                timestamp: new Date().toISOString()
            },
            files: {
                primary: backupPath,
                timestamped: timestampedBackupPath
            }
        });
    } catch (error) {
        console.error('❌ Manual backup failed:', error);
        res.status(500).json({ 
            error: 'Backup failed', 
            details: error.message 
        });
    }
});

// --- Health check endpoint ---
app.get('/api/health', (req, res) => {
    const messageCount = chatState?.chatHistory ? 
        Object.values(chatState.chatHistory).reduce((total, roomMsgs) => total + (roomMsgs?.length || 0), 0) : 0;
    const roomCount = chatState?.chatHistory ? Object.keys(chatState.chatHistory).length : 0;
    
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        platform: process.platform,
        pid: process.pid,
        stats: {
            rooms: roomCount,
            messages: messageCount,
            activeUsers: UsersState.users.length
        }
    });
});

// --- LiveKit Token Endpoint for Private Messaging ---
app.get('/api/livekit-token', async (req, res) => {
    //console.log('✅ AccessToken loaded:', typeof AccessToken);  // should print: function
  const { identity, room } = req.query;
  if (!identity || !room) {
    //console.log('[LiveKit] Missing identity or room in request:', req.query);
    return res.status(400).json({ error: 'identity and room are required' });
  }

  // Use environment variables for LiveKit credentials with fallback
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_SECRET_KEY;
  const wsUrl = process.env.LIVEKIT_WS_URL;

  //console.log('[LiveKit] Token generation request:');
  //console.log('  - Identity:', identity);
  //console.log('  - Room:', room);
  //console.log('  - API Key:', apiKey ? `${apiKey.substring(0, 8)}...` : 'NOT SET');
  //console.log('  - API Secret:', apiSecret ? `${apiSecret.substring(0, 8)}...` : 'NOT SET');
  //console.log('  - WS URL:', wsUrl);

  if (!apiKey || !apiSecret) {
    //console.log('[LiveKit] API key or secret not configured');
    return res.status(500).json({ error: 'LiveKit API key/secret not configured' });
  }

  try {
    //console.log('[LiveKit] Creating AccessToken...');
    
    // Create the AccessToken with detailed logging
    const at = new AccessToken(apiKey, apiSecret, {
      identity: identity,
      ttl: 600, // 10 minutes
    });
    
    //console.log('[LiveKit] AccessToken created successfully');
    //console.log('[LiveKit] Adding grants...');
    
    at.addGrant({
      room: room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
      //console.log('[LiveKit] Grants added successfully');
    //console.log('[LiveKit] Generating JWT token...');
    
    // Handle both Promise and direct string return from toJwt()
    let token = at.toJwt();
    
    // Check if toJwt() returned a Promise (newer SDK versions)
    if (token && typeof token === 'object' && typeof token.then === 'function') {
      //console.log('[LiveKit] toJwt() returned a Promise, awaiting...');
      token = await token;
    }
    
    //console.log('[LiveKit] JWT generation result:');
    //console.log('  - Token type:', typeof token);
    //console.log('  - Token length:', token ? token.length : 0);
    //console.log('  - Token preview:', token && token.length > 50 ? `${token.substring(0, 50)}...` : token || 'EMPTY/NULL');
    
    // Now token should be a string
    const tokenString = token || '';
    const tokenLength = tokenString.length;
    const tokenPreview = tokenLength > 50 ? `${tokenString.substring(0, 50)}...` : tokenString;
      //console.log('  - Token length:', tokenLength);
    //console.log('  - Token preview:', tokenPreview);
    
    if (!tokenString || typeof tokenString !== 'string' || tokenString.length < 10) {
      //console.error('[LiveKit] Generated token is empty or invalid:', token);
    //   console.error('[LiveKit] AccessToken object state:', {
    //     apiKey: apiKey ? 'SET' : 'NOT SET',
    //     apiSecret: apiSecret ? 'SET' : 'NOT SET',
    //     identity: identity,
    //     ttl: 600
    //   });
      return res.status(500).json({ 
        error: 'Failed to generate LiveKit token', 
        details: 'Token is empty or invalid',
        debug: {
          tokenType: typeof token,
          tokenLength: token ? token.length : 0,
          hasApiKey: !!apiKey,
          hasApiSecret: !!apiSecret,
          identity: identity,
          room: room
        }
      });
    }
      //console.log(`[LiveKit] ✅ Token generated successfully for identity=${identity}, room=${room}`);
    return res.json({ token: tokenString, wsUrl });
    
  } catch (err) {
    //console.error('[LiveKit] Error generating token:', err);
    //console.error('[LiveKit] Error stack:', err.stack);
    // console.error('[LiveKit] Error details:', {
    //   name: err.name,
    //   message: err.message,
    //   apiKey: apiKey ? 'SET' : 'NOT SET',
    //   apiSecret: apiSecret ? 'SET' : 'NOT SET',
    //   identity: identity,
    //   room: room
    // });
    return res.status(500).json({ 
      error: 'Error generating LiveKit token', 
      details: err.message,
      errorName: err.name,
      debug: {
        hasApiKey: !!apiKey,
        hasApiSecret: !!apiSecret,
        identity: identity,
        room: room
      }
    });
  }
});

// app.listen(PORT, () => {
//   console.log(`✅ LiveKit token server running at http://localhost:${PORT}`);
// });

const expressServer = app.listen(PORT, async () => {
    console.log(`🚀 VybChat server running on port ${PORT}`);
    console.log(`📊 Chat state initialized with ${Object.keys(chatState.chatHistory).length} rooms`);
    
    // Log current chat history status
    const totalMessages = Object.values(chatState.chatHistory).reduce((total, roomMsgs) => total + (roomMsgs?.length || 0), 0);
    console.log(`💬 Total messages in memory: ${totalMessages}`);
    
    // Check if backup files exist
    const backupPath = path.join(__dirname, 'chat-backup.json');
    try {
        fs.access(backupPath).then(() => {
            console.log(`📁 Backup file exists: ${backupPath}`);
        }).catch(() => {
            console.log(`📁 No existing backup file found`);
        });
    } catch (err) {
        console.log(`📁 Backup file check failed: ${err.message}`);
    }
    
    // Skip S3 bucket root access check completely to avoid AccessDenied errors
    // We'll only access specific paths we know we have permission for
    
    console.log(`🔄 Server ready for connections`);
})

// state 
const UsersState = {
    users: [],
    setUsers: function (newUsersArray) {
        this.users = newUsersArray
    }
}

// Track streaming users
const StreamingState = {
    streamingUsers: new Set(),
    addStreamer: function(username) {
        this.streamingUsers.add(username);
    },
    removeStreamer: function(username) {
        this.streamingUsers.delete(username);
    },
    isStreaming: function(username) {
        return this.streamingUsers.has(username);
    },
    getAllStreamers: function() {
        return Array.from(this.streamingUsers);
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

// --- Initialize AI Bot Manager ---
const aiBots = new AIBotManager(io, buildMsg, chatState);

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
    });    // Add handler for getting online users for private messaging
    socket.on('getOnlineUsers', () => {
        const currentUser = getUser(socket.id);
        if (currentUser) {
            // Get all online users except the current user
            const realUsers = UsersState.users
                .filter(user => user.name !== currentUser.name)
                .map(user => ({ name: user.name, room: user.room }));
            
            // Get AI bots for all active rooms
            const aiBotUsers = aiBots.getAllAIBotsAsUsers()
                .map(bot => ({ name: bot.name, room: bot.room, isAIBot: true }));
            
            // Combine real users and AI bots
            const onlineUsers = [...realUsers, ...aiBotUsers];
            
            socket.emit('onlineUsers', onlineUsers);
        }    });    // Add handler for getting user list for specific room
    socket.on('getUserList', ({ room }) => {
        const currentUser = getUser(socket.id);
        if (currentUser && room) {
            // Send updated user list for the specified room including AI bots
            socket.emit('userList', {
                users: getUsersInRoomWithAI(room)
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

        const user = activateUser(socket.id, name, room)        // Cannot update previous room users list until after the state update in activate user
        if (prevRoom) {
            io.to(prevRoom).emit('userList', {
                users: getUsersInRoomWithAI(prevRoom)
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
        }        // To everyone else 
        socket.broadcast.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} has joined the room`))

        // Update user list for room 
        io.to(user.room).emit('userList', {
            users: getUsersInRoomWithAI(user.room)
        })
        
        // Update rooms list for everyone 
        io.emit('roomList', {
            rooms: getAllActiveRooms()
        })        // AI Bot: Handle user joining a room
        aiBots.handleUserJoin(user.room, user.name);
    });

    // When user disconnects - to all others 
    socket.on('disconnect', () => {
        const user = getUser(socket.id)
        userLeavesApp(socket.id)

        if (user) {            // Remove from streaming users when they disconnect
            StreamingState.removeStreamer(user.name);
            
            io.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} has left the room`))
            
            io.to(user.room).emit('userList', {
                users: getUsersInRoomWithAI(user.room)
            })

            io.emit('roomList', {
                rooms: getAllActiveRooms()
            })

            // Broadcast updated streaming status
            io.emit('streamingUsersUpdate', {
                streamingUsers: StreamingState.getAllStreamers()
            });
        }    });// Listening for a message event 
    socket.on('message', ({ name, text }) => {
        const room = getUser(socket.id)?.room
        if (room) {
            const msg = buildMsg(name, text);
            // Store in room history using chatState
            chatState.addMessage(room, msg);
            io.to(room).emit('message', msg);
            
            // AI Bot: Handle incoming message
            aiBots.handleMessage(room, name, text);
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
    // [REMOVED] Manual WebRTC signaling events (voiceCallOffer, voiceCallAnswer, etc.)
    // All voice/video calls are now handled by LiveKit client SDK on the frontend for best quality.
    // Use the /api/livekit-token endpoint to obtain a JWT for joining a LiveKit room.

    // --- LiveKit private call signaling ---
    socket.on('privateVoiceCallRequest', ({ fromUser, toUser, roomName }) => {
        // Only send a simple alert/popup to the receiver, do not auto-join or auto-call
        const targetUser = UsersState.users.find(user => user.name === toUser);
        if (targetUser) {
            io.to(targetUser.id).emit('privateVoiceCallPopup', { fromUser, roomName });
        } else {
            // If the receiver is not online, notify the caller (optional UX improvement)
            const callerUser = UsersState.users.find(user => user.name === fromUser);
            if (callerUser) {
                io.to(callerUser.id).emit('privateVoiceCallUnavailable', { toUser });
            }
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
    });    // Handle streaming status updates
    socket.on('streamingStatusUpdate', ({ username, isStreaming }) => {
        if (isStreaming) {
            StreamingState.addStreamer(username);
        } else {
            StreamingState.removeStreamer(username);
        }
        
        // Broadcast updated streaming status to all users
        io.emit('streamingUsersUpdate', {
            streamingUsers: StreamingState.getAllStreamers()
        });
    });

    // Handle host leaving conference - disconnect all participants
    socket.on('hostLeftConference', ({ hostUsername, roomName }) => {
        //console.log(`[LiveKit] 🏠 Host ${hostUsername} left conference room: ${roomName}`);
        
        // Broadcast to all clients that the host left and they should disconnect
        io.emit('hostLeftConference', {
            hostUsername,
            roomName,
            message: `${hostUsername} has ended the conference. You will be disconnected.`
        });
        
        // Also remove from streaming state
        StreamingState.removeStreamer(hostUsername);
        io.emit('streamingUsersUpdate', {
            streamingUsers: StreamingState.getAllStreamers()
        });
    });

    // Send current streaming users when user connects
    socket.on('getStreamingUsers', () => {
        socket.emit('streamingUsersUpdate', {
            streamingUsers: StreamingState.getAllStreamers()
        });
    });
});

function buildMsg(name, text, image = null, voice = null) {
    return {
        name,
        text,
        image,
        voice,
        time: new Date().toISOString()
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
    
    // Remove duplicates by name (case-insensitive)
    const uniqueUsers = new Map()
    
    usersInRoom.forEach(user => {
        // The error happens here - sometimes user.username is undefined
        // Instead, we'll use user.name which is what's being used in socket handlers
        const lowerName = user.name ? user.name.toLowerCase() : null
        
        if (lowerName && !uniqueUsers.has(lowerName)) {
            uniqueUsers.set(lowerName, user)
        }
    })
    
    return Array.from(uniqueUsers.values())
}

// Helper function to get users in room including AI bots
function getUsersInRoomWithAI(room) {
    const realUsers = getUsersInRoom(room);
    const aiBot = aiBots.getAIBotForRoom(room);
    return aiBot ? [...realUsers, aiBot] : realUsers;
}

function getAllActiveRooms() {
    return Array.from(new Set(UsersState.users.map(user => user.room)))
}

// Graceful shutdown - save chat history before exit
async function saveAndExit() {
    console.log('================================');
    console.log('💾 STARTING GRACEFUL SHUTDOWN');
    console.log(`🕒 Timestamp: ${new Date().toISOString()}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📦 Platform: ${process.platform}`);
    console.log(`🔢 Process PID: ${process.pid}`);
    console.log('================================');
    process.stdout.write('\x1b[33m💾 Saving chat history before shutdown...\x1b[0m\n');
    console.log('💾 Saving chat history before shutdown...');
    
    try {
        // Ensure chatState exists and has data
        if (!chatState || !chatState.chatHistory) {
            console.log('⚠️ No chat state found, creating empty backup');
            chatState = { chatHistory: {} };
        }
        
        const backupPath = path.join(__dirname, 'chat-backup.json');
        const timestampedBackupPath = path.join(__dirname, `chat-backup-shutdown-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
        
        // Create both regular and timestamped backup
        const backupData = JSON.stringify(chatState.chatHistory, null, 2);
        
        // Log the data we're about to save
        const messageCount = Object.values(chatState.chatHistory).reduce((total, roomMsgs) => total + (roomMsgs?.length || 0), 0);
        const roomCount = Object.keys(chatState.chatHistory).length;
        console.log(`📊 Backup stats: ${roomCount} rooms, ${messageCount} total messages`);
        
        // Write files with error handling for each
        try {
            await fs.writeFile(backupPath, backupData);
            console.log(`✅ Primary backup written: ${backupPath}`);
        } catch (backupErr) {
            console.error(`❌ Failed to write primary backup: ${backupErr.message}`);
        }
        
        try {
            await fs.writeFile(timestampedBackupPath, backupData);
            console.log(`✅ Timestamped backup written: ${timestampedBackupPath}`);
        } catch (timestampErr) {
            console.error(`❌ Failed to write timestamped backup: ${timestampErr.message}`);
        }
        
        const logMessage = `✅ Chat history saved successfully - ${messageCount} messages backed up`;
        
        console.log('================================');
        console.log('✅ BACKUP COMPLETED');
        console.log('================================');
        process.stdout.write(`\x1b[32m${logMessage}\x1b[0m\n`);
        console.log(logMessage);
        console.log(`📂 Primary backup: ${backupPath}`);
        console.log(`📂 Timestamped backup: ${timestampedBackupPath}`);
        console.log('================================');
        
    } catch (err) {
        const errorMessage = `❌ Failed to save chat history: ${err.message}`;
        console.log('================================');
        console.log('❌ BACKUP FAILED');
        console.log('================================');
        process.stderr.write(`\x1b[31m${errorMessage}\x1b[0m\n`);
        console.error(errorMessage);
        console.error('Error details:', err);
        console.error('Stack trace:', err.stack);
    }
    
    // Close database connection gracefully
    try {
        console.log('🔌 Closing database connection...');
        await mongoose.connection.close();
        console.log('✅ Database connection closed');
    } catch (dbErr) {
        console.error('❌ Error closing database:', dbErr.message);
    }
    
    // Close the HTTP server gracefully
    try {
        console.log('🌐 Closing HTTP server...');
        expressServer.close(() => {
            console.log('✅ HTTP server closed');
        });
    } catch (serverErr) {
        console.error('❌ Error closing server:', serverErr.message);
    }
    
    // Give a moment for any pending operations to complete
    setTimeout(() => {
        console.log('👋 Server shutdown complete');
        console.log(`🕒 Final timestamp: ${new Date().toISOString()}`);
        process.exit(0);
    }, 2000); // Increased timeout for remote servers
}

// Handle graceful shutdown with logging
console.log('🔧 Setting up graceful shutdown handlers...');

// Track if shutdown is already in progress to prevent multiple calls
let isShuttingDown = false;

const gracefulShutdown = (signal) => {
    if (isShuttingDown) {
        console.log(`⚠️ Shutdown already in progress, ignoring ${signal} signal`);
        return;
    }
    isShuttingDown = true;
    console.log(`📡 Received ${signal} signal`);
    saveAndExit();
};

// Standard signals - these work on most platforms
process.on('SIGINT', () => gracefulShutdown('SIGINT'));   // Ctrl+C
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Process termination (most cloud platforms)

// Development signals
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // nodemon restart

// PM2 signals
process.on('SIGTSTP', () => gracefulShutdown('SIGTSTP')); // PM2 stop
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));   // PM2 reload

// Additional signals for better cloud platform compatibility
process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT')); // Quit signal
process.on('SIGUSR1', () => gracefulShutdown('SIGUSR1')); // User-defined signal 1

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
    logger.fatal('Uncaught Exception', err, {
        processUptime: process.uptime(),
        memoryUsage: process.memoryUsage()
    });
    
    if (!isShuttingDown) {
        isShuttingDown = true;
        saveAndExit();
    }
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection', reason instanceof Error ? reason : new Error(String(reason)), {
        promise: String(promise),
        processUptime: process.uptime()
    });
    // Don't exit on unhandled rejection, just log it
});

// Handle process.exit() calls
process.on('exit', (code) => {
    console.log(`🚪 Process exiting with code: ${code}`);
});

// For platforms that use different shutdown mechanisms
process.on('beforeExit', (code) => {
    console.log(`⚠️ Process beforeExit event with code: ${code}`);
    if (!isShuttingDown && code === 0) {
        isShuttingDown = true;
        console.log('🔄 Triggering graceful shutdown from beforeExit');
        saveAndExit();
    }
});

// Log successful setup
console.log('✅ Graceful shutdown handlers configured for multiple platforms');

// Utility to check S3 bucket access - specifically targeting avatars directory
async function checkS3BucketAccess() {
    const bucket = process.env.AWS_S3_BUCKET || 'vybchat-media';
    if (!bucket) {
        logger.warn('No S3 bucket configured for access check');
        return false;
    }
    
    try {
        // Only check the avatars directory since we know we have access to it
        const command = new ListObjectsV2Command({ 
            Bucket: bucket,
            Prefix: 'avatars/',
            MaxKeys: 1 // Just need to verify we can list at least one object
        });
        
        const data = await s3Client.send(command);
        
        if (data.Contents && data.Contents.length > 0) {
            logger.info(`✅ S3 bucket ${bucket}/avatars is accessible`);
            return true;
        } else {
            logger.warn(`S3 bucket ${bucket}/avatars appears empty or inaccessible`);
            return false;
        }
    } catch (err) {
        logger.error('Failed to check S3 bucket access', err, { bucket, path: 'avatars/' });
        return false;
    }
}