class RadioPlayer {
    constructor() {
        this.audio = null;
        this.isPlaying = false;
        this.currentStation = null;
        this.volume = 0.5;
        this.stations = [
            // Chill & Ambient
            {
                name: "Lofi Hip Hop",
                url: "https://streams.ilovemusic.de/iloveradio17.mp3",
                genre: "Chill",
                icon: "🎵",
                country: "Global"
            },
            {
                name: "Ambient Space",
                url: "https://streams.ilovemusic.de/iloveradio6.mp3",
                genre: "Ambient",
                icon: "🌌",
                country: "Global"
            },
            {
                name: "Chill Out Radio",
                url: "https://streams.ilovemusic.de/iloveradio8.mp3",
                genre: "Chill Out",
                icon: "🧘",
                country: "Global"
            },
            // Electronic & Dance
            {
                name: "Electronic Vibes",
                url: "https://streams.ilovemusic.de/iloveradio2.mp3", 
                genre: "Electronic",
                icon: "🎧",
                country: "Global"
            },
            {
                name: "Dance & House",
                url: "https://streams.ilovemusic.de/iloveradio11.mp3",
                genre: "Dance",
                icon: "💃",
                country: "Global"
            },
            {
                name: "Hardstyle FM",
                url: "https://streams.ilovemusic.de/iloveradio13.mp3",
                genre: "Hardstyle",
                icon: "⚡",
                country: "Global"
            },
            // Rock & Alternative
            {
                name: "Rock Classics",
                url: "https://streams.ilovemusic.de/iloveradio3.mp3",
                genre: "Rock",
                icon: "🎸",
                country: "Global"
            },
            {
                name: "Alternative Rock",
                url: "https://streams.ilovemusic.de/iloveradio15.mp3",
                genre: "Alternative",
                icon: "🤘",
                country: "Global"
            },
            // Jazz & Classical
            {
                name: "Jazz Cafe",
                url: "https://jazz-wr04.ice.infomaniak.ch/jazz-wr04-128.mp3",
                genre: "Jazz",
                icon: "🎷",
                country: "Global"
            },
            {
                name: "Smooth Jazz",
                url: "https://streams.ilovemusic.de/iloveradio9.mp3",
                genre: "Smooth Jazz",
                icon: "🎺",
                country: "Global"
            },
            // Pop & Mainstream
            {
                name: "Pop Hits",
                url: "https://streams.ilovemusic.de/iloveradio1.mp3",
                genre: "Pop",
                icon: "🎤",
                country: "Global"
            },
            {
                name: "Greatest Hits",
                url: "https://streams.ilovemusic.de/iloveradio5.mp3",
                genre: "Greatest Hits",
                icon: "⭐",
                country: "Global"
            },
            // Hip Hop & R&B
            {
                name: "Hip Hop Central",
                url: "https://streams.ilovemusic.de/iloveradio12.mp3",
                genre: "Hip Hop",
                icon: "🎤",
                country: "Global"
            },
            {
                name: "R&B Soul",
                url: "https://streams.ilovemusic.de/iloveradio14.mp3",
                genre: "R&B",
                icon: "💫",
                country: "Global"
            },
            // Indie & Alternative
            {
                name: "Indie Vibes",
                url: "https://streams.ilovemusic.de/iloveradio16.mp3",
                genre: "Indie",
                icon: "🌿",
                country: "Global"
            },
            {
                name: "90s Throwback",
                url: "https://streams.ilovemusic.de/iloveradio7.mp3",
                genre: "90s Hits",
                icon: "📼",
                country: "Global"
            }
        ];
        
        this.init();
    }
    
    init() {
        this.createAudioElement();
        this.renderStations();
        this.setupEventListeners();
        this.updateUI();
    }
    
