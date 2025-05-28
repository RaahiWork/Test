// Update server URL detection to be more robust
const serverUrl = (() => {
    // Check if we're in development mode
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // For local development, try to connect to the server port (3500)
        return `ws://${window.location.hostname}:3500`;
    } else {
        // For production, use the current origin
        return window.location.origin;
    }
})();

// Add error handling for socket connection
try {
    var socket = io(serverUrl, {
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        autoConnect: true
    });
    
    console.log('Socket.io initialized with server URL:', serverUrl);
    
    // Add error handler for socket connection
    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        alert('Unable to connect to chat server. Please check your connection and try again.');
    });
} catch (e) {
    console.error('Failed to initialize Socket.io:', e);
    alert('Chat functionality is unavailable. Please make sure you\'re connected to the internet.');
    // Create a dummy socket object to prevent errors
    var socket = {
        on: function() {},
        emit: function() {},
        connected: false
    };
}

// DOM elements
const msgInput = document.querySelector('#message');
const nameInput = document.querySelector('#name');
const activity = document.querySelector('.activity');
const usersList = document.querySelector('.user-list');
const chatDisplay = document.querySelector('.chat-display');
const roomSelect = document.querySelector('#room-select');

// Predefined rooms with descriptions - reordered to put Vibe Room first
const predefinedRooms = [
    { name: "Vibe Room", description: "A mellow space to hang out, vibe, and relax with others." },
    { name: "Lounge 404", description: "Where lost thoughts find a home – chat about anything and everything." },
    { name: "The Hive", description: "Buzz with ideas, energy, and conversation – perfect for group discussions." },
    { name: "Code & Coffee", description: "Developers unite! Share code, debug, and caffeinate together." },
    { name: "Midnight Rant Club", description: "Vent, reflect, or ramble – especially after hours." },
    { name: "MemeStream", description: "Drop your funniest memes and gifs – no judgment, just laughter." },
    { name: "The Think Tank", description: "Brainstorm big ideas or dive deep into smart discussions." },
    { name: "AFK Café", description: "Chill zone for casual chat while taking a break." },
    { name: "Spoiler Zone", description: "Discuss shows, movies, and games – spoilers ahead!" },
    { name: "Echo Base", description: "A general hangout for friendly chatter and new connections." }
];

// Default room to join
const DEFAULT_ROOM = "Vibe Room";

// Use a single currentRoom variable
let currentRoom = '';

// Expose sendMessage function globally to ensure it's accessible
window.sendMessage = function(e) {
    if (e) e.preventDefault();
    console.log("Global sendMessage called");
    
    if (!currentRoom) {
        alert('Please join a room before sending messages');
        return;
    }
    
    if (!msgInput.value.trim()) {
        return; // Don't send empty messages
    }
    
    // Send the message
    console.log("Emitting message:", {name: nameInput.value, text: msgInput.value});
    socket.emit('message', {
        name: nameInput.value,
        text: msgInput.value
    });
    
    // Clear input field after sending
    msgInput.value = "";
    msgInput.focus();
};

// Join room function
function joinRoom(roomName) {
    if (!roomName || !nameInput.value) return;
    
    // Don't join if already in this room
    if (roomName === currentRoom) return;
    
    // Show joining indicator
    const statusEl = document.querySelector('.connection-status');
    const originalStatus = statusEl ? statusEl.textContent : '';
    if (statusEl) statusEl.textContent = `Joining ${roomName}...`;
    
    // Emit room join event
    socket.emit('enterRoom', {
        name: nameInput.value,
        room: roomName
    });
    
    // Store current room
    currentRoom = roomName;
    
    // Update UI to show we're joining with a more compact indicator
    document.querySelectorAll('.room-item').forEach(item => {
        const roomBtn = item.querySelector('.join-room-btn');
        item.classList.remove('active-room');
        
        if (roomBtn) {
            roomBtn.textContent = 'Join';
        }
        
        if (item.dataset.room === roomName) {
            item.classList.add('active-room');
            if (roomBtn) {
                roomBtn.textContent = 'Joining...';
                setTimeout(() => {
                    roomBtn.textContent = '✓';
                }, 1000);
            }
        }
    });
    
    // Reset status after a delay
    setTimeout(() => {
        if (statusEl && statusEl.textContent === `Joining ${roomName}...`) {
            statusEl.textContent = originalStatus || 'Connected';
        }
    }, 2000);
    
    // Clear chat history when changing rooms
    chatDisplay.innerHTML = '';
}

