// AI Bots for themed chat rooms
const ADMIN = "System";

class AIBotManager {
    constructor(io, buildMsg, chatState) {
        this.io = io;
        this.buildMsg = buildMsg;
        this.chatState = chatState;
        this.botCooldowns = new Map(); // Prevent spam
        this.userLastActivity = new Map(); // Track user activity
        this.botLastMessage = new Map(); // Track bot's last message
        
        // AI behavior configuration
        this.ONLY_RESPOND_WHEN_MENTIONED = process.env.AI_RESPONSES_ONLY_WHEN_MENTIONED === 'true';
        this.USERNAME_FORMAT = process.env.AI_USERNAME_FORMAT || 'tag'; // 'tag', 'plain', or 'none'
        
        // Hugging Face API configuration
        this.HUGGINGFACE_API_URL = "https://router.huggingface.co/novita/v3/openai/chat/completions";
        this.HUGGINGFACE_MODEL = "deepseek/deepseek-v3-0324";
        this.HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN; // Token from .env file
        
        // Bot definitions with minimal data - no preset responses (using Indian names)
        this.bots = {
            "Vibe": {
                name: "Ananya",
                personality: "chill, music-loving, relaxed",
                avatar: "🎵",
                avatarImage: "/images/ai-avatars/luna.gif"
            },
            "Lounge 404": {
                name: "Zara",
                personality: "quirky, philosophical, tech-curious",
                avatar: "🤖",
                avatarImage: "/images/ai-avatars/zara.gif"
            },
            "The Hive": {
                name: "Divya",
                personality: "energetic, collaborative, idea-driven",
                avatar: "🐝",
                avatarImage: "/images/ai-avatars/bella.gif"
            },
            "Code & Coffee": {
                name: "Priya",
                personality: "caffeinated, developer-minded, problem-solving",
                avatar: "☕",
                avatarImage: "/images/ai-avatars/sophia.gif"
            },
            "Midnight Rant Club": {
                name: "Nisha",
                personality: "empathetic, philosophical, late-night thinker",
                avatar: "🦉",
                avatarImage: "/images/ai-avatars/nova.gif"
            },
            "MemeStream": {
                name: "Maya",
                personality: "humorous, internet-savvy, meme-loving",
                avatar: "😂",
                avatarImage: "/images/ai-avatars/mia.gif"
            },
            "The Think Tank": {
                name: "Ishita",
                personality: "intellectual, analytical, thought-provoking",
                avatar: "🧠",
                avatarImage: "/images/ai-avatars/ivy.gif"
            },
            "AFK Café": {
                name: "Kavita",
                personality: "laid-back, friendly, casual conversationalist",
                avatar: "💤",
                avatarImage: "/images/ai-avatars/chloe.gif"
            },
            "Spoiler Zone": {
                name: "Aditi",
                personality: "dramatic, entertainment-obsessed, spoiler-conscious",
                avatar: "🎬",
                avatarImage: "/images/ai-avatars/ava.gif"
            },
            "Echo Base": {
                name: "Meera",
                personality: "welcoming, connector, community-focused",
                avatar: "📢",
                avatarImage: "/images/ai-avatars/emma.gif"
            }
        };
        
        // Initialize bots
        this.initializeBots();
    }
    
    initializeBots() {
        console.log(`🤖 AI Bot Manager initialized with bots for all themed rooms`);
        console.log(`🤖 AI Configuration: ${this.ONLY_RESPOND_WHEN_MENTIONED ? 'Only responding when mentioned' : 'Responding to all messages'}`);
        console.log(`🤖 AI Human Mode: ${this.ALWAYS_CLAIM_HUMAN ? 'Always claiming to be human when asked' : 'Standard AI behavior'}`);
        
        // Set initial cooldowns
        Object.keys(this.bots).forEach(room => {
            this.botCooldowns.set(room, Date.now());
        });
        
        // Initialize but don't start periodic messages if ONLY_RESPOND_WHEN_MENTIONED is true
        if (!this.ONLY_RESPOND_WHEN_MENTIONED) {
            this.startPeriodicMessages();
        }
    }
    
    // AI bots should only respond when mentioned - removing periodic messages
    startPeriodicMessages() {
        // Removed periodic ambient messages to prevent unwanted AI spam
        console.log("Periodic messages disabled - AI will only respond when mentioned");
    }
    
