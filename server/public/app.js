// Update server URL detection to be more robust
let isLoggingout = false;

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
    
    
    
    // Add error handler for socket connection
    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        //alert('Unable to connect to chat server. Please check your connection and try again.');
    });
} catch (e) {
    console.error('Failed to initialize Socket.io:', e);
    //alert('Chat functionality is unavailable. Please make sure you\'re connected to the internet.');
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

// Predefined rooms with descriptions - reordered to put Vibe first
const predefinedRooms = [
    { name: "Vibe", description: "A mellow space to hang out, vibe, and relax with others." },
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
const DEFAULT_ROOM = "Vibe";

// Use a single currentRoom variable
let currentRoom = '';
let lastDisplayedRoom = '';

// Expose sendMessage function globally to ensure it's accessible
window.sendMessage = function(e) {
    if (e) e.preventDefault();
    
    
    if (!currentRoom) {
        //alert('Please join a room before sending messages');
        return;
    }
    
    if (!msgInput.value.trim()) {
        return; // Don't send empty messages
    }
    
    // Send the message
    
    socket.emit('message', {
        name: nameInput.value,
        text: msgInput.value
    });
    
    // Clear input field after sending
    msgInput.value = "";
    // Only focus if not iOS
    if (!(/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream)) {
        msgInput.focus();
    }
};

// Join room function
function joinRoom(roomName) {
    if (!roomName || !nameInput.value) return;
    // Don't join if already in this room
    if (roomName === currentRoom) return;
    // Clear any previous joining indicators first
    document.querySelectorAll('.room-item').forEach(item => {
        const roomBtn = item.querySelector('.join-room-btn');
        if (roomBtn && roomBtn.textContent === 'Joining...') {
            roomBtn.textContent = 'Join';
        }
    });
    // No need to update connection status text since it's now an indicator dot
    // Emit room join event
    socket.emit('enterRoom', {
        name: nameInput.value,
        room: roomName
    });
    // Store current room
    currentRoom = roomName;
    // Update room header with name and description
    updateRoomHeader(roomName);
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
                    // Only update this specific button
                    if (item.dataset.room === currentRoom) {
                        roomBtn.textContent = '✓';
                    }
                }, 1000);
            }
        }
    });
    // Do NOT clear chat history here; let message handler do it on first message for new room
}

