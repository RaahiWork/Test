# Fix for Username Tagging in AI Chat Greetings

The issue: The AI bots are tagging users twice in their greeting messages. This happens because:
1. The AI model is being prompted to generate a greeting for a specific username
2. Then the code is adding an @username tag to the beginning of the greeting

## Updated Solution (Tag Once):

We want to ensure users are tagged exactly once in the greeting. Here's how to fix it:

1. First, make sure this environment variable in your .env file is set to true:
```
AI_TAG_USERNAME_IN_GREETINGS=true
```

2. Then modify the handleUserJoin method in ai-bots.js:

Look for this block of code:
```javascript
// Handle user joining a room
handleUserJoin(room, username) {
    if (!this.bots[room]) return;
    const bot = this.bots[room];
    const now = Date.now();
    // Greet user on join with proper @username tag
    setTimeout(async () => {
        const greetingPrompt = `Generate a short, friendly greeting for ${username} who just joined the chat room. Ask how they are doing.`;
        const aiGreeting = await this.generateAIResponse(bot, greetingPrompt, username, 'greeting');
        // Ensure the user is properly tagged with @username format
        const greeting = `@${username} ${aiGreeting}`;
        this.sendBotMessage(room, bot, greeting);
    }, Math.random() * 5000 + 2000); // Delay 2-7 seconds
    this.userLastActivity.set(`${room}:${username}`, now);
}
```

And replace it with:
```javascript
// Handle user joining a room
handleUserJoin(room, username) {
    if (!this.bots[room]) return;
    const bot = this.bots[room];
    const now = Date.now();
    // Greet user on join with a welcome message
    setTimeout(async () => {
        // Don't include username in the prompt to avoid double-tagging
        const greetingPrompt = `Generate a short, friendly greeting for a new user who just joined the chat room. Don't mention their name. Ask how they are doing.`;
        const aiGreeting = await this.generateAIResponse(bot, greetingPrompt, username, 'greeting');
        
        // Add the @username tag at the beginning
        const greeting = `@${username} ${aiGreeting}`;
        
        this.sendBotMessage(room, bot, greeting);
    }, Math.random() * 5000 + 2000); // Delay 2-7 seconds
    this.userLastActivity.set(`${room}:${username}`, now);
}
```

This solution:
1. Makes the greeting prompt generic without mentioning specific usernames
2. Always adds the @username tag at the beginning of the message
3. Ensures users are tagged exactly once in the greeting message
