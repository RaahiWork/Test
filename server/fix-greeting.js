// This is a modification to fix the double username tagging issue in AI greetings
// To apply this fix, replace the handleUserJoin method in ai-bots.js with this version:

/*
    handleUserJoin(room, username) {
        if (!this.bots[room]) return;
        const bot = this.bots[room];
        const now = Date.now();
        // Greet user on join with a welcome message (no username in the prompt)
        setTimeout(async () => {
            const greetingPrompt = `Generate a short, friendly greeting for a new user who just joined the chat room. Don't include their name in the greeting, just a generic welcome. Ask how they are doing.`;
            let aiGreeting = await this.generateAIResponse(bot, greetingPrompt, username, 'greeting');
            
            // Remove bot avatar since it will be added automatically by sendBotMessage
            if (aiGreeting.startsWith(bot.avatar)) {
                aiGreeting = aiGreeting.substring(bot.avatar.length).trim();
            }
            
            // Only tag the username once at the beginning
            const greeting = `@${username} ${aiGreeting}`;
            this.sendBotMessage(room, bot, greeting);
        }, Math.random() * 5000 + 2000); // Delay 2-7 seconds
        this.userLastActivity.set(`${room}:${username}`, now);
    }
*/

// Alternatively, you can set the AI_TAG_USERNAME_IN_GREETINGS environment variable:
// AI_TAG_USERNAME_IN_GREETINGS=false

// This would require adding this code to handleUserJoin:
/*
    // Check if we should tag usernames in greetings  
    const shouldTagUsername = process.env.AI_TAG_USERNAME_IN_GREETINGS !== 'false';
    
    // In the setTimeout:
    const greeting = shouldTagUsername ? `@${username} ${aiGreeting}` : aiGreeting;
*/
