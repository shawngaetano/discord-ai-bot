const { Client, GatewayIntentBits, MessageActionRow, MessageButton } = require('discord.js');
const axios = require('axios');

const TOKEN = 'YOUR_DISCORD_BOT_TOKEN';
const API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const API_KEY = 'YOUR_OPENAI_API_KEY';

// Added this because long output throws errors.
const MAX_RESPONSE_LENGTH = 2000;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages, // Allows people to direct message the bot and receive responses
    ],
});

// Stores convo history 
const conversationHistory = new Map();

// Mad Libs game 
const madLibsGames = new Map();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    // Debugging console logs
    console.log(`Received message: ${message.content} from ${message.author.tag}`);

    // Ignore messages from the bot itself
    if (message.author.bot) return;

    // Check messages for bot mention
    if (message.mentions.has(client.user) || message.channel.type === 'DM') {
        const question = message.content.replace(/<@![0-9]+>/, '').trim();
        console.log(`User asked: ${question}`); // User question debugging log

        // Instead of basic ChatGPT response for harsh language, quicker response
        if (containsInappropriateContent(question)) {
            sendResponse(message.channel, 'I apologize, but I cannot respond to messages with inappropriate language.');
            return;
        }

        // Convo history for the current channel
        const channelHistory = conversationHistory.get(message.channel.id) || [];

        // Appending user message to convo history 
        channelHistory.push({ role: 'user', content: question });

        // "how many" or "how much" questions
        if (question.toLowerCase().includes('how many') || question.toLowerCase().includes('how much')) {
            // Responds with random number
            const randomNum = getRandomNumber();
            sendResponse(message.channel, `There are ${randomNum}.`);
            return;
        }

        // Handle input commands
        if (question.toLowerCase() === 'flip a coin') {
            const coinResult = flipCoin();
            sendResponse(message.channel, `I flipped a coin, and it's ${coinResult}!`);
            return;

        } else if (question.toLowerCase() === '!madlibs') {
            startMadLibs(message);
            return;
        }

        const response = await getChatGptResponse(channelHistory);

        sendResponse(message.channel, response);

        // Append bot response to convo history
        channelHistory.push({ role: 'assistant', content: response });

        // Update convo history in the map
        conversationHistory.set(message.channel.id, channelHistory);
    } else {
        // Check if channel is in a Mad Libs game
        const game = madLibsGames.get(message.channel.id);
        if (game) {
            // Append user input to the game
            game.addUserInput(message.content);
            if (game.isComplete()) {
                // If the Mad Libs game is complete, send the story
                sendResponse(message.channel, `Here's your Mad Libs story:\n${game.getStory()}`);
                // Remove the game from the list
                madLibsGames.delete(message.channel.id);
            } else {
                // Ask for the next input
                sendResponse(message.channel, `Great! Give me a ${game.getNextInputType()}:`);
            }
        }
    }
});

function containsInappropriateContent(text) {
    // List of innappropriate words // ADD INAPPROPRIATE LANGUAGE DICT. API HERE SOON
    const inappropriateWords = ['fuck', 'ratio', 'shit', 'based'];

    const lowercaseText = text.toLowerCase();

    return inappropriateWords.some((word) => lowercaseText.includes(word));
}

function flipCoin() {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    return result;
}

async function getChatGptResponse(history) {
    const headers = {
        Authorization: `Bearer ${API_KEY}`,
    };

    const data = {
        model: 'gpt-3.5-turbo',
        messages: history,
    };

    try {
        const response = await axios.post(API_ENDPOINT, data, { headers });

        // Log ChatGPT response for debugging
        console.log('ChatGPT Response:', response.data.choices[0].message.content);

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('Error making ChatGPT API request:', error);
        return 'An error occurred while fetching the response from ChatGPT.';
    }
}

function getRandomNumber() {
    return Math.floor(Math.random() * 100) + 1;
}

// Character limit tinkering, doesn't seem to work yet
function sendResponse(channel, response) {
    if (response.length <= MAX_RESPONSE_LENGTH) {
        channel.send(response);
    } else {
        // Split response into multiple messages (this does not seem to work :/)
        const chunks = splitText(response, MAX_RESPONSE_LENGTH);
        chunks.forEach((chunk) => {
            channel.send(chunk);
        });
    }
}

// Function to split text into chunks of a specified length
function splitText(text, maxLength) {
    const chunks = [];
    for (let i = 0; i < text.length; i += maxLength) {
        chunks.push(text.substring(i, i + maxLength));
    }
    return chunks;
}

// Mad Libs Game 
class MadLibsGame {
    constructor() {
        this.inputs = [];
        this.story = '';
        this.currentIndex = 0;
    }

    addUserInput(input) {
        this.inputs.push(input);
        this.currentIndex++;
    }

    isComplete() {
        return this.currentIndex >= this.inputs.length;
    }

    getNextInputType() {
        const inputTypes = ['noun', 'verb', 'adjective', 'adverb'];
        return inputTypes[this.currentIndex];
    }

    getStory() {
        // Replace placeholders in the story with user inputs
        let replacedStory = this.story;
        for (let i = 0; i < this.inputs.length;i++) {
            const placeholder = `{${i}}`;
            replacedStory = replacedStory.replace(placeholder, this.inputs[i]);
        }
        return replacedStory;
    }
}

function startMadLibs(message) {
    const game = new MadLibsGame();
    game.story = `Once upon a time, there was a {0} who loved to {1} {2}ly. One day, they decided to go on a {3} adventure.`;
    sendResponse(message.channel, `Let's play Mad Libs! Give me a ${game.getNextInputType()}:`);
    madLibsGames.set(message.channel.id, game);
}

client.login(TOKEN);