# Username Format Fix for AI Bots

Follow these steps to fix the double username tagging and use a plain username format:

## 1. Update the .env file
```
AI_USERNAME_FORMAT=plain
```

## 2. In the AIBotManager constructor
Add this line after the ONLY_RESPOND_WHEN_MENTIONED line:
```javascript
this.USERNAME_FORMAT = process.env.AI_USERNAME_FORMAT || 'tag'; // 'tag', 'plain', or 'none'
```

## 3. In the handleUserJoin method
Find the part where the greeting is formatted with the username tag:
```javascript
// Add username tag only at the beginning of the greeting
const greeting = `@${username} ${aiGreeting}`;
```

Replace it with:
```javascript
// Format the greeting based on configuration
let greeting;
            
// Add username based on format setting
if (this.USERNAME_FORMAT === 'tag') {
    greeting = `@${username} ${aiGreeting}`;
} else if (this.USERNAME_FORMAT === 'plain') {
    greeting = `${username}, ${aiGreeting}`;
} else {
    greeting = aiGreeting;
}
```

## 4. Make sure the greeting prompt does not include the username:
```javascript
const greetingPrompt = `Generate a short, friendly greeting for a new user who just joined the chat room. Don't include any names, just a generic welcome. Ask how they are doing.`;
```

This will ensure that the AI bot:
- Mentions the username only once
- Uses the format "username, greeting text" instead of "@username greeting text"
- Provides a setting that can be easily changed in the .env file
