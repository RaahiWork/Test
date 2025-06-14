// LiveKit integration for conference calls in private chat
// This script provides a minimal LiveKit client for managing conference calls in private messages
// Uses .env variables for connection

// You must include the LiveKit client library in your HTML:
// <script src="https://unpkg.com/livekit-client/dist/livekit-client.min.js"></script>

// Remove all hardcoded LiveKit credentials from frontend. Credentials must never be exposed here.
// The backend should inject the LiveKit WebSocket URL if needed, e.g. via a global variable or data attribute.
// If needed, use window.LIVEKIT_WS_URL (set by backend) or require it as a parameter.

// Helper to fetch a LiveKit token from your backend (implement this route in your backend)
async function fetchLiveKitToken(identity, room) {
  // This should be a secure endpoint in production
  const res = await fetch(`/api/livekit-token?identity=${encodeURIComponent(identity)}&room=${encodeURIComponent(room)}`);
  if (!res.ok) throw new Error('Failed to fetch LiveKit token');
  // Token is returned as JSON, not plain text
  const data = await res.json();
  // Defensive: handle if token is an object (buggy backend) or string (correct)
  let token = data.token;
  if (typeof token === 'object' && token !== null) {
    // Try to extract token from a nested property, or stringify if needed
    token = token.jwt || token.value || JSON.stringify(token);
  }
  const wsUrl = data.wsUrl;
  //console.log(`Fetched LiveKit token for ${identity} in room ${room} `+ token);
  if (!token) throw new Error('No token received from LiveKit token endpoint');
  // wsUrl is optional, fallback to window.LIVEKIT_WS_URL if present
  return { token, wsUrl: wsUrl || window.LIVEKIT_WS_URL };
}

// Helper to get deterministic room name for two users
function getPrivateRoomName(identity, targetUser) {
  if (!identity || !targetUser) {
    throw new Error('Both identity and targetUser are required for private room name');
  }
  // Always order the two names the same way
  return `pm-${[identity, targetUser].sort((a, b) => a.localeCompare(b)).join('-')}`;
}

// Connect to LiveKit and publish an audio track
async function sendVoiceNoteToUser(identity, targetUser, audioBlob) {
  const roomName = getPrivateRoomName(identity, targetUser);
  const { token, wsUrl } = await fetchLiveKitToken(identity, roomName);
  const wsURL = wsUrl;
  if (!wsURL) throw new Error('No LiveKit WebSocket URL provided');
  const room = new window.LiveKit.Room();
  await room.connect(wsURL, token);

  // Convert Blob to AudioBuffer and publish as a track
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  const dest = audioCtx.createMediaStreamDestination();
  source.connect(dest);
  source.start();
  const track = LivekitClient.LocalAudioTrack.createTrack(dest.stream.getAudioTracks()[0]);
  await room.localParticipant.publishTrack(track);
  // Optionally, send a chat message with metadata (e.g., "voice note sent")
  // room.localParticipant.publishData(...)
  // Disconnect after sending
  setTimeout(() => room.disconnect(), 5000);
}

// Listen for incoming voice notes in a private chat
async function listenForVoiceNotes(identity, targetUser, onVoiceNote) {
  const roomName = getPrivateRoomName(identity, targetUser);
  const { token, wsUrl } = await fetchLiveKitToken(identity, roomName);
  const wsURL = wsUrl;
  if (!wsURL) throw new Error('No LiveKit WebSocket URL provided');
  const room = new window.LiveKit.Room();
  await room.connect(wsURL, token);
  room.on('trackSubscribed', (track, publication, participant) => {
    if (track.kind === 'audio') {
      // Play the audio track
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      track.attach(audioEl);
      if (onVoiceNote) onVoiceNote(audioEl, participant.identity);
    }
  });
  // Return the room instance so you can disconnect later
  return room;
}

// Move window.openConferencePopup definition to the top level so it is available immediately
window.openConferencePopup = function(options = {}) {  // options: { autoJoin, defaultMicMuted, defaultVideoMuted, hostUsername, roomName }
  // If hostUsername and roomName are provided, use them; otherwise use current user as host
  const currentUser = localStorage.getItem('vybchat-username') || localStorage.getItem('username') || 'Unknown';
  const hostUsername = options.hostUsername || currentUser;
  
  // Generate fresh room name for new host starts to ensure clean state
  let roomName;
  if (options.isHostStarting) {
    // For fresh host starts, create a new room with timestamp to ensure uniqueness
    const timestamp = Date.now();
    roomName = `vybchat-stream-${currentUser}-${timestamp}`;
    //console.log('[LiveKit] 🆕 Generated fresh room name for host start:', roomName);
  } else {
    // For joiners or existing rooms, use provided room name or default
    roomName = options.roomName || `vybchat-stream-${currentUser}`;
  }
  // Helper to show the conference room with video controls
  function showConferenceRoom(hostUsername, roomName, options) {
    let conferenceRoom = document.getElementById('conference-room-container');
    if (!conferenceRoom) {
      conferenceRoom = document.createElement('div');
      conferenceRoom.id = 'conference-room-container';
      conferenceRoom.className = 'conference-room-container';
      document.body.appendChild(conferenceRoom);
    } else {
      conferenceRoom.style.display = 'flex';
    }

    conferenceRoom.innerHTML = `
      <div class="conference-room-main">
        <!-- Header -->
        <div class="conference-room-header">
          <div class="conference-room-info">
            <h2>${hostUsername}'s Conference</h2>
            <div class="conference-room-details">
              <p class="conference-room-name">Room: ${roomName}</p>
              <span id="conference-connection-status" class="conference-connection-status">🟡 Connecting...</span>
            </div>
          </div>
          <div class="conference-header-buttons">
            <button id="conference-share-btn" class="conference-share-btn" title="Share conference link">
              🔗 Share
            </button>
            <button id="conference-close-btn" class="conference-close-btn">
              Leave Conference
            </button>
          </div>
        </div>
        <!-- Video Grid -->
        <div id="conference-video-grid" class="conference-video-grid">
          <!-- Participant videos will be added here -->
        </div>        <!-- Controls Bar -->
        <div class="conference-controls-bar">
          <button id="conference-mic-btn" class="conference-control-btn conference-mic-btn muted" title="Enable Microphone">
            🎤
          </button>
          <button id="conference-speaker-btn" class="conference-control-btn conference-speaker-btn muted" title="Enable Speaker">
            🔊
          </button>
          <button id="conference-video-btn" class="conference-control-btn conference-video-btn disabled" title="Enable Camera">
            📹
          </button>
          <button id="conference-screen-btn" class="conference-control-btn conference-screen-btn" title="Share Screen">
            🖥️
          </button>
          <div class="conference-participants-info">
            <span id="conference-participants-count">1 participant</span>
          </div>
        </div>
      </div>
    `;

    // Set up a temporary close button handler
    const closeBtn = conferenceRoom.querySelector('#conference-close-btn');
    let leaveConferenceFunction = null;
      closeBtn.onclick = () => {
      if (leaveConferenceFunction) {
        leaveConferenceFunction();
      } else {
        // Fallback cleanup if conference hasn't initialized yet
        const currentUser = localStorage.getItem('vybchat-username') || localStorage.getItem('username');
        const isHost = !options.isJoiner && currentUser === hostUsername;
        
        if (isHost) {
          //console.log('[LiveKit] 🏠 Host closing conference (fallback) - notifying all participants');
          // Notify server that host is leaving so all participants can be disconnected
          if (typeof socket !== 'undefined' && socket) {
            socket.emit('hostLeftConference', { 
              hostUsername: currentUser, 
              roomName: roomName 
            });
          }
        }
        
        const conferenceRoom = document.getElementById('conference-room-container');
        if (conferenceRoom) {
          conferenceRoom.style.display = 'none';
        }
        // Reset stream button
        const streamBtn = document.getElementById('stream-btn-global');
        if (streamBtn) {
          streamBtn.disabled = false;
          streamBtn.classList.remove('streaming-active');
          streamBtn.innerHTML = '<span class="stream-btn-fancy-glow">🔴</span> <span class="stream-btn-fancy-label">Start Stream</span>';
        }

        // Notify server that this user is no longer streaming
        if (typeof socket !== 'undefined' && socket) {
          const currentUser = localStorage.getItem('vybchat-username') || localStorage.getItem('username');
          if (currentUser) {
            socket.emit('streamingStatusUpdate', { username: currentUser, isStreaming: false });
          }
        }
      }
    };

    // Set up share button handler
    const shareBtn = conferenceRoom.querySelector('#conference-share-btn');
    shareBtn.onclick = () => {
      generateAndShareConferenceLink(hostUsername, roomName);
    };    // Initialize the conference room and update the close button handler
    initializeConferenceRoom({
      hostUsername,
      roomName,
      options,
      defaultMicMuted: options && options.defaultMicMuted,
      defaultVideoMuted: options && options.defaultVideoMuted,
      joinerIdentity: options && options.joinerIdentity  // Pass joiner identity if available
    }).then(conferenceControls => {
      // Update the leave function reference
      if (conferenceControls && conferenceControls.leaveConference) {
        leaveConferenceFunction = conferenceControls.leaveConference;
      }
    }).catch(err => {
      console.error('Failed to initialize conference room:', err);
    });
  }

  // Helper to show the conference modal with correct username
  function showConferenceModal(hostUsername, room, modalOptions = {}) {
    let modal = document.getElementById('conference-popup-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'conference-popup-modal';
      modal.className = 'conference-modal-overlay';
      document.body.appendChild(modal);
    }
    
    // Ensure the modal is properly styled and visible
    modal.style.display = 'flex';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    modal.style.zIndex = '10000';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    
    modal.innerHTML = `
      <div class="conference-modal-content" style="background-color: #1a1a2e; padding: 20px; border-radius: 8px; width: 90%; max-width: 400px; box-shadow: 0 4px 8px rgba(0,0,0,0.5);">
        <h2 class="conference-modal-title" style="color: #a084ee; margin-top: 0;">Join Stream</h2>
        <div class="conference-modal-text" style="color: white; margin-bottom: 20px;">You are joining <b>${hostUsername}</b>'s stream.</div>
        <div style="display: flex; gap: 10px;">
          <button id="conference-join-btn" class="conference-join-btn" style="flex: 1; padding: 10px; background-color: #6c63ff; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Join</button>
          <button id="conference-cancel-btn" class="conference-cancel-btn" style="flex: 1; padding: 10px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
        </div>
      </div>
    `;
    
    // Log that the modal was created and shown
    //console.log("Join Stream modal shown for:", hostUsername, "room:", room);
    
    // Cancel button closes the popup
    modal.querySelector('#conference-cancel-btn').onclick = () => {
      modal.style.display = 'none';
      //("Join Stream modal cancelled");
    };
      // Join button sends a request to the host and shows the lobby UI
    modal.querySelector('#conference-join-btn').onclick = async () => {
      try {
        const joiner = localStorage.getItem('vybchat-username') || localStorage.getItem('username') || 'Unknown';
        console.log("[LiveKit Lobby] 🚪 Joining request initiated by:", joiner);
        
        // Update modal to show waiting in lobby UI
        modal.innerHTML = `
          <div class="conference-modal-content" style="background-color: #1a1a2e; padding: 20px; border-radius: 8px; width: 90%; max-width: 400px; box-shadow: 0 4px 8px rgba(0,0,0,0.5);">
            <h2 class="conference-modal-title" style="color: #a084ee; margin-top: 0;">Waiting in Lobby</h2>
            <div class="conference-modal-text" style="color: white; margin-bottom: 20px;">
              <p>You are in <b>${hostUsername}</b>'s waiting room.</p>
              <p>Please wait for the host to approve your request to join.</p>
            </div>
            <div class="lobby-spinner" style="display: flex; justify-content: center; margin: 20px 0;">
              <div style="width: 40px; height: 40px; border: 4px solid rgba(255, 255, 255, 0.3); border-radius: 50%; border-top-color: #a084ee; animation: spin 1s ease-in-out infinite;"></div>
            </div>
            <button id="lobby-cancel-btn" class="lobby-cancel-btn" style="width: 100%; padding: 10px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">
              Cancel Request
            </button>
          </div>
          <style>
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          </style>
        `;
        
        // Set up cancel button
        modal.querySelector('#lobby-cancel-btn').onclick = () => {
          // Emit cancellation to host
          if (typeof socket !== 'undefined' && socket) {
            socket.emit('cancelJoinRequest', { 
              joinerName: joiner, 
              hostName: hostUsername, 
              roomName: room 
            });
          }
          modal.style.display = 'none';
          console.log("[LiveKit Lobby] 🚪 Join request cancelled by guest");
        };
        
        // Send join request to the host via socket.io
        if (typeof socket !== 'undefined' && socket) {
          socket.emit('requestToJoinConference', { 
            joinerName: joiner, 
            hostName: hostUsername, 
            roomName: room 
          });
          
          console.log("[LiveKit Lobby] 🚪 Join request sent to host:", hostUsername);
          
          // Set up listener for approval response
          socket.on('joinRequestApproved', async (data) => {
            if (data.joinerName === joiner && data.roomName === room) {
              console.log("[LiveKit Lobby] ✅ Join request approved by host");
              
              try {
                // Connect to the room now that we have approval
                const { token, wsUrl } = await fetchLiveKitToken(joiner, room);
                const wsURL = wsUrl;
                if (!wsURL) throw new Error('No LiveKit WebSocket URL provided');
                const roomObj = new window.LiveKit.Room();
                await roomObj.connect(wsURL, token);
                
                // Mute mic by default unless explicitly enabled
                if (modalOptions.defaultMicMuted !== false) {
                  await roomObj.localParticipant.setMicrophoneEnabled(false);
                }
                
                // Only enable camera if defaultVideoMuted is explicitly set to false
                if (roomObj.localParticipant.setCameraEnabled) {
                  const enableCamera = modalOptions.defaultVideoMuted === false;
                  await roomObj.localParticipant.setCameraEnabled(enableCamera);
                }
                
                // Close modal and show conference room as a joiner
                modal.style.display = 'none';
                showConferenceRoom(hostUsername, room, { 
                  ...modalOptions, 
                  autoJoin: true, 
                  isJoiner: true, 
                  room: roomObj,
                  joinerIdentity: joiner
                });
                
                // Remove the listener once we've joined
                socket.off('joinRequestApproved');
                socket.off('joinRequestRejected');
              } catch (err) {
                console.error('[LiveKit Lobby] Failed to join conference after approval:', err);
                alert('Failed to join conference: ' + err.message);
              }
            }
          });
          
          // Set up listener for rejection
          socket.on('joinRequestRejected', (data) => {
            if (data.joinerName === joiner && data.roomName === room) {
              console.log("[LiveKit Lobby] ❌ Join request rejected by host");
              modal.innerHTML = `
                <div class="conference-modal-content" style="background-color: #1a1a2e; padding: 20px; border-radius: 8px; width: 90%; max-width: 400px; box-shadow: 0 4px 8px rgba(0,0,0,0.5);">
                  <h2 class="conference-modal-title" style="color: #a084ee; margin-top: 0;">Request Rejected</h2>
                  <div class="conference-modal-text" style="color: white; margin-bottom: 20px;">
                    <p>Your request to join <b>${hostUsername}</b>'s conference was declined.</p>
                  </div>
                  <button id="rejection-ok-btn" class="rejection-ok-btn" style="width: 100%; padding: 10px; background-color: #6c63ff; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">
                    OK
                  </button>
                </div>
              `;
              
              modal.querySelector('#rejection-ok-btn').onclick = () => {
                modal.style.display = 'none';
                // Remove the listeners
                socket.off('joinRequestApproved');
                socket.off('joinRequestRejected');
              };
            }
          });
        } else {
          throw new Error('Socket connection not available. Please refresh the page and try again.');
        }
      } catch (err) {
        console.error('[LiveKit Lobby] Failed to send join request:', err);
        alert('Failed to request joining: ' + err.message);
      }
    };
  }
  // If autoJoin, join the room as host and show conference room UI
  if (options.autoJoin) {    // If this is a fresh stream start (host starting), clear any existing room state
    if (options.isHostStarting) {
      clearExistingConferenceState();
    }
    
    // Allow video to be muted by default based on options
    // If not specified, default to muted (defaultVideoMuted=true)
    if (options.defaultVideoMuted === undefined) {
      options.defaultVideoMuted = true;
    }
    
    showConferenceRoom(hostUsername, roomName, options);
  } else {
    // If not autoJoin, show a popup for other users to join the host's stream
    showConferenceModal(hostUsername, roomName, options);
  }
};

