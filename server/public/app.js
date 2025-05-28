// Replace the hard-coded localhost URL with a dynamic detection
const serverUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'ws://localhost:3500'
    : window.location.origin;

const socket = io(serverUrl, {
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    autoConnect: true
})

const msgInput = document.querySelector('#message')
const nameInput = document.querySelector('#name')
const chatRoom = document.querySelector('#room')
const activity = document.querySelector('.activity')
const usersList = document.querySelector('.user-list')
const roomList = document.querySelector('.room-list')
const chatDisplay = document.querySelector('.chat-display')
const roomSelect = document.querySelector('#room-select')
let newRoomBtn = document.querySelector('#new-room-btn')
const newRoomForm = document.querySelector('#new-room-form')

function sendMessage(e) {
    e.preventDefault()
    if (nameInput.value && msgInput.value && chatRoom.value) {
        socket.emit('message', {
            name: nameInput.value,
            text: msgInput.value
        })
        msgInput.value = ""
    }
    msgInput.focus()
}

// Initialize display state with a variable rather than relying on style property
let newRoomFormVisible = false;

// Update the event listener to use the state variable
newRoomBtn.addEventListener('click', () => {
    if (!newRoomFormVisible) {
        newRoomForm.style.display = 'block';
        roomSelect.disabled = true;
        newRoomFormVisible = true;
        
        // When showing the text input, make it required
        chatRoom.setAttribute('required', 'required');
    } else {
        newRoomForm.style.display = 'none';
        roomSelect.disabled = false;
        newRoomFormVisible = false;
        
        // When hiding the text input, remove required attribute
        chatRoom.removeAttribute('required');
    }
})

function enterRoom(e) {
    e.preventDefault()
    const selectedRoom = roomSelect.disabled ? chatRoom.value : roomSelect.value
    
    if (nameInput.value && selectedRoom) {
        socket.emit('enterRoom', {
            name: nameInput.value,
            room: selectedRoom
        })
        
        // Reset the form elements
        if (roomSelect.disabled) {
            newRoomForm.style.display = 'none'
            roomSelect.disabled = false
        }
    }
}

document.querySelector('.form-msg')
    .addEventListener('submit', sendMessage)

document.querySelector('.form-join')
    .addEventListener('submit', enterRoom)

msgInput.addEventListener('keypress', () => {
    socket.emit('activity', nameInput.value)
})

// Listen for messages 
socket.on("message", (data) => {

    activity.textContent = "";
    const { name, text, time, image } = data;
    
    const li = document.createElement('li');
    li.className = 'post';
    if (name === nameInput.value) li.className = 'post post--left';
    if (name !== nameInput.value) li.className = 'post post--right';
    
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
        // Ensure image is properly escaped and set with correct styling
        contentHtml += `<div class="post__image">
            <img src="${image}" alt="Shared image" 
                onerror="this.onerror=null; this.src=''; this.alt='Failed to load image'; this.parentNode.classList.add('image-error');" 
                style="max-width:100%; max-height:300px; border-radius:5px; margin-top:5px;">
        </div>`;
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
    
    
    document.querySelector('.chat-display').appendChild(li);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
});

let activityTimer
socket.on("activity", (name) => {
    activity.textContent = `${name} is typing...`

    // Clear after 3 seconds 
    clearTimeout(activityTimer)
    activityTimer = setTimeout(() => {
        activity.textContent = ""
    }, 3000)
})

socket.on('userList', ({ users }) => {
    showUsers(users)
})

socket.on('roomList', ({ rooms }) => {
    showRooms(rooms)
})

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

let currentRoom = '';

// Update enterRoom function to handle form validation properly
function enterRoom(e) {
    e.preventDefault();
    let roomValue;
    
    // Get room value either from input or dropdown
    if (newRoomForm.style.display === 'block') {
        roomValue = chatRoom.value;
        
        if (!roomValue.trim()) {
            // If new room form is visible but empty, prevent submission and focus
            chatRoom.focus();
            return;
        }
    } else {
        roomValue = roomSelect.value;
        
        if (!roomValue) {
            // If dropdown is visible but nothing selected, show alert
            alert("Please select a room or create a new one");
            return;
        }
    }
    
    if (nameInput.value && roomValue) {
        currentRoom = roomValue; // Store current room
        
        socket.emit('enterRoom', {
            name: nameInput.value,
            room: roomValue
        });
        
        // Reset the new room form
        if (newRoomForm.style.display === 'block') {
            newRoomForm.style.display = 'none';
            roomSelect.disabled = false;
        }
    }
}