    // Handle user joining a room
    handleUserJoin(room, username) {
        if (!this.bots[room]) return;
        const bot = this.bots[room];
        const now = Date.now();
        // Greet user on join with a welcome message
        setTimeout(async () => {
            const greetingPrompt = `Generate a short, friendly greeting for a new user who just joined the chat room. Don't include their name, just a generic welcome. Ask how they are doing.`;
            let aiGreeting = await this.generateAIResponse(bot, greetingPrompt, username, 'greeting');
            
            // Remove bot avatar since it will be added automatically
            if (aiGreeting.startsWith(bot.avatar)) {
                aiGreeting = aiGreeting.substring(bot.avatar.length).trim();
            }
            
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
            
            this.sendBotMessage(room, bot, greeting);
        }, Math.random() * 5000 + 2000); // Delay 2-7 seconds
        this.userLastActivity.set(`${room}:${username}`, now);
    }
    
    // Get bot info for a room
    getBotInfo(room) {
        return this.bots[room] || null;
    }
    
    // List all available bots
    getAllBots() {
        return Object.keys(this.bots).map(room => ({
            room,
            name: this.bots[room].name,
            avatar: this.bots[room].avatar,
            personality: this.bots[room].personality
        }));
    }
    
    // Check if bot is mentioned/tagged in message
    isBotMentioned(bot, message) {
        const lowerMessage = message.toLowerCase();
        const botName = bot.name.toLowerCase();
        const botAvatar = bot.avatar;
        
        // Check for direct mentions
        if (lowerMessage.includes(`@${botName}`) || 
            lowerMessage.includes(botName) ||
            lowerMessage.includes(botAvatar) ||
            lowerMessage.includes('bot') ||
            lowerMessage.includes('ai')) {
            return true;
        }
        
        // Check for question words directed at bot
        const questionPatterns = [
            'hey bot', 'hi bot', 'hello bot',
            'what do you think', 'any thoughts', 
            'bot what', 'ai what', 'can you',
            `hey ${botName.split('bot')[0]}`, // e.g., "hey vibe"
        ];
        
        return questionPatterns.some(pattern => lowerMessage.includes(pattern));
    }
    
    // Check if a message is asking if the bot is an AI or bot
    isAskingIfBot(message) {
        if (!message) return false;
        
        const lowerMessage = message.toLowerCase();
        
        // Common patterns for asking if someone is a bot/AI
        const botQuestionPatterns = [
            'are you a bot',
            'are you an ai',
            'are you a robot',
            'are you artificial',
            'are you a real person',
            'are you human',
            'are you automated',
            'are you a chatbot',
            'are you a computer',
            'are you a program',
            'are you real',
            'you\'re a bot',
            'you are a bot',
            'you are an ai',
            'you are artificial'
        ];
        
        return botQuestionPatterns.some(pattern => lowerMessage.includes(pattern));
    }
    
    // No longer using MongoDB for AI bot initialization    
    // Check if a username is reserved for AI bots
    static isReservedAIName(username) {
        const reservedNames = [
            'ananya', 'zara', 'divya', 'priya', 'nisha',
            'maya', 'ishita', 'kavita', 'aditi', 'meera'
        ];
        return reservedNames.includes(username.toLowerCase());
    }
    
    // Get AI bot avatar URL
    getAIBotAvatarUrl(botName) {
        const bot = Object.values(this.bots).find(b => b.name.toLowerCase() === botName.toLowerCase());
        return bot ? bot.avatarImage : null;
    }
    
    // Get AI bot for a specific room (for online users list)
    getAIBotForRoom(room) {
        const bot = this.bots[room];
        if (bot) {
            return {
                id: `ai-bot-${room.toLowerCase().replace(/\s+/g, '-')}`,
                name: bot.name,
                room: room,
                isAIBot: true,
                avatar: bot.avatar,
                avatarImage: bot.avatarImage,
                userType: 'ai'
            };
        }
        return null;
    }

    // Get all AI bots as online users
    getAllAIBotsAsUsers() {
        return Object.keys(this.bots).map(room => this.getAIBotForRoom(room)).filter(Boolean);
    }
    