// Initialize conference room with LiveKit connection
async function initializeConferenceRoom({
  hostUsername,
  roomName,
  options,
  defaultMicMuted,
  defaultVideoMuted,
  joinerIdentity
}) {
  try {
    let room;
    
    // Check if a room is already provided (for joiners)
    if (options && options.room) {
      room = options.room;
    } else {
      // Step 1: Fetch the token from your backend
      const { token, wsUrl, corsEnabled } = await fetchLiveKitToken(hostUsername, roomName);

      if (!token) throw new Error('Received empty token from server');

      // Step 2: Get the LiveKit WebSocket URL
      const wsURL = wsUrl || window.LIVEKIT_WS_URL;
      if (!wsURL) throw new Error('No LiveKit WebSocket URL provided');
      
      // Step 3: Create a new LiveKit Room instance with enhanced connection settings
      room = new window.LiveKit.Room({
        autoManageVideo: true,
        // Improve connection stability
        adaptiveStream: true,
        dynacast: true,
        // Enhanced video quality settings for screen sharing
        videoCaptureDefaults: {
          resolution: { width: 1280, height: 720 }, // Reduced from 1080p for better stability
          frameRate: 30
        },
        // Screen share specific settings
        screenShareCaptureDefaults: {
          resolution: { width: 1280, height: 720 }, // Reduced from 1080p for better stability
          frameRate: 24                            // Reduced for better stability
        },
        // Increase timeouts for better stability with self-hosted servers
        reconnectPolicy: {
          nextRetryDelayInMs: (context) => {
            return Math.min(context.retryCount * 1500, 15000); // Increased max backoff to 15s
          },
          maxRetryCount: 8  // Increased retry count
        }
      });
      
      // Step 5: Connect to the room with additional CORS handling
      try {
        await room.connect(wsURL, token, {
          // The LiveKit JS SDK automatically adds these headers to WebSocket connections
          extraHeaders: {
            'Origin': window.location.origin,
            'Access-Control-Request-Headers': 'authorization',
            'X-CORS-Proxy-Requested': 'true'
          }
        });
      } catch (connectError) {
        // If connection fails, check if it's a CORS error and provide helpful message
        if (connectError.message && (
            connectError.message.includes('CORS') || 
            connectError.message.includes('cross-origin') ||
            connectError.message.includes('Refused to connect')
        )) {
          console.error('[LiveKit] CORS error detected:', connectError);
          throw new Error(`CORS policy error connecting to LiveKit server. Please check your browser's console or try using Chrome/Firefox.`);
        }
        throw connectError;
      }
      
      // For fresh host starts, ensure room is clean
      if (options && options.isHostStarting) {
        // The new timestamp-based room name ensures this is a fresh room
      }
    }

    // Step 4: Enhanced debug listeners with error handling
    room.on('connected', () => {
      //console.log('[LiveKit] ✅ Connected to room');
      updateConnectionStatus('connected');
      
      // Update UI to show connected state
      const connectBtn = document.getElementById('conference-join-btn');
      if (connectBtn) connectBtn.textContent = 'Connected!';
      
      // Update initial participant count
      updateParticipantCount(room);
    });    room.on('disconnected', (reason) => {
      //console.log('[LiveKit] 🔌 Disconnected from room:', reason);
      updateConnectionStatus('disconnected');
        // Reset controls when disconnected
      resetConferenceControls();
      
      // Clear any focused participant
      focusedParticipant = null;
      updateGridLayout();
      
      // Handle different disconnect reasons
      if (reason === 'ping_timeout') {
        //console.log('[LiveKit] ⚠️ Ping timeout - connection will retry automatically');
      }
    });
      room.on('reconnecting', () => {
      //console.log('[LiveKit] 🔄 Reconnecting to room...');
      updateConnectionStatus('reconnecting');
    });
      room.on('reconnected', () => {
      //console.log('[LiveKit] ✅ Successfully reconnected to room');
      updateConnectionStatus('connected');
      
      // Re-enable controls after reconnection
      enableConferenceControls();
      
      // Refresh participant count after reconnection
      updateParticipantCount(room);
    });    room.on('connectionStateChanged', state => {
      //console.log('[LiveKit] 🛰️ Connection state changed:', state);
      
      // Only update status to disconnected if we're actually disconnected
      // Don't change to disconnected just because of temporary connection issues
      if (state === 'connected') {
        updateConnectionStatus('connected');
        enableConferenceControls();
      } else if (state === 'connecting' || state === 'reconnecting') {
        updateConnectionStatus('connecting');
      } else if (state === 'disconnected' && room.participants.size === 0) {
        // Only show disconnected if there are no other participants
        updateConnectionStatus('disconnected');
        resetConferenceControls();
      }
      
      // Update participant count when connection state changes
      updateParticipantCount(room);
    });    room.on('participantConnected', (participant) => {
      console.log('[LiveKit] 👤 Participant joined:', participant.identity);
      updateParticipantCount(room);
      
      // Ensure connection status shows connected for everyone
      updateConnectionStatus('connected');
      
      // Add participant name to the grid even if they don't have video yet
      addParticipantPlaceholder(participant.identity);
      
      // Set up track subscription listeners for this participant
      participant.on('trackPublished', async (publication) => {
        console.log('[LiveKit] New track published by connected participant:', participant.identity, publication.kind);
        try {
          await publication.setSubscribed(true);
          console.log('[LiveKit] Successfully subscribed to track from', participant.identity);
        } catch (err) {
          console.warn('[LiveKit] Failed to subscribe to track:', err);
        }
      });
      
      // Subscribe to any tracks this participant might already have published
      participant.videoTracks.forEach(async (publication) => {
        console.log('[LiveKit] Processing existing video track from new participant:', participant.identity);
        // Always try to subscribe regardless of current state
        try {
          await publication.setSubscribed(true);
          console.log('[LiveKit] 📹 Auto-subscribed to video track from new participant:', participant.identity);
          
          // If the track is already available, display it
          if (publication.track) {
            const videoEl = publication.track.attach();
            videoEl.autoplay = true;
            videoEl.muted = true;
            videoEl.playsInline = true;
            
            // Add to the grid immediately
            addVideoToGrid(videoEl, participant.identity);
            console.log('[LiveKit] 📹 Added existing video track to grid for new participant:', participant.identity);
          }
        } catch (err) {
          console.warn('[LiveKit] ⚠️ Failed to subscribe to video track:', err);
        }
      });
      
      participant.audioTracks.forEach(async (publication) => {
        // Always try to subscribe to audio tracks
        try {
          await publication.setSubscribed(true);
          console.log('[LiveKit] 🔊 Auto-subscribed to audio track from new participant:', participant.identity);
        } catch (err) {
          console.warn('[LiveKit] ⚠️ Failed to subscribe to audio track:', err);
        }
      });
      
      console.log(`[LiveKit] 📢 ${participant.identity} joined the conference`);
    });
      room.on('participantDisconnected', (participant) => {
      //console.log('[LiveKit] 👤 Participant left:', participant.identity);
      updateParticipantCount(room);
      
      // Keep connection status as connected if we still have the room connection
      if (room.state === 'connected') {
        updateConnectionStatus('connected');
      }
      
      // Remove participant from video grid
      removeVideoFromGrid(participant.identity);
      removeParticipantPlaceholder(participant.identity);
      
      // Broadcast to remaining participants that someone left
      //console.log(`[LiveKit] 📢 ${participant.identity} left the conference`);
    });    room.on('trackPublished', async (publication, participant) => {
      console.log('[LiveKit] 📤 Track published by', participant.identity, ':', publication.kind, publication.source);
      
      // Always auto-subscribe to newly published tracks from other participants
      if (participant !== room.localParticipant) {
        try {
          // Force subscription to ensure we get all remote tracks
          await publication.setSubscribed(true);
          console.log('[LiveKit] ✅ Auto-subscribed to new track from', participant.identity);
          
          // If this is a video track, make sure to show it immediately
          if (publication.kind === 'video' && publication.track) {
            const videoEl = publication.track.attach();
            videoEl.autoplay = true;
            videoEl.muted = true;
            videoEl.playsInline = true;
            addVideoToGrid(videoEl, participant.identity);
            console.log('[LiveKit] 📹 Video from published track added to grid for', participant.identity);
          }
        } catch (err) {
          console.warn('[LiveKit] ⚠️ Failed to auto-subscribe to new track from', participant.identity, ':', err);
        }
      }
    });    room.on('trackSubscribed', (track, publication, participant) => {
      console.log('[LiveKit] 📺 Track subscribed:', track.kind, 'from', participant.identity, 'source:', publication.source);
      
      if (track.kind === 'audio') {
        const audioEl = track.attach();
        audioEl.autoplay = true;
        
        // Add to global speaker control array and respect current speaker state
        conferenceAudioElements.push(audioEl);
        if (!isConferenceSpeakerEnabled) {
          audioEl.muted = true;
          audioEl.volume = 0;
          console.log('[LiveKit] 🔇 Audio element muted because speaker is disabled');
        } else {
          audioEl.muted = false;
          audioEl.volume = 1;
          console.log('[LiveKit] 🔊 Audio element enabled because speaker is enabled');
        }
        
        document.body.appendChild(audioEl);
        console.log('[LiveKit] 🔊 Audio track from', participant.identity, 'added to speaker control');
        
        // Add event listener for when the audio track ends
        track.on('ended', () => {
          console.log('[LiveKit] 🔊 Audio track ended for participant:', participant.identity);
          // Remove from audioElements array
          const index = conferenceAudioElements.indexOf(audioEl);
          if (index > -1) {
            conferenceAudioElements.splice(index, 1);
          }
          if (audioEl.parentNode) {
            audioEl.parentNode.removeChild(audioEl);
          }
        });
      } else if (track.kind === 'video') {
        // Remove any existing placeholder or video for this participant first
        removeVideoFromGrid(participant.identity);
        removeParticipantPlaceholder(participant.identity);
        
        console.log('[LiveKit] 📹 Creating video element for', participant.identity);
        
        // For video tracks, make sure we correctly display them
        const videoEl = track.attach();
        videoEl.autoplay = true;
        videoEl.muted = true; // Prevent echo
        videoEl.playsInline = true; // Better mobile compatibility
        
        // Set max width/height to ensure stream is visible
        videoEl.style.maxWidth = '100%';
        videoEl.style.maxHeight = '100%';
        
        // Make sure we have an ID on the element for debugging
        videoEl.id = `video-element-${participant.identity}`;
        
        // Force play the video to ensure visibility (especially important for Safari)
        videoEl.play().catch(err => {
          console.warn('[LiveKit] Error auto-playing video, trying again with user interaction:', err);
          // Add a button to manually play if needed
          const playBtn = document.createElement('button');
          playBtn.innerHTML = '▶️ Play Video';
          playBtn.className = 'video-play-button';
          playBtn.onclick = () => {
            videoEl.play();
            playBtn.remove();
          };
          videoEl.parentElement?.appendChild(playBtn);
        });
        
        // Add to the grid with participant's identity
        addVideoToGrid(videoEl, participant.identity);
        console.log('[LiveKit] 📹 Video track from', participant.identity, 'added to grid successfully');
        
        // Add event listener for when the video track ends (camera turned off)
        track.on('ended', () => {
          console.log('[LiveKit] 📹 Video track ended for participant:', participant.identity);
          removeVideoFromGrid(participant.identity);
          setTimeout(() => {
            addParticipantPlaceholder(participant.identity);
          }, 100);
        });
      }
    });
      room.on('trackUnsubscribed', (track, publication, participant) => {
      //console.log('[LiveKit] 📺 Track unsubscribed:', track.kind, 'from', participant.identity);
      if (track.kind === 'video') {
        // Remove the video element completely
        removeVideoFromGrid(participant.identity);
        
        // Add placeholder back when participant turns off their video
        // Wait a small delay to ensure the video is fully removed
        setTimeout(() => {
          addParticipantPlaceholder(participant.identity);
        }, 100);
        
        //console.log('[LiveKit] 📹 Video stopped for participant:', participant.identity, '- showing placeholder');
      }
    });    // Handle existing participants and their tracks (crucial for joiners)
    console.log('[LiveKit] 👥 Processing existing participants...', room.participants.size);
    room.participants.forEach((participant) => {
      console.log('[LiveKit] 👤 Found existing participant:', participant.identity);
      
      // Add placeholder for existing participants (they'll be replaced by video if available)
      addParticipantPlaceholder(participant.identity);
      
      // Setup track published listener for the participant
      participant.on('trackPublished', async (publication) => {
        console.log('[LiveKit] Track published by existing participant:', publication.kind, participant.identity);
        try {
          await publication.setSubscribed(true);
        } catch (err) {
          console.warn('[LiveKit] Failed to subscribe to track from existing participant:', err);
        }
      });
      
      // Check for existing video tracks and always resubscribe to ensure they're working
      participant.videoTracks.forEach(async (publication) => {
        console.log('[LiveKit] Processing video track for', participant.identity, 
                  'isSubscribed:', publication.isSubscribed,
                  'hasTrack:', !!publication.track,
                  'source:', publication.source);
        
        try {
          // Force subscription to ensure we get all video tracks
          await publication.setSubscribed(true);
          console.log('[LiveKit] Subscription successful for', participant.identity);
          
          if (publication.track) {
            console.log('[LiveKit] Track available, attaching video for', participant.identity);
            
            // Remove existing elements first
            removeVideoFromGrid(participant.identity);
            removeParticipantPlaceholder(participant.identity);
            
            const videoEl = publication.track.attach();
            videoEl.id = `video-element-existing-${participant.identity}`;
            videoEl.autoplay = true;
            videoEl.muted = true;
            videoEl.playsInline = true;
            
            // Make sure video loads properly
            videoEl.style.maxWidth = '100%';
            videoEl.style.maxHeight = '100%';
            
            videoEl.play().catch(err => {
              console.warn('[LiveKit] Error playing video for existing participant:', err);
            });
            
            // Add to grid
            addVideoToGrid(videoEl, participant.identity);
            console.log('[LiveKit] Successfully added video for existing participant:', participant.identity);
            
            // Check actual video state after a short delay
            setTimeout(() => {
              if (videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
                console.warn('[LiveKit] Video element has no dimensions for', participant.identity);
                // Try to fix by reattaching
                const newVideoEl = publication.track.attach();
                newVideoEl.autoplay = true;
                newVideoEl.muted = true;
                newVideoEl.playsInline = true;
                removeVideoFromGrid(participant.identity);
                addVideoToGrid(newVideoEl, participant.identity);
              } else {
                console.log('[LiveKit] Video dimensions:', videoEl.videoWidth, 'x', videoEl.videoHeight, 'for', participant.identity);
              }
            }, 1000);
          } else {
            console.log('[LiveKit] No video track available yet for', participant.identity);
            addParticipantPlaceholder(participant.identity);
          }
        } catch (err) {
          console.warn('[LiveKit] ⚠️ Failed to process video track from', participant.identity, ':', err);
          // Show placeholder if subscription fails
          addParticipantPlaceholder(participant.identity);
        }
      });
        // Check for existing audio tracks and subscribe if needed
      participant.audioTracks.forEach(async (publication) => {
        if (publication.track) {          if (publication.isSubscribed) {
            //console.log('[LiveKit] 🔊 Already subscribed to audio track from:', participant.identity);
            const audioEl = publication.track.attach();
            audioEl.autoplay = true;
            
            // Add to global speaker control and respect current speaker state
            conferenceAudioElements.push(audioEl);
            if (!isConferenceSpeakerEnabled) {
              audioEl.muted = true;
              audioEl.volume = 0;
              //console.log('[LiveKit] 🔇 Existing audio element muted because speaker is disabled');
            } else {
              audioEl.muted = false;
              audioEl.volume = 1;
              //console.log('[LiveKit] 🔊 Existing audio element enabled because speaker is enabled');
            }
            
            document.body.appendChild(audioEl);
          } else {
            //console.log('[LiveKit] 🔊 Subscribing to existing audio track from:', participant.identity);
            try {
              await publication.setSubscribed(true);
              if (publication.track) {
                const audioEl = publication.track.attach();
                audioEl.autoplay = true;
                  // Add to global speaker control and respect current speaker state
                conferenceAudioElements.push(audioEl);
                if (!isConferenceSpeakerEnabled) {
                  audioEl.muted = true;
                  audioEl.volume = 0;
                  //console.log('[LiveKit] 🔇 Subscribed audio element muted because speaker is disabled');
                } else {
                  audioEl.muted = false;
                  audioEl.volume = 1;
                  //console.log('[LiveKit] 🔊 Subscribed audio element enabled because speaker is enabled');
                }
                
                document.body.appendChild(audioEl);
              }
            } catch (err) {
              //console.warn('[LiveKit] ⚠️ Failed to subscribe to audio track from', participant.identity, ':', err);
            }
          }
        }
      });
    });    // Listen for local participant track publications to show own video
    room.localParticipant.on('trackPublished', (publication) => {
      if (publication.kind === 'video' && publication.track) {
        const videoEl = publication.track.attach();
        videoEl.autoplay = true;
        videoEl.muted = true; // Always mute local video to avoid echo
        videoEl.playsInline = true; // Better mobile compatibility
        
        // Use the correct local display name
        const localDisplayName = joinerIdentity ? `${joinerIdentity} (You)` : `${hostUsername} (You)`;
        
        // Set mirroring for self-view to make it more natural
        videoEl.style.transform = 'scaleX(-1)';
        
        // Attempt forced play for browsers that might block autoplay
        videoEl.play().catch(err => {
          console.warn('[LiveKit] Auto-play prevented for local video:', err);
        });
        
        // Always ensure the local video is visible in the grid
        addVideoToGrid(videoEl, localDisplayName);
        console.log('[LiveKit] 📹 Local video track added to grid');
        
        // Update UI to show video is enabled
        const videoBtn = document.getElementById('conference-video-btn');
        if (videoBtn) {
          videoBtn.classList.remove('disabled');
          videoBtn.classList.add('enabled');
          videoBtn.title = 'Disable Camera';
        }
      }
    });room.localParticipant.on('trackUnpublished', (publication) => {
      if (publication.kind === 'video') {
        const localDisplayName = joinerIdentity ? `${joinerIdentity} (You)` : `${hostUsername} (You)`;
        removeVideoFromGrid(localDisplayName);
        
        // Add placeholder back when video is turned off
        addParticipantPlaceholder(localDisplayName);
        //console.log('[LiveKit] 📹 Local video track removed from grid');
      }
    });

    // Step 6: Publish mic if enabled (only for new room connections, not joiners)
    if (!options || !options.room) {
      if (!defaultMicMuted) {
        // Create high-quality audio track with enhanced settings
        const micTrack = await window.LiveKit.LocalAudioTrack.create({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,  // Higher sample rate for better quality
          channelCount: 2,    // Stereo audio for better quality
          latency: 0.01,      // Low latency for real-time communication
          sampleSize: 16      // 16-bit audio for better quality
        });
        await room.localParticipant.publishTrack(micTrack);
        //console.log('[LiveKit] 🎙️ High-quality mic published');
      }      // Step 7: Initialize camera based on user preference (defaultVideoMuted setting)
      try {
        // Use the setCameraEnabled method which is the recommended way to manage camera in LiveKit
        const enableCamera = defaultVideoMuted === false;
        await room.localParticipant.setCameraEnabled(enableCamera);
        console.log(`[LiveKit] 📷 Camera ${enableCamera ? 'enabled' : 'disabled'} based on user preference`);
        
        // Update UI to match camera state
        const videoBtn = document.getElementById('conference-video-btn');
        if (videoBtn) {
          if (enableCamera) {
            videoBtn.classList.remove('disabled');
            videoBtn.classList.add('enabled');
            videoBtn.title = 'Disable Camera';
          } else {
            videoBtn.classList.remove('enabled');
            videoBtn.classList.add('disabled');
            videoBtn.title = 'Enable Camera';
          }
        }
      } catch (err) {
        console.warn('[LiveKit] ⚠️ Failed to set initial camera state:', err);
      }
    }// Step 8: Set up control button handlers
    setupConferenceControls(room);    // Step 9: Update initial participant count and add local participant placeholder
    updateParticipantCount(room);
    
    // Determine the local participant's display name
    const localParticipantName = joinerIdentity || hostUsername;
    const localDisplayName = joinerIdentity ? `${joinerIdentity} (You)` : `${hostUsername} (You)`;    // Always add placeholder for local participant as a fallback
    // This will be automatically replaced once the video is published
    addParticipantPlaceholder(localDisplayName);
      // Initialize the local video state based on the defaultVideoMuted setting
    // This ensures consistent behavior with user's preference
    try {
      // Set camera enabled state based on defaultVideoMuted
      const enableCamera = defaultVideoMuted === false;
      
      // Add placeholder for local participant since camera might be off by default
      if (!enableCamera) {
        // Make sure placeholder is added for local participant if camera is off
        setTimeout(() => {
          addParticipantPlaceholder(localDisplayName);
        }, 100);
      }
      
      // Update UI controls to reflect camera state
      const videoBtn = document.getElementById('conference-video-btn');
      if (videoBtn) {
        if (enableCamera) {
          videoBtn.classList.remove('disabled');
          videoBtn.classList.add('enabled');
          videoBtn.title = 'Disable Camera';
        } else {
          videoBtn.classList.remove('enabled');
          videoBtn.classList.add('disabled');
          videoBtn.title = 'Enable Camera';
        }
        videoBtn.style.opacity = '1';
        videoBtn.style.cursor = 'pointer';
      }
    } catch (err) {
      console.warn('[LiveKit] ⚠️ Failed to initialize local camera state:', err);
    }// Step 10: Expose room globally if needed
    window.currentConferenceRoom = room;
    
    // Add periodic status check to keep UI synchronized
    const statusCheckInterval = setInterval(() => {
      if (room && room.state) {
        // Only update if we're actually connected
        if (room.state === 'connected') {
          updateConnectionStatus('connected');
          updateParticipantCount(room);
        }
      } else {
        // Clear interval if room is no longer available
        clearInterval(statusCheckInterval);
      }    }, 5000); // Check every 5 seconds
    
    // Return controls for leaveConference if needed
    return {
      leaveConference: () => {
        // Clear the status check interval
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval);
        }
          // Clean up audio elements and reset speaker state
        conferenceAudioElements.forEach(audioEl => {
          if (audioEl.parentNode) {
            audioEl.parentNode.removeChild(audioEl);
          }
        });
        conferenceAudioElements = [];
        isConferenceSpeakerEnabled = false;
        
        // Reset all conference controls to disabled state
        resetConferenceControls();
        //console.log('[LiveKit] 🧹 Cleaned up audio elements, reset speaker state, and disabled controls');
        
        // Check if this user is the host leaving
        const currentUser = localStorage.getItem('vybchat-username') || localStorage.getItem('username');
        const isHost = !joinerIdentity && currentUser === hostUsername;
        
        if (isHost) {
          //console.log('[LiveKit] 🏠 Host is leaving conference - notifying all participants');
          // Notify server that host is leaving so all participants can be disconnected
          if (typeof socket !== 'undefined' && socket) {
            socket.emit('hostLeftConference', { 
              hostUsername: currentUser, 
              roomName: roomName 
            });
          }
        }
        
        room.disconnect();
        const conferenceRoom = document.getElementById('conference-room-container');
        if (conferenceRoom) conferenceRoom.style.display = 'none';
        
        // Reset stream button if it exists
        const streamBtn = document.getElementById('stream-btn-global');
        if (streamBtn) {
          streamBtn.disabled = false;
          streamBtn.classList.remove('streaming-active');
          streamBtn.innerHTML = '<span class="stream-btn-fancy-glow">🔴</span> <span class="stream-btn-fancy-label">Start Stream</span>';
        }        // Notify server that this user is no longer streaming
        if (typeof socket !== 'undefined' && socket) {
          const currentUser = localStorage.getItem('vybchat-username') || localStorage.getItem('username');
          if (currentUser) {
            socket.emit('streamingStatusUpdate', { username: currentUser, isStreaming: false });
          }        }
      }
    };
  } catch (err) {
    //console.error('[LiveKit] ❌ Error during conference room setup:', err);
    alert('LiveKit Conference Error: ' + err.message);
  }
}