// Update the event listener for room selection dropdown
roomSelect.addEventListener('change', function() {
    // If a room is selected in dropdown, remove required attribute from textbox
    if (this.value) {
        chatRoom.removeAttribute('required');
    } else if (newRoomFormVisible) {
        // Only add required back if the new room form is visible
        chatRoom.setAttribute('required', 'required');
    }
});

// Remove the old duplicate newRoomBtn click handler and use a single implementation
// Create a standalone function for toggling the room form
function toggleNewRoomForm(show) {
    if (show) {
        newRoomForm.style.display = 'block';
        roomSelect.disabled = true;
        newRoomFormVisible = true;
        
        // Always make required when showing the new room form
        chatRoom.setAttribute('required', 'required');
        
        // Make sure the input is enabled and focused
        chatRoom.removeAttribute('disabled');
        chatRoom.value = '';
        setTimeout(() => chatRoom.focus(), 0);
    } else {
        newRoomForm.style.display = 'none';
        roomSelect.disabled = false;
        newRoomFormVisible = false;
        
        // Always remove required when hiding
        chatRoom.removeAttribute('required');
    }

}

// Clear any existing listeners (to avoid duplicates)
newRoomBtn.removeEventListener('click', toggleNewRoomForm);
const newBtnClone = newRoomBtn.cloneNode(true);
newRoomBtn.parentNode.replaceChild(newBtnClone, newRoomBtn);
newRoomBtn = newBtnClone;

// Add the click event listener to the button
newRoomBtn.addEventListener('click', function(e) {
    e.preventDefault(); // Prevent any form submission
    toggleNewRoomForm(!newRoomFormVisible);
});

// Update showRooms to select the current room
function showRooms(rooms) {
    // First clear the existing dropdown options (except the first placeholder)
    while (roomSelect.options.length > 1) {
        roomSelect.remove(1);
    }
    
    if (rooms && rooms.length) {
        // Add room options to dropdown
        rooms.forEach(room => {
            const option = document.createElement('option');
            option.value = room;
            option.textContent = room;
            roomSelect.appendChild(option);
            
            // Select current room if it matches
            if (currentRoom && room === currentRoom) {
                option.selected = true;
            }
        });
        
        // Also update the rooms container for click functionality
        document.querySelector('.room-selection-container').style.display = 'flex';
        
        // Create room items display (if you still want to show them elsewhere)
        const roomsContainer = document.createElement('div');
        roomsContainer.className = 'rooms-container';
        rooms.forEach(room => {
            const roomItem = document.createElement('div');
            roomItem.className = 'room-item';
            roomItem.dataset.room = room;
            roomItem.innerHTML = `
                <span class="room-icon">🚪</span>
                <span class="room-name">${room}</span>
            `;
            roomItem.addEventListener('click', () => {
                roomSelect.value = room;
                newRoomForm.style.display = 'none';
                roomSelect.disabled = false;
            });
            roomsContainer.appendChild(roomItem);
        });
    } else {
        document.querySelector('.room-selection-container').style.display = 'flex';
    }
}

// Login overlay logic
const loginOverlay = document.querySelector('.login-overlay')
const loginForm = document.querySelector('.login-form')
const loginUsername = document.querySelector('#login-username')
const main = document.querySelector('main')
const logoutBtn = document.querySelector('.logout-btn')

loginForm.addEventListener('submit', function (e) {
    e.preventDefault()
    const username = loginUsername.value.trim()
    if (username) {
        nameInput.value = username
        nameInput.disabled = true
        nameInput.classList.add('disabled')
        localStorage.setItem('vybchat-username', username)
        loginOverlay.classList.add('hide')
        // Hide power button when overlay is visible, show when hidden
        if (logoutBtn) logoutBtn.style.display = 'block'
        setTimeout(() => {
            loginOverlay.style.display = 'none'
            main.style.opacity = '1'
            main.style.pointerEvents = 'auto'
        }, 600)
    }
})

