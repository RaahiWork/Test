document.addEventListener('DOMContentLoaded', function() {
    const emojiBtn = document.getElementById('emoji-btn');
    const emojiPicker = document.getElementById('emoji-picker');
    const closeEmojiPicker = document.getElementById('close-emoji-picker');
    const emojiContainer = document.getElementById('emoji-container');
    const messageInput = document.getElementById('message');
    
    if (!emojiBtn || !emojiPicker) return;
    
    // Default emojis if server doesn't provide any
    const defaultEmojis = [
        '😊', '😂', '❤️', '👍', '😎', 
        '🙌', '🎉', '👋', '😁', '🥳', 
        '😍', '🤔', '🤣', '🙏', '👏',
        '💯', '🔥', '💕', '😭', '😢'
    ];
    
    // Function to position the emoji picker
    function positionEmojiPicker() {
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
            // On mobile, use the fixed centered position from CSS
            return;
        }
        
        // On desktop, position above the emoji button
        const btnRect = emojiBtn.getBoundingClientRect();
        const pickerWidth = 300; // Default width in CSS
        
        // Calculate the left position to center with the button
        let leftPos = btnRect.left + (btnRect.width / 2) - (pickerWidth / 2);
        
        // Ensure the picker doesn't go off-screen on the left
        leftPos = Math.max(10, leftPos);
        
        // Ensure the picker doesn't go off-screen on the right
        const rightEdge = leftPos + pickerWidth;
        if (rightEdge > window.innerWidth - 10) {
            leftPos = window.innerWidth - pickerWidth - 10;
        }
        
        // Set the position directly
        emojiPicker.style.position = 'fixed';
        emojiPicker.style.bottom = `${window.innerHeight - btnRect.top + 10}px`;
        emojiPicker.style.left = `${leftPos}px`;
    }
    
    // Toggle emoji picker
    function toggleEmojiPicker(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const isVisible = emojiPicker.style.display === 'flex';
        
        if (!isVisible) {
            // Set display before positioning for accurate calculations
            emojiPicker.style.opacity = '0';
            emojiPicker.style.display = 'flex';
            
            // Position the picker
            positionEmojiPicker();
            
            // Load emojis if needed
            if (!emojiContainer.innerHTML || emojiContainer.children.length === 0) {
                loadEmojis();
            }
            
            // Fade in after positioning
            setTimeout(() => {
                emojiPicker.classList.add('positioned');
                emojiPicker.style.opacity = '1';
            }, 10);
        } else {
            hideEmojiPicker();
        }
    }
    
    // Hide emoji picker
    function hideEmojiPicker() {
        emojiPicker.classList.remove('positioned');
        emojiPicker.style.opacity = '0';
        setTimeout(() => {
            emojiPicker.style.display = 'none';
        }, 200);
    }
    
    // Function to load emojis
    function loadEmojis() {
        // Start with loading state
        emojiContainer.innerHTML = '<div class="emoji-loading">Loading emojis...</div>';
        
        // Try to fetch from server
        fetch('/api/emojis')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load emojis from server');
                }
                return response.json();
            })
            .then(emojis => {
                if (!Array.isArray(emojis) || emojis.length === 0) {
                    // Fall back to default emojis
                    renderDefaultEmojis();
                    return;
                }
                
                // Render server emojis
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
                renderDefaultEmojis();
            });
    }
    
    // Render default emojis
    function renderDefaultEmojis() {
        emojiContainer.innerHTML = '';
        
        defaultEmojis.forEach(emoji => {
            const emojiItem = document.createElement('div');
            emojiItem.className = 'emoji-item';
            emojiItem.textContent = emoji;
            
            // Add click handler
            emojiItem.addEventListener('click', () => {
                insertEmoji(emoji);
            });
            
            emojiContainer.appendChild(emojiItem);
        });
    }
    
    // Insert emoji at cursor position
    function insertEmoji(emoji) {
        if (!messageInput) return;
        
        const cursorPos = messageInput.selectionStart;
        const textBefore = messageInput.value.substring(0, cursorPos);
        const textAfter = messageInput.value.substring(messageInput.selectionEnd);
        
        messageInput.value = textBefore + emoji + textAfter;
        
        // Set cursor position after the inserted emoji
        const newCursorPos = cursorPos + emoji.length;
        messageInput.setSelectionRange(newCursorPos, newCursorPos);
        
        // Focus back to input
        messageInput.focus();
        
        // Hide picker after selecting an emoji
        hideEmojiPicker();
    }
    
    // Event listeners
    emojiBtn.addEventListener('click', toggleEmojiPicker);
    closeEmojiPicker.addEventListener('click', hideEmojiPicker);
    
    // Close on outside click
    document.addEventListener('click', (e) => {
        if (emojiPicker.style.display !== 'none' && 
            !emojiPicker.contains(e.target) && 
            e.target !== emojiBtn) {
            hideEmojiPicker();
        }
    });
    
    // Reposition when window is resized
    window.addEventListener('resize', () => {
        if (emojiPicker.style.display === 'flex') {
            positionEmojiPicker();
        }
    });
});