// Generate and share conference room link
function generateAndShareConferenceLink(hostUsername, roomName) {
  // Create the shareable link URL with conference room parameters
  const baseUrl = window.location.origin + window.location.pathname;
  const conferenceUrl = `${baseUrl}?join=${encodeURIComponent(hostUsername)}&room=${encodeURIComponent(roomName)}`;
  
  // Show share modal
  showShareModal(hostUsername, conferenceUrl);
}

// Show the share modal with copy link functionality
function showShareModal(hostUsername, conferenceUrl) {
  let modal = document.getElementById('conference-share-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'conference-share-modal';
    modal.className = 'conference-share-modal-overlay';
    document.body.appendChild(modal);
  }
  
  // Always ensure the display style is properly set
  modal.style.display = 'flex';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  modal.style.zIndex = '10000';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
  
  modal.innerHTML = `
    <div class="conference-share-modal-content" style="background-color: #fff; padding: 20px; border-radius: 8px; width: 90%; max-width: 500px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
      <h2 class="conference-share-title" style="margin-top: 0; color: #333;">Share Conference</h2>
      <div class="conference-share-description" style="margin-bottom: 15px;">
        Invite others to join <strong>${hostUsername}'s</strong> conference room
      </div>
      
      <div class="conference-link-section" style="margin-bottom: 20px;">
        <label class="conference-link-label" style="display: block; margin-bottom: 5px; font-weight: bold;">Conference Link:</label>
        <div class="conference-link-input-container" style="display: flex;">
          <input 
            id="conference-link-input" 
            class="conference-link-input"
            type="text" 
            value="${conferenceUrl}" 
            readonly 
            style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px 0 0 4px;"
          />
          <button 
            id="copy-link-btn" 
            class="conference-copy-btn"
            title="Copy link to clipboard"
            style="padding: 8px 12px; background-color: #4CAF50; color: white; border: none; border-radius: 0 4px 4px 0; cursor: pointer;"
          >
            📋 Copy
          </button>
        </div>
      </div>

      <div class="conference-share-info" style="margin-bottom: 20px; background-color: #f9f9f9; padding: 10px; border-radius: 4px;">
        <div class="conference-share-info-item" style="margin-bottom: 5px;">🔗 Anyone with this link can join your conference</div>
        <div>📱 Works on desktop and mobile browsers</div>
      </div>

      <div class="conference-share-buttons" style="display: flex; gap: 10px; margin-bottom: 15px;">
        <button 
          id="share-whatsapp-btn" 
          class="conference-share-whatsapp"
          style="flex: 1; padding: 8px; background-color: #25D366; color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          📱 WhatsApp
        </button>
        <button 
          id="share-email-btn" 
          class="conference-share-email"
          style="flex: 1; padding: 8px; background-color: #4285F4; color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          ✉️ Email
        </button>
      </div>

      <button 
        id="share-modal-close-btn" 
        class="conference-share-close"
        style="width: 100%; padding: 8px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;"
      >
        Close
      </button>
    </div>
  `;

  // Set up event handlers
  const copyBtn = modal.querySelector('#copy-link-btn');
  const linkInput = modal.querySelector('#conference-link-input');
  const whatsappBtn = modal.querySelector('#share-whatsapp-btn');
  const emailBtn = modal.querySelector('#share-email-btn');
  const closeBtn = modal.querySelector('#share-modal-close-btn');
  
  // Copy link functionality
  copyBtn.onclick = async () => {
    try {
      // Use the copy-to-clipboard function available in app.js
      if (typeof copyToClipboard === 'function') {
        const success = await copyToClipboard(conferenceUrl);
        if (success) {
          copyBtn.innerHTML = '✅ Copied!';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.innerHTML = '📋 Copy';
            copyBtn.classList.remove('copied');
          }, 2000);
        }
      } else {
        // Fallback to older clipboard API
        await navigator.clipboard.writeText(conferenceUrl);
        copyBtn.innerHTML = '✅ Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.innerHTML = '📋 Copy';
          copyBtn.classList.remove('copied');
        }, 2000);
      }
    } catch (err) {
      // Fallback for older browsers
      linkInput.select();
      linkInput.setSelectionRange(0, 99999);
      document.execCommand('copy');
      copyBtn.innerHTML = '✅ Copied!';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.innerHTML = '📋 Copy';
        copyBtn.classList.remove('copied');
      }, 2000);
    }
  };

  // WhatsApp share
  whatsappBtn.onclick = () => {
    const message = `Join ${hostUsername}'s VybChat conference: ${conferenceUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Email share
  emailBtn.onclick = () => {
    const subject = `Join ${hostUsername}'s VybChat Conference`;
    const body = `Hi!\n\n${hostUsername} is hosting a conference on VybChat and would like you to join.\n\nClick the link below to join:\n${conferenceUrl}\n\nSee you there!`;
    const emailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = emailUrl;
  };

  // Close modal
  closeBtn.onclick = () => {
    modal.style.display = 'none';
  };

  // Close when clicking outside
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  };

  // Auto-select the link input for easy copying
  setTimeout(() => {
    linkInput.select();
  }, 100);
}

