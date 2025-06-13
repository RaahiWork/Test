/**
 * Username Formatting for AI Bot Greetings
 * 
 * This file documents how the username formatting feature works in the AI chat bot system.
 * These changes have already been applied to ai-bots.js.
 */

/**
 * Configuration in .env file:
 * 
 * AI_USERNAME_FORMAT=plain
 * 
 * Supported formats:
 * - 'tag': Uses the format "@username message" (e.g., "@john Welcome to the chat!")
 * - 'plain': Uses the format "username, message" (e.g., "john, Welcome to the chat!")
 * - 'none': Does not include the username at all (e.g., "Welcome to the chat!")
 */

// Implementation in AIBotManager constructor:
// this.USERNAME_FORMAT = process.env.AI_USERNAME_FORMAT || 'tag'; // Default to 'tag' format

/**
 * Implementation in handleUserJoin method:
 * 
 * ```javascript
 * handleUserJoin(room, username) {     if (!this.bots[room]) return;
 *     const bot = this.bots[room];
 *     const now = Date.now();
 *     
 *     // Greet user on join with a welcome message
 *     setTimeout(async () => {
 *         // This prompt doesn't include the username to avoid double-mentions
 *         const greetingPrompt = `Generate a short, friendly greeting for a new user who just joined the chat room. Don't include any names, just a generic welcome. Ask how they are doing.`;
 *         
 *         let aiGreeting = await this.generateAIResponse(bot, greetingPrompt, username, 'greeting');
 *         
 *         // Remove bot avatar if already included by the AI
 *         if (aiGreeting.startsWith(bot.avatar)) {
 *             aiGreeting = aiGreeting.substring(bot.avatar.length).trim();
 *         }
 *         
 *         // Format the greeting based on configuration
 *         let greeting;
 *         
 *         switch (this.USERNAME_FORMAT) {
 *             case 'tag':
 *                 greeting = `@${username} ${aiGreeting}`;
 *                 break;
 *             case 'plain':
 *                 greeting = `${username}, ${aiGreeting}`;
 *                 break;
 *             default:
 *                 greeting = aiGreeting;
 *         }
 *         
 *         this.sendBotMessage(room, bot, greeting);
 *     }, Math.random() * 5000 + 2000); // Delay 2-7 seconds
 *     
 *     this.userLastActivity.set(`${room}:${username}`, now);
 * }
 * ```

/**
 * Benefits of this implementation:
 * 1. Prevents double username mentions in greetings
 * 2. Provides flexible formatting options through environment variables
 * 3. Makes greeting messages more natural and customizable
 * 4. Handles bot avatar duplication gracefully
 */
