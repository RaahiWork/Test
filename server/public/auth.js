let cachedUsers = [];
let usersDataLoaded = false;

document.addEventListener('DOMContentLoaded', function() {
    fetchAndCacheUsersFromMongoDB();
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            window.location.reload();
        });
    }
    
    const loginButton = document.getElementById('login-button');
    
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        loginButton.classList.add('mobile-button');
        
        loginButton.addEventListener('touchstart', function(e) {
            // Visual feedback only
        }, { passive: true });
    }
    
    const usernameInput = document.getElementById('login-username');
    usernameInput.addEventListener('focus', function() {
        setTimeout(function() {
            window.scrollTo(0, 0);
        }, 50);
    });
});

async function fetchAndCacheUsersFromMongoDB() {
    try {
        const serverUrl = (() => {
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                return `http://${window.location.hostname}:3500`;
            } else {
                return window.location.origin;
            }
        })();
        
        const response = await fetch(`${serverUrl}/api/users`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        cachedUsers = data.users || [];
        usersDataLoaded = true;
        
    } catch (error) {
        usersDataLoaded = false;
        cachedUsers = [];
    }
}

function findCachedUser(username) {
    if (!usersDataLoaded || !cachedUsers) {
        return null;
    }
    return cachedUsers.find(user => 
        (user.username && user.username.toLowerCase() === username.toLowerCase()) ||
        (user.displayName && user.displayName.toLowerCase() === username.toLowerCase())
    );
}

window.refreshUserData = function() {
    fetchAndCacheUsersFromMongoDB();
};

function showLoginMessage(message, type = 'error') {
    const messageElement = document.getElementById('login-message');
    messageElement.textContent = message;
    messageElement.className = `login-message ${type}`;
    
    if (type === 'success') {
        setTimeout(() => {
            messageElement.textContent = '';
            messageElement.className = 'login-message';
        }, 3000);
    }
}

function clearLoginMessage() {
    const messageElement = document.getElementById('login-message');
    messageElement.textContent = '';
    messageElement.className = 'login-message';
}

