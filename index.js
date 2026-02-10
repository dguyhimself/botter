import { GoogleGenAI } from "@google/genai";
import { Telegraf } from "telegraf";
import express from "express";
import "dotenv/config";

// 1. Configuration
const BOT_TOKEN = process.env.BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.DOMAIN; 

if (!BOT_TOKEN || !GEMINI_API_KEY) {
  console.error("Missing Environment Variables: Make sure BOT_TOKEN and GEMINI_API_KEY are set.");
  process.exit(1);
}

// 2. Initialize Clients
const bot = new Telegraf(BOT_TOKEN);
const app = express();
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Simple in-memory store for chat sessions
const chatSessions = new Map();

// 3. Bot Logic
bot.start((ctx) => {
  ctx.reply("Hello! I am powered by Gemini 2.0. Ask me anything!");
  chatSessions.delete(ctx.from.id);
});

bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const userMessage = ctx.message.text;

  ctx.sendChatAction("typing");

  try {
    // Get or create a chat session
    let chat = chatSessions.get(userId);
    
    if (!chat) {
        chat = ai.chats.create({
        model: "gemini-1.5-flash", // <--- TO THIS
        config: {
          temperature: 0.7,
        },
        history: [
          {
            role: "user",
            parts: [{ text: "You are a helpful and concise Telegram assistant." }],
          },
          {
            role: "model",
            parts: [{ text: "Understood. I will help you with whatever you need." }],
          },
        ],
      });
      chatSessions.set(userId, chat);
    }

    // Send message using the new SDK syntax (uses 'message' not 'content')
    const result = await chat.sendMessage({
      message: userMessage,
    });
    
    // The new SDK returns the text directly in result.text usually
    // or sometimes we need result.response.text() depending on exact version.
    // usage: console.log(result.text);
    await ctx.reply(result.text);

  } catch (error) {
    console.error("Error generating content:", error);
    // If the session is broken/expired, delete it so the user can start over
    chatSessions.delete(userId);
    ctx.reply("Sorry, I encountered an error. Please try sending your message again.");
  }
});

// 4. Setup Webhook & Server
async function startServer() {
  if (DOMAIN) {
    const webhookPath = `/telegraf/${bot.secretPathComponent()}`;
    await bot.telegram.setWebhook(`${DOMAIN}${webhookPath}`);
    app.use(bot.webhookCallback(webhookPath));
    console.log(`Webhook set to: ${DOMAIN}${webhookPath}`);
  } else {
    console.log("No DOMAIN provided, starting in polling mode...");
    bot.launch();
  }

  app.get("/", (req, res) => res.send("Bot is alive!"));

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

// Graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
