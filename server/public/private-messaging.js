// Private messaging functionality
class PrivateMessaging {
    constructor() {
        this.privateConversations = new Map();
        this.currentPrivateChat = null;
        this.unreadCounts = new Map();
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupSocketHandlers();
    }
    
    setupEventListeners() {
        // Close private message modal
        const closeBtn = document.getElementById('close-private-message');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closePrivateMessage());
        }
        
        // Private message form submission
        const privateForm = document.getElementById('private-message-form');
        if (privateForm) {
            privateForm.addEventListener('submit', (e) => this.handlePrivateMessageSubmit(e));
        }
        
        // Private image upload
        const privateImageBtn = document.getElementById('private-image-btn');
        const privateImageFile = document.getElementById('private-image-file');
        
        if (privateImageBtn && privateImageFile) {
            privateImageBtn.addEventListener('click', () => privateImageFile.click());
            privateImageFile.addEventListener('change', (e) => this.handlePrivateImageUpload(e));
        }

        // Private message emoji button
        const privateEmojiBtn = document.getElementById('private-emoji-btn');
        const privateMessageInput = document.getElementById('private-message-input');

        if (privateEmojiBtn && privateMessageInput) {
            privateEmojiBtn.addEventListener('click', (e) => {
                if (window.openEmojiPickerFor) {
                    window.openEmojiPickerFor(e, privateMessageInput, privateEmojiBtn);
                } else {
                    console.error('Emoji picker handler (window.openEmojiPickerFor) not available.');
                }
            });
        }
        
        // Close modal when clicking outside
        const modal = document.getElementById('private-message-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closePrivateMessage();
                }
            });
        }

        // Private voice message
        const privateVoiceBtn = document.getElementById('private-voice-record-btn');
        const privateVoiceFile = document.getElementById('private-voice-file');
        if (privateVoiceBtn && privateVoiceFile) {
            let mediaRecorder, audioChunks = [];
            privateVoiceBtn.addEventListener('click', async () => {
                if (mediaRecorder && mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                    privateVoiceBtn.textContent = '🎤';
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
                        reader.onload = (event) => {
                            this.sendPrivateMessage(this.currentPrivateChat, null, null, event.target.result);
                        };
                        reader.readAsDataURL(audioBlob);
                    };
                    mediaRecorder.start();
                    privateVoiceBtn.textContent = '⏹️';
                } catch (err) {
                    alert('Could not start recording: ' + err.message);
                }
            });
            privateVoiceFile.addEventListener('change', function() {
                if (this.files && this.files[0]) {
                    const file = this.files[0];
                    if (!file.type.match('audio.*')) {
                        alert('Please select a valid audio file.');
                        this.value = '';
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        window.privateMessaging.sendPrivateMessage(
                            window.privateMessaging.currentPrivateChat, null, null, event.target.result
                        );
                    };
                    reader.readAsDataURL(file);
                    this.value = '';
                }
            });
        }
    }
    
    setupSocketHandlers() {
        // Wait for socket to be available
        const waitForSocket = () => {
            if (typeof socket !== 'undefined' && socket) {
                //console.log('Setting up private messaging socket handlers');
                
                // Handle incoming private messages
                socket.on('privateMessage', (data) => {
                    //console.log('Received private message:', data);
                    this.handleIncomingPrivateMessage(data);
                });
                
                // Handle private message sent confirmation
                socket.on('privateMessageSent', (data) => {
                    //console.log('Private message sent confirmation:', data);
                    this.handlePrivateMessageSent(data);
                });
                
                // Handle private message errors
                socket.on('privateMessageError', (data) => {
                    //console.log('Private message error:', data);
                    this.handlePrivateMessageError(data);
                });
            } else {
                // Retry after 100ms if socket not ready
                setTimeout(waitForSocket, 100);
            }
        };
        
        waitForSocket();
    }
    
    openPrivateMessage(username) {
        const nameInput = document.querySelector('#name');
        if (!username || username === nameInput?.value) return;
        
        this.currentPrivateChat = username;
        
        // Update modal title
        const title = document.getElementById('private-message-title');
        if (title) {
            title.textContent = `Private Message - ${username}`;
        }
        
        // Clear unread count for this user
        this.unreadCounts.set(username, 0);
        this.updateConversationTabs();
        
        // Load conversation history
        this.loadConversationHistory(username);
        
        // Show modal
        const modal = document.getElementById('private-message-modal');
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('show'), 10);
        }
        
        // Focus on input
        const input = document.getElementById('private-message-input');
        if (input) {
            setTimeout(() => input.focus(), 100);
        }
    }
    
    closePrivateMessage() {
        const modal = document.getElementById('private-message-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.style.display = 'none';
                this.currentPrivateChat = null;
            }, 300);
        }
    }
    
    handlePrivateMessageSubmit(e) {
        e.preventDefault();
        
        if (!this.currentPrivateChat) return;
        
        const input = document.getElementById('private-message-input');
        const message = input?.value?.trim();
        
        if (!message) return;
        
        // Send private message
        this.sendPrivateMessage(this.currentPrivateChat, message);
        
        // Clear input
        if (input) {
            input.value = '';
        }
    }
    
    sendPrivateMessage(toUser, text, image = null, voice = null) {
        const nameInput = document.querySelector('#name');
        
        if (typeof socket === 'undefined' || !socket || !nameInput?.value) {
            console.error('Socket not available or nameInput not found', {
                socketAvailable: typeof socket !== 'undefined' && !!socket,
                nameInputValue: nameInput?.value
            });
            return;
        }
        
        //console.log('Sending private message:', { fromUser: nameInput.value, toUser, text, image: image ? 'Image data' : null });
        
        socket.emit('privateMessage', {
            fromUser: nameInput.value,
            toUser,
            text,
            image,
            voice
        });
    }
    
    handleIncomingPrivateMessage(data) {
        const nameInput = document.querySelector('#name');
        const { fromUser, text, image, time, voice } = data;
        
        // Add to conversation history
        this.addMessageToConversation(fromUser, {
            fromUser,
            toUser: nameInput?.value,
            text,
            image,
            voice,
            time,
            type: 'received'
        });
        
        // Show notification if not currently viewing this conversation
        if (this.currentPrivateChat !== fromUser) {
            this.showPrivateMessageNotification(fromUser, text || 'Image');
            
            // Increment unread count
            const currentCount = this.unreadCounts.get(fromUser) || 0;
            this.unreadCounts.set(fromUser, currentCount + 1);
            this.updateConversationTabs();
        } else {
            // Update the current chat display
            this.displayMessage(data, 'received');
        }
    }
    
    handlePrivateMessageSent(data) {
        //console.log('Handling sent message:', data);
        const nameInput = document.querySelector('#name');
        const { toUser, text, image, time, voice } = data;
        
        // Add to conversation history
        this.addMessageToConversation(toUser, {
            fromUser: nameInput?.value,
            toUser,
            text,
            image,
            voice,
            time,
            type: 'sent'
        });
        
        // Update current chat display if viewing this conversation
        if (this.currentPrivateChat === toUser) {
            //console.log('Displaying sent message in current chat');
            this.displayMessage({
                fromUser: nameInput?.value,
                toUser,
                text,
                image,
                time
            }, 'sent');
        }
        
        // Update conversation tabs
        this.updateConversationTabs();
    }
    
    handlePrivateMessageError(data) {
        alert(`Failed to send message: ${data.error}`);
    }
    
    addMessageToConversation(username, message) {
        if (!this.privateConversations.has(username)) {
            this.privateConversations.set(username, []);
        }
        
        this.privateConversations.get(username).push(message);
        
        // Limit conversation history to last 100 messages
        const conversation = this.privateConversations.get(username);
        if (conversation.length > 100) {
            conversation.splice(0, conversation.length - 100);
        }
    }
    
    loadConversationHistory(username) {
        const chatContainer = document.getElementById('private-message-chat');
        if (!chatContainer) return;
        
        chatContainer.innerHTML = '';
        
        const conversation = this.privateConversations.get(username) || [];
        
        if (conversation.length === 0) {
            chatContainer.innerHTML = '<div style="text-align: center; color: #888; margin: 2rem 0;">Start a private conversation!</div>';
            return;
        }
        
        conversation.forEach(message => {
            this.displayMessage(message, message.type);
        });
        
        // Scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    displayMessage(data, type) {
        //console.log('Displaying message:', { data, type });
        const chatContainer = document.getElementById('private-message-chat');
        if (!chatContainer) {
            console.error('Private message chat container not found');
            return;
        }
        
        const nameInput = document.querySelector('#name');
        
        // Create message element using same structure as main chat
        const li = document.createElement('li');
        li.className = 'post';
        
        // Match main chatroom: sent messages left, received messages right
        if (type === 'received') {
            li.className = 'post post--right';
        } else if (type === 'sent') {
            li.className = 'post post--left';
        } else {
            li.className = 'post post--admin';
        }
        
        // Don't show system messages in private chat for now
        if (data.fromUser === 'System') return;
        
        // Convert server time to local time (same as main chat)
        const localTime = this.formatLocalTime(data.time);
        
        let contentHtml = `<div class="post__header ${type === 'received'
            ? 'post__header--reply'
            : 'post__header--user'
        }">
            <span class="post__header--name">${type === 'sent' ? nameInput?.value || 'You' : data.fromUser}</span> 
            <span class="post__header--time">${localTime}</span> 
        </div>`;
        
        // Add image content if available
        if (data.image) {
            // Create image container
            const imageContainer = document.createElement('div');
            imageContainer.className = 'post__image';
            
            // Add loading indicator
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'image-loading';
            loadingDiv.textContent = 'Loading image...';
            imageContainer.appendChild(loadingDiv);
            
            // Create image element
            const imgElement = document.createElement('img');
            imgElement.alt = 'Shared image';
            imgElement.style.maxWidth = '100%';
            imgElement.style.maxHeight = '300px';
            imgElement.style.borderRadius = '5px';
            imgElement.style.marginTop = '5px';
            imgElement.style.display = 'none';
            imageContainer.appendChild(imgElement);
            
            contentHtml += imageContainer.outerHTML;
            
            // Set image source after adding to DOM
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
                    
                    addedImg.src = data.image;
                }
            }, 10);
        }
        
        // Add voice content if available
        if (data.voice) {
            contentHtml += `<div class="post__voice"><audio controls src="${data.voice}"></audio></div>`;
        }
        
        // Add text content if available
        if (data.text) {
            // Process emoji markers in text (same as main chat)
            let processedText = data.text;
            const emojiRegex = /\[emoji:([^\]]+)\]/g;
            
            processedText = processedText.replace(emojiRegex, (match, emojiFile) => {
                return `<img class="emoji" src="/emojis/${emojiFile}" alt="emoji" 
                    data-emoji="${emojiFile}"
                    onerror="console.error('Failed to load emoji in private message:', this.getAttribute('data-emoji')); this.style.display='none'; this.insertAdjacentText('afterend', '😊');">`;
            });
            
            contentHtml += `<div class="post__text">${processedText}</div>`;
        }
        
        li.innerHTML = contentHtml;
        chatContainer.appendChild(li);
        
        //console.log('Message added to chat container');
        
        // Scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    // Add utility function to format time (same as main chat)
    formatLocalTime(timestamp) {
        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) {
                return timestamp;
            }
            
            return date.toLocaleTimeString([], {
                hour: 'numeric',
                minute: 'numeric'
            });
        } catch (error) {
            console.error('Error formatting time:', error);
            return timestamp;
        }
    }
    
    updateConversationTabs() {
        const container = document.getElementById('private-conversations');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Sort conversations by most recent message
        const sortedConversations = Array.from(this.privateConversations.entries())
            .sort((a, b) => {
                const aLastMessage = a[1][a[1].length - 1];
                const bLastMessage = b[1][b[1].length - 1];
                return new Date(bLastMessage?.time || 0) - new Date(aLastMessage?.time || 0);
            });
        
        sortedConversations.forEach(([username, messages]) => {
            const tab = document.createElement('div');
            tab.className = 'private-conversation-tab';
            
            const unreadCount = this.unreadCounts.get(username) || 0;
            if (unreadCount > 0) {
                tab.classList.add('has-unread');
            }
            
            const lastMessage = messages[messages.length - 1];
            const preview = lastMessage ? 
                (lastMessage.text || 'Image') : 
                'No messages yet';
            
            tab.innerHTML = `
                <div class="private-conversation-name">${username}</div>
                <div class="private-conversation-preview">${preview.substring(0, 30)}${preview.length > 30 ? '...' : ''}</div>
            `;
            
            tab.addEventListener('click', () => this.openPrivateMessage(username));
            container.appendChild(tab);
        });
    }
    
    showPrivateMessageNotification(fromUser, text) {
        // Remove existing notification
        const existingNotification = document.querySelector('.private-message-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = 'private-message-notification';
        notification.innerHTML = `
            <div class="private-message-notification-header">New message from ${fromUser}</div>
            <div class="private-message-notification-text">${text}</div>
        `;
        
        // Add click handler to open conversation
        notification.addEventListener('click', () => {
            this.openPrivateMessage(fromUser);
            notification.remove();
        });
        
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }
    
    handlePrivateImageUpload(e) {
        const file = e.target.files[0];
        if (!file || !this.currentPrivateChat) return;
        
        if (!file.type.match('image.*')) {
            alert('Please select a valid image file.');
            e.target.value = '';
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            alert('Image file is too large. Please select an image less than 5MB.');
            e.target.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
            this.sendPrivateMessage(this.currentPrivateChat, null, event.target.result);
            e.target.value = '';
        };
        
        reader.onerror = () => {
            alert('Failed to read image file. Please try again.');
            e.target.value = '';
        };
        
        reader.readAsDataURL(file);
    }
}

// Initialize private messaging when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.privateMessaging = new PrivateMessaging();
});