// Make share modal function globally accessible
window.showShareModal = showShareModal;

// Check for conference join parameters on page load
function checkForConferenceJoinLink() {
  const urlParams = new URLSearchParams(window.location.search);
  const joinUser = urlParams.get('join');
  const roomName = urlParams.get('room');
  
  if (joinUser && roomName) {
    // Clean up the URL
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // Show join modal after a short delay to ensure page is loaded
    setTimeout(() => {
      if (window.openConferencePopup) {
        window.openConferencePopup({ 
          autoJoin: false, // Always show popup/modal
          hostUsername: joinUser, 
          roomName: roomName,
          defaultMicMuted: true,
          defaultVideoMuted: true
        });
      }
    }, 1000);
  }
}

// Initialize conference join link checking when DOM is ready
document.addEventListener('DOMContentLoaded', checkForConferenceJoinLink);
// Also check immediately in case DOMContentLoaded has already fired
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkForConferenceJoinLink);
} else {
  checkForConferenceJoinLink();
}

// Socket listener for host leaving conference
if (typeof socket !== 'undefined' && socket) {
  socket.on('hostLeftConference', ({ hostUsername, roomName, message }) => {
    //console.log('[LiveKit] 🚨 Host left conference:', hostUsername, roomName);
    
    // Check if we're currently in a conference
    const currentConferenceRoom = document.getElementById('conference-room-container');
    if (currentConferenceRoom && currentConferenceRoom.style.display !== 'none') {
      // Show a more user-friendly notification
      const currentUser = localStorage.getItem('vybchat-username') || localStorage.getItem('username');
      
      // Don't show alert to the host themselves
      if (currentUser !== hostUsername) {
        alert(`📢 Conference Ended\n\n${hostUsername} has ended the conference. You will be disconnected from the room.`);
      }
      
      // Disconnect from LiveKit room if we're connected
      if (window.currentConferenceRoom) {
        try {
          window.currentConferenceRoom.disconnect();
          window.currentConferenceRoom = null;
        } catch (err) {
          //console.warn('[LiveKit] Error disconnecting after host left:', err);
        }
      }
        // Hide conference room UI
      currentConferenceRoom.style.display = 'none';
        // Reset controls to disabled state
      resetConferenceControls();
      
      // Clear any focused participant  
      focusedParticipant = null;
      updateGridLayout();
      
      // Reset any stream button state
      const streamBtn = document.getElementById('stream-btn-global');
      if (streamBtn) {
        streamBtn.disabled = false;
        streamBtn.classList.remove('streaming-active');
        streamBtn.innerHTML = '<span class="stream-btn-fancy-glow">🔴</span> <span class="stream-btn-fancy-label">Start Stream</span>';
      }
      
      //console.log('[LiveKit] ✅ Disconnected from conference after host left');
    }
  });
}