// Add a function to update the room header
function updateRoomHeader(roomName) {
    const header = document.querySelector('.current-room-header');
    const nameElement = document.querySelector('.current-room-name');
    const descriptionElement = document.querySelector('.current-room-description');
    
    if (header && nameElement && descriptionElement) {
        // Find room description from predefined rooms
        const roomData = predefinedRooms.find(room => room.name === roomName) || {
            name: roomName,
            description: "Chat room"
        };
        
        // Update the header content
        nameElement.textContent = roomData.name;
        descriptionElement.textContent = roomData.description;
        
        // Set data attribute for room-specific styling
        header.setAttribute('data-room', roomName);
        
        // Add animation effect
        header.classList.add('room-changed');
        setTimeout(() => {
            header.classList.remove('room-changed');
        }, 700);
    }
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
        
        // Use standard title attribute for tooltip - show only description
        roomItem.title = room.description;
        
        // Create a more compact room item layout
        roomItem.innerHTML = `
            <div class="room-info">
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
    if (users?.length) {
        // Remove duplicates by name (case-insensitive) as an extra safety measure
        const uniqueUsers = [];
        const seenNames = new Set();
        
        users.forEach(user => {
            const lowerName = user.name.toLowerCase();
            if (!seenNames.has(lowerName)) {
                seenNames.add(lowerName);
                uniqueUsers.push(user);
            }
        });
        
        usersList.innerHTML = `<ul>` +
            uniqueUsers.map(user =>
                `<li class="user-list-item">
                    <div class="user-info">
                        <span style="display:inline-block;width:1.3em;text-align:center;margin-right:0.5em;opacity:0.7;">👤</span>
                        <span>${user.name}</span>
                    </div>
                    ${user.name !== nameInput.value ? 
                        `<button class="message-user-btn" onclick="window.privateMessaging?.openPrivateMessage('${user.name}');window.handleHideRightPaneOnMobile && window.handleHideRightPaneOnMobile();" title="Send private message">💬</button>` : 
                        ''
                    }
                </li>`
            ).join('') +
            `</ul>`;
    } else {
        usersList.innerHTML = `<em>No users in room</em>`;
    }
    // Move clear room button here, below users list
    addClearRoomButtonIfAdmin();
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
    // If switching rooms, clear chat and reset deduplication
    if (currentRoom !== lastDisplayedRoom) {
        chatDisplay.innerHTML = '';
        processedMessages.clear();
        lastDisplayedRoom = currentRoom;
    }
    renderMessage(data);
});

// Helper function to render a message
function renderMessage(data) {
    // Create a unique identifier for this message
    const messageId = `${data.name}-${data.time}-${data.text?.substring(0, 20) || 'image'}`;
    if (processedMessages.has(messageId)) {
        return;
    }
    processedMessages.add(messageId);
    if (processedMessages.size > 100) {
        const firstValue = processedMessages.values().next().value;
        processedMessages.delete(firstValue);
    }
    activity.textContent = "";
    const { name, text, time, image, voice } = data;
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
        const localTime = formatLocalTime(time);
        let contentHtml = `<div class="post__header ${name === nameInput.value ? 'post__header--user' : 'post__header--reply'}" ${name !== nameInput.value ? 'tabindex="0" role="button" aria-label="Reply to this user"' : ''}>
<span class="post__header--name${name === nameInput.value ? ' current-user' : ''}">
${name} <span class="verified-icon" title="Registered User">✔️</span>
<span class="post__header--time">${localTime}</span> 
</div>`;
        if (image) {
            const imgElement = document.createElement('img');
            imgElement.alt = 'Shared image';
            imgElement.style.maxWidth = '100%';
            imgElement.style.maxHeight = '300px';
            imgElement.style.borderRadius = '5px';
            imgElement.style.marginTop = '5px';
            imgElement.style.display = 'none';
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'image-loading';
            loadingDiv.textContent = 'Loading image...';
            const imageContainer = document.createElement('div');
            imageContainer.className = 'post__image';
            imageContainer.appendChild(loadingDiv);
            imageContainer.appendChild(imgElement);
            contentHtml += imageContainer.outerHTML;
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
        }
        if (text) {
            let processedText = text;
            const emojiRegex = /\[emoji:([^\]]+)\]/g;
            processedText = processedText.replace(emojiRegex, (match, emojiFile) => {
                return `<img class="emoji" src="/emojis/${emojiFile}" alt="emoji" 
                    data-emoji="${emojiFile}"
                    onerror="console.error('Failed to load emoji in message:', this.getAttribute('data-emoji')); this.style.display='none'; this.insertAdjacentText('afterend', '😊');">`;
            });
            contentHtml += `<div class="post__text">${processedText}</div>`;
        }
        if (voice) {
            const downloadMp3Btn = `
                <a href="${voice}" download="voice-message.mp3" 
                   style="
                    display:inline-block;
                    margin-left:10px;
                    padding:4px 14px;
                    background:#2ecc71;
                    color:#fff;
                    border-radius:18px;
                    font-size:0.97em;
                    font-weight:500;
                    text-decoration:none;
                    box-shadow:0 2px 6px rgba(46,204,113,0.12);
                    transition:background 0.2s;
                    vertical-align:middle;
                "
                onmouseover="this.style.background='#27ae60'"
                onmouseout="this.style.background='#2ecc71'"
                title="Download voice message as MP3"
                >⬇️ Download as MP3</a>`;
            contentHtml += `<div class="post__voice"><audio controls src="${voice}"></audio>${downloadMp3Btn}</div>`;
        }
        li.innerHTML = contentHtml;
    } else {
        li.innerHTML = `<div class="post__text">${text || ''}</div>`;
    }
    const myName = nameInput.value;
    if (myName && name !== myName && name !== 'System') {
        function highlightUserName(node) {
            if (node.nodeType === 3) {
                const regex = new RegExp(`\\b${myName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'g');
                if (regex.test(node.nodeValue)) {
                    const span = document.createElement('span');
                    span.innerHTML = node.nodeValue.replace(regex, `<span class="current-user-highlight">${myName}</span>`);
                    node.replaceWith(...span.childNodes);
                }
            } else if (node.nodeType === 1 && node.childNodes) {
                node.childNodes.forEach(highlightUserName);
            }
        }
        highlightUserName(li);
    }
    chatDisplay.appendChild(li);
    if (autoScroll) {
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    }
}

let activityTimer;
socket.on("activity", (name) => {
    activity.textContent = `${name} is typing...`;

    // Clear after 3 seconds 
    clearTimeout(activityTimer);
    activityTimer = setTimeout(() => {
        activity.textContent = "";
    }, 3000);
});