// Room selection display function
function showRooms() {
    // Create room items display with descriptions
    const roomsContainer = document.createElement('div');
    roomsContainer.className = 'rooms-container';
    
    const roomsTitle = document.createElement('div');
    roomsTitle.className = 'rooms-title';
    roomsTitle.textContent = 'Available Rooms';
    roomsContainer.appendChild(roomsTitle);
    
    // Add each predefined room to the container
    predefinedRooms.forEach(room => {
        const roomItem = document.createElement('div');
        roomItem.className = 'room-item' + (room.name === currentRoom ? ' active-room' : '');
        roomItem.dataset.room = room.name;
        roomItem.title = room.description;
        
        // Create a more compact room item layout
        roomItem.innerHTML = `
            <div class="room-info" title="${room.description}">
                <span class="room-icon">🚪</span>
                <span class="room-name">${room.name}</span>
            </div>
            <button class="join-room-btn" data-room="${room.name}">
                ${room.name === currentRoom ? '✓' : 'Join'}
            </button>
        `;
        
        // Make the entire room item clickable
        roomItem.addEventListener('click', (e) => {
            // Only handle clicks on the room info area, not the join button
            if (!e.target.closest('.join-room-btn')) {
                const roomName = roomItem.dataset.room;
                if (roomName !== currentRoom) {
                    joinRoom(roomName);
                }
            }
        });
        
        roomsContainer.appendChild(roomItem);
    });
    
    // Add the rooms container to the sidebar
    const roomsListContainer = document.getElementById('rooms-list-container');
    if (roomsListContainer) {
        roomsListContainer.innerHTML = '';
        roomsListContainer.appendChild(roomsContainer);
    }
    
    // Add event listeners to join buttons
    document.querySelectorAll('.join-room-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const roomName = btn.dataset.room;
            if (roomName !== currentRoom) {
                joinRoom(roomName);
            }
        });
    });
}

// Update users display
function showUsers(users) {
    usersList.innerHTML = '';
    if (users && users.length) {
        usersList.innerHTML = `<ul>` +
            users.map(user =>
                `<li class="user-list-item">
                    <span style="display:inline-block;width:1.3em;text-align:center;margin-right:0.5em;opacity:0.7;">👤</span>
                    <span>${user.name}</span>
                </li>`
            ).join('') +
            `</ul>`;
    } else {
        usersList.innerHTML = `<em>No users in room</em>`;
    }
}

// Socket.io event handlers
socket.on('roomList', () => {
    showRooms();
});

socket.on('userList', ({ users }) => {
    showUsers(users);
});

// Create a message tracking system to prevent duplicates
const processedMessages = new Set();