// Function to show join request notification to the host
function showJoinRequest(joinerName, hostName, roomName) {
  console.log(`[LiveKit Lobby] 🚪 Received join request from ${joinerName}`);
  
  // Check if the current user is the host
  const currentUser = localStorage.getItem('vybchat-username') || localStorage.getItem('username');
  if (currentUser !== hostName) {
    console.log('[LiveKit Lobby] Not the host, ignoring join request');
    return;
  }
  
  // Create notification UI
  let requestNotification = document.getElementById('join-request-notification');
  if (!requestNotification) {
    requestNotification = document.createElement('div');
    requestNotification.id = 'join-request-notification';
    requestNotification.className = 'join-request-notification';
    document.body.appendChild(requestNotification);
  }
  
  // Style the notification
  requestNotification.style.position = 'fixed';
  requestNotification.style.top = '20px';
  requestNotification.style.right = '20px';
  requestNotification.style.backgroundColor = '#1a1a2e';
  requestNotification.style.color = 'white';
  requestNotification.style.padding = '15px';
  requestNotification.style.borderRadius = '8px';
  requestNotification.style.boxShadow = '0 4px 8px rgba(0,0,0,0.5)';
  requestNotification.style.zIndex = '10001';
  requestNotification.style.width = '300px';
  requestNotification.style.animation = 'slideIn 0.3s forwards';
  
  // Add content to notification
  requestNotification.innerHTML = `
    <style>
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .join-request-btn {
        padding: 8px 12px;
        border-radius: 4px;
        border: none;
        cursor: pointer;
        margin-right: 10px;
      }
      .join-request-approve {
        background-color: #4CAF50;
        color: white;
      }
      .join-request-reject {
        background-color: #f44336;
        color: white;
      }
    </style>
    <div style="margin-bottom: 10px; font-weight: bold;">Join Request</div>
    <div style="margin-bottom: 15px;">${joinerName} is requesting to join your conference.</div>
    <div>
      <button class="join-request-btn join-request-approve" id="approve-join-${joinerName}">Approve</button>
      <button class="join-request-btn join-request-reject" id="reject-join-${joinerName}">Reject</button>
    </div>
  `;
  
  // Make notification audible to get host's attention
  const notificationSound = new Audio('/assets/ringtone.mp3');
  notificationSound.volume = 0.5;
  notificationSound.play().catch(e => console.warn('Could not play notification sound:', e));
  
  // Add event listeners for approve/reject buttons
  document.getElementById(`approve-join-${joinerName}`).onclick = () => {
    if (typeof socket !== 'undefined' && socket) {
      console.log(`[LiveKit Lobby] ✅ Host approved join request from ${joinerName}`);
      socket.emit('approveJoinRequest', { joinerName, hostName, roomName });
      requestNotification.remove();
    }
  };
  
  document.getElementById(`reject-join-${joinerName}`).onclick = () => {
    if (typeof socket !== 'undefined' && socket) {
      console.log(`[LiveKit Lobby] ❌ Host rejected join request from ${joinerName}`);
      socket.emit('rejectJoinRequest', { joinerName, hostName, roomName });
      requestNotification.remove();
    }
  };
  
  // Auto-hide after 30 seconds if no action is taken (treats as rejection)
  setTimeout(() => {
    if (document.body.contains(requestNotification)) {
      if (typeof socket !== 'undefined' && socket) {
        console.log(`[LiveKit Lobby] ⏱️ Join request from ${joinerName} timed out (auto-rejected)`);
        socket.emit('rejectJoinRequest', { joinerName, hostName, roomName });
      }
      requestNotification.remove();
    }
  }, 30000);
}