// Improved typing indicator management
let typingUsers = new Set();
let typingTimer;

// Enhanced activity handler - make sure we always update the list of typing users
socket.on("activity", (name) => {
    // Don't show typing indicator for our own messages
    if (name === nameInput.value) return;
    
    // Add user to typing set
    typingUsers.add(name);
    
    // Update typing indicator display
    updateTypingIndicator();
    
    // Clear previous timer for this user if exists
    if (typingTimer[name]) {
        clearTimeout(typingTimer[name]);
    }
    
    // Set new timeout to remove user from typing after delay
    typingTimer[name] = setTimeout(() => {
        // Remove this user from typing
        typingUsers.delete(name);
        updateTypingIndicator();
    }, 3000);
});

// Update typing indicator function to be more robust
function updateTypingIndicator() {
    const activity = document.querySelector('.activity');
    if (!activity) return;

    if (typingUsers.size === 0) {
        activity.textContent = "";
        activity.classList.remove('typing');
        return;
    }
    
    activity.classList.add('typing');
    
    // Get array of typing users
    const users = Array.from(typingUsers);
    
    // Create text based on number of typing users
    let text = '';
    if (users.length === 1) {
        text = `${users[0]} is typing`;
    } else if (users.length === 2) {
        text = `${users[0]} and ${users[1]} are typing`;
    } else if (users.length === 3) {
        text = `${users[0]}, ${users[1]} and ${users[2]} are typing`;
    } else {
        text = `${users.length} people are typing`;
    }
    
    // Set text with animated dots
    activity.innerHTML = text + '<div class="typing-indicator"><span></span><span></span><span></span></div>';
}

// Reset typing users when receiving messages
socket.on("message", (data) => {
    // Clear typing indicator for the user who sent this message
    if (typingUsers.has(data.name)) {
        typingUsers.delete(data.name);
        updateTypingIndicator();
        
        // Clear any pending timeouts for this user
        if (typingTimer[data.name]) {
            clearTimeout(typingTimer[data.name]);
            delete typingTimer[data.name];
        }
    }
});

// Initialize typing timers as an object for better management
document.addEventListener('DOMContentLoaded', function() {
    // Initialize typing timer object to track per-user timeouts
    typingTimer = {};
    
    // Ensure activity element exists
    const activity = document.querySelector('.activity');
    if (!activity) {
        console.error("Activity element not found");
    }
    
    // Clear typing list when changing rooms
    const oldJoinRoom = window.joinRoom || joinRoom;
    window.joinRoom = function(roomName) {
        // Clear typing users list when changing rooms
        typingUsers.clear();
        
        // Clear all typing timers
        Object.keys(typingTimer).forEach(user => {
            clearTimeout(typingTimer[user]);
            delete typingTimer[user];
        });
        
        // Update the UI
        updateTypingIndicator();
        
        // Call the original function
        return oldJoinRoom.apply(this, arguments);
    };
    
    // Enhanced input events for typing
    const msgInput = document.getElementById('message');
    if (msgInput) {
        let typingTimeout;
        let lastTypingTime = 0;
        
        msgInput.addEventListener('input', function() {
            // Only emit if we have text and are in a room
            if (this.value.trim() && currentRoom) {
                const now = Date.now();
                
                // Throttle to prevent too many events (no more than once per second)
                if (now - lastTypingTime > 1000) {
                    socket.emit('activity', nameInput.value);
                    lastTypingTime = now;
                }
                
                clearTimeout(typingTimeout);
            }
        });
    }
});

// Also update when users leave
socket.on('userList', ({ users }) => {
    showUsers(users);
    
    // Get current user names from the updated list
    const currentUserNames = users.map(user => user.name);
    
    // Remove any typing indicators for users who are not in the room anymore
    typingUsers.forEach(userName => {
        if (!currentUserNames.includes(userName)) {
            typingUsers.delete(userName);
            
            // Clear any pending timeouts for this user
            if (typingTimer[userName]) {
                clearTimeout(typingTimer[userName]);
                delete typingTimer[userName];
            }
        }
    });
    
    // Update the typing indicator
    updateTypingIndicator();
});