// Only keep one socket.on('message') handler
socket.on("message", (data) => {
    console.log('Message received:', data);
    
    // Create a unique identifier for this message
    const messageId = `${data.name}-${data.time}-${data.text?.substring(0, 20) || 'image'}`;
    
    // Check if we've already processed this message
    if (processedMessages.has(messageId)) {
        console.log('Duplicate message detected, skipping:', messageId);
        return;
    }
    
    // Add to processed messages
    processedMessages.add(messageId);
    
    // Limit the size of the Set to prevent memory leaks
    if (processedMessages.size > 100) {
        // Remove the oldest entry (first one)
        const firstValue = processedMessages.values().next().value;
        processedMessages.delete(firstValue);
    }
    
    // Reset activity indicator
    activity.textContent = "";
    const { name, text, time, image } = data;
    
    const li = document.createElement('li');
    li.className = 'post';
    
    if (name === nameInput.value) {
        li.className = 'post post--left';
    } else if (name !== 'System') {
        li.className = 'post post--right';
    } else {
        li.className = 'post post--admin';
    }
    
    if (name !== 'System') {
        let contentHtml = `<div class="post__header ${name === nameInput.value
        ? 'post__header--user'
        : 'post__header--reply'
        }">
    <span class="post__header--name">${name}</span> 
    <span class="post__header--time">${time}</span> 
    </div>`;
    
    // Add text or image based on what's available
    if (image) {
        // Create a proper image element with loading state
        const imgElement = document.createElement('img');
        imgElement.alt = 'Shared image';
        imgElement.style.maxWidth = '100%';
        imgElement.style.maxHeight = '300px';
        imgElement.style.borderRadius = '5px';
        imgElement.style.marginTop = '5px';
        imgElement.style.display = 'none'; // Hide until loaded
        
        // Add loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'image-loading';
        loadingDiv.textContent = 'Loading image...';
        
        // Create image container
        const imageContainer = document.createElement('div');
        imageContainer.className = 'post__image';
        imageContainer.appendChild(loadingDiv);
        imageContainer.appendChild(imgElement);
        
        // Add to content
        if (name !== 'System') {
            contentHtml += imageContainer.outerHTML;
        }
        
        // Set image source after adding to DOM to track loading state
        setTimeout(() => {
            const addedImg = li.querySelector('.post__image img');
            if (addedImg) {
                addedImg.onload = function() {
                    this.style.display = 'block';
                    const loadingEl = this.parentNode.querySelector('.image-loading');
                    if (loadingEl) loadingEl.style.display = 'none';
                };
                
                addedImg.onerror = function() {
                    const loadingEl = this.parentNode.querySelector('.image-loading');
                    if (loadingEl) {
                        loadingEl.textContent = 'Failed to load image';
                        loadingEl.className = 'image-error';
                    }
                };
                
                addedImg.src = image;
            }
        }, 10);
    } else if (text) {
        // Process emoji markers in text with improved regex and error handling
        let processedText = text;
        const emojiRegex = /\[emoji:([^\]]+)\]/g;
        
        processedText = processedText.replace(emojiRegex, (match, emojiFile) => {
            // Create direct relative URL to ensure consistent rendering across environments
            return `<img class="emoji" src="/emojis/${emojiFile}" alt="emoji" 
                data-emoji="${emojiFile}"
                onerror="console.error('Failed to load emoji in message:', this.getAttribute('data-emoji')); this.style.display='none'; this.insertAdjacentText('afterend', '😊');">`;
        });
        
        contentHtml += `<div class="post__text">${processedText}</div>`;
    }
    
    li.innerHTML = contentHtml;
    } else {
        li.innerHTML = `<div class="post__text">${text || ''}</div>`;
    }
    
    chatDisplay.appendChild(li);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
});

let activityTimer;
socket.on("activity", (name) => {
    activity.textContent = `${name} is typing...`;

    // Clear after 3 seconds 
    clearTimeout(activityTimer);
    activityTimer = setTimeout(() => {
        activity.textContent = "";
    }, 3000);
});

// Connection handling
socket.on('connect', () => {
    console.log('Socket connected!');
    
    // Request room list immediately after connection
    socket.emit('getRooms');
    
    // If we were in a room before disconnection, try to rejoin it
    if (nameInput.value) {
        // If we were in a room, rejoin it, otherwise join default room
        const roomToJoin = currentRoom || DEFAULT_ROOM;
        
        socket.emit('enterRoom', {
            name: nameInput.value,
            room: roomToJoin
        });
        
        // Update current room
        currentRoom = roomToJoin;
    }
    
    // Update UI for connected state
    if (document.querySelector('.connection-status')) {
        document.querySelector('.connection-status').classList.remove('disconnected');
        document.querySelector('.connection-status').classList.add('connected');
        document.querySelector('.connection-status').textContent = 'Connected';
    }
});

socket.on('disconnect', (reason) => {
    // Update UI for disconnected state
    if (document.querySelector('.connection-status')) {
        document.querySelector('.connection-status').classList.remove('connected');
        document.querySelector('.connection-status').classList.add('disconnected');
        document.querySelector('.connection-status').textContent = 'Disconnected';
    }
});

socket.on('reconnecting', (attemptNumber) => {
    // Update UI for reconnecting state
    if (document.querySelector('.connection-status')) {
        document.querySelector('.connection-status').textContent = `Reconnecting (${attemptNumber})...`;
    }
});