    createAudioElement() {
        this.audio = new Audio();
        this.audio.volume = this.volume;
        this.audio.preload = 'none';
        this.audio.crossOrigin = "anonymous";
        
        this.audio.addEventListener('loadstart', () => {
            this.updateStatus('Loading...');
        });
        
        this.audio.addEventListener('canplay', () => {
            this.updateStatus('Ready to play');
        });
        
        this.audio.addEventListener('playing', () => {
            this.updateStatus('Playing');
            this.isPlaying = true;
            this.updatePlayButton();
        });
        
        this.audio.addEventListener('pause', () => {
            this.updateStatus('Paused');
            this.isPlaying = false;
            this.updatePlayButton();
        });
        
        this.audio.addEventListener('error', (e) => {
            console.error('Radio stream error:', e);
            const station = this.stations[this.currentStation];
            this.updateStatus(`Failed: ${station?.name || 'Unknown'}`);
            this.isPlaying = false;
            this.updatePlayButton();
            
            // Auto-try next station if this one fails
            setTimeout(() => {
                this.tryNextWorkingStation();
            }, 2000);
        });
        
        this.audio.addEventListener('waiting', () => {
            this.updateStatus('Buffering...');
        });
        
        this.audio.addEventListener('stalled', () => {
            this.updateStatus('Connection stalled...');
        });
    }
    
    tryNextWorkingStation() {
        if (this.currentStation !== null) {
            // Try the next station in the list
            const nextIndex = (this.currentStation + 1) % this.stations.length;
            //console.log(`Trying next station: ${this.stations[nextIndex].name}`);
            this.selectStation(nextIndex);
        }
    }
    
    renderStations() {
        const stationList = document.getElementById('station-list');
        if (!stationList) return;
        
        stationList.innerHTML = '';
        
        // Group stations by genre type
        const chillStations = this.stations.filter(s => ['Chill', 'Ambient', 'Chill Out'].includes(s.genre));
        const electronicStations = this.stations.filter(s => ['Electronic', 'Dance', 'Hardstyle'].includes(s.genre));
        const rockStations = this.stations.filter(s => ['Rock', 'Alternative'].includes(s.genre));
        const jazzStations = this.stations.filter(s => ['Jazz', 'Smooth Jazz'].includes(s.genre));
        const popStations = this.stations.filter(s => ['Pop', 'Greatest Hits', '90s Hits'].includes(s.genre));
        const urbanStations = this.stations.filter(s => ['Hip Hop', 'R&B'].includes(s.genre));
        const indieStations = this.stations.filter(s => ['Indie'].includes(s.genre));
        
        // Add sections
        this.addStationSection(stationList, 'Chill & Ambient', chillStations);
        this.addStationSection(stationList, 'Electronic & Dance', electronicStations);
        this.addStationSection(stationList, 'Rock & Alternative', rockStations);
        this.addStationSection(stationList, 'Jazz & Classical', jazzStations);
        this.addStationSection(stationList, 'Pop & Hits', popStations);
        this.addStationSection(stationList, 'Hip Hop & R&B', urbanStations);
        this.addStationSection(stationList, 'Indie & Alternative', indieStations);
    }
    
    addStationSection(container, title, stations) {
        if (stations.length === 0) return;
        
        // Add section header
        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'station-section-header';
        sectionHeader.textContent = title;
        container.appendChild(sectionHeader);
        
        // Add stations
        stations.forEach((station, index) => {
            const globalIndex = this.stations.indexOf(station);
            const stationItem = document.createElement('div');
            stationItem.className = 'station-item';
            stationItem.dataset.stationIndex = globalIndex;
            
            stationItem.innerHTML = `
                <div class="station-icon">${station.icon}</div>
                <div class="station-details">
                    <div class="station-name">${station.name}</div>
                    <div class="station-genre">${station.genre}</div>
                </div>
                <div class="station-status-dot"></div>
            `;
            
            stationItem.addEventListener('click', () => {
                this.selectStation(globalIndex);
            });
            
            container.appendChild(stationItem);
        });
    }
    
