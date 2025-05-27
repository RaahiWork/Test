const socket = io(window.location.origin);

const msgInput = document.querySelector('#message')
const nameInput = document.querySelector('#name')
const chatRoom = document.querySelector('#room')
const activity = document.querySelector('.activity')
const usersList = document.querySelector('.user-list')
const roomList = document.querySelector('.room-list')
const chatDisplay = document.querySelector('.chat-display')

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

function enterRoom(e) {
    e.preventDefault()
    if (nameInput.value && chatRoom.value) {
        socket.emit('enterRoom', {
            name: nameInput.value,
            room: chatRoom.value
        })
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
        usersList.innerHTML = `<ul style="list-style:none;padding-left:0;margin:0;">` +
            users.map(user => `<li style="margin-bottom:0.3em;">${user.name}</li>`).join('') +
            `</ul>`;
    } else {
        usersList.innerHTML = `<em>No users in room</em>`;
    }
}

function showRooms(rooms) {
    roomList.textContent = ''
    if (rooms) {
        roomList.innerHTML = '<em>Active Rooms:</em>'
        rooms.forEach((room, i) => {
            roomList.textContent += ` ${room}`
            if (rooms.length > 1 && i !== rooms.length - 1) {
                roomList.textContent += ","
            }
        })
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
    } else {
        main.style.opacity = '0.5'
        main.style.pointerEvents = 'none'
        nameInput.disabled = false
        loginOverlay.classList.add('show')
        loginOverlay.style.display = 'flex'
        if (logoutBtn) logoutBtn.style.display = 'none'
        loginUsername.focus()
    }
})