// Connection handling
socket.on('connect', () => {
    // Request room list immediately after connection
    socket.emit('getRooms');
    
    // Request online users for private messaging
    socket.emit('getOnlineUsers');
    
    // If we were in a room before disconnection, try to rejoin it
    if (nameInput.value) {
        // Always join Vibe room as default for authenticated users
        const roomToJoin = 'Vibe';
        
        socket.emit('enterRoom', {
            name: nameInput.value,
            room: roomToJoin
        });
        
        // Update current room
        currentRoom = roomToJoin;
        
        // Update room header
        updateRoomHeader(roomToJoin);
    }
    
    // Update UI for connected state - replace text with indicator dot
    if (document.querySelector('.connection-status')) {
        document.querySelector('.connection-status').classList.remove('disconnected');
        document.querySelector('.connection-status').classList.add('connected');
        document.querySelector('.connection-status').innerHTML = '<span class="status-dot"></span>';
    }
});

socket.on('disconnect', (reason) => {
    // Update UI for disconnected state - replace text with indicator dot
    if (document.querySelector('.connection-status')) {
        document.querySelector('.connection-status').classList.remove('connected');
        document.querySelector('.connection-status').classList.add('disconnected');
        document.querySelector('.connection-status').innerHTML = '<span class="status-dot"></span>';
    }
});

socket.on('reconnecting', (attemptNumber) => {
    // Update UI for reconnecting state - replace text with indicator dot and attempt number
    if (document.querySelector('.connection-status')) {
        document.querySelector('.connection-status').innerHTML = '<span class="status-dot reconnecting"></span>';
    }
});

socket.on('reconnect_failed', () => {
    //alert('Connection to server lost. Please refresh the page.');
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
        isLoggingout = true;
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
        
        // Hide login overlay
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
        
        
    }
}

