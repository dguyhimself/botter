require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

// --- DATABASE SCHEMA ---
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB error:', err));

const userSchema = new mongoose.Schema({
    telegramId: { type: Number, required: true, unique: true },
    firstName: String,
    username: String,
    registrationStep: { type: String, default: 'completed' }, // tracks registration progress
    profile: {
        gender: String,
        age: String,
        province: String,
        job: String,
        purpose: String,
        photoId: String
    },
    status: { type: String, default: 'idle' }, // idle, searching, chatting
    partnerId: Number
});

const User = mongoose.model('User', userSchema);

// --- INITIALIZE BOT ---
const bot = new Telegraf(BOT_TOKEN);

// --- CONSTANTS & KEYBOARDS ---
const PROVINCES = ['Kabul', 'Herat', 'Kandahar', 'Balkh', 'Nangarhar', 'Bamyan', 'Other'];
const JOBS = ['Worker', 'Personal Business', 'Unemployed', 'Student'];
const PURPOSES = ['For Fun', 'Finding a Friend', 'Marriage', 'Just Chat'];

// Helper to get Main Menu
const getMainMenu = () => {
    return Markup.keyboard([
        ['🎲 Connect to Stranger'],
        ['👤 My Profile', '✏️ Edit Profile']
    ]).resize();
};

// --- MIDDLEWARE: GET USER ---
bot.use(async (ctx, next) => {
    if (ctx.chat.type !== 'private') return;
    
    let user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) {
        user = new User({
            telegramId: ctx.from.id,
            firstName: ctx.from.first_name,
            username: ctx.from.username,
            registrationStep: 'gender' // Start registration immediately for new users
        });
        await user.save();
    }
    ctx.user = user;
    return next();
});

// --- COMMANDS ---

bot.start(async (ctx) => {
    if (ctx.user.registrationStep !== 'completed') {
        return startRegistration(ctx);
    }
    ctx.reply('Welcome back to Afghan Connect! 👋\nSelect an option below:', getMainMenu());
});

// --- REGISTRATION LOGIC ---

async function startRegistration(ctx) {
    ctx.user.registrationStep = 'gender';
    await ctx.user.save();
    ctx.reply('Welcome! Let\'s set up your profile first.\n\nWhat is your Gender?', 
        Markup.keyboard(['Male 👦', 'Female 👧']).oneTime().resize());
}

// Handle Text & Photo Inputs
bot.on(['text', 'photo'], async (ctx, next) => {
    const user = ctx.user;

    // 1. IF CHATTING - Relay Message
    if (user.status === 'chatting' && user.partnerId) {
        try {
            // Forward everything (text, photo, sticker, voice) to partner
            await ctx.copyMessage(user.partnerId); 
            return;
        } catch (error) {
            // If partner blocked bot
            await endChat(ctx.from.id, user.partnerId, ctx);
            return;
        }
    }

    // 2. IF REGISTERING - Handle Steps
    if (user.registrationStep !== 'completed') {
        const text = ctx.message.text;

        switch (user.registrationStep) {
            case 'gender':
                if (!['Male 👦', 'Female 👧'].includes(text)) return ctx.reply('Please verify using the buttons.');
                user.profile.gender = text;
                user.registrationStep = 'age';
                await user.save();
                return ctx.reply('How old are you? (Type a number, e.g., 22)', Markup.removeKeyboard());

            case 'age':
                if (isNaN(text) || text < 10 || text > 99) return ctx.reply('Please enter a valid age (10-99).');
                user.profile.age = text;
                user.registrationStep = 'province';
                await user.save();
                return ctx.reply('Which province are you from?', Markup.keyboard(PROVINCES).chunk(2).resize());

            case 'province':
                if (!PROVINCES.includes(text)) return ctx.reply('Please select from the buttons.');
                user.profile.province = text;
                user.registrationStep = 'job';
                await user.save();
                return ctx.reply('What is your job?', Markup.keyboard(JOBS).chunk(2).resize());

            case 'job':
                if (!JOBS.includes(text)) return ctx.reply('Please select from the buttons.');
                user.profile.job = text;
                user.registrationStep = 'purpose';
                await user.save();
                return ctx.reply('Why are you here?', Markup.keyboard(PURPOSES).chunk(2).resize());

            case 'purpose':
                if (!PURPOSES.includes(text)) return ctx.reply('Please select from the buttons.');
                user.profile.purpose = text;
                user.registrationStep = 'photo';
                await user.save();
                return ctx.reply('Finally, upload a profile picture 📸.', Markup.removeKeyboard());

            case 'photo':
                if (!ctx.message.photo) return ctx.reply('Please send a photo.');
                // Get the highest quality photo ID
                const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
                user.profile.photoId = photoId;
                user.registrationStep = 'completed';
                await user.save();
                return ctx.reply('✅ Profile Setup Complete! You can now start chatting.', getMainMenu());
        }
    }

    // 3. IF IDLE - Handle Menu Commands
    next();
});