function attemptRegistration(username, password) {
    const serverUrl = (() => {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return `http://${window.location.hostname}:3500`;
        } else {
            return window.location.origin;
        }
    })();

    const loginButton = document.getElementById('login-button');
    loginButton.textContent = 'Creating Account...';
    showLoginMessage('Creating your account...', 'info');
    
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${serverUrl}/api/register`, false);
    xhr.setRequestHeader('Content-Type', 'application/json');
    
    try {
        xhr.send(JSON.stringify({
            username: username,
            password: password
        }));
        
        const registerData = JSON.parse(xhr.responseText);
        
        if (xhr.status === 200 || xhr.status === 201) {
            const displayName = registerData.user.displayName || registerData.user.username;
            showLoginMessage(`Welcome ${displayName}! Your account has been created.`, 'success');
            
            cachedUsers.push({
                _id: registerData.user.id,
                username: registerData.user.username,
                displayName: displayName,
                createdAt: registerData.user.createdAt
            });
            
            setTimeout(() => proceedWithLogin(displayName), 1500);
            
        } else {
            if (xhr.status === 409) {
                showLoginMessage('Username already exists. Please try logging in with the correct password.');
            } else if (xhr.status === 400) {
                if (registerData.details && Array.isArray(registerData.details)) {
                    showLoginMessage(`Registration failed: ${registerData.details.join(', ')}`);
                } else {
                    showLoginMessage(`Registration failed: ${registerData.error}`);
                }
            } else {
                showLoginMessage('Registration failed. Please try again.');
            }
        }
    } catch (error) {
        showLoginMessage('Registration failed. Please try again.');
    }
}

function attemptLogin(username, password) {
    const serverUrl = (() => {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return `http://${window.location.hostname}:3500`;
        } else {
            return window.location.origin;
        }
    })();

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${serverUrl}/api/login`, false);
    xhr.setRequestHeader('Content-Type', 'application/json');
    
    try {
        xhr.send(JSON.stringify({
            username: username,
            password: password
        }));
        
        const loginData = JSON.parse(xhr.responseText);

        if (xhr.status === 200) {
            const displayName = loginData.user.displayName || loginData.user.username;
            showLoginMessage(`Welcome back, ${displayName}!`, 'success');
            setTimeout(() => proceedWithLogin(displayName), 1500);

        } else {
            showLoginMessage('Incorrect password. Please try again.');

            document.getElementById('login-password').value = '';

            const passwordField = document.getElementById('login-password');
            passwordField.style.borderColor = '#ff6b6b';
            passwordField.style.backgroundColor = '#ffe6e6';

            setTimeout(() => {
                passwordField.style.borderColor = '';
                passwordField.style.backgroundColor = '';
            }, 3000);

            passwordField.focus();

            const loginOverlay = document.querySelector('.login-overlay');
            const main = document.querySelector('main');

            loginOverlay.style.display = 'flex';
            loginOverlay.classList.remove('hide');
            main.style.opacity = '0.5';
            main.style.pointerEvents = 'none';
            return false;
        }
    } catch (error) {
        showLoginMessage('Login failed. Please try again.');
    }
}

function handleLoginSubmit(e) {
    e.preventDefault();
    
    clearLoginMessage();
    
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!username || !password) {
        showLoginMessage('Please enter both username and password');
        return;
    }
    
    if (username.length < 3) {
        showLoginMessage('Username must be at least 3 characters long');
        return;
    }
    
    if (username.length > 20) {
        showLoginMessage('Username cannot exceed 20 characters');
        return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        showLoginMessage('Username can only contain letters, numbers, and underscores');
        return;
    }
    
    if (password.length < 6) {
        showLoginMessage('Password must be at least 6 characters long');
        return;
    }
    
    const loginButton = document.getElementById('login-button');
    const originalText = loginButton.textContent;
    
    try {
        loginButton.textContent = 'Checking...';
        loginButton.disabled = true;
        showLoginMessage('Checking credentials...', 'info');
        
        const existingUser = findCachedUser(username);
        
        if (existingUser) {
            attemptLogin(username, password);
        } else {
            loginButton.textContent = 'Creating Account...';
            showLoginMessage('Creating your account...', 'info');
            attemptRegistration(username, password);
        }
        
    } catch (error) {
        showLoginMessage('Connection error. Please check if the server is running and try again.');
    } finally {
        loginButton.textContent = originalText;
        loginButton.disabled = false;
    }
}

function proceedWithLogin(displayName) {
    clearLoginMessage();
    
    // Use the database format for the username if available
    const cachedUser = findCachedUser(displayName);
    const dbDisplayName = cachedUser ? (cachedUser.displayName || cachedUser.username) : displayName;
    
    const nameField = document.querySelector('#name');
    if (nameField) nameField.value = dbDisplayName;
    
    localStorage.setItem('vybchat-username', dbDisplayName);
    
    const nameInput = document.querySelector('#name');
    if (nameInput) {
        nameInput.value = dbDisplayName;
        nameInput.disabled = true;
        nameInput.classList.add('disabled');
    }
    
    const loginOverlay = document.querySelector('.login-overlay');
    const main = document.querySelector('main');
    
    loginOverlay.classList.add('hide');
    
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) logoutBtn.style.display = 'block';
    
    setTimeout(() => {
        loginOverlay.style.display = 'none';
        main.style.opacity = '1';
        main.style.pointerEvents = 'auto';
        
        if (window.initializeSocketConnection) {
            window.initializeSocketConnection(dbDisplayName);
        } else if (window.socket && window.socket.connected) {
            // Auto-join Vibe room after login
            window.socket.emit('enterRoom', {
                name: dbDisplayName,
                room: 'Vibe'
            });
            
            // Update current room in app.js if available
            if (window.currentRoom !== undefined) {
                window.currentRoom = 'Vibe';
            }
        }
    }, 600);
}