// Helper functions for UI updates
function updateConnectionStatus(state) {
  const statusIndicator = document.getElementById('conference-connection-status');
  if (!statusIndicator) return;
  
  const statusMap = {
    'connected': { text: '🟢 Connected', color: '#4CAF50' },
    'connecting': { text: '🟡 Connecting...', color: '#FF9800' },
    'reconnecting': { text: '🟡 Reconnecting...', color: '#FF9800' },
    'disconnected': { text: '🔴 Disconnected', color: '#F44336' }
  };
  
  const status = statusMap[state] || { text: `🔵 ${state}`, color: '#2196F3' };
  statusIndicator.textContent = status.text;
  statusIndicator.style.color = status.color;
  
  // Also log for debugging
  //console.log(`[LiveKit] 📊 Connection status updated: ${status.text}`);
}

function updateParticipantCount(room) {
  const countEl = document.getElementById('conference-participants-count');
  if (!countEl) return;
  
  // Count all participants: remote participants + local participant
  const remoteCount = room.participants.size;
  const totalCount = remoteCount + 1; // +1 for local participant
  
  countEl.textContent = `${totalCount} participant${totalCount === 1 ? '' : 's'}`;
  
  // Log for debugging
  //console.log(`[LiveKit] 👥 Participant count updated: ${totalCount} total (${remoteCount} remote + 1 local)`);
  
  // Also update participant names in console for debugging
  const participantNames = Array.from(room.participants.values()).map(p => p.identity);
  //console.log(`[LiveKit] 👥 Participants: [${participantNames.join(', ')}] + local`);
}

function addVideoToGrid(videoElement, participantId) {
  const grid = document.getElementById('conference-video-grid');
  if (!grid) {
    console.error('[LiveKit] Cannot add video to grid - grid element not found');
    return;
  }
  
  console.log(`[LiveKit] 📹 Adding video for participant: ${participantId}`);
  
  // Remove any existing placeholder for this participant
  removeParticipantPlaceholder(participantId);
  
  // Remove any existing video container for this participant
  const existingContainer = document.getElementById(`video-${participantId}`);
  if (existingContainer) {
    console.log(`[LiveKit] Removing existing video container for: ${participantId}`);
    existingContainer.remove();
  }
  
  // Create video container
  const container = document.createElement('div');
  container.id = `video-${participantId}`;
  container.className = 'conference-video-container';
  
  // Style the video element
  videoElement.className = 'conference-video-element';
  
  // Set object-fit to cover for better video filling
  videoElement.style.objectFit = 'cover';
  
  // Set important display property to make sure video is visible
  videoElement.style.display = 'block';
  
  // Better handling for local participant's video
  if (participantId.includes('(You)')) {
    // Mirror local video for natural self-view
    videoElement.style.transform = 'scaleX(-1)';
  }
  
  // Add click handler for focused view
  videoElement.addEventListener('click', () => {
    toggleFocusedView(participantId);
  });
  
  // Add hover effect for clickable indication
  videoElement.style.cursor = 'pointer';
  videoElement.title = 'Click to focus on this participant';
  
  // Add important debugging data attributes
  videoElement.dataset.participant = participantId;
  
  // Add event listeners to detect when video stops
  videoElement.addEventListener('loadstart', () => {
    console.log(`[LiveKit] 📹 Video loading started for ${participantId}`);
  });
  
  videoElement.addEventListener('canplay', () => {
    console.log(`[LiveKit] 📹 Video can play for ${participantId}, dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
    // Make sure the video is visible when it's ready to play
    videoElement.style.display = 'block';
    
    // Remove any existing placeholder once video is ready
    removeParticipantPlaceholder(participantId);
  });
  
  videoElement.addEventListener('ended', () => {
    console.log(`[LiveKit] 📹 Video ended for participant: ${participantId} - replacing with placeholder`);
    removeVideoFromGrid(participantId);
    setTimeout(() => {
      addParticipantPlaceholder(participantId);
    }, 100);
  });
  
  videoElement.addEventListener('emptied', () => {
    console.log(`[LiveKit] 📹 Video emptied for ${participantId} - replacing with placeholder`);
    removeVideoFromGrid(participantId);
    setTimeout(() => {
      addParticipantPlaceholder(participantId);
    }, 100);
  });
  
  // Add participant label
  const label = document.createElement('div');
  label.className = 'conference-participant-label';
  label.textContent = participantId;
  
  // Add debugging info to label
  if (videoElement.videoWidth && videoElement.videoHeight) {
    label.title = `Video: ${videoElement.videoWidth}x${videoElement.videoHeight}`;
  }
  
  container.appendChild(videoElement);
  container.appendChild(label);
  grid.appendChild(container);
  
  // Update grid layout
  updateGridLayout();
  
  console.log(`[LiveKit] 📹 Successfully added video for participant: ${participantId}`);
  
  // Set a short timer to check if the video is actually displaying
  setTimeout(() => {
    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      console.warn(`[LiveKit] ⚠️ Video element for ${participantId} has no dimensions, may not be displaying properly`);
    } else {
      console.log(`[LiveKit] ✅ Confirmed video dimensions for ${participantId}: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
    }
  }, 1000);
}

function addParticipantPlaceholder(participantId) {
  const grid = document.getElementById('conference-video-grid');
  if (!grid) return;
  
  // Don't add placeholder if video already exists
  const existingVideo = document.getElementById(`video-${participantId}`);
  if (existingVideo) return;
  
  // Don't add duplicate placeholder
  const existingPlaceholder = document.getElementById(`placeholder-${participantId}`);
  if (existingPlaceholder) return;
  
  // Create placeholder container
  const container = document.createElement('div');
  container.id = `placeholder-${participantId}`;
  container.className = 'conference-video-container conference-video-placeholder';
    // Create placeholder content
  const placeholder = document.createElement('div');
  placeholder.className = 'conference-video-element conference-placeholder-content';
  placeholder.innerHTML = `
    <div class="conference-placeholder-avatar">👤</div>
    <div class="conference-placeholder-text">Camera off</div>
  `;
    // Add click handler for focused view (show participant info for placeholder)
  placeholder.addEventListener('click', () => {
    toggleFocusedView(participantId);
  });
  placeholder.style.cursor = 'pointer';
  placeholder.title = 'Click to focus on this participant';
  
  // Add participant label
  const label = document.createElement('div');
  label.className = 'conference-participant-label';
  label.textContent = participantId;
  
  container.appendChild(placeholder);
  container.appendChild(label);
  grid.appendChild(container);
  
  // Update grid layout
  updateGridLayout();
  
  //console.log(`[LiveKit] 👤 Added placeholder for participant: ${participantId}`);
}

function removeParticipantPlaceholder(participantId) {
  const placeholder = document.getElementById(`placeholder-${participantId}`);
  if (placeholder) {
    placeholder.remove();
    updateGridLayout();
    //console.log(`[LiveKit] 🗑️ Removed placeholder for participant: ${participantId}`);
  }
}

function removeVideoFromGrid(participantId) {
  const videoContainer = document.getElementById(`video-${participantId}`);
  if (videoContainer) {
    videoContainer.remove();
    updateGridLayout();
    //console.log(`[LiveKit] 🗑️ Removed video for participant: ${participantId}`);
  }
  
  // Also remove any placeholder
  removeParticipantPlaceholder(participantId);
}

function updateGridLayout() {
  const grid = document.getElementById('conference-video-grid');
  if (!grid) return;
  
  const videoCount = grid.children.length;
  
  if (focusedParticipant) {
    // Focused layout: one large tile + smaller tiles
    // Use CSS Grid areas for focused layout
    grid.style.gridTemplateColumns = '2fr 1fr';
    grid.style.gridTemplateRows = 'repeat(auto-fit, minmax(150px, 1fr))';
    grid.style.gap = '10px';
  } else {
    // Normal grid layout
    let columns = 1;
    
    if (videoCount === 1) columns = 1;
    else if (videoCount <= 4) columns = 2;
    else if (videoCount <= 9) columns = 3;
    else columns = 4;
    
    grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    grid.style.gridTemplateRows = 'auto';
    grid.style.gap = '15px';
  }
  
  // Update focus styles
  updateFocusedViewStyles();
}

// Global variables for conference controls - need to be accessible across functions
let conferenceAudioElements = []; // Keep track of all audio elements for speaker control
let isConferenceSpeakerEnabled = false; // Track speaker state globally
let focusedParticipant = null; // Track which participant is currently focused

// Toggle focused view for a participant
function toggleFocusedView(participantId) {
  const grid = document.getElementById('conference-video-grid');
  if (!grid) return;
  
  if (focusedParticipant === participantId) {
    // If clicking on the already focused participant, unfocus
    focusedParticipant = null;
    //console.log(`[LiveKit] 👁️ Unfocused participant: ${participantId}`);
  } else {
    // Focus on the new participant
    focusedParticipant = participantId;
    //console.log(`[LiveKit] 👁️ Focused on participant: ${participantId}`);
  }
  
  // Update the grid layout to reflect the focused state
  updateGridLayout();
  
  // Update visual focus indicators
  updateFocusedViewStyles();
}