socket.on('reconnect_failed', () => {
    alert('Connection to server lost. Please refresh the page.');
});

// Login overlay logic
const loginOverlay = document.querySelector('.login-overlay');
const loginForm = document.querySelector('.login-form');
const loginUsername = document.querySelector('#login-username');
const main = document.querySelector('main');

// Fix the login handler to ensure chat UI is properly shown
loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const username = loginUsername.value.trim();
    
    if (username) {
        // Set the hidden name field value
        const nameField = document.querySelector('#name');
        if (nameField) nameField.value = username;
        
        // Store in local storage
        localStorage.setItem('vybchat-username', username);
        
        // Add to disabled input if exists
        if (nameInput) {
            nameInput.value = username;
            nameInput.disabled = true;
            nameInput.classList.add('disabled');
        }
        
        // Hide overlay
        loginOverlay.classList.add('hide');
        
        // Show logout button if exists
        const logoutBtn = document.querySelector('.logout-btn');
        if (logoutBtn) logoutBtn.style.display = 'block';
        
        // Show main content with animation
        setTimeout(() => {
            loginOverlay.style.display = 'none';
            main.style.opacity = '1';
            main.style.pointerEvents = 'auto';
            
            // Request room list after successful login
            if (socket && socket.connected) {
                socket.emit('getRooms');
                
                // Auto-join default room
                socket.emit('enterRoom', {
                    name: username,
                    room: DEFAULT_ROOM
                });
                currentRoom = DEFAULT_ROOM;
            }
        }, 600);
    }
});

// Add logout functionality
function handleLogout() {
    // Confirm before logout
    if (confirm('Are you sure you want to logout?')) {
        // Clear username from localStorage
        localStorage.removeItem('vybchat-username');
        
        // Clear current room
        currentRoom = '';
        
        // Clear chat display
        chatDisplay.innerHTML = '';
        
        // Enable name input if it exists
        if (nameInput) {
            nameInput.value = '';
            nameInput.disabled = false;
            nameInput.classList.remove('disabled');
        }
        
        // Show login overlay
        if (loginOverlay) {
            loginOverlay.classList.remove('hide');
            loginOverlay.style.display = 'flex';
            loginOverlay.classList.add('show');
            
            // Focus on username input
            if (loginUsername) {
                loginUsername.value = '';
                loginUsername.focus();
            }
        }
        
        // Disable main content
        if (main) {
            main.style.opacity = '0.5';
            main.style.pointerEvents = 'none';
        }
        
        // Let the server know we're leaving
        if (socket && socket.connected) {
            socket.emit('leaveRoom');
        }
        
        console.log('User logged out');
    }
}

