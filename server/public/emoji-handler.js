document.addEventListener('DOMContentLoaded', function() {
    // Get all the necessary elements
    const emojiBtn = document.getElementById('emoji-btn');
    const emojiPicker = document.getElementById('emoji-picker');
    const closeEmojiPicker = document.getElementById('close-emoji-picker');
    const emojiContainer = document.getElementById('emoji-container');
    const messageInput = document.getElementById('message');
    
    // Default emojis if server doesn't provide any
    const defaultEmojis = [
        '😊', '😂', '❤️', '👍', '😎', 
        '🙌', '🎉', '👋', '😁', '🥳', 
        '😍', '🤔', '🤣', '🙏', '👏',
        '💯', '🔥', '💕', '😭', '😢'
    ];
    
    // Function to show emoji picker
    function showEmojiPicker(e) {
        e.stopPropagation(); // Prevent clicks from propagating
        
        // Position the emoji picker properly
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
            // Center horizontally on mobile
            emojiPicker.style.left = '50%';
            emojiPicker.style.transform = 'translateX(-50%)';
            emojiPicker.style.bottom = '120px';
        } else {
            // Position relative to emoji button
            const rect = emojiBtn.getBoundingClientRect();
            emojiPicker.style.left = `${rect.left}px`;
            emojiPicker.style.bottom = `${window.innerHeight - rect.top + 10}px`;
            emojiPicker.style.transform = 'none';
        }
        
        // Show the picker
        emojiPicker.style.display = 'flex';
        
        // Load emojis if container is empty
        if (emojiContainer.children.length === 0) {
            loadEmojis();
        }
    }
    
    // Function to hide emoji picker
    function hideEmojiPicker() {
        emojiPicker.style.display = 'none';
    }
    
    // Function to load emojis
    function loadEmojis() {
        // Show loading state
        emojiContainer.innerHTML = '<div class="emoji-loading">Loading emojis...</div>';
        
        // Try to load from server
        fetch('/api/emojis')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load emojis from server');
                }
                return response.json();
            })
            .then(emojis => {
                if (!Array.isArray(emojis) || emojis.length === 0) {
                    // Use default emojis if server returns empty array
                    renderDefaultEmojis();
                    return;
                }
                
                // Clear loading message
                emojiContainer.innerHTML = '';
                
                // Render server emojis
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
                // Fall back to default emojis
                renderDefaultEmojis();
            });
    }
    
    // Render default emoji set
    function renderDefaultEmojis() {
        emojiContainer.innerHTML = '';
        
        defaultEmojis.forEach(emoji => {
            const emojiItem = document.createElement('div');
            emojiItem.className = 'emoji-item';
            emojiItem.textContent = emoji;
            
            // Add click handler for default emojis
            emojiItem.addEventListener('click', () => {
                insertEmoji(emoji);
            });
            
            emojiContainer.appendChild(emojiItem);
        });
    }
    
    // Insert emoji into message input
    function insertEmoji(emoji) {
        if (!messageInput) return;
        
        const cursorPos = messageInput.selectionStart || messageInput.value.length;
        const textBefore = messageInput.value.substring(0, cursorPos);
        const textAfter = messageInput.value.substring(cursorPos);
        
        messageInput.value = textBefore + emoji + textAfter;
        
        // Set cursor position after the inserted emoji
        const newCursorPos = cursorPos + emoji.length;
        messageInput.setSelectionRange(newCursorPos, newCursorPos);
        
        // Focus back to input
        messageInput.focus();
        
        // Hide picker after selection
        hideEmojiPicker();
    }
    
    // Add event listeners
    if (emojiBtn) {
        emojiBtn.addEventListener('click', showEmojiPicker);
    }
    
    if (closeEmojiPicker) {
        closeEmojiPicker.addEventListener('click', hideEmojiPicker);
    }
    
    // Close emoji picker when clicking outside
    document.addEventListener('click', (e) => {
        if (emojiPicker.style.display !== 'none' && 
            !emojiPicker.contains(e.target) && 
            e.target !== emojiBtn) {
            hideEmojiPicker();
        }
    });
    
    // Mobile-specific touch events
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        if (emojiContainer) {
            // Add touch feedback
            emojiContainer.addEventListener('touchstart', (e) => {
                const target = e.target.closest('.emoji-item');
                if (target) {
                    target.style.transform = 'scale(1.2)';
                    target.style.backgroundColor = '#f0f0f0';
                }
            }, { passive: true });
            
            emojiContainer.addEventListener('touchend', (e) => {
                document.querySelectorAll('.emoji-item').forEach(item => {
                    item.style.transform = '';
                    item.style.backgroundColor = '';
                });
            }, { passive: true });
        }
    }
});