// Update styles to show focused participant
function updateFocusedViewStyles() {
  const grid = document.getElementById('conference-video-grid');
  if (!grid) return;
  
  // Remove existing focus classes
  grid.querySelectorAll('.conference-video-container').forEach(container => {
    container.classList.remove('focused', 'unfocused');
  });
  
  if (focusedParticipant) {
    // Add focused class to the selected participant
    const focusedContainer = document.getElementById(`video-${focusedParticipant}`) || 
                            document.getElementById(`placeholder-${focusedParticipant}`);
    if (focusedContainer) {
      focusedContainer.classList.add('focused');
    }
    
    // Add unfocused class to all other participants
    grid.querySelectorAll('.conference-video-container').forEach(container => {
      if (container !== focusedContainer) {
        container.classList.add('unfocused');
      }
    });
    
    // Add focused-layout class to grid for special layout
    grid.classList.add('focused-layout');
  } else {
    // Remove focused layout when no participant is focused
    grid.classList.remove('focused-layout');
  }
}

// Setup conference control button handlers
function setupConferenceControls(room) {
  const micBtn = document.getElementById('conference-mic-btn');
  const speakerBtn = document.getElementById('conference-speaker-btn');
  const videoBtn = document.getElementById('conference-video-btn');
  const screenBtn = document.getElementById('conference-screen-btn');
  
  let isMicEnabled = false;
  let isVideoEnabled = false;
  let isScreenSharing = false;
  let currentVideoTrack = null;
  let currentScreenTrack = null;
    // Initialize speaker button with proper muted state
  isConferenceSpeakerEnabled = false;
  speakerBtn.classList.add('muted');
  speakerBtn.classList.remove('enabled');
  speakerBtn.title = 'Enable Speaker';
  speakerBtn.innerHTML = '🔇'; // Start with muted speaker icon
    // Initialize mic button with proper muted state and icon
  isMicEnabled = false;
  micBtn.classList.add('muted');
  micBtn.classList.remove('enabled');
  micBtn.title = 'Enable Microphone';
  micBtn.innerHTML = '🎤'; // Muted mic icon
  
  // Enable all controls when conference starts
  enableConferenceControls();
  // Microphone toggle
  if (micBtn) {
    micBtn.onclick = async () => {
      try {
        if (isMicEnabled) {
          // Disable microphone
          await room.localParticipant.setMicrophoneEnabled(false);
          micBtn.classList.remove('enabled');
          micBtn.classList.add('muted');
          micBtn.title = 'Enable Microphone';
          micBtn.innerHTML = '🎤'; // Muted mic icon
          //console.log('[LiveKit] 🎙️ Microphone disabled');
        } else {
          // Enable microphone
          await room.localParticipant.setMicrophoneEnabled(true);
          micBtn.classList.remove('muted');
          micBtn.classList.add('enabled');
          micBtn.title = 'Disable Microphone';
          micBtn.innerHTML = '🎙️'; // Enabled mic icon
          //console.log('[LiveKit] 🎙️ Microphone enabled');
        }
        isMicEnabled = !isMicEnabled;
      } catch (err) {
        //console.error('[LiveKit] ❌ Error toggling microphone:', err);
        alert('Failed to toggle microphone: ' + err.message);
      }
    };
  }
  // Speaker toggle
  if (speakerBtn) {
    speakerBtn.onclick = async () => {
      try {
        if (isConferenceSpeakerEnabled) {
          // Mute all audio elements
          conferenceAudioElements.forEach(audioEl => {
            audioEl.muted = true;
            audioEl.volume = 0;
          });
          speakerBtn.classList.remove('enabled');
          speakerBtn.classList.add('muted');
          speakerBtn.title = 'Enable Speaker';
          speakerBtn.innerHTML = '🔇'; // Muted speaker icon
          //console.log('[LiveKit] 🔇 Speaker muted - no audio will be heard');
        } else {
          // Unmute all audio elements
          conferenceAudioElements.forEach(audioEl => {
            audioEl.muted = false;
            audioEl.volume = 1;
          });
          speakerBtn.classList.remove('muted');
          speakerBtn.classList.add('enabled');
          speakerBtn.title = 'Disable Speaker';
          speakerBtn.innerHTML = '🔊'; // Unmuted speaker icon
          // console.log('[LiveKit] 🔊 Speaker enabled - audio will be heard');        
          }
        isConferenceSpeakerEnabled = !isConferenceSpeakerEnabled;
        //console.log(`[LiveKit] 🔊 Speaker state changed to: ${isConferenceSpeakerEnabled ? 'enabled' : 'disabled'}`);
      } catch (err) {
        //console.error('[LiveKit] ❌ Error toggling speaker:', err);
        alert('Failed to toggle speaker: ' + err.message);
      }
    };
  }  // Video toggle
  if (videoBtn) {
    // Initialize video button based on the current camera state
    const cameraTrackPublications = room.localParticipant.videoTracks;
    isVideoEnabled = Array.from(cameraTrackPublications.values()).some(
      publication => publication.track && publication.track.source === 'camera'
    );
    
    if (isVideoEnabled) {
      videoBtn.classList.remove('disabled');
      videoBtn.classList.add('enabled');
      videoBtn.title = 'Disable Camera';
    } else {
      videoBtn.classList.remove('enabled');
      videoBtn.classList.add('disabled');
      videoBtn.title = 'Enable Camera';
    }
    videoBtn.style.opacity = '1';
    videoBtn.style.cursor = 'pointer';
    
    videoBtn.onclick = async () => {
      try {
        if (isVideoEnabled) {
          // Disable video
          await room.localParticipant.setCameraEnabled(false);
          videoBtn.classList.remove('enabled');
          videoBtn.classList.add('disabled');
          videoBtn.title = 'Enable Camera';
          console.log('[LiveKit] 📹 Camera disabled');
        } else {
          // Enable video
          await room.localParticipant.setCameraEnabled(true);
          videoBtn.classList.remove('disabled');
          videoBtn.classList.add('enabled');
          videoBtn.title = 'Disable Camera';
          console.log('[LiveKit] 📹 Camera enabled');
        }
        isVideoEnabled = !isVideoEnabled;
      } catch (err) {
        console.error('[LiveKit] ❌ Error toggling camera:', err);
        alert('Failed to toggle camera: ' + err.message);
      }
    };
  }
  // Screen share toggle
  if (screenBtn) {
    screenBtn.onclick = async () => {
      try {
        // Check if screen sharing is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          alert('Screen sharing is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Edge.');
          return;
        }
        
        if (isScreenSharing) {
          // Stop screen sharing
          if (currentScreenTrack) {
            await room.localParticipant.unpublishTrack(currentScreenTrack);
            currentScreenTrack.stop();
            currentScreenTrack = null;
          }
          screenBtn.classList.remove('sharing');
          screenBtn.title = 'Share Screen';
          //console.log('[LiveKit] 🖥️ Screen sharing stopped');        } else {
          // Start screen sharing
          try {
            //console.log('[LiveKit] 🖥️ Requesting screen share permission...');
            
            // Try different LiveKit API methods for screen sharing
            let screenTrack;
              // Method 1: Try createScreenShareTrack with high quality settings
            try {
              screenTrack = await window.LiveKit.LocalVideoTrack.createScreenShareTrack({
                resolution: { width: 1920, height: 1080 },
                frameRate: 30,
                audio: true,
                video: {
                  width: { ideal: 1920, max: 3840 },
                  height: { ideal: 1080, max: 2160 },
                  frameRate: { ideal: 30, max: 60 }
                }
              });
            } catch (apiErr1) {
              //console.log('[LiveKit] Method 1 failed, trying alternative API...');
              
              // Method 2: Try create with screen share options
              try {
                screenTrack = await window.LiveKit.LocalVideoTrack.create({
                  source: 'screen_share',
                  resolution: { width: 1920, height: 1080 },
                  frameRate: 30,
                  audio: true,
                  video: {
                    width: { ideal: 1920, max: 3840 },
                    height: { ideal: 1080, max: 2160 },
                    frameRate: { ideal: 30, max: 60 }
                  }
                });
              } catch (apiErr2) {
                //console.log('[LiveKit] Method 2 failed, using native browser API...');
                  // Method 3: Use native browser API with high-quality constraints
                const mediaStream = await navigator.mediaDevices.getDisplayMedia({
                  video: {
                    width: { ideal: 1920, max: 3840 },     // Support up to 4K
                    height: { ideal: 1080, max: 2160 },    // Support up to 4K
                    frameRate: { ideal: 30, max: 60 },     // High frame rate
                    cursor: 'always',                       // Show cursor
                    displaySurface: 'monitor'               // Prefer full screen
                  },
                  audio: {
                    echoCancellation: false,               // Don't cancel system audio
                    noiseSuppression: false,               // Keep original audio
                    autoGainControl: false,                // Don't adjust system audio
                    sampleRate: 48000,                     // High quality audio
                    channelCount: 2                        // Stereo audio
                  }
                });
                
                const videoTrack = mediaStream.getVideoTracks()[0];
                
                // Apply additional high-quality settings to the video track
                if (videoTrack.getSettings) {
                  const settings = videoTrack.getSettings();
                  //console.log('[LiveKit] 📊 Screen share video settings:', settings);
                }
                
                screenTrack = new window.LiveKit.LocalVideoTrack(videoTrack, {
                  source: 'screen_share'
                });
              }
            }
            
            await room.localParticipant.publishTrack(screenTrack);
            currentScreenTrack = screenTrack;
            screenBtn.classList.add('sharing');
            screenBtn.title = 'Stop Screen Share';
            //console.log('[LiveKit] 🖥️ Screen sharing started successfully');
          } catch (screenErr) {
            //console.error('[LiveKit] Screen share error:', screenErr);
            // Provide more specific error handling
            if (screenErr.name === 'NotAllowedError') {
              alert('❌ Screen Sharing Permission Denied\n\nPlease:\n1. Click "Allow" when prompted for screen sharing\n2. Make sure you select a screen or window to share\n3. Try clicking the screen share button again');
            } else if (screenErr.name === 'NotSupportedError') {
              alert('❌ Screen Sharing Not Supported\n\nPlease use a modern browser like:\n• Chrome (recommended)\n• Firefox\n• Edge\n• Safari (latest version)');
            } else if (screenErr.name === 'AbortError') {
              alert('Screen sharing was cancelled. Please try again if you want to share your screen.');
            } else {
              alert('❌ Screen Sharing Failed\n\nError: ' + screenErr.message + '\n\nTry refreshing the page and trying again.');
            }
            return;
          }
        }
        isScreenSharing = !isScreenSharing;
      } catch (err) {
        //console.error('[LiveKit] ❌ Error toggling screen share:', err);
        alert('Failed to toggle screen share: ' + err.message);
      }
    };
  }
  // Listen for track publications to update button states
  room.localParticipant.on('trackPublished', (publication) => {
    //console.log('[LiveKit] 📤 Track published:', publication.kind, publication.source);
      if (publication.kind === 'audio' && publication.source === 'microphone') {
      isMicEnabled = true;
      if (micBtn) {
        micBtn.classList.remove('muted');
        micBtn.classList.add('enabled');
        micBtn.title = 'Disable Microphone';
        micBtn.innerHTML = '🎙️'; // Enabled mic icon
      }
    } else if (publication.kind === 'video' && publication.source === 'camera') {
      isVideoEnabled = true;
      if (videoBtn) {
        videoBtn.classList.remove('disabled');
        videoBtn.classList.add('enabled');
        videoBtn.title = 'Disable Camera';
      }
    } else if (publication.kind === 'video' && publication.source === 'screen_share') {
      isScreenSharing = true;
      if (screenBtn) {
        screenBtn.classList.add('sharing');
        screenBtn.title = 'Stop Screen Share';
      }
    }
  });
  room.localParticipant.on('trackUnpublished', (publication) => {
    //console.log('[LiveKit] 📤 Track unpublished:', publication.kind, publication.source);
      if (publication.kind === 'audio' && publication.source === 'microphone') {
      isMicEnabled = false;
      if (micBtn) {
        micBtn.classList.remove('enabled');
        micBtn.classList.add('muted');
        micBtn.title = 'Enable Microphone';
        micBtn.innerHTML = '🎤'; // Muted mic icon
      }
    } else if (publication.kind === 'video' && publication.source === 'camera') {
      isVideoEnabled = false;
      if (videoBtn) {
        videoBtn.classList.remove('enabled');
        videoBtn.classList.add('disabled');
        videoBtn.title = 'Enable Camera';
      }
    } else if (publication.kind === 'video' && publication.source === 'screen_share') {
      isScreenSharing = false;
      if (screenBtn) {
        screenBtn.classList.remove('sharing');
        screenBtn.title = 'Share Screen';
      }
    }
  });

  // Set initial button states
  //console.log('[LiveKit] 🎛️ Conference controls initialized');
}

