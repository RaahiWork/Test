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
    console.log('================================');
    console.log('🔄 RESTORING CHAT HISTORY');
    console.log('================================');
    console.log(`📁 Found backup file: ${backupPath}`);
    
    const data = fs.readFileSync(backupPath, 'utf8');
    const restoredData = JSON.parse(data);
    
    // Count messages before restoration
    const messageCount = Object.values(restoredData).reduce((total, roomMsgs) => total + (roomMsgs?.length || 0), 0);
    const roomCount = Object.keys(restoredData).length;
    
    chatHistory = restoredData;
    
    console.log('================================');
    console.log('✅ CHAT HISTORY RESTORED');
    console.log('================================');
    // Use process.stdout.write for server logs only (not broadcasted to clients)
    process.stdout.write('\x1b[32m✅ Chat history restored from backup\x1b[0m\n');
    console.log(`💬 Restored ${messageCount} messages across ${roomCount} rooms`);
    console.log(`📂 Backup file location: ${backupPath}`);
    
    // Delete the backup file after successful restore
    fs.unlinkSync(backupPath);
    process.stdout.write('\x1b[33m🗑️ Backup file cleaned up after successful restore\x1b[0m\n');
    console.log('🗑️ Backup file cleaned up after successful restore');
    console.log('================================');
    
  } catch (err) {
    console.log('================================');
    console.log('❌ CHAT RESTORATION FAILED');
    console.log('================================');
    process.stderr.write('\x1b[31m❌ Failed to restore chat history: ' + err.message + '\x1b[0m\n');
    console.error('❌ Failed to restore chat history:', err.message);
    console.error('Error details:', err);
    chatHistory = {};
    console.log('🔄 Initialized with empty chat history');
  }
} else {
  console.log('================================');
  console.log('ℹ️ NO BACKUP FILE FOUND');
  console.log('================================');
  console.log(`📁 Looked for backup at: ${backupPath}`);
  console.log('🔄 Starting with empty chat history');
  console.log('================================');
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
