/**
 * Touch Handler for Mobile Slide Panels
 * Enables swipe gestures to show/hide side panels on mobile
 */

document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const mainContent = document.querySelector('.main-content');
    const leftPane = document.querySelector('.left-pane');
    const rightPane = document.querySelector('.right-pane');
    
    // Touch tracking variables
    let touchStartX = 0;
    let touchEndX = 0;
    let touchStarted = false;
    
    // Minimum swipe distance (pixels)
    const minSwipeDistance = 50;
    
    // Add touch event listeners to the main content area
    if (mainContent) {
        mainContent.addEventListener('touchstart', handleTouchStart, { passive: true });
        mainContent.addEventListener('touchmove', handleTouchMove, { passive: true });
        mainContent.addEventListener('touchend', handleTouchEnd, { passive: true });
    }
    
    // Handle touch start - record initial position
    function handleTouchStart(e) {
        // If a side pane is open and the touch starts inside it, disable swipe on mobile
        if (window.innerWidth <= 768) {
            const isOpenLeftPane = leftPane && leftPane.classList.contains('open');
            const isOpenRightPane = rightPane && rightPane.classList.contains('open');

            if (isOpenLeftPane && leftPane.contains(e.target)) {
                touchStarted = false;
                return;
            }
            if (isOpenRightPane && rightPane.contains(e.target)) {
                touchStarted = false;
                return;
            }
        }

        touchStartX = e.touches[0].clientX;
        touchStarted = true;
    }
    
    // Handle touch move - track movement for visual feedback
    function handleTouchMove(e) {
        if (!touchStarted) return;
        
        const currentX = e.touches[0].clientX;
        const diff = currentX - touchStartX;
        
        // Optional: Add visual feedback during swipe
        if (Math.abs(diff) > 20) {
            if (diff > 0) {
                // Swiping right - show indicator for left panel
                document.body.classList.add('swiping-right');
            } else {
                // Swiping left - show indicator for right panel
                document.body.classList.add('swiping-left');
            }
        }
    }
    
    // Handle touch end - determine swipe direction and toggle panels
    function handleTouchEnd(e) {
        if (!touchStarted) return;
        
        touchEndX = e.changedTouches[0].clientX;
        
        // Calculate swipe distance
        const swipeDistance = touchEndX - touchStartX;
        
        // Handle swipe gestures if they exceed minimum distance
        if (Math.abs(swipeDistance) >= minSwipeDistance) {
            if (swipeDistance > 0) {
                // Swipe right - show left panel
                if (leftPane && window.innerWidth <= 768) {
                    leftPane.classList.add('open');
                    if (rightPane) rightPane.classList.remove('open');
                }
            } else {
                // Swipe left - show right panel
                if (rightPane && window.innerWidth <= 768) {
                    rightPane.classList.add('open');
                    if (leftPane) leftPane.classList.remove('open');
                }
            }
        }
        
        // Reset visual indicators
        document.body.classList.remove('swiping-right', 'swiping-left');
        touchStarted = false;
    }
    
    // Close panels when clicking/tapping outside - This logic is now handled by mobile-sidepane.js
    /*
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 768) {
            if (leftPane && leftPane.classList.contains('open') && 
                !leftPane.contains(e.target) && 
                !e.target.closest('.left-toggle')) {
                leftPane.classList.remove('open');
            }
            
            if (rightPane && rightPane.classList.contains('open') && 
                !rightPane.contains(e.target) && 
                !e.target.closest('.right-toggle')) {
                rightPane.classList.remove('open');
            }
        }
    });
    */
    
    // Add swipe indicators
    const swipeIndicatorLeft = document.createElement('div');
    swipeIndicatorLeft.className = 'swipe-indicator left-indicator';
    swipeIndicatorLeft.innerHTML = '<div class="indicator-content"><span>←</span><span>Rooms</span></div>';
    
    const swipeIndicatorRight = document.createElement('div');
    swipeIndicatorRight.className = 'swipe-indicator right-indicator';
    swipeIndicatorRight.innerHTML = '<div class="indicator-content"><span>Users</span><span>→</span></div>';
    
    if (mainContent) {
        mainContent.appendChild(swipeIndicatorLeft);
        mainContent.appendChild(swipeIndicatorRight);
    }
    
    // Show swipe indicators on first visit
    const hasSeenSwipeGuide = localStorage.getItem('seen-swipe-guide');
    if (!hasSeenSwipeGuide && window.innerWidth <= 768) {
        setTimeout(() => {
            document.body.classList.add('show-swipe-guide');
            setTimeout(() => {
                document.body.classList.remove('show-swipe-guide');
                localStorage.setItem('seen-swipe-guide', 'true');
            }, 3000);
        }, 2000);
    }
});
