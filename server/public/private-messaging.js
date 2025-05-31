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
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupSocketHandlers();
        this.setupVoiceCallUI();
        this.setupRingtone();
    }
    
    setupRingtone() {
        // Use a pleasant, short, non-intrusive ringtone (public domain)
        this.ringtoneAudio = document.createElement('audio');
        this.ringtoneAudio.src = 'https://cdn.pixabay.com/audio/2022/07/26/audio_124bfae3e2.mp3'; // Example: "Soft Notification" by Lesfm (Pixabay, free)
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
        const privateVoiceActionContainer = document.getElementById('private-voice-action-container');
        const privateVoiceAudioPreview = document.getElementById('private-voice-audio-preview');
        const privateVoiceSendBtn = document.getElementById('private-voice-send-btn');
        const privateVoiceCancelBtn = document.getElementById('private-voice-cancel-btn');
        const privateVoiceDownloadBtn = document.getElementById('private-voice-download-btn');
        let privateRecordedVoiceData = null;
        let mediaRecorder, audioChunks = [];

        if (privateVoiceBtn && privateVoiceFile && privateVoiceActionContainer && privateVoiceAudioPreview && privateVoiceSendBtn && privateVoiceCancelBtn && privateVoiceDownloadBtn) {
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
                            privateRecordedVoiceData = event.target.result;
                            privateVoiceAudioPreview.src = privateRecordedVoiceData;
                            privateVoiceActionContainer.style.display = 'flex';
                        };
                        reader.readAsDataURL(audioBlob);
                    };
                    mediaRecorder.start();
                    privateVoiceBtn.textContent = '⏹️';
                } catch (err) {
                    alert('Could not start recording: ' + err.message);
                }
            });

            privateVoiceSendBtn.addEventListener('click', () => {
                if (privateRecordedVoiceData && this.currentPrivateChat) {
                    this.sendPrivateMessage(this.currentPrivateChat, null, null, privateRecordedVoiceData);
                }
                privateVoiceActionContainer.style.display = 'none';
                privateVoiceAudioPreview.src = '';
                privateRecordedVoiceData = null;
            });

            privateVoiceCancelBtn.addEventListener('click', () => {
                privateVoiceActionContainer.style.display = 'none';
                privateVoiceAudioPreview.src = '';
                privateRecordedVoiceData = null;
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
                        privateRecordedVoiceData = event.target.result;
                        privateVoiceAudioPreview.src = privateRecordedVoiceData;
                        privateVoiceActionContainer.style.display = 'flex';
                    };
                    reader.readAsDataURL(file);
                    this.value = '';
                }
            });

            privateVoiceDownloadBtn.addEventListener('click', function() {
                if (!privateRecordedVoiceData) return;
                const arr = privateRecordedVoiceData.split(',');
                const mime = arr[0].match(/:(.*?);/)[1];
                const bstr = atob(arr[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while (n--) u8arr[n] = bstr.charCodeAt(n);
                let blob = new Blob([u8arr], { type: mime });
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

        // Voice call button in private message modal
        const voiceCallBtn = document.getElementById('private-voice-call-btn');
        if (voiceCallBtn) {
            voiceCallBtn.addEventListener('click', () => {
                if (this.currentPrivateChat) {
                    this.startVoiceCall(this.currentPrivateChat);
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

                // WebRTC signaling handlers
                socket.on('voiceCallOffer', async (data) => {
                    if (data.to !== this.getMyName()) return;
                    this.currentCallUser = data.from;
                    this.isCaller = false;
                    this.incomingCallData = data;
                    this.playRingtone();
                    this.showVoiceCallModal(data.from, `${data.from} is calling...`, true);
                });

                socket.on('voiceCallAnswer', async (data) => {
                    if (data.to !== this.getMyName()) return;
                    this.stopRingtone();
                    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
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
                });

                socket.on('voiceCallDeclined', (data) => {
                    if (data.to !== this.getMyName()) return;
                    this.stopRingtone();
                    this.endVoiceCall(true);
                    alert(`${data.from} declined your call.`);
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
            const downloadMp3Btn = `
                <a href="${data.voice}" download="voice-message.mp3" 
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
            contentHtml += `<div class="post__voice"><audio controls src="${data.voice}"></audio>${downloadMp3Btn}</div>`;
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
        await this.createPeerConnection();

        // Get local audio
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            this.localStream.getTracks().forEach(track => this.peerConnection.addTrack(track, this.localStream));
        } catch (err) {
            alert('Could not access microphone: ' + err.message);
            this.endVoiceCall();
            return;
        }

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
        });
        this.currentCallUser = null;
        this.incomingCallData = null;
    }

    async handleIncomingCall(data) {
        await this.createPeerConnection();

        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            this.localStream.getTracks().forEach(track => this.peerConnection.addTrack(track, this.localStream));
        } catch (err) {
            alert('Could not access microphone: ' + err.message);
            this.endVoiceCall();
            return;
        }

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
                { urls: "stun:stun.l.google.com:19302" }
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
        };

        // Remote stream
        this.peerConnection.ontrack = (event) => {
            if (!this.remoteStream) {
                this.remoteStream = new MediaStream();
                const remoteAudio = document.getElementById('voice-call-remote-audio');
                if (remoteAudio) {
                    remoteAudio.srcObject = this.remoteStream;
                }
            }
            this.remoteStream.addTrack(event.track);
        };

        // Connection state
        this.peerConnection.onconnectionstatechange = () => {
            if (this.peerConnection.connectionState === "disconnected" || this.peerConnection.connectionState === "failed" || this.peerConnection.connectionState === "closed") {
                this.endVoiceCall();
            }
        };
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
}

// Initialize private messaging when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.privateMessaging = new PrivateMessaging();
});
