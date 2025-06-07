// test-backup.js - Convert to ES module syntax
import chatState from './chatState.js';

// Add some test messages
process.stdout.write('Adding test messages...\n');
chatState.addMessage('general', { 
    name: 'TestUser1', 
    text: 'Hello World!', 
    time: new Date().toLocaleTimeString() 
});

chatState.addMessage('general', { 
    name: 'TestUser2', 
    text: 'How are you?', 
    time: new Date().toLocaleTimeString() 
});

chatState.addMessage('tech-talk', { 
    name: 'Developer', 
    text: 'Discussing Node.js', 
    time: new Date().toLocaleTimeString() 
});

process.stdout.write('Current chat history:\n');
process.stdout.write(JSON.stringify(chatState.chatHistory, null, 2) + '\n');

// Test backup
process.stdout.write('\nTesting backup...\n');
import('./backup.js');

process.stdout.write('\nBackup test completed. Check chat-backup.json file.\n');