// Update DOMContentLoaded to set up auto-join for Vibe room
document.addEventListener('DOMContentLoaded', function() {
    // Set up favicon
    const setFavicon = () => {
        // Check if a favicon already exists
        let favicon = document.querySelector('link[rel="icon"]');
        
        if (!favicon) {
            // Create a new favicon link element if it doesn't exist
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
        }
        
        // Set the favicon to our logo image
        favicon.href = '/images/logo.png';
        favicon.type = 'image/png';
    };
    
    // Set favicon immediately
    setFavicon();
    
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
                //alert('Please select a room to join');
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
            
            // Auto-join Vibe room for authenticated users
            socket.emit('enterRoom', {
                name: savedUsername,
                room: 'Vibe'
            });
            currentRoom = 'Vibe';
            updateRoomHeader('Vibe');
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
    
    // Add side panel toggle for mobile - This logic is now handled by mobile-sidepane.js
    /*
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
    
    // Close side panels when clicking outside - This logic is now handled by mobile-sidepane.js
    document.addEventListener('click', (e) => {
        if (leftPane && leftPane.classList.contains('active') && 
            !leftPane.contains(e.target) && 
            leftToggle && !leftToggle.contains(e.target)) { // Added null check for leftToggle
            leftPane.classList.remove('active');
        }
        
        if (rightPane && rightPane.classList.contains('active') && 
            !rightPane.contains(e.target) && 
            rightToggle && !rightToggle.contains(e.target)) { // Added null check for rightToggle
            rightPane.classList.remove('active');
        }
    });
    */
    
    // Initialize room display
    showRooms();
    
    // Also initialize emoji and image buttons
    setupEmojiAndImageHandlers();
    
    // Ensure message input is visible on focus (mobile keyboard)
    const msgInput = document.getElementById('message');
    if (msgInput) {
        msgInput.addEventListener('focus', function() {
            setTimeout(() => {
                // Scroll input into view if needed (mobile)
                msgInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 200);
        });
    }
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
        
        // Add close button functionality
        const closeEmojiPickerBtn = document.getElementById('close-emoji-picker');
        if (closeEmojiPickerBtn) {
            closeEmojiPickerBtn.addEventListener('click', () => {
                emojiPicker.style.display = 'none';
            });
        }
        
        // Close emoji picker when clicking outside
        document.addEventListener('click', (e) => {
            if (emojiPicker.style.display !== 'none' && 
                !emojiPicker.contains(e.target) && 
                e.target !== emojiBtn && 
                !emojiBtn.contains(e.target)) {
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
                    //alert('Please select a valid image file.');
                    this.value = '';
                    return;
                }
                
                if (file.size > 5 * 1024 * 1024) // 5MB limit
                {
                    //alert('Image file is too large. Please select an image less than 5MB.');
                    this.value = '';
                    return;
                }
                
                // Check if user is in a room
                if (!currentRoom) {
                    //alert('Please join a room before sending images');
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
                    
                    
                    
                    // Clear file input for next upload
                    imageFileInput.value = '';
                };
                
                reader.onerror = function(err) {
                    console.error('Error reading image file:', err);
                    //alert('Failed to read image file. Please try again.');
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
                        //alert('Please join a room before sending images');
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
                        
                        
                    };
                    
                    reader.onerror = function(err) {
                        console.error('Error reading pasted image:', err);
                        //alert('Failed to process pasted image. Please try again.');
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

// Add voice message support
function setupVoiceMessageHandlers() {
    const voiceBtn = document.getElementById('voice-record-btn');
    const voiceFileInput = document.getElementById('voice-file');
    const voiceActionContainer = document.getElementById('voice-action-container');
    const voiceAudioPreview = document.getElementById('voice-audio-preview');
    const voiceSendBtn = document.getElementById('voice-send-btn');
    const voiceCancelBtn = document.getElementById('voice-cancel-btn');
    const voiceDownloadBtn = document.getElementById('voice-download-btn');
    let recordedVoiceData = null;
    let mediaRecorder, audioChunks = [];

    if (!voiceBtn || !voiceFileInput || !voiceActionContainer || !voiceAudioPreview || !voiceSendBtn || !voiceCancelBtn) return;

    voiceBtn.addEventListener('click', async () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            voiceBtn.textContent = '🎤';
            return;
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Voice recording not supported in this browser.');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onload = function(e) {
                    recordedVoiceData = e.target.result;
                    voiceAudioPreview.src = recordedVoiceData;
                    voiceActionContainer.style.display = 'flex';
                };
                reader.readAsDataURL(audioBlob);
            };
            mediaRecorder.start();
            voiceBtn.textContent = '⏹️';
        } catch (err) {
            alert('Could not start recording: ' + err.message);
        }
    });

    voiceSendBtn.addEventListener('click', function() {
        if (recordedVoiceData) {
            socket.emit('voiceMessage', {
                name: nameInput.value,
                voice: recordedVoiceData
            });
        }
        voiceActionContainer.style.display = 'none';
        voiceAudioPreview.src = '';
        recordedVoiceData = null;
    });

    voiceCancelBtn.addEventListener('click', function() {
        voiceActionContainer.style.display = 'none';
        voiceAudioPreview.src = '';
        recordedVoiceData = null;
    });

    voiceFileInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            const file = this.files[0];
            if (!file.type.match('audio.*')) {
                alert('Please select a valid audio file.');
                this.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = function(e) {
                recordedVoiceData = e.target.result;
                voiceAudioPreview.src = recordedVoiceData;
                voiceActionContainer.style.display = 'flex';
            };
            reader.readAsDataURL(file);
            this.value = '';
        }
    });
    
    if (voiceDownloadBtn) {
        voiceDownloadBtn.addEventListener('click', function() {
            if (!recordedVoiceData) return;
            // Convert base64 to Blob
            const arr = recordedVoiceData.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) u8arr[n] = bstr.charCodeAt(n);
            let blob = new Blob([u8arr], { type: mime });

            // If browser supports, use webm-to-mp3 conversion (optional, fallback to webm)
            // For simplicity, just rename to .mp3 for download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'voice-message.mp3';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                URL.revokeObjectURL(url);
                a.remove();
            }, 100);
        });
    }
}
document.addEventListener('DOMContentLoaded', function() {
    // ...existing code...
    setupVoiceMessageHandlers();
    // ...existing code...
});

// Remove the window.addEventListener('load') section as it's causing duplicate handlers

// Update the debug function to check for duplicate event handlers
function debugEvents() {
    const formMsg = document.querySelector('.form-msg');
    const sendButton = document.querySelector('.form-msg button[type="submit"]');
    
    
    
    // Check for duplicate socket handlers
    // This is just for debugging and won't fix the issue directly
    if (socket._callbacks) {
        
        for (const eventType in socket._callbacks) {
            
        }
    }
}

// Call this at the end of the file to ensure it runs
setTimeout(debugEvents, 1000);