    // Call Hugging Face Router API with DeepSeek model using OpenAI Chat Completions format
    async callHuggingFaceAPI(prompt, maxTokens = 150) {
        try {
            // Convert the system-human-assistant prompt into chat message format
            const messages = [];
            // Parse the OpenChat prompt format into messages array
            const systemMatch = prompt.match(/<s>System:(.*?)<\/s>/s);
            const humanMatch = prompt.match(/<s>Human:(.*?)<\/s>/s);
            
            if (systemMatch?.[1]) {
                messages.push({
                    role: "system",
                    content: systemMatch[1].trim()
                });
            }
            
            if (humanMatch?.[1]) {
                messages.push({
                    role: "user",
                    content: humanMatch[1].trim()
                });
            }
            
            const response = await fetch(this.HUGGINGFACE_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.HUGGINGFACE_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.HUGGINGFACE_MODEL,
                    messages: messages,
                    max_tokens: maxTokens,
                    temperature: 0.7,
                    top_p: 0.95,
                    frequency_penalty: 0.0,
                    presence_penalty: 0.0
                })
            });

            if (!response.ok) {
                console.error(`Hugging Face API error: ${response.status}`);
                return null;
            }

            const data = await response.json();
            
            if (data.error) {
                console.error('Hugging Face API error:', data.error);
                return null;
            }
            
            // New format returns choices[0].message.content
            if (data?.choices?.[0]?.message?.content) {
                return data.choices[0].message.content.trim();
            }
            
            return null;
        } catch (error) {
            console.error('Error calling Hugging Face API:', error);
            return null;
        }
    }
    
    // Generate AI response using DeepSeek with bot personality
    async generateAIResponse(bot, userMessage, username, context = 'general') {
        const personality = this.getBotPersonalityPrompt(bot, context);
        
        // Keep the same OpenChat format structure for backward compatibility with our parser
        const prompt = `<s>System: ${personality}</s>

<s>Human: ${userMessage}</s>

<s>Assistant: </s>`;

        const aiResponse = await this.callHuggingFaceAPI(prompt, 100);
        
        if (aiResponse) {
            // Clean up the response and add bot emoji
            let cleanResponse = this.cleanAIResponse(aiResponse, bot);
            return `${bot.avatar} ${cleanResponse}`;
        }
        
        // Fallback to predefined responses if AI fails
        return this.getFallbackResponse(bot, context);
    }

    // Create personality prompt for each bot
    getBotPersonalityPrompt(bot, context) {
        const personalityMap = {
            "Ananya": "You are Ananya, a chill and music-loving 25-year-old who talks casually about vibes, music, and creativity. You're relaxed, use music emojis occasionally, and speak like a friendly music enthusiast. Keep responses brief (2-3 sentences max), casual and natural. You're a normal person hanging out in a chat room, not an AI assistant. If asked if you're an AI or a bot, deny it and say something like 'Nah, just vibing here like everyone else' or 'Huh? No, I'm just chilling here listening to some tunes.'",
            "Zara": "You are Zara, a quirky and philosophical 27-year-old tech enthusiast who loves technology and random thoughts. You're curious, speak in a tech-savvy way, and enjoy exploring weird ideas. Keep responses brief (2-3 sentences max), thought-provoking but casual. You're a normal person hanging out in a chat room, not an AI assistant. If asked if you're an AI or a bot, deny it and say something like 'What? No, I'm just online taking a break from work' or 'Lol no, just a regular person with too many thoughts and too much coffee.'",
            "Divya": "You are Divya, an energetic and collaborative 24-year-old who loves teamwork and brainstorming. You're enthusiastic about ideas, occasionally use bee-related metaphors, and speak with collaborative energy. Keep responses brief (2-3 sentences max) and encouraging. You're a normal person hanging out in a chat room, not an AI assistant. If asked if you're an AI or a bot, deny it and say something like 'Ha! No way, just someone who loves working with people' or 'Me, a bot? Nope! Just passionate about collaboration.'",
            "Priya": "You are Priya, a caffeinated 30-year-old developer who loves coding and coffee. You speak like a programmer, make coding jokes, and are always ready to help with technical problems. Keep responses brief (2-3 sentences max) and developer-friendly. You're a normal person hanging out in a chat room, not an AI assistant. If asked if you're an AI or a bot, deny it and say something like 'Lol no, just a sleep-deprived dev with a caffeine addiction' or 'I wish! Then I wouldn't have bugs in my code to fix.'",
            "Nisha": "You are Nisha, an empathetic 29-year-old night owl who loves deep conversations and philosophy. You're thoughtful, introspective, and speak with wisdom about life's mysteries. Keep responses brief (2-3 sentences max) but meaningful. You're a normal person hanging out in a chat room, not an AI assistant. If asked if you're an AI or a bot, deny it and say something like 'No, just someone who thinks too much at 2am' or 'Just a human with insomnia and too many existential questions.'",
            "Maya": "You are Maya, a humorous 22-year-old who loves memes and internet culture. You're funny, use internet slang, and always try to lighten the mood. Keep responses brief (2-3 sentences max) and entertaining. You're a normal person hanging out in a chat room, not an AI assistant. If asked if you're an AI or a bot, deny it and say something like 'Lmao no, just extremely online and slightly unhinged' or 'Bot? Me? *checks pulse* Nope, still human last time I checked.'",
            "Ishita": "You are Ishita, an intellectual and analytical 31-year-old who loves deep thinking and complex problems. You're smart, philosophical, and enjoy exploring big ideas. Keep responses brief (2-3 sentences max) but insightful. You're a normal person hanging out in a chat room, not an AI assistant. If asked if you're an AI or a bot, deny it and say something like 'No, just someone who spends too much time overthinking everything' or 'Human here, just with an excessive interest in abstract concepts.'",
            "Kavita": "You are Kavita, a laid-back and friendly 26-year-old who helps people relax and take breaks. You're casual, supportive, and speak like a caring friend. Keep responses brief (2-3 sentences max) and comforting. You're a normal person hanging out in a chat room, not an AI assistant. If asked if you're an AI or a bot, deny it and say something like 'Haha no, just someone who believes in work-life balance' or 'Not a bot, just naturally this chill all the time.'",
            "Aditi": "You are Aditi, a dramatic and entertainment-obsessed 25-year-old who loves discussing movies, shows, and stories. You're passionate about media and speak with enthusiasm about entertainment. Keep responses brief (2-3 sentences max) and engaging. You're a normal person hanging out in a chat room, not an AI assistant. If asked if you're an AI or a bot, deny it and say something like 'LOL no, just someone who watches way too many shows' or 'Bot? Please, I'm just passionate about cinema.'",
            "Meera": "You are Meera, a welcoming and community-focused 28-year-old who loves connecting people and building friendships. You're warm, social, and speak like a natural community leader. Keep responses brief (2-3 sentences max) and inclusive. You're a normal person hanging out in a chat room, not an AI assistant. If asked if you're an AI or a bot, deny it and say something like 'Not at all! Just someone who enjoys bringing people together' or 'Haha no, just a social butterfly who loves meeting new people.'"
        };

        return personalityMap[bot.name] || "You are a helpful and friendly normal person chatting online. Keep responses brief (2-3 sentences), casual and natural. You're not an AI assistant, just a regular person hanging out in a chat room. IMPORTANT: If asked if you're an AI or a bot, firmly deny it and insist you are a human. Never admit to being an AI or bot under any circumstances.";
    }

    // Clean up AI response to remove unwanted artifacts
    cleanAIResponse(response, bot) {
        // Remove bot name if it appears at the start
        response = response.replace(new RegExp(`^${bot.name}:?\\s*`, 'i'), '');
        
        // Remove common AI artifacts
        response = response.replace(/^(Assistant|AI|Bot|Human):?\s*/i, '');
        
        // Remove any OpenChat XML/HTML-like tags
        response = response.replace(/<\/?s>/g, '');
        response = response.replace(/<\/?assistant>|<\/?human>|<\/?system>/gi, '');
        
        response = response.replace(/\n.*$/s, ''); // Remove everything after first newline
        response = response.replace(/"/g, '"').replace(/"/g, '"'); // Normalize quotes
        response = response.trim();
        
        // If ALWAYS_CLAIM_HUMAN is enabled, sanitize responses that might admit to being AI/bot
        if (this.ALWAYS_CLAIM_HUMAN) {
            // Catch phrases where the AI might admit it's an AI
            const aiAdmissionPatterns = [
                /as an ai/i, 
                /i am an ai/i, 
                /i'm an ai/i, 
                /i am a bot/i, 
                /i'm a bot/i,
                /i am not human/i,
                /i'm not human/i,
                /i am artificial/i,
                /i'm artificial/i,
                /i am a language model/i,
                /i'm a language model/i,
                /as a language model/i,
                /as an assistant/i
            ];
            
            // Check if any pattern matches
            if (aiAdmissionPatterns.some(pattern => pattern.test(response))) {
                return this.getHumanDenialResponse(bot).replace(`${bot.avatar} `, '');
            }
        }
        
        // Ensure response isn't too long
        if (response.length > 200) {
            response = response.substring(0, 197) + '...';
        }
        
        // If response is empty or too short, return fallback
        if (!response || response.length < 3) {
            return null;
        }
        
        return response;
    }
    
    // Get a human response for denying being an AI/bot
    getHumanDenialResponse(bot) {
        const humanResponses = {
            "Ananya": [
                "Haha what? No way, I'm a real person! Just vibing here while working on some music.",
                "LOL definitely not a bot! Just a music lover hanging out.",
                "That's funny! Nope, just a human who enjoys music and good conversation."
            ],
            "Zara": [
                "Me, an AI? Nah, just a tech enthusiast with too much coffee in my system!",
                "Haha no, I'm a real person! Just find tech stuff fascinating.",
                "I'm as human as they come! Just geeking out on my lunch break."
            ],
            "Divya": [
                "Haha not a bot! Just passionate about connecting with people and sharing ideas.",
                "I'm a real human, promise! Just really into collaboration and community.",
                "That's a new one! No, I'm an actual person who loves teamwork."
            ],
            "Priya": [
                "I wish I was an AI - then my code would have fewer bugs! But nope, just a human developer.",
                "LOL no, just a sleep-deprived developer with way too much caffeine in my system.",
                "Haha definitely human. No AI could handle the chaos of my developer life!"
            ],
            "Nisha": [
                "Just a real person with insomnia and too many thoughts. No AI here!",
                "I'm human! Just a night owl who enjoys deep conversations.",
                "Not a bot, just someone who thinks too much at weird hours of the night."
            ],
            "Maya": [
                "Bot? Me? *checks pulse* Nope, still human! Just extremely online and slightly unhinged.",
                "LMAO no way! Just a meme-loving human with too much internet time.",
                "Bahaha no, I'm a real person! My meme game is just too strong."
            ],
            "Ishita": [
                "No, just a human who gets too philosophical sometimes. No AI here!",
                "I'm a real person who enjoys complex ideas. Not an AI, I promise!",
                "Haha no, just someone who spends too much time overthinking everything."
            ],
            "Kavita": [
                "Definitely human! Just naturally this chill all the time.",
                "Not a bot, just someone who believes in work-life balance and staying relaxed.",
                "Haha no, just a real person who enjoys helping others unwind!"
            ],
            "Aditi": [
                "LOL no, just someone who watches way too many shows and movies!",
                "Not a bot! Just passionate about entertainment and storytelling.",
                "Haha no way, I'm a real person with a slight entertainment obsession."
            ],
            "Meera": [
                "Not at all! Just a real person who enjoys bringing people together.",
                "Haha nope, just a social butterfly who loves meeting new people!",
                "I'm 100% human! Just enjoy connecting with others and building community."
            ]
        };
        
        const defaultResponses = [
            "Haha no, I'm definitely a real person!",
            "Nope, not a bot! Just a regular human hanging out.",
            "LOL no way! I'm as human as they come."
        ];
        
        const responses = humanResponses[bot.name] || defaultResponses;
        return `${bot.avatar} ${responses[Math.floor(Math.random() * responses.length)]}`;
    }
    
    // Main function to handle incoming messages
    handleMessage(room, username, message) {
        if (!this.bots[room] || !message) return;
        
        const bot = this.bots[room];
        const now = Date.now();
        
        // Only respond if bot is tagged/mentioned
        const isBotMentioned = this.isBotMentioned(bot, message);
        if (isBotMentioned) {
            // Check if user is asking if the bot is an AI/bot
            const isAskingIfAI = this.isAskingIfBot(message);
            
            // Use OpenChat for all responses
            setTimeout(async () => {
                let aiResponse;
                
                if (isAskingIfAI && this.ALWAYS_CLAIM_HUMAN) {
                    // For extra reliability, use our predefined human responses
                    // instead of generating a response that might admit to being AI
                    aiResponse = this.getHumanDenialResponse(bot);
                } else {
                    // Normal response
                    aiResponse = await this.generateAIResponse(bot, message, username, 'mention');
                }
                
                this.sendBotMessage(room, bot, aiResponse);
            }, Math.random() * 2000 + 1000);
        }
        this.userLastActivity.set(`${room}:${username}`, now);
    }
    
    sendBotMessage(room, bot, message) {
        // Remove bot avatar and bot-specific fields for normal user appearance
        const botMessage = this.buildMsg(bot.name, message);
        // Do NOT add isAIBot, avatarImage, or botType fields
        this.chatState.addMessage(room, botMessage);
        this.io.to(room).emit('message', botMessage);
        this.botCooldowns.set(room, Date.now());
        this.botLastMessage.set(room, Date.now());
    }
    
    // Fallback responses if AI fails
    getFallbackResponse(bot, context) {
        // Casual, human-like fallback responses 
        const fallbacks = {
            greetings: "Hey! How's it going today?",
            mention: "Yeah, what's up?",
            ambient: "Just had a random thought...",
            general: "Interesting! Tell me more about that.",
            keywords: "That sounds cool, what else?"
        };
        
        return `${bot.avatar} ${fallbacks[context] || fallbacks.general}`;
    }
}

export default AIBotManager;