// Prevent chat interaction before login or auto-login if username exists
window.addEventListener('DOMContentLoaded', () => {
    const savedUsername = localStorage.getItem('vybchat-username')
    if (savedUsername) {
        nameInput.value = savedUsername
        nameInput.disabled = true
        nameInput.classList.add('disabled')
        loginOverlay.classList.add('hide')
        loginOverlay.style.display = 'none'
        main.style.opacity = '1'
        main.style.pointerEvents = 'auto'
        if (logoutBtn) logoutBtn.style.display = 'block'
        
        // Request room list if we're already logged in
        if (socket.connected) {
            socket.emit('getRooms');
        }
    } else {
        main.style.opacity = '0.5'
        main.style.pointerEvents = 'none'
        nameInput.disabled = false
        loginOverlay.classList.add('show')
        loginOverlay.style.display = 'flex'
        if (logoutBtn) logoutBtn.style.display = 'none'
        loginUsername.focus()
    }
});

// Add connection events to request room list immediately
socket.on('connect', () => {
    // Request room list immediately after connection
    socket.emit('getRooms');
    
    // If we were in a room before disconnection, try to rejoin it
    if (currentRoom && nameInput.value) {
        socket.emit('enterRoom', {
            name: nameInput.value,
            room: currentRoom
        });
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

socket.on('error', (error) => {

});

// Add a keepalive ping to prevent timeout disconnections
setInterval(() => {
    if (socket.connected) {
        socket.emit('keepalive');
    }
}, 30000); // Send keepalive every 30 seconds

// Add image upload functionality
const imageUploadBtn = document.getElementById('image-upload-btn');
const imageFileInput = document.getElementById('image-file');

// Trigger file input when image button is clicked
imageUploadBtn.addEventListener('click', () => {
    imageFileInput.click();
});

// Fix image upload functionality
imageFileInput.addEventListener('change', function() {
    if (this.files && this.files[0]) {
        const file = this.files[0];
        
        // Validate file size and type
        if (file.size > 2 * 1024 * 1024) {
            alert('Image too large (max 2MB). Please select a smaller image.');
            this.value = '';
            return;
        }
        
        if (!file.type.match('image.*')) {
            alert('Please select a valid image file.');
            this.value = '';
            return;
        }
        
        const reader = new FileReader();
        
        // Show sending indicator
        const activityEl = document.querySelector('.activity');
        if (activityEl) activityEl.textContent = 'Processing image...';
        
        reader.onload = function(e) {
            const imageData = e.target.result;
            
            if (activityEl) activityEl.textContent = 'Sending image...';
            
            // Validate current room
            if (!currentRoom) {
                alert('Please join a room before sending images');
                if (activityEl) activityEl.textContent = '';
                return;
            }
            
            // Send image message to the server
            socket.emit('imageMessage', {
                name: nameInput.value,
                image: imageData
            });
            
            // Clear the file input for future uploads
            imageFileInput.value = '';
            
            // Clear activity message after short delay
            setTimeout(() => {
                if (activityEl && activityEl.textContent === 'Sending image...') {
                    activityEl.textContent = '';
                }
            }, 3000);
        };
        
        reader.onerror = function(error) {
            console.error('Error reading file:', error);
            alert('Error reading image file. Please try again.');
            if (activityEl) activityEl.textContent = '';
        };
        
        reader.readAsDataURL(file);
    }
});

// Also improve paste functionality with error handling
document.addEventListener('paste', function(e) {
    // Only process paste if focused on message input
    if (document.activeElement === msgInput) {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        let foundImage = false;
        
        for (const item of items) {
            if (item.type.indexOf('image') === 0) {
                foundImage = true;
                e.preventDefault();
                
                const blob = item.getAsFile();
                
                
                const reader = new FileReader();
                
                reader.onload = function(event) {
                    if (nameInput.value && currentRoom) {
                        // Send image message

                        socket.emit('imageMessage', {
                            name: nameInput.value,
                            image: event.target.result
                        });
                    } else {
                        alert('Please join a room before sending images');
                    }
                };
                
                reader.onerror = function() {

                    alert("Error reading image data. Please try again.");
                };
                
                reader.readAsDataURL(blob);
                break;
            }
        }
    }
});

// Add emoji picker functionality
const emojiBtn = document.getElementById('emoji-btn');
const emojiPicker = document.getElementById('emoji-picker');
const emojiContainer = document.getElementById('emoji-container');
const closeEmojiPickerBtn = document.getElementById('close-emoji-picker');

// Toggle emoji picker visibility
emojiBtn?.addEventListener('click', () => {
    if (emojiPicker.style.display === 'none' || !emojiPicker.style.display) {
        emojiPicker.style.display = 'flex';
        loadEmojis();
    } else {
        emojiPicker.style.display = 'none';
    }
});

// Close emoji picker
closeEmojiPickerBtn?.addEventListener('click', () => {
    emojiPicker.style.display = 'none';
});

// Load emojis from server with better error handling
function loadEmojis() {
    // Clear previous emojis except loading indicator
    emojiContainer.innerHTML = '<div class="emoji-loading">Loading emojis...</div>';
    
    // Convert WebSocket URL to HTTP URL for fetch API - ensure it works in production
    const apiUrl = serverUrl.replace('ws://', 'http://').replace('wss://', 'https://');
    
    // Fetch list of emojis from the server
    fetch(`${apiUrl}/api/emojis`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
        },
        cache: 'no-cache' // Force fresh fetch
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(emojis => {
        if (!Array.isArray(emojis) || emojis.length === 0) {
            emojiContainer.innerHTML = '<div class="emoji-loading">No emojis available.</div>';
            return;
        }
        
        emojiContainer.innerHTML = ''; // Clear loading message
        
        // Add each emoji to the picker with consistent URL structure
        emojis.forEach((emoji, index) => {
            const emojiItem = document.createElement('div');
            emojiItem.className = 'emoji-item';
            emojiItem.title = emoji.replace(/\.[^.]+$/, ''); // Remove file extension for title
            
            const img = document.createElement('img');
            // Use relative URL for consistent rendering across environments
            img.src = `/emojis/${emoji}`;
            img.alt = emojiItem.title;
            img.setAttribute('data-emoji', emoji);
            img.setAttribute('loading', 'eager'); 
            
            // Test that the emoji loads properly
            img.onerror = function() {
                console.error(`Failed to load emoji: ${emoji}`);
                this.parentElement.innerHTML = `<span class="emoji-fallback">${emoji.charAt(0).toUpperCase()}</span>`;
            };
            
            // Add "loaded" class when the image loads correctly
            img.onload = function() {
                this.classList.add('loaded');
            };
            
            emojiItem.appendChild(img);
            emojiContainer.appendChild(emojiItem);
            
            // Add click event to insert emoji into message
            emojiItem.addEventListener('click', () => {
                insertEmoji(emoji);
                // Log success for debugging
               
            });
        });
    })
    .catch(error => {
        console.error('Error loading emojis:', error);
        
        // Provide a more helpful error message and fallback
        emojiContainer.innerHTML = `
            <div class="emoji-loading">
                <p>Error loading emojis: ${error.message}</p>
                <p>Try placing emoji images in server/emojis folder</p>
                <p><button id="retry-emojis-btn" class="emoji-retry-btn">Retry</button></p>
            </div>`;
            
        // Add retry button event listener
        document.getElementById('retry-emojis-btn')?.addEventListener('click', () => loadEmojis());
    });
}

// Insert emoji into message input
function insertEmoji(emoji) {
    // Insert emoji image reference in text input
    const emojiText = `[emoji:${emoji}]`;
    const cursorPos = msgInput.selectionStart;
    const textBefore = msgInput.value.substring(0, cursorPos);
    const textAfter = msgInput.value.substring(cursorPos);
    
    msgInput.value = textBefore + emojiText + textAfter;
    msgInput.focus();
    
    // Place cursor after inserted emoji
    const newCursorPos = cursorPos + emojiText.length;
    msgInput.setSelectionRange(newCursorPos, newCursorPos);
    
    // Close emoji picker
    emojiPicker.style.display = 'none';
}

// Modify sendMessage to handle emoji markers
const originalSendMessage = sendMessage;

sendMessage = function(e) {
    e.preventDefault();
    
    if (nameInput.value && msgInput.value && currentRoom) {
        let messageText = msgInput.value;
        
        // Process emoji markers in message
        socket.emit('message', {
            name: nameInput.value,
            text: messageText
        });
        
        msgInput.value = "";
    } else if (!currentRoom) {
        alert('Please join a room before sending messages');
    }
    
    msgInput.focus();
};

// Add CSS for emoji fallbacks directly in JavaScript to ensure it's applied
(function() {
    const style = document.createElement('style');
    style.textContent = `
        .emoji-fallback {
            display: flex;
            justify-content: center;
            align-items: center;
            width: 30px;
            height: 30px;
            background-color: #f0f0f0;
            border-radius: 4px;
            font-weight: bold;
            color: #555;
            font-size: 14px;
        }
        
        .emoji-retry-btn {
            padding: 5px 10px;
            background: #6c63ff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 10px;
        }
    `;
    document.head.appendChild(style);
})();