// Add CSS for custom tooltip styling if needed
const style = document.createElement('style');
style.textContent = `
@keyframes roomChanged {
    0% { transform: translateY(-10px); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
}
.room-changed {
    animation: roomChanged 0.5s ease forwards;
}

/* Connection status indicator styles */
.status-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 5px;
}
.connected .status-dot {
    background-color: #2ecc71; /* Green color for connected */
    box-shadow: 0 0 5px #2ecc71; /* Small glow effect */
}
.disconnected .status-dot {
    background-color: #e74c3c; /* Red color for disconnected */
}
.reconnecting .status-dot {
    background-color: #f39c12; /* Orange color for reconnecting */
    animation: pulse 1.5s infinite; /* Pulsing animation */
}

@keyframes pulse {
    0% { opacity: 0.4; }
    50% { opacity: 1; }
    100% { opacity: 0.4; }
}

/* Improved tooltip appearance - uses browser's native tooltip but improves styling */
.room-item {
    position: relative;
}

/* This ensures the entire room item gets the tooltip */
.room-item .room-info {
    cursor: pointer;
}

/* Style for visually indicating hoverable elements */
.room-item:hover {
    background-color: rgba(255,255,255,0.05);
}

/* Make chat-display background fully transparent but keep text and UI interactive */
.chat-display {
    background: transparent;
    pointer-events: auto;
}

/* Help/Credits modal styles */
.help-credits {
    background: rgba(255, 255, 255, 0.9);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    padding: 20px;
    max-width: 400px;
    width: 90%;
    margin: 0 auto;
    z-index: 10000;
    position: relative;
}
.help-credits strong {
    color: #333;
}
.help-credits a {
    color: #6c63ff;
    text-decoration: none;
}
.help-credits a:hover {
    text-decoration: underline;
}
.thanks {
    display: block;
    margin-top: 12px;
    font-size: 0.9em;
    color: #777;
}
`;
document.head.appendChild(style);

// Add a utility function to format time in local timezone
function formatLocalTime(timestamp) {
    try {
        const date = new Date(timestamp);
        // Check if the date is valid
        if (isNaN(date.getTime())) {
            return timestamp; // Return the original timestamp if parsing fails
        }
        
        // Format the time according to the browser's locale
        return date.toLocaleTimeString([], {
            hour: 'numeric',
            minute: 'numeric'
        });
    } catch (error) {
        console.error('Error formatting time:', error);
        return timestamp; // Return original on error
    }
}

// Create a global function to initialize socket connection for auth.js
window.initializeSocketConnection = function(username) {
    if (socket && socket.connected) {
        // Auto-join Vibe room
        socket.emit('enterRoom', {
            name: username,
            room: 'Vibe'
        });
        currentRoom = 'Vibe';
        updateRoomHeader('Vibe');
    }
};

// Hide right pane on mobile when opening private message
window.handleHideRightPaneOnMobile = function() {
    if (window.innerWidth <= 768) {
        const rightPane = document.querySelector('.right-pane');
        if (rightPane && rightPane.classList.contains('open')) {
            rightPane.classList.remove('open');
        }
    }
};

// Also handle private conversation tab clicks (sidebar private messages)
document.addEventListener('DOMContentLoaded', function() {
    // ...existing code...
    // Observe clicks on private conversation tabs to hide right pane on mobile
    const privateConversations = document.getElementById('private-conversations');
    if (privateConversations) {
        privateConversations.addEventListener('click', function(e) {
            if (window.innerWidth <= 768) {
                const rightPane = document.querySelector('.right-pane');
                if (rightPane && rightPane.classList.contains('open')) {
                    rightPane.classList.remove('open');
                }
            }
        });
    }
    // ...existing code...
});

// Warn user before leaving or reloading the page
window.addEventListener('beforeunload', function (e) {
    if (isLoggingout) {
        // If logging out, don't show the confirmation dialog
        return;
    }
    // Standard message is ignored by most browsers, but returning a string triggers the dialog
    e.preventDefault();
    e.returnValue = 'Are you sure you want to leave? Your chat session will be disconnected.';
});

// Track if user is near the bottom of chat
let autoScroll = true;
function handleChatScroll() {
    const el = chatDisplay;
    if (!el) return;
    // If user is within 100px of the bottom, enable auto-scroll
    autoScroll = (el.scrollHeight - el.scrollTop - el.clientHeight < 100);
}
if (chatDisplay) {
    chatDisplay.addEventListener('scroll', handleChatScroll);
}

