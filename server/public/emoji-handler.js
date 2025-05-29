document.addEventListener('DOMContentLoaded', function() {
    // Get necessary elements
    const emojiBtn = document.getElementById('emoji-btn');
    const emojiPicker = document.getElementById('emoji-picker');
    const closeEmojiPicker = document.getElementById('close-emoji-picker');
    const emojiContainer = document.getElementById('emoji-container');
    const messageInput = document.getElementById('message');
    
    if (!emojiBtn || !emojiPicker || !emojiContainer) {
        console.error('Emoji picker elements not found');
        return;
    }
    
    // Function to position the emoji picker properly
    function positionEmojiPicker() {
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
            // On mobile, center the picker
            emojiPicker.style.position = 'fixed';
            emojiPicker.style.left = '50%';
            emojiPicker.style.top = '50%';
            emojiPicker.style.transform = 'translate(-50%, -50%)';
            emojiPicker.style.bottom = 'auto';
            emojiPicker.style.width = '90%';
        } else {
            // On desktop, position above the emoji button
            const btnRect = emojiBtn.getBoundingClientRect();
            
            emojiPicker.style.position = 'fixed';
            emojiPicker.style.bottom = (window.innerHeight - btnRect.top + 10) + 'px';
            emojiPicker.style.left = (btnRect.left - 150 + btnRect.width/2) + 'px';
            emojiPicker.style.transform = 'none';
            emojiPicker.style.width = '300px';
        }
    }
    
    // Function to show emoji picker
    function showEmojiPicker(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Position the picker first (while hidden)
        emojiPicker.style.display = 'flex';
        emojiPicker.style.opacity = '0';
        
        // Position it properly
        positionEmojiPicker();
        
        // Now show it with a fade in effect
        setTimeout(() => {
            emojiPicker.style.opacity = '1';
        }, 10);
        
        // Load emojis from server
        loadEmojisFromServer();
    }
    
    // Function to hide emoji picker
    function hideEmojiPicker() {
        emojiPicker.style.opacity = '0';
        setTimeout(() => {
            emojiPicker.style.display = 'none';
        }, 200);
    }
    
    // Load emojis directly from server
    function loadEmojisFromServer() {
        // Show loading message
        emojiContainer.innerHTML = '<div class="emoji-loading">Loading emojis...</div>';
        
        // Fetch emoji list from server
        fetch('/api/emojis')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}`);
                }
                return response.json();
            })
            .then(emojis => {
                if (!Array.isArray(emojis) || emojis.length === 0) {
                    emojiContainer.innerHTML = '<div class="emoji-message">No emojis available from server</div>';
                    return;
                }
                
                // Render server-provided emojis
                emojiContainer.innerHTML = '';
                emojis.forEach(emojiFile => {
                    const emojiItem = document.createElement('div');
                    emojiItem.className = 'emoji-item';
                    
                    const img = document.createElement('img');
                    img.src = `/emojis/${emojiFile}`;
                    img.alt = emojiFile.replace(/\.\w+$/, '');
                    img.title = emojiFile.replace(/\.\w+$/, '');
                    
                    emojiItem.appendChild(img);
                    
                    // Add click handler
                    emojiItem.addEventListener('click', () => {
                        insertEmoji(`[emoji:${emojiFile}]`);
                    });
                    
                    emojiContainer.appendChild(emojiItem);
                });
            })
            .catch(error => {
                console.error('Error loading emojis:', error);
                emojiContainer.innerHTML = `
                    <div class="emoji-error">
                        Failed to load emojis from server.<br>
                        <button class="retry-btn">Try again</button>
                    </div>`;
                
                // Add retry button functionality
                const retryBtn = emojiContainer.querySelector('.retry-btn');
                if (retryBtn) {
                    retryBtn.addEventListener('click', loadEmojisFromServer);
                }
            });
    }
    
    // Insert emoji at cursor position
    function insertEmoji(emoji) {
        if (!messageInput) return;
        
        const cursorPos = messageInput.selectionStart || 0;
        const textBefore = messageInput.value.substring(0, cursorPos);
        const textAfter = messageInput.value.substring(messageInput.selectionEnd || cursorPos);
        
        // Insert emoji at cursor position
        messageInput.value = textBefore + emoji + textAfter;
        
        // Move cursor position after the inserted emoji
        const newCursorPos = cursorPos + emoji.length;
        messageInput.setSelectionRange(newCursorPos, newCursorPos);
        
        // Focus on the input
        messageInput.focus();
        
        // Hide picker
        hideEmojiPicker();
    }
    
    // Add event listeners
    emojiBtn.addEventListener('click', showEmojiPicker);
    
    if (closeEmojiPicker) {
        closeEmojiPicker.addEventListener('click', hideEmojiPicker);
    }
    
    // Close emoji picker when clicking outside
    document.addEventListener('click', function(e) {
        if (emojiPicker.style.display === 'flex' && 
            !emojiPicker.contains(e.target) && 
            e.target !== emojiBtn) {
            hideEmojiPicker();
        }
    });
    
    // Update position on window resize
    window.addEventListener('resize', function() {
        if (emojiPicker.style.display === 'flex') {
            positionEmojiPicker();
        }
    });
});
