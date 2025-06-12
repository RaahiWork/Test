// Private messaging functionality
class PrivateMessaging {
    constructor() {
        this.privateConversations = new Map();
        this.currentPrivateChat = null;
        this.unreadCounts = new Map();
        this.voiceCallModal = null;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.isCaller = false;
        this.currentCallUser = null;
        this.ringtoneAudio = null;
        this.ringing = false;
        this.originalTitle = document.title;
        this.originalFavicon = this.getFaviconHref();
        this.tabFlashInterval = null;
        this.tabFlashState = false;
        this.windowFocused = true;
        this.init();    }
      // Helper function to get fallback avatar URL for private messaging
    getFallbackAvatarUrl(username) {
        // Use the main app's getAvatarUrl function if available
        if (window.getAvatarUrl) {
            return window.getAvatarUrl(username);
        }
        // Default fallback to default avatar
        return 'https://vybchat-media.s3.ap-south-1.amazonaws.com/avatars/default/default.jpg';
    }
    
    init() {
        this.setupEventListeners();
        this.setupSocketHandlers();
        this.setupVoiceCallUI();
        this.setupRingtone();
        this.setupTabFocusHandlers();

        // Always fetch recent private chats after DOMContentLoaded and username is available
        const tryFetchRecentChats = () => {
            const myName = this.getMyName();
            if (typeof socket !== 'undefined' && socket && myName) {
                socket.emit('getRecentPrivateChats', { user: myName });
            } else {
                setTimeout(tryFetchRecentChats, 300);
            }
        };

        document.addEventListener('DOMContentLoaded', () => {
            tryFetchRecentChats();
        });
    }
    
    setupRingtone() {
        // Use the local ringtone for both calling and receiving
        this.ringtoneAudio = document.createElement('audio');
        this.ringtoneAudio.src = '/assets/ringtone.mp3';
        this.ringtoneAudio.loop = true;
        this.ringtoneAudio.preload = 'auto';
        this.ringtoneAudio.volume = 0.7;
        document.body.appendChild(this.ringtoneAudio);
    }

    playRingtone() {
        if (this.ringtoneAudio && !this.ringing) {
            this.ringing = true;
            this.ringtoneAudio.currentTime = 0;
            this.ringtoneAudio.play().catch(() => {});
        }
    }

    stopRingtone() {
        if (this.ringtoneAudio && this.ringing) {
            this.ringing = false;
            this.ringtoneAudio.pause();
            this.ringtoneAudio.currentTime = 0;
        }
    }

