// Conference Controls Debug Helper
// This script helps debug issues with conference room controls

class ConferenceDebugger {
    constructor() {
        this.debugMode = true;
        this.checkInterval = null;
        this.init();
    }

    init() {
        console.log('🔧 Conference Debugger initialized');
        
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
        
        console.log('📝 Keyboard shortcuts:');
        console.log('  Ctrl+Shift+M: Test mic button');
        console.log('  Ctrl+Shift+V: Test video button');
        console.log('  Ctrl+Shift+S: Test screen button');
        console.log('  Ctrl+Shift+D: Dump controls info');
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
        };

        let issuesFound = [];

        Object.entries(controls).forEach(([name, element]) => {
            if (!element) {
                issuesFound.push(`❌ ${name} not found`);
                return;
            }

            // Check if element is clickable
            const style = window.getComputedStyle(element);
            if (style.pointerEvents === 'none') {
                issuesFound.push(`🚫 ${name} has pointer-events: none`);
            }
            
            if (style.display === 'none') {
                issuesFound.push(`👻 ${name} is hidden (display: none)`);
            }
            
            if (style.visibility === 'hidden') {
                issuesFound.push(`👻 ${name} is hidden (visibility: hidden)`);
            }

            // Check if button has click handler
            if (name.includes('btn') && !element.onclick && !this.hasEventListener(element, 'click')) {
                issuesFound.push(`⚠️ ${name} has no click handler`);
            }

            // Check z-index issues
            const zIndex = parseInt(style.zIndex) || 0;
            if (zIndex < 0) {
                issuesFound.push(`📉 ${name} has negative z-index: ${zIndex}`);
            }
        });

        if (issuesFound.length > 0 && this.debugMode) {
            console.warn('🐛 Conference controls issues found:', issuesFound);
        }
    }

    hasEventListener(element, eventType) {
        // This is a simplified check - in reality, we can't easily detect all event listeners
        // But we can check for some common patterns
        return element.hasAttribute(`on${eventType}`) || 
               element.getEventListeners && element.getEventListeners()[eventType]?.length > 0;
    }

    testMicButton() {
        const micBtn = document.getElementById('conference-mic-btn');
        if (micBtn) {
            console.log('🎤 Testing mic button...');
            this.simulateClick(micBtn);
        } else {
            console.error('❌ Mic button not found');
        }
    }

    testVideoButton() {
        const videoBtn = document.getElementById('conference-video-btn');
        if (videoBtn) {
            console.log('📹 Testing video button...');
            this.simulateClick(videoBtn);
        } else {
            console.error('❌ Video button not found');
        }
    }

    testScreenButton() {
        const screenBtn = document.getElementById('conference-screen-btn');
        if (screenBtn) {
            console.log('🖥️ Testing screen button...');
            this.simulateClick(screenBtn);
        } else {
            console.error('❌ Screen button not found');
        }
    }

    simulateClick(element) {
        // Try multiple ways to trigger the click
        console.log('🖱️ Simulating click on:', element.id);
        
        // Method 1: Call onclick directly
        if (element.onclick) {
            console.log('  → Using onclick handler');
            element.onclick();
        }
        
        // Method 2: Dispatch click event
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        console.log('  → Dispatching click event');
        element.dispatchEvent(clickEvent);
        
        // Method 3: Focus and trigger
        if (element.focus) {
            element.focus();
        }
    }

    dumpControlsInfo() {
        console.log('🔍 Conference Controls Debug Info:');
        
        const conferenceRoom = document.getElementById('conference-room-container');
        console.log('Conference Room:', {
            exists: !!conferenceRoom,
            visible: conferenceRoom ? conferenceRoom.style.display !== 'none' : false,
            zIndex: conferenceRoom ? window.getComputedStyle(conferenceRoom).zIndex : 'N/A'
        });

        const controls = ['conference-mic-btn', 'conference-video-btn', 'conference-screen-btn'];
        controls.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                
                console.log(`${id}:`, {
                    exists: true,
                    visible: style.display !== 'none' && style.visibility !== 'hidden',
                    clickable: style.pointerEvents !== 'none',
                    position: {
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height
                    },
                    style: {
                        display: style.display,
                        visibility: style.visibility,
                        pointerEvents: style.pointerEvents,
                        zIndex: style.zIndex,
                        cursor: style.cursor
                    },
                    hasOnclick: !!element.onclick,
                    textContent: element.textContent
                });
            } else {
                console.log(`${id}: NOT FOUND`);
            }
        });

        // Check for overlapping elements
        this.checkForOverlaps();
    }

    checkForOverlaps() {
        console.log('🔍 Checking for overlapping elements...');
        
        const controls = ['conference-mic-btn', 'conference-video-btn', 'conference-screen-btn'];
        controls.forEach(id => {
            const element = document.getElementById(id);
            if (!element) return;
            
            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            const elementAtPoint = document.elementFromPoint(centerX, centerY);
            
            if (elementAtPoint !== element) {
                console.warn(`⚠️ ${id} is being overlapped by:`, elementAtPoint);
            }
        });
    }

    forceEnableButtons() {
        console.log('🔧 Force enabling all conference buttons...');
        
        const controls = ['conference-mic-btn', 'conference-video-btn', 'conference-screen-btn'];
        controls.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.pointerEvents = 'auto';
                element.style.cursor = 'pointer';
                element.disabled = false;
                console.log(`✅ ${id} enabled`);
            }
        });
    }

    destroy() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
        console.log('🔧 Conference Debugger destroyed');
    }
}

// Auto-initialize debugger
window.ConferenceDebugger = window.ConferenceDebugger || new ConferenceDebugger();

// Add global helper functions
window.debugConference = () => window.ConferenceDebugger.dumpControlsInfo();
window.fixConferenceButtons = () => window.ConferenceDebugger.forceEnableButtons();

console.log('🚀 Conference Debug Helper loaded');
console.log('Use debugConference() to get detailed info');
console.log('Use fixConferenceButtons() to force enable buttons');