    setupEventListeners() {
        const playPauseBtn = document.getElementById('play-pause-btn');
        const volumeBtn = document.getElementById('volume-btn');
        const volumeSlider = document.getElementById('volume-slider');
        
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                this.togglePlayPause();
            });
        }
        
        if (volumeBtn) {
            volumeBtn.addEventListener('click', () => {
                this.toggleMute();
            });
        }
        
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                this.setVolume(e.target.value / 100);
            });
        }
    }
    
    selectStation(index) {
        if (index < 0 || index >= this.stations.length) return;
        
        const station = this.stations[index];
        
        // Update current station
        this.currentStation = index;
        
        // Update UI
        this.updateStationSelection();
        this.updateCurrentStationInfo(station);
        
        // Stop current audio and load new station
        if (this.audio) {
            this.audio.pause();
            this.audio.src = station.url;
            this.audio.load();
        }
        
        // Auto-play if was playing before
        if (this.isPlaying) {
            setTimeout(() => {
                this.play();
            }, 500);
        }
        
        // Broadcast station change to other users
        this.broadcastStationChange(station);
    }
    
    togglePlayPause() {
        if (!this.currentStation && this.currentStation !== 0) {
            // No station selected, select first working one (Lofi Hip Hop)
            this.selectStation(0);
            return;
        }
        
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }
    
    play() {
        if (this.audio && this.audio.src) {
            this.updateStatus('Starting...');
            const playPromise = this.audio.play();
            
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    //console.log('Radio playback started successfully');
                }).catch(error => {
                    console.error('Failed to start radio playback:', error);
                    this.updateStatus('Playback failed - trying next...');
                    
                    // Try next station after a brief delay
                    setTimeout(() => {
                        this.tryNextWorkingStation();
                    }, 1000);
                });
            }
        }
    }
    
    pause() {
        if (this.audio) {
            this.audio.pause();
        }
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.audio) {
            this.audio.volume = this.volume;
        }
        this.updateVolumeUI();
    }
    
    toggleMute() {
        if (this.volume > 0) {
            this.previousVolume = this.volume;
            this.setVolume(0);
        } else {
            this.setVolume(this.previousVolume || 0.5);
        }
        
        const volumeSlider = document.getElementById('volume-slider');
        if (volumeSlider) {
            volumeSlider.value = this.volume * 100;
        }
    }
    
    updatePlayButton() {
        const playIcon = document.querySelector('.play-icon');
        if (playIcon) {
            playIcon.textContent = this.isPlaying ? '⏸️' : '▶️';
        }
    }
    
    updateVolumeUI() {
        const volumeIcon = document.querySelector('.volume-icon');
        if (volumeIcon) {
            if (this.volume === 0) {
                volumeIcon.textContent = '🔇';
            } else if (this.volume < 0.5) {
                volumeIcon.textContent = '🔉';
            } else {
                volumeIcon.textContent = '🔊';
            }
        }
    }
    
    updateStationSelection() {
        const stationItems = document.querySelectorAll('.station-item');
        stationItems.forEach((item, index) => {
            const stationIndex = parseInt(item.dataset.stationIndex);
            if (stationIndex === this.currentStation) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
    
    updateCurrentStationInfo(station) {
        const currentStationEl = document.querySelector('.current-station');
        if (currentStationEl) {
            currentStationEl.textContent = `${station.icon} ${station.name}`;
        }
    }
    
    updateStatus(status) {
        const statusEl = document.querySelector('.station-status');
        if (statusEl) {
            statusEl.textContent = status;
        }
    }
    
    updateUI() {
        this.updatePlayButton();
        this.updateVolumeUI();
        this.updateStationSelection();
    }
    
    broadcastStationChange(station) {
        // Only broadcast if user is logged in and socket is available
        if (typeof socket !== 'undefined' && socket) {
            const nameInput = document.querySelector('#name');
            if (nameInput?.value) {
                socket.emit('stationChange', {
                    user: nameInput.value,
                    station: station.name,
                    genre: station.genre
                });
            }
        }
    }
    
    // Method to handle station changes from other users
    handleStationBroadcast(data) {
        // Show notification about what others are listening to
        if (data.user && data.station) {
            this.showStationNotification(data.user, data.station, data.genre);
        }
    }
    
    showStationNotification(user, stationName, genre) {
        // Create a small notification
        const notification = document.createElement('div');
        notification.className = 'station-notification';
        notification.innerHTML = `
            <span class="station-notification-text">
                🎵 ${user} is listening to ${stationName} (${genre})
            </span>
        `;
        
        const chatDisplay = document.querySelector('.chat-display');
        if (chatDisplay) {
            chatDisplay.appendChild(notification);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 5000);
            
            // Scroll to show notification
            chatDisplay.scrollTop = chatDisplay.scrollHeight;
        }
    }
}

// Initialize radio player when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.radioPlayer = new RadioPlayer();
    
    // Set up socket handler for station broadcasts if socket becomes available
    const setupRadioSocketHandlers = () => {
        if (typeof socket !== 'undefined' && socket && window.radioPlayer) {
            socket.on('stationChange', (data) => {
                window.radioPlayer.handleStationBroadcast(data);
            });
        } else {
            setTimeout(setupRadioSocketHandlers, 100);
        }
    };
    
    setupRadioSocketHandlers();
});
