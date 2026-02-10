import { GoogleGenAI } from "@google/genai";
import { Telegraf, Markup } from "telegraf";
import express from "express";
import fetch from "node-fetch"; // Native in Node 20+, but good to have for older envs
import "dotenv/config";

// ==========================================
// 1. CONFIGURATION & VALIDATION
// ==========================================
const BOT_TOKEN = process.env.BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.DOMAIN;
const MODEL_NAME = "gemini-1.5-flash"; // Stable, fast, and supports images

if (!BOT_TOKEN || !GEMINI_API_KEY) {
  console.error("❌ CRITICAL: Missing BOT_TOKEN or GEMINI_API_KEY.");
  process.exit(1);
}

// ==========================================
// 2. INITIALIZE CLIENTS
// ==========================================
const bot = new Telegraf(BOT_TOKEN);
const app = express();
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Session Store (In-Memory)
// Note: In a production app with users > 1000, you would use Redis here.
const chatSessions = new Map();

// ==========================================
// 3. HELPER FUNCTIONS
// ==========================================

/**
 * Splits long text into chunks that fit Telegram's 4096 char limit.
 */
function splitMessage(text, limit = 4000) {
  const chunks = [];
  while (text.length > limit) {
    let chunk = text.slice(0, limit);
    const lastSpace = chunk.lastIndexOf(" ");
    if (lastSpace > 0) chunk = chunk.slice(0, lastSpace);
    chunks.push(chunk);
    text = text.slice(chunk.length);
  }
  chunks.push(text);
  return chunks;
}

/**
 * Safely sends a reply. Tries Markdown first; fails over to plain text.
 */
async function safeReply(ctx, text) {
  if (!text) return;
  const chunks = splitMessage(text);

  for (const chunk of chunks) {
    try {
      // Try sending with Markdown formatting (good for code)
      await ctx.reply(chunk, { parse_mode: "Markdown" });
    } catch (e) {
      // If Markdown fails (syntax error), send as plain text
      await ctx.reply(chunk);
    }
  }
}

/**
 * Gets or creates a Gemini Chat Session
 */
async function getChatSession(userId) {
  if (!chatSessions.has(userId)) {
    const chat = ai.chats.create({
      model: MODEL_NAME,
      config: { temperature: 0.7 },
      history: [
        {
          role: "user",
          parts: [{ text: "You are a professional, helpful, and concise AI assistant on Telegram." }],
        },
        {
          role: "model",
          parts: [{ text: "Understood. I am ready to assist you professionally." }],
        },
      ],
    });
    chatSessions.set(userId, chat);
  }
  return chatSessions.get(userId);
}

// ==========================================
// 4. BOT LOGIC & COMMANDS
// ==========================================

// --- /start Command ---
bot.start((ctx) => {
  chatSessions.delete(ctx.from.id); // Reset session on start
  const welcomeMsg = `
👋 *Hello ${ctx.from.first_name}!*

I am your professional AI Assistant powered by *${MODEL_NAME}*.

🔹 I can answer questions.
🔹 I can write code.
🔹 I can analyze photos you send me.
🔹 I remember our conversation context.

Tap the button below to clear my memory if I get confused.
  `;
  
  ctx.reply(welcomeMsg, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      Markup.button.callback("🗑️ Clear Context", "clear_history")
    ])
  });
});

// --- Button Action: Clear History ---
bot.action("clear_history", (ctx) => {
  chatSessions.delete(ctx.from.id);
  ctx.answerCbQuery("Memory cleared!");
  ctx.reply("♻️ *Conversation context has been reset.*", { parse_mode: "Markdown" });
});

// --- Text Handler ---
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const userMessage = ctx.message.text;

  // Visual feedback
  ctx.sendChatAction("typing");

  try {
    const chat = await getChatSession(userId);
    
    // Generate Response
    const result = await chat.sendMessage({ message: userMessage });
    
    // Send back to user safely
    await safeReply(ctx, result.text);

  } catch (error) {
    console.error("Text Gen Error:", error);
    handleError(ctx, error);
  }
});

// --- Photo Handler (Vision) ---
bot.on("photo", async (ctx) => {
  const userId = ctx.from.id;
  const caption = ctx.message.caption || "Describe this image detailedly.";
  
  ctx.sendChatAction("upload_photo"); // Visual feedback

  try {
    // 1. Get the file link from Telegram
    // Telegram sends multiple sizes; take the last one (highest quality)
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);

    // 2. Fetch the image as an ArrayBuffer
    const response = await fetch(fileLink);
    const arrayBuffer = await response.arrayBuffer();
    
    // 3. Convert to Base64
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    // 4. Send to Gemini (Non-streaming for simplicity with images)
    // Note: We use the generic generateContent here, not the chat session, 
    // because mixing images into text-only chat history can sometimes be tricky.
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: "user",
          parts: [
            { text: caption },
            { inlineData: { mimeType: "image/jpeg", data: base64Data } }
          ],
        },
      ],
    });

    await safeReply(ctx, result.text);

  } catch (error) {
    console.error("Vision Error:", error);
    handleError(ctx, error);
  }
});

// --- Global Error Handler Helper ---
function handleError(ctx, error) {
  // Check for Quota Limit (429)
  if (JSON.stringify(error).includes("429") || error.status === 429) {
    return ctx.reply("⚠️ *Server Busy:* I'm receiving too many messages right now. Please wait 30 seconds and try again.", { parse_mode: "Markdown" });
  }

  // Check for Safety Block
  if (JSON.stringify(error).includes("SAFETY")) {
    return ctx.reply("🛡️ *Safety Alert:* I cannot process that request as it violates safety guidelines.");
  }

  // General Error
  ctx.reply("❌ *System Error:* Something went wrong. Try using /start to reset me.", { parse_mode: "Markdown" });
}

// ==========================================
// 5. SERVER SETUP (WEBHOOK OR POLLING)
// ==========================================
async function startServer() {
  if (DOMAIN) {
    // --- Production (Webhook) ---
    const webhookPath = `/telegraf/${bot.secretPathComponent()}`;
    await bot.telegram.setWebhook(`${DOMAIN}${webhookPath}`);
    app.use(bot.webhookCallback(webhookPath));
    console.log(`🚀 Webhook active: ${DOMAIN}${webhookPath}`);
  } else {
    // --- Development (Polling) ---
    console.log("⚠️ No DOMAIN set. Starting in POLLING mode...");
    bot.launch();
  }

  // Health check route for Render
  app.get("/", (req, res) => res.send("🤖 Professional Bot is Online & Active."));

  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
}

startServer();

// Graceful Stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
