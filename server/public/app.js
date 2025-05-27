const socket = io(window.location.origin);

const msgInput = document.querySelector('#message')
const nameInput = document.querySelector('#name')
const chatRoom = document.querySelector('#room')
const activity = document.querySelector('.activity')
const usersList = document.querySelector('.user-list')
const roomList = document.querySelector('.room-list')
const chatDisplay = document.querySelector('.chat-display')
const roomSelect = document.querySelector('#room-select')
const newRoomBtn = document.querySelector('#new-room-btn')
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
        chatRoom.focus();
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
    activity.textContent = ""
    const { name, text, time } = data
    const li = document.createElement('li')
    li.className = 'post'
    if (name === nameInput.value) li.className = 'post post--left'
    if (name !== nameInput.value && name !== 'Admin') li.className = 'post post--right'
    if (name !== 'Admin') {
        li.innerHTML = `<div class="post__header ${name === nameInput.value
            ? 'post__header--user'
            : 'post__header--reply'
            }">
        <span class="post__header--name">${name}</span> 
        <span class="post__header--time">${time}</span> 
        </div>
        <div class="post__text">${text}</div>`
    } else {
        li.innerHTML = `<div class="post__text">${text}</div>`
    }
    document.querySelector('.chat-display').appendChild(li)

    chatDisplay.scrollTop = chatDisplay.scrollHeight
})

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

// Update the toggle functionality for new room form
newRoomBtn.addEventListener('click', () => {
    if (newRoomForm.style.display === 'none') {
        newRoomForm.style.display = 'block';
        roomSelect.disabled = true;
        
        // Make sure room input is not required when hidden
        if (roomSelect.disabled) {
            // When showing the text input, make it required
            chatRoom.setAttribute('required', 'required');
        }
        
        chatRoom.focus();
    } else {
        newRoomForm.style.display = 'none';
        roomSelect.disabled = false;
        
        // When hiding the text input, remove required attribute
        chatRoom.removeAttribute('required');
    }
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
            chatRoom.focus()
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
        chatRoom.focus()
        
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
});

// Initialize the form state on page load
window.addEventListener('DOMContentLoaded', () => {
    // Set initial state
    newRoomForm.style.display = 'none';
    newRoomFormVisible = false;
    
    // ...existing code...
});