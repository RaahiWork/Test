// chatState.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let chatHistory = {};
const backupPath = path.join(__dirname, 'chat-backup.json');

// Load previous messages if backup file exists
if (fs.existsSync(backupPath)) {
  try {
    const data = fs.readFileSync(backupPath, 'utf8');
    chatHistory = JSON.parse(data);
    // Use process.stdout.write for server logs only (not broadcasted to clients)
    process.stdout.write('\x1b[32m✅ Chat history restored from backup\x1b[0m\n');
    
    // Delete the backup file after successful restore
    fs.unlinkSync(backupPath);
    process.stdout.write('\x1b[33m🗑️ Backup file cleaned up after successful restore\x1b[0m\n');
  } catch (err) {
    process.stderr.write('\x1b[31m❌ Failed to restore chat history: ' + err.message + '\x1b[0m\n');
    chatHistory = {};
  }
}

export default {
  chatHistory,

  addMessage(room, message) {
    if (!chatHistory[room]) chatHistory[room] = [];
    chatHistory[room].push(message);
    if (chatHistory[room].length > 50) {
      chatHistory[room].shift(); // Limit to 50 messages per room
    }
  },

  getMessages(room) {
    return chatHistory[room] || [];
  },

  getAllRooms() {
    return Object.keys(chatHistory);
  }
};
