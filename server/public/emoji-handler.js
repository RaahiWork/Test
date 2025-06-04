document.addEventListener('DOMContentLoaded', function() {
    // Get necessary elements for the picker UI
    const emojiPicker = document.getElementById('emoji-picker');
    const closeEmojiPicker = document.getElementById('close-emoji-picker');
    const emojiContainer = document.getElementById('emoji-container');
    
    // Default elements for the main chat (if this script is also used for it)
    const mainChatEmojiBtn = document.getElementById('emoji-btn'); // The button in the main chat form
    const mainChatMessageInput = document.getElementById('message'); // The input in the main chat form
      // Pagination state
    let allEmojis = [];
    // REMOVE: let currentPage = 1;
    // REMOVE: const emojisPerPage = 25;

    // Variables to store the current target for the emoji picker
    let currentTargetInput = null;
    let currentTriggerButton = null;
    
    if (!emojiPicker || !emojiContainer) { // Check only core picker elements
        console.error('Emoji picker core UI elements not found');
        return;
    }

    // Apply styles to make the emoji container scrollable
    emojiContainer.style.maxHeight = '200px'; // Adjust this value as needed (e.g., '25vh' or '250px')
    emojiContainer.style.overflowY = 'auto';
    
    // Function to position the emoji picker properly
    function positionEmojiPicker() {
        if (!currentTriggerButton) return; // Ensure a trigger button is set

        const isMobile = window.innerWidth <= 768;
        const btnRect = currentTriggerButton.getBoundingClientRect();
        
        if (isMobile) {
            // On mobile, center the picker (CSS media queries handle width and max-width)
            emojiPicker.style.position = 'fixed';
            emojiPicker.style.left = '50%';
            emojiPicker.style.top = '50%';
            emojiPicker.style.transform = 'translate(-50%, -50%)';
            emojiPicker.style.bottom = 'auto';
        } else {
            // On desktop, position above the trigger button
            emojiPicker.style.position = 'fixed';
            emojiPicker.style.bottom = (window.innerHeight - btnRect.top + 10) + 'px';
            const pickerWidth = emojiPicker.offsetWidth || 260; // Fallback to CSS width if offsetWidth is 0
            emojiPicker.style.left = (btnRect.left - (pickerWidth / 2) + (btnRect.width / 2)) + 'px';
            emojiPicker.style.transform = 'none';
        }
    }
    
    // Internal function to show emoji picker, now uses currentTargetInput and currentTriggerButton
    function _internalShowEmojiPicker(event) {
        event.preventDefault();
        event.stopPropagation();
        
        emojiPicker.style.display = 'flex';
        emojiPicker.style.opacity = '0';
        
        positionEmojiPicker(); // Uses currentTriggerButton
        
        setTimeout(() => {
            emojiPicker.style.opacity = '1';
        }, 10);
        
        loadEmojisFromServer();
    }

    // Expose a function to be called from other scripts (like private-messaging.js)
    window.openEmojiPickerFor = function(event, targetInput, triggerButton) {
        currentTargetInput = targetInput;
        currentTriggerButton = triggerButton;
        _internalShowEmojiPicker(event); // Call the internal function
    };
    
    // Function to hide emoji picker
    function hideEmojiPicker() {
        emojiPicker.style.opacity = '0';
        setTimeout(() => {
            emojiPicker.style.display = 'none';
        }, 200);
    }
    
    // REMOVE: createPaginationControls function
    // REMOVE: updatePaginationControls function
    
    // Render all emojis with lazy loading
    function renderEmojis() {
        emojiContainer.innerHTML = ''; // Clear previous emojis
        
        allEmojis.forEach(emojiFile => {
            const emojiItem = document.createElement('div');
            emojiItem.className = 'emoji-item';
            
            const img = document.createElement('img');
            // Set data-src for lazy loading, and a placeholder or small initial src if desired
            img.setAttribute('data-src', `/emojis/${emojiFile}`);
            img.src = '/images/placeholder.gif'; // Use a valid placeholder path
            img.alt = emojiFile.replace(/\.\w+$/, '');
            img.title = emojiFile.replace(/\.\w+$/, '');
            img.loading = 'lazy'; // Use native browser lazy loading

            emojiItem.appendChild(img);
            
            // Add click handler
            emojiItem.addEventListener('click', () => {
                insertEmoji(`[emoji:${emojiFile}]`);
            });
            
            emojiContainer.appendChild(emojiItem);
        });

        // Implement Intersection Observer for images that don't support loading="lazy" or for more control
        const images = emojiContainer.querySelectorAll('img[data-src]');
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries, observerInstance) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const lazyImage = entry.target;
                        lazyImage.src = lazyImage.getAttribute('data-src');
                        lazyImage.removeAttribute('data-src');
                        observerInstance.unobserve(lazyImage);
                    }
                });
            });
            images.forEach(img => observer.observe(img));
        } else {
            // Fallback for older browsers: load all images immediately
            images.forEach(img => {
                img.src = img.getAttribute('data-src');
                img.removeAttribute('data-src');
            });
        }
    }
    
    // Load emojis directly from server
    function loadEmojisFromServer() {
        // Show loading message
        emojiContainer.innerHTML = '<div class="emoji-loading">Loading emojis...</div>';
        
        // Remove existing pagination controls during loading
        const existingPagination = emojiPicker.querySelector('.emoji-pagination');
        if (existingPagination) {
            existingPagination.remove();
        }
        
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
                
                // Store all emojis
                allEmojis = emojis;
                // REMOVE: currentPage = 1; // Already removed in user's provided code
                
                // Render all emojis
                renderEmojis();
                
                // REMOVE: createPaginationControls(); // Already removed in user's provided code
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
    
    // Insert emoji at cursor position of the currentTargetInput
    function insertEmoji(emoji) {
        if (!currentTargetInput) {
            console.warn("No target input set for emoji insertion.");
            return;
        }
        
        const cursorPos = currentTargetInput.selectionStart || 0;
        const textBefore = currentTargetInput.value.substring(0, cursorPos);
        const textAfter = currentTargetInput.value.substring(currentTargetInput.selectionEnd || cursorPos);
        
        currentTargetInput.value = textBefore + emoji + textAfter;
        
        const newCursorPos = cursorPos + emoji.length;
        currentTargetInput.setSelectionRange(newCursorPos, newCursorPos);
        currentTargetInput.focus();
        hideEmojiPicker();
    }
    
    // Add event listener for the main chat emoji button (if it exists)
    if (mainChatEmojiBtn && mainChatMessageInput) {
        mainChatEmojiBtn.addEventListener('click', function(e) {
            // Call the new global function, passing the main chat elements
            window.openEmojiPickerFor(e, mainChatMessageInput, mainChatEmojiBtn);
        });
    }
    
    if (closeEmojiPicker) {
        closeEmojiPicker.addEventListener('click', hideEmojiPicker);
    }
    
    // Close emoji picker when clicking outside
    document.addEventListener('click', function(e) {
        if (emojiPicker.style.display === 'flex' && 
            !emojiPicker.contains(e.target) && 
            currentTriggerButton && !currentTriggerButton.contains(e.target)) { // Check against currentTriggerButton
            hideEmojiPicker();
        }
    });
    
    // Update position on window resize
    window.addEventListener('resize', function() {
        if (emojiPicker.style.display === 'flex') {
            positionEmojiPicker(); // Uses currentTriggerButton
        }
    });
    
    // REMOVE: Keyboard navigation for pagination (ArrowLeft, ArrowRight)
    // document.addEventListener('keydown', function(e) { ... });
});