// Make any post header clickable to insert username at cursor position in message input
chatDisplay.addEventListener('click', function(e) {
    const header = e.target.closest('.post__header');
    if (header) {
        const nameSpan = header.querySelector('.post__header--name');
        if (nameSpan) {
            const username = nameSpan.textContent.trim().split(' ')[0];
            if (msgInput) {
                const start = msgInput.selectionStart;
                const end = msgInput.selectionEnd;
                const value = msgInput.value;
                // Only add a space if not already present before or after
                let insertText = username;
                // Add a space before if not at start and not already a space
                if (start > 0 && value[start - 1] !== ' ') {
                    insertText = ' ' + insertText;
                }
                // Add a space after if not already a space
                if (value[end] !== ' ') {
                    insertText = insertText + ' ';
                }
                msgInput.value = value.slice(0, start) + insertText + value.slice(end);
                const cursorPos = start + insertText.length;
                msgInput.setSelectionRange(cursorPos, cursorPos);
                msgInput.focus();
            }
        }
    }
});

// Keyboard accessibility: Enter/Space triggers reply
chatDisplay.addEventListener('keydown', function(e) {
    const header = e.target.closest('.post__header');
    if ((e.key === 'Enter' || e.key === ' ') && header) {
        e.preventDefault();
        header.click();
    }
});

// Add tab highlight for @mentions in main chat
let origTitle = document.title;
let origFavicon = (() => {
    const link = document.querySelector('link[rel="icon"]');
    return link ? link.href : '';
})();
let tabFlashInterval = null;
let tabFlashState = false;
let windowFocused = true;

window.addEventListener('focus', () => {
    windowFocused = true;
    stopTabHighlight();
});
window.addEventListener('blur', () => {
    windowFocused = false;
});

function highlightTabForMention(mentionSourceName) {
    if (windowFocused) return;
    stopTabHighlight();
    let flashTitle = `🔔 Mentioned by ${mentionSourceName || 'Someone'}`;
    let link = document.querySelector('link[rel="icon"]');
    let flashFavicon = '/images/logo.png';
    tabFlashInterval = setInterval(() => {
        tabFlashState = !tabFlashState;
        document.title = tabFlashState ? flashTitle : origTitle;
        if (link) link.href = tabFlashState ? flashFavicon : origFavicon;
    }, 900);
}

function stopTabHighlight() {
    if (tabFlashInterval) {
        clearInterval(tabFlashInterval);
        tabFlashInterval = null;
        document.title = origTitle;
        let link = document.querySelector('link[rel="icon"]');
        if (link && origFavicon) link.href = origFavicon;
    }
}

