# Fix for Double Username Tagging in AI Chat Greetings

The issue: The AI bots are tagging users twice in their greeting messages. This happens because:
1. The AI model is being prompted to generate a greeting for a specific username
2. Then the code is adding an @username tag to the beginning of the greeting

## Solution:

1. First, add this environment variable to your .env file:
```
AI_TAG_USERNAME_IN_GREETINGS=false
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
        const greetingPrompt = `Generate a short, friendly greeting for a new user who just joined the chat room. Make it generic without mentioning any specific name. Ask how they are doing.`;
        const aiGreeting = await this.generateAIResponse(bot, greetingPrompt, username, 'greeting');
        
        // Check if we should include the @username tag (controlled by environment variable)
        const shouldTagUsername = process.env.AI_TAG_USERNAME_IN_GREETINGS !== 'false';
        const greeting = shouldTagUsername ? `@${username} ${aiGreeting}` : aiGreeting;
        
        this.sendBotMessage(room, bot, greeting);
    }, Math.random() * 5000 + 2000); // Delay 2-7 seconds
    this.userLastActivity.set(`${room}:${username}`, now);
}
```

3. Add this property in the constructor (around line 12-15):
```javascript
constructor(io, buildMsg, chatState) {
    this.io = io;
    this.buildMsg = buildMsg;
    this.chatState = chatState;
    this.botCooldowns = new Map(); // Prevent spam
    this.userLastActivity = new Map(); // Track user activity
    this.botLastMessage = new Map(); // Track bot's last message
    
    // AI behavior configuration
    this.ONLY_RESPOND_WHEN_MENTIONED = process.env.AI_RESPONSES_ONLY_WHEN_MENTIONED === 'true';
    this.TAG_USERNAME_IN_GREETINGS = process.env.AI_TAG_USERNAME_IN_GREETINGS !== 'false'; // Add this line
    
    // Hugging Face API configuration
    // ...
}
```

This solution:
1. Makes the greeting prompt generic without mentioning specific usernames
2. Adds a configuration option to control whether to add @username tags
3. By default, it's set to false, so no @username tag will be added