// Update DOMContentLoaded to set up the logout button
document.addEventListener('DOMContentLoaded', function() {
    console.log("Setting up message form");
    
    // Add direct event handler to form
    const messageForm = document.querySelector('.form-msg');
    if (messageForm) {
        messageForm.onsubmit = window.sendMessage;
    }
    
    // Also set up button click as backup
    const sendButton = document.querySelector('.form-msg button[type="submit"]');
    if (sendButton) {
        sendButton.onclick = function(e) {
            e.preventDefault();
            window.sendMessage();
            return false;
        };
    }
    
    // Setup form-join listener
    const formJoin = document.querySelector('.form-join');
    if (formJoin) {
        formJoin.addEventListener('submit', function(e) {
            e.preventDefault();
            if (roomSelect.value) {
                joinRoom(roomSelect.value);
            } else {
                alert('Please select a room to join');
            }
        });
    }
    
    // Set initial state from localStorage
    const savedUsername = localStorage.getItem('vybchat-username');
    
    if (savedUsername) {
        nameInput.value = savedUsername;
        nameInput.disabled = true;
        nameInput.classList.add('disabled');
        loginOverlay.classList.add('hide');
        loginOverlay.style.display = 'none';
        main.style.opacity = '1';
        main.style.pointerEvents = 'auto';
        
        // Request room list if we're already logged in
        if (socket.connected) {
            socket.emit('getRooms');
            
            // Auto-join default room if not already in a room
            if (!currentRoom && nameInput.value) {
                socket.emit('enterRoom', {
                    name: nameInput.value,
                    room: DEFAULT_ROOM
                });
                currentRoom = DEFAULT_ROOM;
            }
        }
    } else {
        main.style.opacity = '0.5';
        main.style.pointerEvents = 'none';
        nameInput.disabled = false;
        loginOverlay.classList.add('show');
        loginOverlay.style.display = 'flex';
        loginUsername.focus();
    }
    
    // Set up logout button functionality
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Add side panel toggle for mobile
    const leftPane = document.querySelector('.left-pane');
    const rightPane = document.querySelector('.right-pane');
    const leftToggle = document.querySelector('.left-toggle');
    const rightToggle = document.querySelector('.right-toggle');
    
    if (leftToggle && leftPane) {
        leftToggle.addEventListener('click', () => {
            leftPane.classList.toggle('active');
            
            // Close right pane when opening left pane
            if (rightPane && rightPane.classList.contains('active')) {
                rightPane.classList.remove('active');
            }
        });
    }
    
    if (rightToggle && rightPane) {
        rightToggle.addEventListener('click', () => {
            rightPane.classList.toggle('active');
            
            // Close left pane when opening right pane
            if (leftPane && leftPane.classList.contains('active')) {
                leftPane.classList.remove('active');
            }
        });
    }
    
    // Close side panels when clicking outside
    document.addEventListener('click', (e) => {
        if (leftPane && leftPane.classList.contains('active') && 
            !leftPane.contains(e.target) && 
            !leftToggle.contains(e.target)) {
            leftPane.classList.remove('active');
        }
        
        if (rightPane && rightPane.classList.contains('active') && 
            !rightPane.contains(e.target) && 
            !rightToggle.contains(e.target)) {
            rightPane.classList.remove('active');
        }
    });
    
    // Initialize room display
    showRooms();
    
    // Also initialize emoji and image buttons
    setupEmojiAndImageHandlers();
});

// Add a function to set up emoji and image handlers
function setupEmojiAndImageHandlers() {
    // Add emoji picker functionality
    const emojiBtn = document.getElementById('emoji-btn');
    const emojiPicker = document.getElementById('emoji-picker');
    
    if (emojiBtn && emojiPicker) {
        emojiBtn.addEventListener('click', () => {
            if (emojiPicker.style.display === 'none' || !emojiPicker.style.display) {
                emojiPicker.style.display = 'flex';
                loadEmojis();
            } else {
                emojiPicker.style.display = 'none';
            }
        });
    }
    
    // Fix image upload functionality
    const imageUploadBtn = document.getElementById('image-upload-btn');
    const imageFileInput = document.getElementById('image-file');
    
    if (imageUploadBtn && imageFileInput) {
        // Add click event to button to trigger file input
        imageUploadBtn.addEventListener('click', () => {
            imageFileInput.click();
        });
        
        // Add change event to file input to handle file selection
        imageFileInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const file = this.files[0];
                
                // Validate file type and size
                if (!file.type.match('image.*')) {
                    alert('Please select a valid image file.');
                    this.value = '';
                    return;
                }
                
                if (file.size > 5 * 1024 * 1024) { // 5MB limit
                    alert('Image file is too large. Please select an image less than 5MB.');
                    this.value = '';
                    return;
                }
                
                // Check if user is in a room
                if (!currentRoom) {
                    alert('Please join a room before sending images');
                    this.value = '';
                    return;
                }
                
                // Show loading indicator
                activity.textContent = 'Uploading image...';
                
                // Read the file as data URL
                const reader = new FileReader();
                reader.onload = function(e) {
                    const imageData = e.target.result;
                    
                    // Send image to server
                    socket.emit('imageMessage', {
                        name: nameInput.value,
                        image: imageData
                    });
                    
                    console.log('Image sent to server');
                    
                    // Clear file input for next upload
                    imageFileInput.value = '';
                };
                
                reader.onerror = function(err) {
                    console.error('Error reading image file:', err);
                    alert('Failed to read image file. Please try again.');
                    imageFileInput.value = '';
                    activity.textContent = '';
                };
                
                // Start reading the file
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Also add paste support for images
    document.addEventListener('paste', function(e) {
        // Only handle paste if message input is focused
        if (document.activeElement === msgInput) {
            const items = e.clipboardData.items;
            
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') === 0) {
                    // Prevent default paste behavior
                    e.preventDefault();
                    
                    // Check if user is in a room
                    if (!currentRoom) {
                        alert('Please join a room before sending images');
                        return;
                    }
                    
                    // Get the image file from clipboard
                    const blob = items[i].getAsFile();
                    
                    // Show loading indicator
                    activity.textContent = 'Processing pasted image...';
                    
                    // Read the blob as data URL
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        // Send image to server
                        socket.emit('imageMessage', {
                            name: nameInput.value,
                            image: e.target.result
                        });
                        
                        console.log('Pasted image sent to server');
                    };
                    
                    reader.onerror = function(err) {
                        console.error('Error reading pasted image:', err);
                        alert('Failed to process pasted image. Please try again.');
                        activity.textContent = '';
                    };
                    
                    // Start reading the blob
                    reader.readAsDataURL(blob);
                    break;
                }
            }
        }
    });
}

