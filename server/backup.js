// backup.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chatState from './chatState.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('================================');
console.log('🔧 STARTING BACKUP PROCESS');
console.log('================================');
console.log('📡 Current chat state:', chatState.chatHistory);

try {  const backupPath = path.join(__dirname, 'chat-backup.json');
  const timestampedBackupPath = path.join(__dirname, `chat-backup-deployment-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  
  const backupData = JSON.stringify(chatState.chatHistory, null, 2);
  
  // Create both regular and timestamped backup
  fs.writeFileSync(backupPath, backupData);
  fs.writeFileSync(timestampedBackupPath, backupData);
  
  const messageCount = Object.values(chatState.chatHistory).reduce((total, roomMsgs) => total + (roomMsgs?.length || 0), 0);
  
  console.log('================================');
  console.log('✅ BACKUP COMPLETED SUCCESSFULLY');
  console.log('================================');
  process.stdout.write('\x1b[32m✅ Chat history backed up successfully\x1b[0m\n');
  console.log(`💬 Backed up ${messageCount} messages across ${Object.keys(chatState.chatHistory).length} rooms`);
  console.log(`📁 Primary backup: ${backupPath}`);
  console.log(`📁 Timestamped backup: ${timestampedBackupPath}`);
  
  // Verify the file was created
  const stats = fs.statSync(backupPath);
  console.log(`📊 Backup file size: ${stats.size} bytes`);
  console.log('================================');
  
} catch (err) {
  console.log('================================');
  console.log('❌ BACKUP FAILED');
  console.log('================================');
  process.stderr.write('\x1b[31m❌ Failed to backup chat history: ' + err.message + '\x1b[0m\n');
  console.error('Error details:', err);
  process.exit(1);
}