    setupVoiceCallUI() {
        // Create modal if not present
        let modal = document.getElementById('private-voice-call-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'private-voice-call-modal';
            modal.style.display = 'none';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100vw';
            modal.style.height = '100vh';
            modal.style.background = 'rgba(0,0,0,0.7)';
            modal.style.zIndex = '2000';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.display = 'flex';
            document.body.appendChild(modal);
        }
        modal.innerHTML = `
            <div style="background:#222;padding:2em 2.5em;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.3);display:flex;flex-direction:column;align-items:center;gap:1.2em;min-width:260px;max-width:90vw;">
                <div style="font-size:2.2em;margin-bottom:0.2em;" id="voice-call-icon">🔊</div>
                <div id="voice-call-status" style="color:#fff;font-size:1.1em;text-align:center;">Calling...</div>
                <audio id="voice-call-remote-audio" autoplay style="margin:1em 0;"></audio>
                <div id="voice-call-actions" style="display:flex;gap:1.5em;">
                    <button id="voice-call-end-btn" style="background:#ff6b6b;color:#fff;border:none;border-radius:50%;width:48px;height:48px;font-size:1.5em;cursor:pointer;">⏹️</button>
                    <button id="voice-call-mute-btn" style="background:#444;color:#fff;border:none;border-radius:50%;width:48px;height:48px;font-size:1.3em;cursor:pointer;">🔇</button>
                </div>
            </div>
        `;
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.endVoiceCall();
        });
        this.voiceCallModal = modal;

        // End call button
        modal.querySelector('#voice-call-end-btn').onclick = () => this.endVoiceCall();
        // Mute button (toggle)
        let muted = false;
        modal.querySelector('#voice-call-mute-btn').onclick = () => {
            muted = !muted;
            if (this.localStream) {
                this.localStream.getAudioTracks().forEach(track => track.enabled = !muted);
            }
            modal.querySelector('#voice-call-mute-btn').textContent = muted ? '🔈' : '🔇';
        };
    }

    showVoiceCallModal(username, statusText = "Calling...", isIncoming = false) {
        if (!this.voiceCallModal) this.setupVoiceCallUI();
        const status = this.voiceCallModal.querySelector('#voice-call-status');
        const icon = this.voiceCallModal.querySelector('#voice-call-icon');
        const actions = this.voiceCallModal.querySelector('#voice-call-actions');
        if (status) status.textContent = statusText || `Calling ${username}...`;
        if (icon) icon.textContent = isIncoming ? '📞' : '🔊';

        // If incoming, show Accept/Decline, else show End/Mute
        if (isIncoming) {
            actions.innerHTML = `
                <button id="voice-call-accept-btn" style="background:#2ecc71;color:#fff;border:none;border-radius:50%;width:48px;height:48px;font-size:1.5em;cursor:pointer;">✅</button>
                <button id="voice-call-decline-btn" style="background:#ff6b6b;color:#fff;border:none;border-radius:50%;width:48px;height:48px;font-size:1.5em;cursor:pointer;">❌</button>
            `;
            actions.querySelector('#voice-call-accept-btn').onclick = () => this.acceptIncomingCall();
            actions.querySelector('#voice-call-decline-btn').onclick = () => this.declineIncomingCall();
        } else {
            actions.innerHTML = `
                <button id="voice-call-end-btn" style="background:#ff6b6b;color:#fff;border:none;border-radius:50%;width:48px;height:48px;font-size:1.5em;cursor:pointer;">⏹️</button>
                <button id="voice-call-mute-btn" style="background:#444;color:#fff;border:none;border-radius:50%;width:48px;height:48px;font-size:1.3em;cursor:pointer;">🔇</button>
            `;
            actions.querySelector('#voice-call-end-btn').onclick = () => this.endVoiceCall();
            let muted = false;
            actions.querySelector('#voice-call-mute-btn').onclick = () => {
                muted = !muted;
                if (this.localStream) {
                    this.localStream.getAudioTracks().forEach(track => track.enabled = !muted);
                }
                actions.querySelector('#voice-call-mute-btn').textContent = muted ? '🔈' : '🔇';
            };
        }
        this.voiceCallModal.style.display = 'flex';
    }

    hideVoiceCallModal() {
        if (this.voiceCallModal) this.voiceCallModal.style.display = 'none';
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
                    //
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
        }        // Voice call button in private message modal
        const voiceCallBtn = document.getElementById('private-voice-call-btn');
        if (voiceCallBtn) {
            voiceCallBtn.addEventListener('click', () => {
                if (this.currentPrivateChat) {
                    this.startVoiceCall(this.currentPrivateChat);
                }
            });
        }

        // Add click handler for private message header avatar to open profile
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.classList.contains('private-message-header-avatar')) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (this.currentPrivateChat && window.showUserProfile) {
                        // Assume user is online since they're in a private chat
                        const isOnline = true;
                        const avatarSrc = e.target.src;
                        window.showUserProfile(this.currentPrivateChat, isOnline, avatarSrc);
                    }
                }
            });
        }
    }
    
    setupSocketHandlers() {
        // Wait for socket to be available
        const waitForSocket = () => {
            if (typeof socket !== 'undefined' && socket) {
                //
                
                // Handle incoming private messages
                socket.on('privateMessage', (data) => {
                    this.handleIncomingPrivateMessage(data);
                });
                
                // Handle private message sent confirmation
                socket.on('privateMessageSent', (data) => {
                    this.handlePrivateMessageSent(data);
                });
                
                // Handle private message errors
                socket.on('privateMessageError', (data) => {
                    this.handlePrivateMessageError(data);
                });

                // Handle private message history from server
                socket.on('privateHistory', (data) => {
                    const nameInput = document.querySelector('#name');
                    const { userA, userB, messages } = data;
                    // Only load if this is the current chat
                    if (
                        (this.currentPrivateChat === userA && nameInput?.value === userB) ||
                        (this.currentPrivateChat === userB && nameInput?.value === userA)
                    ) {
                        // Store messages in memory
                        this.privateConversations.set(
                            this.currentPrivateChat,
                            (messages || []).map(msg => ({
                                fromUser: msg.fromUser,
                                toUser: msg.toUser,
                                text: msg.text,
                                image: msg.image,
                                time: msg.time,
                                type: msg.fromUser === nameInput?.value ? 'sent' : 'received'
                            }))
                        );
                        this.loadConversationHistory(this.currentPrivateChat);
                    }
                });

                // WebRTC signaling handlers
                socket.on('voiceCallOffer', async (data) => {
                    if (data.to !== this.getMyName()) return;
                    this.currentCallUser = data.from;
                    this.isCaller = false;
                    this.incomingCallData = data;
                    this.playRingtone();
                    this.showVoiceCallModal(data.from, `${data.from} is calling...`, true);
                });                socket.on('voiceCallAnswer', async (data) => {
                    if (data.to !== this.getMyName()) return;
                    this.stopRingtone();
                    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                    // Update UI to show the call is connected
                    this.showVoiceCallModal(this.currentCallUser, `In call with ${this.currentCallUser}`, false);
                });

                socket.on('voiceCallCandidate', async (data) => {
                    if (data.to !== this.getMyName()) return;
                    if (this.peerConnection) {
                        try {
                            await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                        } catch (e) {}
                    }
                });

                socket.on('voiceCallEnd', (data) => {
                    if (data.to !== this.getMyName()) return;
                    this.stopRingtone();
                    this.endVoiceCall(true);
                });                socket.on('voiceCallDeclined', (data) => {
                    if (data.to !== this.getMyName()) return;
                    this.stopRingtone();
                    this.endVoiceCall(true);
                    //
                });

                // Handle recent private chats from server (users table + private messages)
                socket.on('recentPrivateChats', (data) => {
                    // data: { chats: [{ username, displayName, lastMessage }] }
                    if (!Array.isArray(data.chats)) return;
                    this.privateConversations.clear();
                    this.displayNameMap = {};
                    data.chats.forEach(chat => {
                        this.displayNameMap[chat.username] = chat.displayName || chat.username;
                        // Attach displayName to each message for use in displayMessage
                        const msgWithDisplayName = {
                            ...chat.lastMessage,
                            displayName: chat.displayName || chat.username,
                            type: chat.lastMessage.fromUser === this.getMyName() ? 'sent' : 'received'
                        };
                        this.privateConversations.set(chat.username, [msgWithDisplayName]);
                    });
                    this.updateConversationTabs();
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
            // Use displayName if available
            let displayName = username;
            if (this.displayNameMap && this.displayNameMap[username]) {
                displayName = this.displayNameMap[username];
            }              // Get avatar URL for the user
            const avatarUrl = window.getAvatarUrl ? window.getAvatarUrl(username) : this.getFallbackAvatarUrl(username);            title.innerHTML = `
                <img src="${avatarUrl}" alt="${displayName}'s Avatar" class="private-message-header-avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; margin-right: 10px; border: 2px solid #e8e6ff; vertical-align: middle; cursor: pointer;" title="View ${displayName}'s Profile" onerror="this.src='https://vybchat-media.s3.ap-south-1.amazonaws.com/avatars/default/default.jpg'">
                Private Message - ${displayName}
            `;
        }

        // Clear search bar after opening a chat
        const searchInput = document.getElementById('private-user-search-input');
        if (searchInput) {
            searchInput.value = '';
            // Optionally, also hide results if present
            const results = document.getElementById('private-user-search-results');
            if (results) {
                results.classList.remove('active');
                results.innerHTML = '';
            }
        }

        // Clear unread count for this user
        this.unreadCounts.set(username, 0);
        this.updateConversationTabs();

        // Request conversation history from server
        if (typeof socket !== 'undefined' && socket) {
            socket.emit('getPrivateHistory', {
                userA: nameInput?.value,
                userB: username
            });
        }        // Show modal
        const modal = document.getElementById('private-message-modal');
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('show'), 10);
        }        // Hide only the message input form when private message is open (desktop view)
        const messageForm = document.querySelector('.form-msg');
        if (messageForm) {
            messageForm.style.display = 'none';
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
        }        // Show the message input form again when private message is closed
        const messageForm = document.querySelector('.form-msg');
        if (messageForm) {
            messageForm.style.display = 'flex';
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
    
    sendPrivateMessage(toUser, text, image = null) {
        const nameInput = document.querySelector('#name');
        if (typeof socket === 'undefined' || !socket || !nameInput?.value) {
            return;
        }
        socket.emit('privateMessage', {
            fromUser: nameInput.value,
            toUser,
            text,
            image
        });
    }
    
    handleIncomingPrivateMessage(data) {
        const nameInput = document.querySelector('#name');
        const { fromUser, text, image, time } = data;
        this.addMessageToConversation(fromUser, {
            fromUser,
            toUser: nameInput?.value,
            text,
            image,
            time,
            type: 'received'
        });
        if (this.currentPrivateChat !== fromUser) {
            this.showPrivateMessageNotification(fromUser, text || 'Image');
            const currentCount = this.unreadCounts.get(fromUser) || 0;
            this.unreadCounts.set(fromUser, currentCount + 1);
            this.updateConversationTabs();
        } else {
            this.displayMessage(data, 'received');
        }
        this.highlightTabForPrivateMessage(fromUser);
    }
    
    handlePrivateMessageSent(data) {
        const nameInput = document.querySelector('#name');
        const { toUser, text, image, time } = data;
        this.addMessageToConversation(toUser, {
            fromUser: nameInput?.value,
            toUser,
            text,
            image,
            time,
            type: 'sent'
        });
        if (this.currentPrivateChat === toUser) {
            this.displayMessage({
                fromUser: nameInput?.value,
                toUser,
                text,
                image,
                time
            }, 'sent');
        }
        this.updateConversationTabs();
    }
      handlePrivateMessageError(data) {
        //
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
            //
            return;
        }

        const nameInput = document.querySelector('#name');

        // Check if this message should be chained with the previous one
        const lastMessage = chatContainer.lastElementChild;
        let isChained = false;
        let fromDisplayName = data.displayName || data.fromUser;
        
        // For sent messages, show our own displayName if available
        if (type === 'sent') {
            // Try to get our displayName from displayNameMap
            if (this.displayNameMap && this.getMyName && this.displayNameMap[this.getMyName()]) {
                fromDisplayName = this.displayNameMap[this.getMyName()];
            } else {
                fromDisplayName = nameInput?.value || 'You';
            }
        }

        // Check if we should chain this message
        if (lastMessage && lastMessage.classList.contains('post')) {
            const lastMessageType = lastMessage.classList.contains('post--left') ? 'sent' : 
                                   lastMessage.classList.contains('post--right') ? 'received' : null;
            const lastMessageUser = lastMessage.dataset.fromUser;
            
            // Chain if same user and same type, and within 5 minutes
            if (lastMessageType === type && lastMessageUser === data.fromUser) {
                const lastMessageTime = lastMessage.dataset.messageTime;
                const currentTime = new Date(data.time).getTime();
                const timeDiff = Math.abs(currentTime - new Date(lastMessageTime).getTime());
                
                // Chain if within 5 minutes (300000 ms)
                if (timeDiff < 300000) {
                    isChained = true;
                }
            }
        }

        const li = document.createElement('li');
        li.className = 'post';
        li.dataset.fromUser = data.fromUser;
        li.dataset.messageTime = data.time;

        if (type === 'received') {
            li.className = 'post post--right';
        } else if (type === 'sent') {
            li.className = 'post post--left';
        } else {
            li.className = 'post post--admin';
        }

        // Add chained class if this is a follow-up message
        if (isChained) {
            li.classList.add('post--chained');
        }

        if (data.fromUser === 'System') return;

        // Use server timestamp and convert to local time safely
        let localTime = data.time;
        if (data.time) {
            const dateObj = new Date(data.time);
            if (!isNaN(dateObj.getTime())) {
                localTime = dateObj.toLocaleString();
            } else {
                localTime = data.time;
            }
        }        let contentHtml = '';
          // Only show header for non-chained messages
        if (!isChained) {
            contentHtml = `<div class="post__header ${type === 'received'
                ? 'post__header--reply'
                : 'post__header--user'
            }">
                <span class="post__header--name">${fromDisplayName}</span> 
                <span class="post__header--time">${localTime}</span> 
            </div>`;
        }
        
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
        
        // Add text content if available
        if (data.text) {
            // Process emoji markers in text (same as main chat)
            let processedText = data.text;
            const emojiRegex = /\[emoji:([^\]]+)\]/g;
            
            processedText = processedText.replace(emojiRegex, (match, emojiFile) => {
                return `<img class="emoji" src="/emojis/${emojiFile}" alt="emoji" 
                    data-emoji="${emojiFile}"                    onerror="// this.style.display='none'; this.insertAdjacentText('afterend', '😊');">`;
            });
            
            contentHtml += `<div class="post__text">${processedText}</div>`;
        }
        
        li.innerHTML = contentHtml;
        chatContainer.appendChild(li);

        // Only scroll to bottom if user is already near the bottom
        const nearBottom = (chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 100);
        if (nearBottom) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }
    
    // Replace formatLocalTime function to use toLocaleString
    formatLocalTime(timestamp) {
        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) {
                return timestamp;
            }
            return date.toLocaleString();
        } catch (error) {
            return timestamp;
        }
    }
    
    updateConversationTabs() {
        const container = document.getElementById('private-conversations');
        if (!container) return;

        container.innerHTML = '';

        // If there are no in-memory conversations, fetch recent chats from server (users table)
        if (this.privateConversations.size === 0) {
            const myName = this.getMyName();
            if (typeof socket !== 'undefined' && socket && myName) {
                socket.emit('getRecentPrivateChats', { user: myName });
            }
        }

        // Sort conversations by most recent message (latest at the top)
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

            // Use displayName from displayNameMap if available
            let displayName = username;
            if (this.displayNameMap && this.displayNameMap[username]) {
                displayName = this.displayNameMap[username];
            }

            const lastMessage = messages[messages.length - 1];
            let preview = 'No messages yet';
            if (lastMessage) {
                if (lastMessage.text && lastMessage.text.trim()) {
                    preview = lastMessage.text;
                } else if (lastMessage.voice) {
                    preview = 'Voice';
                } else if (lastMessage.image) {
                    preview = 'Image';
                } else {
                    preview = 'Message';
                }
            }            // Get avatar URL for the conversation user
            const avatarUrl = window.getAvatarUrl ? window.getAvatarUrl(username) : this.getFallbackAvatarUrl(username);tab.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <img src="${avatarUrl}" alt="${displayName}'s Avatar" class="private-conversation-avatar" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1px solid #e8e6ff; flex-shrink: 0;" onerror="this.src='https://vybchat-media.s3.ap-south-1.amazonaws.com/avatars/default/default.jpg'">
                    <div style="flex: 1; min-width: 0;">
                        <div class="private-conversation-name">${displayName}</div>
                        <div class="private-conversation-preview">${preview.substring(0, 30)}${preview.length > 30 ? '...' : ''}</div>
                    </div>
                </div>
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
            //
            e.target.value = '';
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            //
            e.target.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
            this.sendPrivateMessage(this.currentPrivateChat, null, event.target.result);
            e.target.value = '';
        };
          reader.onerror = () => {
            //
            e.target.value = '';
        };
        
        reader.readAsDataURL(file);
    }

    getMyName() {
        const nameInput = document.querySelector('#name');
        return nameInput?.value;
    }

    async startVoiceCall(username) {
        if (this.peerConnection) {
            this.endVoiceCall();
        }
        this.isCaller = true;
        this.currentCallUser = username;
        await this.createPeerConnection();        // Get local audio with progressive fallback for device compatibility
        try {
            //console.log('Requesting user media for caller...');
            
            // Try high-quality constraints first
            const highQualityConstraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000,
                    channelCount: 2,
                    latency: 0.01,
                    sampleSize: 16
                },
                video: false
            };
            
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia(highQualityConstraints);
            } catch (highQualityErr) {
                console.warn('High-quality constraints failed, trying medium quality:', highQualityErr);
                
                // Fallback to medium quality (better Samsung compatibility)
                const mediumQualityConstraints = {
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        sampleRate: { ideal: 48000, min: 16000 },
                        channelCount: { ideal: 2, min: 1 },
                        latency: { ideal: 0.01, max: 0.1 }
                    },
                    video: false
                };
                
                try {
                    this.localStream = await navigator.mediaDevices.getUserMedia(mediumQualityConstraints);
                } catch (mediumQualityErr) {
                    console.warn('Medium-quality constraints failed, trying Samsung-optimized:', mediumQualityErr);
                    
                    // Samsung-specific optimized constraints
                    const samsungOptimizedConstraints = {
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                            sampleRate: 44100, // Samsung devices often prefer 44.1kHz
                            channelCount: 1,    // Mono for better compatibility
                            latency: 0.05       // Slightly higher latency for stability
                        },
                        video: false
                    };
                    
                    try {
                        this.localStream = await navigator.mediaDevices.getUserMedia(samsungOptimizedConstraints);
                    } catch (samsungErr) {
                        console.warn('Samsung-optimized constraints failed, using basic audio:', samsungErr);
                        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                    }
                }
            }
            
            //console.log('Local stream obtained:', this.localStream, 'tracks:', this.localStream.getTracks());
            
            this.localStream.getTracks().forEach(track => {
                //console.log('Adding track to peer connection:', track);
                this.peerConnection.addTrack(track, this.localStream);
            });
        } catch (err) {
            console.error('Error getting user media for caller:', err);
            this.endVoiceCall();
            return;
        }

        // Set codec preferences for better audio quality
        this.setAudioCodecPreferences();

        this.showVoiceCallModal(username, `Calling ${username}...`, false);
        this.playRingtone();

        // Create offer
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);

        socket.emit('voiceCallOffer', {
            from: this.getMyName(),
            to: username,
            offer
        });
    }

    async acceptIncomingCall() {
        this.stopRingtone();
        this.showVoiceCallModal(this.currentCallUser, `In call with ${this.currentCallUser}`, false);
        await this.handleIncomingCall(this.incomingCallData);
        this.incomingCallData = null;
    }

    declineIncomingCall() {
        this.stopRingtone();
        this.hideVoiceCallModal();
        socket.emit('voiceCallDeclined', {
            from: this.getMyName(),
            to: this.currentCallUser
        });        this.currentCallUser = null;
        this.incomingCallData = null;
    }

    async handleIncomingCall(data) {
        await this.createPeerConnection();        try {
            // Progressive fallback for device compatibility, especially Samsung
            try {
                // High-quality constraints first
                const highQualityConstraints = {
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        sampleRate: 48000,
                        channelCount: 2,
                        latency: 0.01,
                        sampleSize: 16
                    },
                    video: false
                };
                this.localStream = await navigator.mediaDevices.getUserMedia(highQualityConstraints);
            } catch (highQualityErr) {
                console.warn('High-quality constraints failed for call recipient, trying medium quality:', highQualityErr);
                
                // Medium quality fallback
                const mediumQualityConstraints = {
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        sampleRate: { ideal: 48000, min: 16000 },
                        channelCount: { ideal: 2, min: 1 },
                        latency: { ideal: 0.01, max: 0.1 }
                    },
                    video: false
                };
                
                try {
                    this.localStream = await navigator.mediaDevices.getUserMedia(mediumQualityConstraints);
                } catch (mediumQualityErr) {
                    console.warn('Medium-quality constraints failed, trying Samsung-optimized for recipient:', mediumQualityErr);
                    
                    // Samsung-optimized constraints
                    const samsungOptimizedConstraints = {
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                            sampleRate: 44100, // Samsung devices often prefer 44.1kHz
                            channelCount: 1,    // Mono for better compatibility
                            latency: 0.05       // Slightly higher latency for stability
                        },
                        video: false
                    };
                    
                    try {
                        this.localStream = await navigator.mediaDevices.getUserMedia(samsungOptimizedConstraints);
                    } catch (samsungErr) {
                        console.warn('Samsung-optimized constraints failed, using basic audio for recipient:', samsungErr);
                        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                    }
                }
            }
              this.localStream.getTracks().forEach(track => this.peerConnection.addTrack(track, this.localStream));
        } catch (err) {
            console.error('Error getting user media for call recipient:', err);
            this.endVoiceCall();
            return;
        }

        // Set codec preferences for better audio quality
        this.setAudioCodecPreferences();

        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        socket.emit('voiceCallAnswer', {
            from: this.getMyName(),
            to: data.from,
            answer
        });
    }

    async createPeerConnection() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        const config = {
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" },
                { urls: "stun:stun2.l.google.com:19302" }
            ]
        };
        this.peerConnection = new RTCPeerConnection(config);

        // ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.currentCallUser) {
                socket.emit('voiceCallCandidate', {
                    from: this.getMyName(),
                    to: this.currentCallUser,
                    candidate: event.candidate
                });
            }
        };        // Remote stream
        this.peerConnection.ontrack = (event) => {
            //console.log('WebRTC ontrack event:', event);
            // Use the stream from the event, which already contains all tracks
            if (event.streams && event.streams[0]) {
                this.remoteStream = event.streams[0];
                //console.log('Remote stream received:', this.remoteStream, 'tracks:', this.remoteStream.getTracks());
                const remoteAudio = document.getElementById('voice-call-remote-audio');
                if (remoteAudio) {
                    remoteAudio.srcObject = this.remoteStream;
                    remoteAudio.volume = 1.0; // Ensure volume is at maximum
                    // Ensure audio plays automatically
                    remoteAudio.play().catch(() => {});
                    //console.log('Remote audio element set up successfully');
                } else {
                    console.error('Remote audio element not found');
                }
            } else {
                console.warn('No remote stream found in ontrack event');
            }
        };// Connection state
        this.peerConnection.onconnectionstatechange = () => {
            if (this.peerConnection.connectionState === "connected" && this.currentCallUser) {
                // Update UI to show call is connected
                this.showVoiceCallModal(this.currentCallUser, `In call with ${this.currentCallUser}`, false);
            } else if (this.peerConnection.connectionState === "disconnected" || this.peerConnection.connectionState === "failed" || this.peerConnection.connectionState === "closed") {
                this.endVoiceCall();
            }
        };

        // Set codec preferences to prioritize high-quality audio codecs
        this.setAudioCodecPreferences();
    }    setAudioCodecPreferences() {
        if (!this.peerConnection) return;
        
        try {
            const transceivers = this.peerConnection.getTransceivers();
            const audioTransceiver = transceivers.find(t => 
                t.receiver && t.receiver.track && t.receiver.track.kind === 'audio'
            );
            
            if (audioTransceiver && typeof audioTransceiver.setCodecPreferences === 'function') {
                const capabilities = RTCRtpReceiver.getCapabilities('audio');
                if (!capabilities || !capabilities.codecs) return;
                
                // Enhanced codec preferences for maximum quality
                const preferredCodecs = capabilities.codecs.filter(codec => 
                    codec.mimeType === 'audio/opus'
                ).sort((a, b) => {
                    // Prefer higher sample rates and stereo
                    const aRate = a.clockRate || 0;
                    const bRate = b.clockRate || 0;
                    const aChannels = a.channels || 1;
                    const bChannels = b.channels || 1;
                    
                    if (aRate !== bRate) return bRate - aRate; // Higher sample rate first
                    return bChannels - aChannels; // Stereo before mono
                });
                
                if (preferredCodecs.length > 0) {
                    audioTransceiver.setCodecPreferences(preferredCodecs);
                }
            }
        } catch (err) {
            console.warn('Failed to set codec preferences:', err);
        }
    }

    endVoiceCall(remote = false) {
        this.stopRingtone();
        if (this.peerConnection) {
            this.peerConnection.onicecandidate = null;
            this.peerConnection.ontrack = null;
            this.peerConnection.onconnectionstatechange = null;
            this.peerConnection.close();
            this.peerConnection = null;
        }
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }
        const remoteAudio = document.getElementById('voice-call-remote-audio');
        if (remoteAudio) {
            remoteAudio.srcObject = null;
        }
        this.hideVoiceCallModal();
        if (!remote && this.currentCallUser) {
            socket.emit('voiceCallEnd', {
                from: this.getMyName(),
                to: this.currentCallUser
            });
        }
        this.currentCallUser = null;
        this.isCaller = false;
        this.incomingCallData = null;
    }

    setupTabFocusHandlers() {
        window.addEventListener('focus', () => {
            this.windowFocused = true;
            this.stopTabHighlight();
        });
        window.addEventListener('blur', () => {
            this.windowFocused = false;
        });
    }

    highlightTabForPrivateMessage(fromUser) {
        if (this.windowFocused) return;
        this.stopTabHighlight();
        let flashTitle = `🔔 New message from ${fromUser}`;
        let origTitle = this.originalTitle;
        let origFavicon = this.originalFavicon;
        let flashFavicon = '/images/logo.png'; // fallback
        // Try to use a notification icon if available
        if (document.querySelector('link[rel="icon"]')) {
            flashFavicon = '/images/logo.png';
        }
        let link = document.querySelector('link[rel="icon"]');
        this.tabFlashInterval = setInterval(() => {
            this.tabFlashState = !this.tabFlashState;
            document.title = this.tabFlashState ? flashTitle : origTitle;
            if (link) link.href = this.tabFlashState ? flashFavicon : origFavicon;
        }, 900);
    }

    stopTabHighlight() {
        if (this.tabFlashInterval) {
            clearInterval(this.tabFlashInterval);
            this.tabFlashInterval = null;
            document.title = this.originalTitle;
            let link = document.querySelector('link[rel="icon"]');
            if (link && this.originalFavicon) link.href = this.originalFavicon;
        }
    }

    getFaviconHref() {
        const link = document.querySelector('link[rel="icon"]');
        return link ? link.href : '';
    }
}

// Initialize private messaging when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.privateMessaging = new PrivateMessaging();
});
