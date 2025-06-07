// backup.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chatState from './chatState.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const backupPath = path.join(__dirname, 'chat-backup.json');
  fs.writeFileSync(backupPath, JSON.stringify(chatState.chatHistory, null, 2));
  process.stdout.write('\x1b[32m✅ Chat history backed up successfully\x1b[0m\n');
} catch (err) {
  process.stderr.write('\x1b[31m❌ Failed to backup chat history: ' + err.message + '\x1b[0m\n');
  process.exit(1);
}