// Add function to load emojis that was referenced but missing
function loadEmojis() {
    const emojiContainer = document.getElementById('emoji-container');
    if (!emojiContainer) return;
    
    // Show loading state
    emojiContainer.innerHTML = '<div class="emoji-loading">Loading emojis...</div>';
    
    // Get base URL for emoji API
    const baseUrl = serverUrl.replace('ws://', 'http://').replace('wss://', 'https://');
    
    // Fetch emoji list from server
    fetch(`${baseUrl}/api/emojis`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(emojis => {
            if (!Array.isArray(emojis) || emojis.length === 0) {
                emojiContainer.innerHTML = '<div class="emoji-message">No emojis available</div>';
                return;
            }
            
            // Clear container
            emojiContainer.innerHTML = '';
            
            // Add each emoji to the container
            emojis.forEach(emoji => {
                const emojiItem = document.createElement('div');
                emojiItem.className = 'emoji-item';
                emojiItem.innerHTML = `<img src="/emojis/${emoji}" alt="${emoji}" title="${emoji.replace(/\.\w+$/, '')}">`;
                
                // Add click handler to insert emoji
                emojiItem.addEventListener('click', () => {
                    const emojiCode = `[emoji:${emoji}]`;
                    
                    // Insert at cursor position
                    const cursorPos = msgInput.selectionStart;
                    msgInput.value = msgInput.value.substring(0, cursorPos) + 
                                   emojiCode + 
                                   msgInput.value.substring(msgInput.selectionEnd);
                    
                    // Move cursor after inserted emoji
                    msgInput.selectionStart = cursorPos + emojiCode.length;
                    msgInput.selectionEnd = cursorPos + emojiCode.length;
                    msgInput.focus();
                    
                    // Hide emoji picker
                    document.getElementById('emoji-picker').style.display = 'none';
                });
                
                emojiContainer.appendChild(emojiItem);
            });
        })
        .catch(error => {
            console.error('Error loading emojis:', error);
            emojiContainer.innerHTML = `<div class="emoji-error">
                Failed to load emojis: ${error.message}
                <button class="retry-btn">Retry</button>
            </div>`;
            
            // Add retry button functionality
            const retryBtn = emojiContainer.querySelector('.retry-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', loadEmojis);
            }
        });
}

// Remove the window.addEventListener('load') section as it's causing duplicate handlers

// Update the debug function to check for duplicate event handlers
function debugEvents() {
    const formMsg = document.querySelector('.form-msg');
    const sendButton = document.querySelector('.form-msg button[type="submit"]');
    
    console.log("Form:", formMsg);
    console.log("Send button:", sendButton);
    
    // Check for duplicate socket handlers
    // This is just for debugging and won't fix the issue directly
    if (socket._callbacks) {
        console.log("Socket event handlers:");
        for (const eventType in socket._callbacks) {
            console.log(`- ${eventType}: ${socket._callbacks[eventType].length} handler(s)`);
        }
    }
}

// Call this at the end of the file to ensure it runs
setTimeout(debugEvents, 1000);