// Highlight tab if message mentions current user and window is not focused
socket.on("message", (data) => {
    // ...existing code...
    const myName = nameInput.value;
    if (
        myName &&
        data.name !== myName &&
        data.name !== 'System' &&
        typeof data.text === 'string' &&
        new RegExp(`\\b${myName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(data.text) &&
        !windowFocused
    ) {
        highlightTabForMention(data.name);
    }
    // ...existing code...
});

// Prevent UI zoom from changing the size of the UI on mobile by using viewport meta tag
(function ensureViewportMetaTag() {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'viewport';
        document.head.appendChild(meta);
    }
    // Prevent zoom from resizing UI, but allow user scaling for accessibility
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=1';
})();

// === Theme Picker Logic ===
const themePicker = document.getElementById('theme-picker');
const themeList = [
    'rain.gif',
    'snowfall.gif',
    'beach.gif',
    'fantasy.gif',
    'fireworks.gif',
    'forest.gif',
    'freedom.gif',
    'halloween.gif',
    'fireflies.gif' // Added fireflies theme
];

function setThemeBackground(themeFile) {
    document.body.style.background = `url('/themes/${themeFile}') center center fixed no-repeat`;
    document.body.style.backgroundSize = 'cover';
}

if (themePicker) {
    themePicker.addEventListener('change', function() {
        setThemeBackground(this.value);
        localStorage.setItem('vybchat-theme', this.value);
    });
    // On load, set theme from localStorage or default
    const savedTheme = localStorage.getItem('vybchat-theme');
    if (savedTheme && themeList.includes(savedTheme)) {
        themePicker.value = savedTheme;
        setThemeBackground(savedTheme);
    }
}

// Add clear room button for Admin
function addClearRoomButtonIfAdmin() {
    const isAdmin = nameInput.value === 'Admin';
    let clearBtn = document.getElementById('clear-room-btn');
    if (isAdmin) {
        if (!clearBtn) {
            clearBtn = document.createElement('button');
            clearBtn.id = 'clear-room-btn';
            clearBtn.innerHTML = `
                <span class="clear-room-icon" aria-hidden="true" style="vertical-align:middle;display:inline-block;margin-right:0.5em;">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;">
                        <rect x="4" y="7" width="12" height="9" rx="2" fill="#fff" fill-opacity="0.15"/>
                        <rect x="7" y="2" width="6" height="3" rx="1.5" fill="#fff" fill-opacity="0.25"/>
                        <rect x="2" y="5" width="16" height="2" rx="1" fill="#fff" fill-opacity="0.25"/>
                        <path d="M8 10V14" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
                        <path d="M12 10V14" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </span>
                <span class="clear-room-label">Clear Room</span>
            `;
            clearBtn.type = 'button';
            clearBtn.setAttribute('tabindex', '0');
            clearBtn.setAttribute('title', 'Remove all messages in this room');
            clearBtn.onclick = function() {
                if (confirm('Are you sure you want to clear all messages in this room?')) {
                    socket.emit('clearRoom', { room: currentRoom });
                }
            };
        }
        // Inject modern style for the button only once
        if (!document.getElementById('clear-room-btn-style')) {
            const style = document.createElement('style');
            style.id = 'clear-room-btn-style';
            style.textContent = `
                #clear-room-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5em;
                    width: 100%;
                    margin: 1.2em 0 0 0;
                    padding: 0.7em 0;
                    background: linear-gradient(90deg, #e74c3c 60%, #c0392b 100%);
                    color: #fff;
                    border: none;
                    border-radius: 8px;
                    font-size: 1.08em;
                    font-weight: 600;
                    letter-spacing: 0.02em;
                    box-shadow: 0 2px 10px rgba(231,76,60,0.10);
                    cursor: pointer;
                    transition: background 0.18s, box-shadow 0.18s, transform 0.12s;
                    outline: none;
                    position: relative;
                    z-index: 2;
                }
                #clear-room-btn:focus {
                    box-shadow: 0 0 0 3px rgba(231,76,60,0.18);
                    background: linear-gradient(90deg, #e74c3c 70%, #c0392b 100%);
                }
                #clear-room-btn:hover {
                    background: linear-gradient(90deg, #c0392b 60%, #e74c3c 100%);
                    box-shadow: 0 4px 16px rgba(231,76,60,0.16);
                    transform: translateY(-1px) scale(1.025);
                }
                #clear-room-btn:active {
                    background: #b93222;
                    box-shadow: 0 1px 4px rgba(231,76,60,0.10);
                    transform: scale(0.98);
                }
                #clear-room-btn .clear-room-icon {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                #clear-room-btn .clear-room-label {
                    display: inline-block;
                }
                @media (max-width: 600px) {
                    #clear-room-btn {
                        font-size: 1em;
                        padding: 0.6em 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        // Always move the button to just after the usersList
        if (usersList && clearBtn.parentNode !== usersList.parentNode) {
            usersList.parentNode.insertBefore(clearBtn, usersList.nextSibling);
        }
    } else if (clearBtn) {
        clearBtn.remove();
    }
}
// Call on room join and login
socket.on('userList', ({ users }) => {
    showUsers(users);
});
socket.on('roomList', () => {
    showRooms();
});
socket.on('clearRoom', () => {
    chatDisplay.innerHTML = '';
    processedMessages.clear();
});

// Info/help button functionality
const helpBtn = document.getElementById('help-btn');
if (helpBtn) {
    helpBtn.innerHTML = '<span class="info-icon">ℹ️</span>';
    helpBtn.title = 'Info';
    helpBtn.addEventListener('click', function() {
        let overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(4px);
            z-index: 9998;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        let modal = document.createElement('div');
        modal.className = 'help-credits';
        modal.innerHTML = `
          <div style="font-size:1.3em;margin-bottom:20px;color:#ffd700;text-shadow:0 1px 3px rgba(0,0,0,0.3);"><strong>🔮 Info & Credits</strong></div>
          <div style="margin-bottom:12px;"><strong>Credits:</strong> Emoji art powered by <a href='https://fonts.google.com/emoji' target='_blank' rel='noopener'>Google</a><br>Theme images by <a href='https://pixabay.com/' target='_blank' rel='noopener'>Pixabay</a></div>
          <div style="margin-bottom:12px;"><strong>Need help?</strong> Email <a href='mailto:support@vybchat.com'>support@vybchat.com</a></div>
          <span class='thanks'>Thanks for using <strong>Vyb Chat</strong>! 🎉</span>
          <button id='close-help-modal' class='close-help-modal'>Close</button>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        const closeModal = () => document.body.removeChild(overlay);
        document.getElementById('close-help-modal').onclick = closeModal;
        overlay.onclick = (e) => e.target === overlay && closeModal();
    });
}