// Helper function to clear existing conference state for fresh host start
function clearExistingConferenceState() {
  //console.log('[LiveKit] 🧹 Clearing existing conference state for fresh host start');
  
  // Disconnect from any existing LiveKit room
  if (window.currentConferenceRoom) {
    try {
      //console.log('[LiveKit] 🔌 Disconnecting from existing room');
      window.currentConferenceRoom.disconnect();
      window.currentConferenceRoom = null;
    } catch (err) {
      //console.warn('[LiveKit] ⚠️ Error disconnecting from existing room:', err);
    }
  }
  
  // Clear any existing conference room UI
  const existingConferenceRoom = document.getElementById('conference-room-container');
  if (existingConferenceRoom) {
    //console.log('[LiveKit] 🗑️ Removing existing conference room UI');
    existingConferenceRoom.remove();
  }
    // Clear any existing conference modals
  const existingModal = document.getElementById('conference-popup-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const existingShareModal = document.getElementById('conference-share-modal');
  if (existingShareModal) {
    existingShareModal.remove();
  }
  // Clear audio elements and reset speaker state
  conferenceAudioElements.forEach(audioEl => {
    if (audioEl.parentNode) {
      audioEl.parentNode.removeChild(audioEl);
    }
  });
  conferenceAudioElements = [];
  isConferenceSpeakerEnabled = false;
  focusedParticipant = null; // Reset focused participant
  //console.log('[LiveKit] 🧹 Cleared audio elements, reset speaker state, and cleared focused participant');
    // Reset controls to disabled state
  resetConferenceControls();
  
  // Clear the video grid
  clearVideoGrid();
  
  // Clear any focused participant
  focusedParticipant = null;
  
  //console.log('[LiveKit] ✅ Conference state cleared for fresh start');
}

// Helper function to clear video grid
function clearVideoGrid() {
  const grid = document.getElementById('conference-video-grid');
  if (grid) {
    //console.log('[LiveKit] 🧹 Clearing video grid');
    grid.innerHTML = '';
  }
}

// Helper function to reset all conference controls to disabled state
function resetConferenceControls() {
  const micBtn = document.getElementById('conference-mic-btn');
  const speakerBtn = document.getElementById('conference-speaker-btn');
  const videoBtn = document.getElementById('conference-video-btn');
  const screenBtn = document.getElementById('conference-screen-btn');
  
  if (micBtn) {
    micBtn.classList.remove('enabled');
    micBtn.classList.add('muted');
    micBtn.title = 'Enable Microphone';
    micBtn.innerHTML = '🎤';
    micBtn.disabled = true;
  }
  
  if (speakerBtn) {
    speakerBtn.classList.remove('enabled');
    speakerBtn.classList.add('muted');
    speakerBtn.title = 'Enable Speaker';
    speakerBtn.innerHTML = '🔇';
    speakerBtn.disabled = true;
  }
  
  if (videoBtn) {
    videoBtn.classList.remove('enabled');
    videoBtn.classList.add('disabled');
    videoBtn.title = 'Enable Camera';
    videoBtn.innerHTML = '📹';
    videoBtn.disabled = true;
  }
  
  if (screenBtn) {
    screenBtn.classList.remove('sharing');
    screenBtn.title = 'Share Screen';
    screenBtn.innerHTML = '🖥️';
    screenBtn.disabled = true;
  }
  
  //console.log('[LiveKit] 🎛️ All conference controls reset to disabled state');
}

// Helper function to enable conference controls
function enableConferenceControls() {
  const micBtn = document.getElementById('conference-mic-btn');
  const speakerBtn = document.getElementById('conference-speaker-btn');
  const videoBtn = document.getElementById('conference-video-btn');
  const screenBtn = document.getElementById('conference-screen-btn');
  
  if (micBtn) micBtn.disabled = false;
  if (speakerBtn) speakerBtn.disabled = false;
  if (videoBtn) videoBtn.disabled = false;
  if (screenBtn) screenBtn.disabled = false;
  
  //console.log('[LiveKit] 🎛️ Conference controls enabled');
}

// Full-screen video functionality
function makeVideoFullScreen(videoElement, participantId) {
  // Create full-screen overlay
  const fullscreenOverlay = document.createElement('div');
  fullscreenOverlay.id = 'conference-fullscreen-overlay';
  fullscreenOverlay.className = 'conference-fullscreen-overlay';
  
  // Clone the video element for full-screen
  const fullscreenVideo = videoElement.cloneNode(true);
  fullscreenVideo.className = 'conference-fullscreen-video';
  
  // Create close button
  const closeButton = document.createElement('button');
  closeButton.className = 'conference-fullscreen-close';
  closeButton.innerHTML = '✕';
  closeButton.title = 'Exit Full Screen';
  closeButton.onclick = () => exitFullScreen();
  
  // Create participant label for full-screen
  const participantLabel = document.createElement('div');
  participantLabel.className = 'conference-fullscreen-label';
  participantLabel.textContent = participantId;
  
  // Add elements to overlay
 
  fullscreenOverlay.appendChild(fullscreenVideo);
  fullscreenOverlay.appendChild(closeButton);
  fullscreenOverlay.appendChild(participantLabel);
  
  // Add to body
  document.body.appendChild(fullscreenOverlay);
    // Add event listeners
  fullscreenOverlay.addEventListener('click', (e) => {
    if (e.target === fullscreenOverlay) {
      exitFullScreen();
    }
  });
}

// Helper function to reset all conference controls to disabled state
function resetConferenceControls() {
  const micBtn = document.getElementById('conference-mic-btn');
  const speakerBtn = document.getElementById('conference-speaker-btn');
  const videoBtn = document.getElementById('conference-video-btn');
  const screenBtn = document.getElementById('conference-screen-btn');
  
  if (micBtn) {
    micBtn.disabled = true;
    micBtn.classList.add('muted');
    micBtn.classList.remove('enabled');
    micBtn.title = 'Enable Microphone';
    micBtn.innerHTML = '🎤';
    micBtn.style.opacity = '0.5';
    micBtn.style.cursor = 'not-allowed';
  }
  
  if (speakerBtn) {
    speakerBtn.disabled = true;
    speakerBtn.classList.add('muted');
    speakerBtn.classList.remove('enabled');
    speakerBtn.title = 'Enable Speaker';
    speakerBtn.innerHTML = '🔇';
    speakerBtn.style.opacity = '0.5';
    speakerBtn.style.cursor = 'not-allowed';
  }
  
  if (videoBtn) {
    videoBtn.disabled = true;
    videoBtn.classList.add('disabled');
    videoBtn.classList.remove('enabled');
    videoBtn.title = 'Enable Camera';
    videoBtn.innerHTML = '📹';
    videoBtn.style.opacity = '0.5';
    videoBtn.style.cursor = 'not-allowed';
  }
  
  if (screenBtn) {
    screenBtn.disabled = true;
    screenBtn.classList.remove('sharing');
    screenBtn.title = 'Share Screen';
    screenBtn.innerHTML = '🖥️';
    screenBtn.style.opacity = '0.5';
    screenBtn.style.cursor = 'not-allowed';
  }
  
  //console.log('[LiveKit] 🎛️ All conference controls reset to disabled state');
}

// Helper function to enable conference controls
function enableConferenceControls() {
  const micBtn = document.getElementById('conference-mic-btn');
  const speakerBtn = document.getElementById('conference-speaker-btn');
  const videoBtn = document.getElementById('conference-video-btn');
  const screenBtn = document.getElementById('conference-screen-btn');
  
  if (micBtn) {
    micBtn.disabled = false;
    micBtn.style.opacity = '1';
    micBtn.style.cursor = 'pointer';
  }
  
  if (speakerBtn) {
    speakerBtn.disabled = false;
    speakerBtn.style.opacity = '1';
    speakerBtn.style.cursor = 'pointer';
  }
  
  if (videoBtn) {
    videoBtn.disabled = false;
    videoBtn.style.opacity = '1';
    videoBtn.style.cursor = 'pointer';
  }
  
  if (screenBtn) {
    screenBtn.disabled = false;
    screenBtn.style.opacity = '1';
    screenBtn.style.cursor = 'pointer';
  }
  
  //console.log('[LiveKit] 🎛️ Conference controls enabled');
}
