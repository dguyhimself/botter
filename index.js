import { GoogleGenAI } from "@google/genai";
import { Telegraf } from "telegraf";
import express from "express";
import "dotenv/config";

// 1. Configuration
const BOT_TOKEN = process.env.BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.DOMAIN; // Your Render URL (e.g. https://my-bot.onrender.com)

if (!BOT_TOKEN || !GEMINI_API_KEY) {
  console.error("Missing Environment Variables: Make sure BOT_TOKEN and GEMINI_API_KEY are set.");
  process.exit(1);
}

// 2. Initialize Clients
const bot = new Telegraf(BOT_TOKEN);
const app = express();
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Simple in-memory store for chat sessions
// Note: This resets if the Render server restarts (common on free tier)
const chatSessions = new Map();

// 3. Bot Logic
bot.start((ctx) => {
  ctx.reply("Hello! I am powered by Gemini AI. Ask me anything!");
  // Reset history on start
  chatSessions.delete(ctx.from.id);
});

bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const userMessage = ctx.message.text;

  // Show a "typing..." status
  ctx.sendChatAction("typing");

  try {
    // Get or create a chat session for this user
    let chat = chatSessions.get(userId);
    
    if (!chat) {
      // Create a new chat session using the Gemini SDK
      chat = ai.chats.create({
        model: "gemini-2.0-flash", // Or "gemini-1.5-flash" / "gemini-1.5-pro"
        config: {
          temperature: 0.7,
        },
        history: [
          {
            role: "user",
            parts: [{ text: "You are a helpful and concise Telegram assistant." }],
          },
        ],
      });
      chatSessions.set(userId, chat);
    }

    // Generate content using the new SDK's chat method
    const result = await chat.sendMessage({
      content: userMessage,
    });
    
    // Send the response back to Telegram
    const responseText = result.text; 
    await ctx.reply(responseText);

  } catch (error) {
    console.error("Error generating content:", error);
    ctx.reply("Sorry, I had trouble thinking of a response. Try again later.");
  }
});

// 4. Setup Webhook & Server
async function startServer() {
  // If a DOMAIN is provided (Production), use Webhook
  if (DOMAIN) {
    const webhookPath = `/telegraf/${bot.secretPathComponent()}`;
    // Tell Telegram to send updates to this URL
    await bot.telegram.setWebhook(`${DOMAIN}${webhookPath}`);
    // Register the webhook callback with Express
    app.use(bot.webhookCallback(webhookPath));
    console.log(`Webhook set to: ${DOMAIN}${webhookPath}`);
  } else {
    // Local development: fallback to polling
    console.log("No DOMAIN provided, starting in polling mode...");
    bot.launch();
  }

  // Define a simple root route for health checks
  app.get("/", (req, res) => res.send("Bot is alive!"));

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

// Graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
