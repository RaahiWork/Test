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
  const { token, wsUrl } = await res.json();
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
  const wsURL = wsUrl || window.LIVEKIT_WS_URL;
  if (!wsURL) throw new Error('No LiveKit WebSocket URL provided');
  const room = new LivekitClient.Room();
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
  const wsURL = wsUrl || window.LIVEKIT_WS_URL;
  if (!wsURL) throw new Error('No LiveKit WebSocket URL provided');
  const room = new LivekitClient.Room();
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

// When the caller clicks the voice call button, open a conference popup to search and add users to the conference.
// This disables all private voice note logic and focuses only on conference call UI entry point.

// Example: Expose a function to open the conference popup
window.openConferencePopup = function() {
  let modal = document.getElementById('conference-popup-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'conference-popup-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.7)';
    modal.style.zIndex = '3000';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.innerHTML = `
      <div style="background:#222;padding:2em 2.5em;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.3);display:flex;flex-direction:column;align-items:center;gap:1.2em;min-width:320px;max-width:95vw;">
        <h2 style="color:#fff;margin-bottom:0.5em;">Start Conference Call</h2>
        <input id="conference-user-search" type="text" placeholder="Search users to add..." style="padding:0.5em 1em;border-radius:8px;border:1px solid #888;width:100%;margin-bottom:1em;">
        <div id="conference-user-results" style="width:100%;max-height:180px;overflow-y:auto;margin-bottom:1em;"></div>
        <div id="conference-selected-users" style="width:100%;margin-bottom:1em;color:#fff;"></div>
        <button id="conference-start-btn" style="background:#6c63ff;color:#fff;padding:0.7em 2em;border:none;border-radius:8px;font-size:1.1em;cursor:pointer;">Start Call</button>
        <button id="conference-cancel-btn" style="background:#ff6b6b;color:#fff;padding:0.5em 1.5em;border:none;border-radius:8px;font-size:1em;cursor:pointer;margin-top:0.5em;">Cancel</button>
      </div>
    `;
    document.body.appendChild(modal);
  } else {
    modal.style.display = 'flex';
  }
  // Cancel button closes the popup
  modal.querySelector('#conference-cancel-btn').onclick = () => {
    modal.style.display = 'none';
  };

  // --- User search and selection logic ---
  const searchInput = modal.querySelector('#conference-user-search');
  const resultsDiv = modal.querySelector('#conference-user-results');
  const selectedDiv = modal.querySelector('#conference-selected-users');
  let selectedUsers = [];
  let lastSearch = '';
  let users = [];

  function renderSelected() {
    selectedDiv.innerHTML = selectedUsers.length
      ? 'Selected: ' + selectedUsers.map(u => `<span style="background:#6c63ff;padding:0.2em 0.7em;border-radius:12px;margin-right:0.5em;">${u.displayName || u.username}</span>`).join('')
      : '';
  }

  function renderResults(list) {
    resultsDiv.innerHTML = '';
    if (!list.length) {
      resultsDiv.innerHTML = '<div style="color:#aaa;padding:0.5em;">No users found</div>';
      return;
    }
    list.forEach(user => {
      const div = document.createElement('div');
      div.textContent = user.displayName || user.username;
      div.style.padding = '0.5em 0.7em';
      div.style.cursor = 'pointer';
      div.style.color = '#fff';
      div.onmouseenter = () => div.style.background = '#333';
      div.onmouseleave = () => div.style.background = '';
      div.onclick = () => {
        if (!selectedUsers.some(u => u.username === user.username)) {
          selectedUsers.push(user);
          renderSelected();
        }
      };
      resultsDiv.appendChild(div);
    });
  }

  searchInput.addEventListener('input', function() {
    const q = searchInput.value.trim();
    lastSearch = q;
    if (!q) {
      resultsDiv.innerHTML = '';
      return;
    }
    fetch(`/api/search-users?q=${encodeURIComponent(q)}`)
      .then(res => res.json())
      .then(data => {
        users = (data.users || []);
        renderResults(users);
      })
      .catch(() => {
        resultsDiv.innerHTML = '<div style="color:#aaa;padding:0.5em;">Error searching users</div>';
      });
  });

  // Remove user from selected on click
  selectedDiv.onclick = function(e) {
    if (e.target.tagName === 'SPAN') {
      const name = e.target.textContent;
      selectedUsers = selectedUsers.filter(u => (u.displayName || u.username) !== name);
      renderSelected();
    }
  };

  // Start conference call button
  modal.querySelector('#conference-start-btn').onclick = () => {
    if (!selectedUsers.length) {
      alert('Please select at least one user to start a conference call.');
      return;
    }
    // TODO: Implement conference call start logic here (e.g., open LiveKit room with selected users)
    alert('Conference call would start with: ' + selectedUsers.map(u => u.displayName || u.username).join(', '));
    modal.style.display = 'none';
  };
};

// All console.log statements have been removed from this file. No client-side logging remains.
