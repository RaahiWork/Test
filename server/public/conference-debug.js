// Conference Controls Debug Helper
// This script helps debug issues with conference room controls

class ConferenceDebugger {
    constructor() {
        this.debugMode = true;
        this.checkInterval = null;
        this.init();
    }    init() {
        // Check for controls every 2 seconds
        this.checkInterval = setInterval(() => {
            this.checkControls();
        }, 2000);
        
        // Add keyboard shortcuts for testing
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey) {
                switch(e.key) {
                    case 'M':
                        this.testMicButton();
                        e.preventDefault();
                        break;
                    case 'V':
                        this.testVideoButton();
                        e.preventDefault();
                        break;
                    case 'S':
                        this.testScreenButton();
                        e.preventDefault();
                        break;
                    case 'D':
                        this.dumpControlsInfo();
                        e.preventDefault();
                        break;
                }
            }
        });
    }

    checkControls() {
        const conferenceRoom = document.getElementById('conference-room-container');
        if (!conferenceRoom || conferenceRoom.style.display === 'none') {
            return; // No conference room active
        }

        const controls = {
            micBtn: document.getElementById('conference-mic-btn'),
            videoBtn: document.getElementById('conference-video-btn'),
            screenBtn: document.getElementById('conference-screen-btn'),
            videoGrid: document.getElementById('conference-video-grid'),
            participantsCount: document.getElementById('conference-participants-count')
        };        // Check controls but don't log issues
        Object.entries(controls).forEach(([name, element]) => {
            // Checks removed as part of log removal
        });
    }

    hasEventListener(element, eventType) {
        // This is a simplified check - in reality, we can't easily detect all event listeners
        // But we can check for some common patterns
        return element.hasAttribute(`on${eventType}`) || 
               element.getEventListeners && element.getEventListeners()[eventType]?.length > 0;
    }    testMicButton() {
        const micBtn = document.getElementById('conference-mic-btn');
        if (micBtn) {
            this.simulateClick(micBtn);
        }
    }    testVideoButton() {
        const videoBtn = document.getElementById('conference-video-btn');
        if (videoBtn) {
            this.simulateClick(videoBtn);
        }
    }    testScreenButton() {
        const screenBtn = document.getElementById('conference-screen-btn');
        if (screenBtn) {
            this.simulateClick(screenBtn);
        }
    }    simulateClick(element) {
        // Try multiple ways to trigger the click
        
        // Method 1: Call onclick directly
        if (element.onclick) {
            element.onclick();
        }
        
        // Method 2: Dispatch click event
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        element.dispatchEvent(clickEvent);
        
        // Method 3: Focus and trigger
        if (element.focus) {
            element.focus();
        }
    }    dumpControlsInfo() {
        // Method preserved without logs
        
        // Check for overlapping elements
        this.checkForOverlaps();
    }    checkForOverlaps() {
        const controls = ['conference-mic-btn', 'conference-video-btn', 'conference-screen-btn'];
        controls.forEach(id => {
            const element = document.getElementById(id);
            if (!element) return;
            
            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            const elementAtPoint = document.elementFromPoint(centerX, centerY);
            
            // Check for overlaps but don't log
        });
    }    forceEnableButtons() {
        const controls = ['conference-mic-btn', 'conference-video-btn', 'conference-screen-btn'];
        controls.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.pointerEvents = 'auto';
                element.style.cursor = 'pointer';
                element.disabled = false;
            }
        });
    }    destroy() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
    }
}

// Auto-initialize debugger
window.ConferenceDebugger = window.ConferenceDebugger || new ConferenceDebugger();

// Add global helper functions
window.debugConference = () => window.ConferenceDebugger.dumpControlsInfo();
window.fixConferenceButtons = () => window.ConferenceDebugger.forceEnableButtons();