// --- MENU HANDLERS ---

bot.hears('✏️ Edit Profile', (ctx) => startRegistration(ctx));

bot.hears('👤 My Profile', async (ctx) => {
    const p = ctx.user.profile;
    const caption = `👤 **My Profile**\n\n` +
                    `👦 Gender: ${p.gender}\n` +
                    `🎂 Age: ${p.age}\n` +
                    `📍 Location: ${p.province}\n` +
                    `💼 Job: ${p.job}\n` +
                    `🔎 Looking for: ${p.purpose}`;
    
    if (p.photoId) {
        await ctx.replyWithPhoto(p.photoId, { caption: caption, parse_mode: 'Markdown' });
    } else {
        await ctx.reply(caption, { parse_mode: 'Markdown' });
    }
});

bot.hears('🎲 Connect to Stranger', async (ctx) => {
    if (ctx.user.status !== 'idle') return ctx.reply('You are already searching or chatting.');

    // 1. Check if there is someone else searching
    const partner = await User.findOne({ 
        status: 'searching', 
        telegramId: { $ne: ctx.user.telegramId } // Not myself
    });

    if (partner) {
        // MATCH FOUND!
        
        // Update Current User
        ctx.user.status = 'chatting';
        ctx.user.partnerId = partner.telegramId;
        await ctx.user.save();

        // Update Partner
        partner.status = 'chatting';
        partner.partnerId = ctx.user.telegramId;
        await partner.save();

        // Send Profiles to each other
        await sendMatchMessage(ctx, ctx.user, partner); // Send partner profile to user
        await sendMatchMessage(ctx, partner, ctx.user); // Send user profile to partner
        
    } else {
        // NO MATCH, ADD TO QUEUE
        ctx.user.status = 'searching';
        await ctx.user.save();
        ctx.reply('🔎 Searching for a user... Please wait.', Markup.keyboard([['❌ Stop Searching']]).resize());
    }
});

bot.hears('❌ Stop Searching', async (ctx) => {
    if (ctx.user.status === 'searching') {
        ctx.user.status = 'idle';
        await ctx.user.save();
        ctx.reply('Search stopped.', getMainMenu());
    }
});

bot.command('end', async (ctx) => {
    if (ctx.user.status === 'chatting') {
        await endChat(ctx.user.telegramId, ctx.user.partnerId, ctx);
    } else {
        ctx.reply('You are not in a chat.');
    }
});

// --- HELPERS ---

async function sendMatchMessage(ctx, recipient, profileData) {
    const p = profileData.profile;
    const msg = `🔔 **User Found!**\n\n` +
                `Gender: ${p.gender}\nAge: ${p.age}\nLoc: ${p.province}\nJob: ${p.job}\nGoal: ${p.purpose}\n\n` +
                `_Say Hello! (Type /end to stop)_`;
    
    try {
        if (p.photoId) {
            await ctx.telegram.sendPhoto(recipient.telegramId, p.photoId, { caption: msg, parse_mode: 'Markdown' });
        } else {
            await ctx.telegram.sendMessage(recipient.telegramId, msg, { parse_mode: 'Markdown' });
        }
    } catch (e) {
        console.log('Error sending match msg', e);
    }
}

async function endChat(userId1, userId2, ctx) {
    // Reset User 1
    await User.updateOne({ telegramId: userId1 }, { status: 'idle', partnerId: null });
    // Reset User 2
    await User.updateOne({ telegramId: userId2 }, { status: 'idle', partnerId: null });

    // Notify both
    try {
        await ctx.telegram.sendMessage(userId1, '🚫 Chat ended.', getMainMenu());
        await ctx.telegram.sendMessage(userId2, '🚫 Partner ended the chat.', getMainMenu());
    } catch (e) {
        console.log('Error sending end chat msg');
    }
}

// --- SERVER SETUP (FOR RENDER) ---
// Render requires a port to be bound to keep the service running
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // Launch Bot
    bot.launch();
    console.log('Bot started');
});

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
