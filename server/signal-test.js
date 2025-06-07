#!/usr/bin/env node

/**
 * Signal Testing Script for Remote Deployment Debugging
 * 
 * This script helps identify which signals are available and how
 * the remote platform handles process termination.
 * 
 * Usage:
 * 1. Deploy this script to your remote server
 * 2. Run it: node signal-test.js
 * 3. Observe which signals are triggered when the process is stopped
 */

console.log('🔍 Signal Testing Script Started');
console.log(`📦 Platform: ${process.platform}`);
console.log(`🔢 Process PID: ${process.pid}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🕒 Start time: ${new Date().toISOString()}`);
console.log('================================');

// Track received signals
const receivedSignals = [];

// All possible signals to test
const signalsToTest = [
    'SIGINT',    // Ctrl+C
    'SIGTERM',   // Termination signal (most common for cloud platforms)
    'SIGQUIT',   // Quit signal
    'SIGHUP',    // Hangup signal
    'SIGUSR1',   // User-defined signal 1
    'SIGUSR2',   // User-defined signal 2 (nodemon)
    'SIGTSTP',   // Terminal stop signal
    'SIGCONT',   // Continue signal
];

// Set up handlers for all signals
signalsToTest.forEach(signal => {
    try {
        process.on(signal, () => {
            const timestamp = new Date().toISOString();
            const logMessage = `📡 Received ${signal} at ${timestamp}`;
            console.log(logMessage);
            receivedSignals.push({ signal, timestamp });
            
            // Don't exit immediately, log what we received
            setTimeout(() => {
                console.log('================================');
                console.log('📊 SIGNAL SUMMARY:');
                receivedSignals.forEach(s => {
                    console.log(`   ${s.signal} at ${s.timestamp}`);
                });
                console.log('================================');
                console.log('👋 Exiting gracefully');
                process.exit(0);
            }, 1000);
        });
        console.log(`✅ Handler set for ${signal}`);
    } catch (err) {
        console.log(`❌ Cannot handle ${signal}: ${err.message}`);
    }
});

// Test other process events
process.on('exit', (code) => {
    console.log(`🚪 Process exit event with code: ${code}`);
});

process.on('beforeExit', (code) => {
    console.log(`⚠️ Process beforeExit event with code: ${code}`);
});

process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection:', reason);
});

// Keep the process alive and log periodically
let counter = 0;
const heartbeat = setInterval(() => {
    counter++;
    console.log(`💓 Heartbeat ${counter} - Process still alive (${new Date().toISOString()})`);
    
    // Auto-exit after 5 minutes if no signals received
    if (counter >= 60) { // 5 minutes worth of 5-second intervals
        console.log('⏰ Auto-exiting after 5 minutes');
        clearInterval(heartbeat);
        
        if (receivedSignals.length === 0) {
            console.log('⚠️ No signals were received during testing');
            console.log('💡 This suggests the platform may not send standard termination signals');
            console.log('💡 Consider using beforeExit event or manual backup endpoints');
        }
        
        process.exit(0);
    }
}, 5000); // Log every 5 seconds

console.log('🏃 Script is running. Try stopping/restarting to see which signals are sent.');
console.log('📝 Watch the console output to see which signals your platform uses.');
console.log('⏰ Will auto-exit after 5 minutes if no signals are received.');
