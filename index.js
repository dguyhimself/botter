require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

// --- DARI TRANSLATIONS & CONSTANTS ---
const TEXTS = {
    welcome: 'سلام! به ربات چت ناشناس افغان خوش آمدید. 🇦🇫\nبرای شروع لطفا پروفایل خود را تکمیل کنید.',
    main_menu_title: 'منوی اصلی:',
    btn_connect: '🎲 وصل شدن به ناشناس',
    btn_profile: '👤 پروفایل من',
    btn_edit: '✏️ ویرایش پروفایل',
    btn_support: '💬 پشتیبانی',
    
    // Registration Steps
    ask_name: 'لطفا نام یا لقب خود را وارد کنید:',
    ask_gender: 'جنسیت خود را انتخاب کنید:',
    ask_age: 'سن خود را انتخاب کنید:',
    ask_province: 'از کدام ولایت هستید؟',
    ask_job: 'شغل شما چیست؟',
    ask_purpose: 'هدف شما از بودن در اینجا چیست؟',
    ask_photo: 'لطفا یک عکس برای پروفایل خود ارسال کنید (یا دکمه رد کردن را بزنید):',
    
    // Chat Actions
    searching: '🔍 در حال جستجوی هم‌صحبت... لطفا صبر کنید.',
    connected: '✅ به یک نفر وصل شدید!\nالان میتوانید چت کنید.',
    partner_disconnected: '🚫 طرف مقابل مکالمه را قطع کرد.',
    you_disconnected: '🚫 شما مکالمه را قطع کردید.',
    stop_search: '❌ لغو جستجو',
    
    // Chat Buttons
    btn_disconnect: '🚫 قطع مکالمه',
    btn_view_profile: '📄 مشاهده پروفایل طرف',
    
    // Profile View
    profile_viewed: '👁 طرف مقابل پروفایل شما را مشاهده کرد.',
    
    // Validation
    error_photo: 'لطفا فقط عکس بفرستید.',
    error_text: 'لطفا از دکمه ها استفاده کنید.',
};

// Options
const GENDERS = ['پسر 👦', 'دختر 👧'];
const PROVINCES = ['کابل', 'هرات', 'قندهار', 'بلخ', 'ننگرهار', 'بامیان', 'غزنی', 'بدخشان', 'کندز', 'خارج از کشور'];
const JOBS = ['کارگر 🛠', 'شغل آزاد 💼', 'محصل 🎓', 'بیکار 🏠', 'کارمند 📝'];
const PURPOSES = ['سرگرمی 😂', 'پیدا کردن دوست 🤝', 'ازدواج 💍', 'چت کردن 💬'];

// Generate Ages 12-80
const AGES = Array.from({ length: 69 }, (_, i) => (i + 12).toString());

// --- DATABASE SCHEMA ---
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB error:', err));

const userSchema = new mongoose.Schema({
    telegramId: { type: Number, required: true, unique: true },
    firstName: String, // Telegram name
    displayName: String, // Custom name in bot
    username: String,
    
    // Registration State
    regStep: { type: String, default: 'completed' }, // 'name', 'gender', 'age', etc.
    isEditing: { type: Boolean, default: false }, // true if editing specific field
    
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

// --- HELPER FUNCTIONS ---
function chunkArray(arr, size) {
    return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size)
    );
}

// Keyboards
const getMainMenu = () => Markup.keyboard([
    [TEXTS.btn_connect],
    [TEXTS.btn_profile, TEXTS.btn_edit]
]).resize();

const getChatMenu = () => Markup.keyboard([
    [TEXTS.btn_disconnect, TEXTS.btn_view_profile]
]).resize();

const getEditMenu = () => Markup.keyboard([
    ['✏️ تغییر نام', '✏️ تغییر عکس'],
    ['✏️ تغییر سن', '✏️ تغییر جنسیت'],
    ['✏️ تغییر ولایت', '✏️ تغییر شغل'],
    ['✏️ تغییر هدف', '🔙 برگشت به منوی اصلی']
]).resize();

// --- MIDDLEWARE ---
bot.use(async (ctx, next) => {
    if (!ctx.chat || ctx.chat.type !== 'private') return;
    
    let user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) {
        user = new User({
            telegramId: ctx.from.id,
            firstName: ctx.from.first_name,
            username: ctx.from.username,
            regStep: 'name' // Start with Name
        });
        await user.save();
    }
    ctx.user = user;
    return next();
});

// --- COMMANDS ---

bot.start(async (ctx) => {
    if (ctx.user.regStep !== 'completed') {
        return stepHandler(ctx); // Continue registration
    }
    ctx.reply(TEXTS.welcome, getMainMenu());
});

// --- MAIN LOGIC HANDLER ---
bot.on(['text', 'photo'], async (ctx) => {
    const user = ctx.user;
    const text = ctx.message.text;

    // 1. IF CHATTING
    if (user.status === 'chatting' && user.partnerId) {
        // Handle Disconnect
        if (text === TEXTS.btn_disconnect) {
            return endChat(ctx.from.id, user.partnerId, ctx);
        }
        
        // Handle Show Profile
        if (text === TEXTS.btn_view_profile) {
            return showPartnerProfile(ctx, user.partnerId);
        }

        // Relay Message
        try {
            await ctx.copyMessage(user.partnerId);
        } catch (error) {
            await endChat(ctx.from.id, user.partnerId, ctx);
        }
        return;
    }

    // 2. IF REGISTERING OR EDITING
    if (user.regStep !== 'completed') {
        return stepHandler(ctx);
    }

    // 3. MAIN MENU COMMANDS
    if (text === TEXTS.btn_connect) return startSearching(ctx);
    if (text === TEXTS.btn_profile) return showMyProfile(ctx);
    if (text === TEXTS.btn_edit) {
        ctx.reply('کدام قسمت را میخواهید ویرایش کنید؟ 👇', getEditMenu());
        return;
    }
    if (text === TEXTS.stop_search) return stopSearching(ctx);

    // 4. EDIT MENU COMMANDS
    if (text === '🔙 برگشت به منوی اصلی') return ctx.reply(TEXTS.main_menu_title, getMainMenu());
    
    // Switch to Edit Mode
    if (text.startsWith('✏️')) {
        user.isEditing = true;
        if (text.includes('نام')) user.regStep = 'name';
        if (text.includes('عکس')) user.regStep = 'photo';
        if (text.includes('سن')) user.regStep = 'age';
        if (text.includes('جنسیت')) user.regStep = 'gender';
        if (text.includes('ولایت')) user.regStep = 'province';
        if (text.includes('شغل')) user.regStep = 'job';
        if (text.includes('هدف')) user.regStep = 'purpose';
        await user.save();
        return stepHandler(ctx); // Trigger the prompt immediately
    }
});

// --- WIZARD / STEP HANDLER ---
async function stepHandler(ctx) {
    const user = ctx.user;
    const text = ctx.message.text;
    const isEdit = user.isEditing;

    // Helper to finish step
    const nextStep = async (nextState) => {
        if (isEdit) {
            user.regStep = 'completed';
            user.isEditing = false;
            await user.save();
            ctx.reply('✅ تغییرات ذخیره شد.', getEditMenu());
        } else {
            user.regStep = nextState;
            await user.save();
            // Trigger next prompt
            promptForStep(ctx, nextState);
        }
    };

    // LOGIC FOR SAVING DATA
    // Note: We check if the input is valid based on the *current* step stored in DB
    
    // 1. NAME
    if (user.regStep === 'name') {
        // If this is the prompt trigger (user didn't send text yet, just started step)
        if (!text || text.startsWith('✏️') || text === '/start') {
            return ctx.reply(TEXTS.ask_name, Markup.removeKeyboard());
        }
        user.displayName = text;
        return nextStep('gender');
    }

    // 2. GENDER
    if (user.regStep === 'gender') {
        if (!GENDERS.includes(text)) {
            return ctx.reply(TEXTS.ask_gender, Markup.keyboard(chunkArray(GENDERS, 2)).resize());
        }
        user.profile.gender = text;
        return nextStep('age');
    }

    // 3. AGE
    if (user.regStep === 'age') {
        if (!AGES.includes(text)) {
            // Show Age Grid (6 buttons per row)
            return ctx.reply(TEXTS.ask_age, Markup.keyboard(chunkArray(AGES, 6)).resize());
        }
        user.profile.age = text;
        return nextStep('province');
    }

    // 4. PROVINCE
    if (user.regStep === 'province') {
        if (!PROVINCES.includes(text)) {
            return ctx.reply(TEXTS.ask_province, Markup.keyboard(chunkArray(PROVINCES, 3)).resize());
        }
        user.profile.province = text;
        return nextStep('job');
    }

    // 5. JOB
    if (user.regStep === 'job') {
        if (!JOBS.includes(text)) {
            return ctx.reply(TEXTS.ask_job, Markup.keyboard(chunkArray(JOBS, 2)).resize());
        }
        user.profile.job = text;
        return nextStep('purpose');
    }

    // 6. PURPOSE
    if (user.regStep === 'purpose') {
        if (!PURPOSES.includes(text)) {
            return ctx.reply(TEXTS.ask_purpose, Markup.keyboard(chunkArray(PURPOSES, 2)).resize());
        }
        user.profile.purpose = text;
        return nextStep('photo');
    }

    // 7. PHOTO
    if (user.regStep === 'photo') {
        // Prompt
        if (!ctx.message.photo && text !== 'بدون عکس') {
            return ctx.reply(TEXTS.ask_photo, Markup.keyboard([['بدون عکس']]).resize());
        }
        
        // Save
        if (ctx.message.photo) {
            user.profile.photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        } else if (text === 'بدون عکس') {
            user.profile.photoId = null;
        }

        if (isEdit) {
            user.regStep = 'completed';
            user.isEditing = false;
            await user.save();
            ctx.reply('✅ تغییرات ذخیره شد.', getEditMenu());
        } else {
            user.regStep = 'completed';
            await user.save();
            ctx.reply('🎉 پروفایل شما کامل شد!', getMainMenu());
        }
    }
}

// Helper to send the question for the *next* step (Used in Registration flow only)
async function promptForStep(ctx, step) {
    if (step === 'gender') ctx.reply(TEXTS.ask_gender, Markup.keyboard(chunkArray(GENDERS, 2)).resize());
    if (step === 'age') ctx.reply(TEXTS.ask_age, Markup.keyboard(chunkArray(AGES, 6)).resize());
    if (step === 'province') ctx.reply(TEXTS.ask_province, Markup.keyboard(chunkArray(PROVINCES, 3)).resize());
    if (step === 'job') ctx.reply(TEXTS.ask_job, Markup.keyboard(chunkArray(JOBS, 2)).resize());
    if (step === 'purpose') ctx.reply(TEXTS.ask_purpose, Markup.keyboard(chunkArray(PURPOSES, 2)).resize());
    if (step === 'photo') ctx.reply(TEXTS.ask_photo, Markup.keyboard([['بدون عکس']]).resize());
}

// --- PROFILE FUNCTIONS ---

async function showMyProfile(ctx) {
    const p = ctx.user.profile;
    const name = ctx.user.displayName || ctx.user.firstName;
    const caption = `👤 **پروفایل من**\n\n` +
                    `📛 نام: ${name}\n` +
                    `🚻 جنسیت: ${p.gender}\n` +
                    `🎂 سن: ${p.age}\n` +
                    `📍 ولایت: ${p.province}\n` +
                    `💼 شغل: ${p.job}\n` +
                    `🎯 هدف: ${p.purpose}`;
    
    if (p.photoId) {
        await ctx.replyWithPhoto(p.photoId, { caption: caption, parse_mode: 'Markdown' });
    } else {
        await ctx.reply(caption, { parse_mode: 'Markdown' });
    }
}

async function showPartnerProfile(ctx, partnerId) {
    const partner = await User.findOne({ telegramId: partnerId });
    if (!partner) return ctx.reply('خطا در دریافت پروفایل.');

    const p = partner.profile;
    const name = partner.displayName || 'ناشناس';
    const caption = `👤 **پروفایل هم‌صحبت شما**\n\n` +
                    `📛 نام: ${name}\n` +
                    `🚻 جنسیت: ${p.gender}\n` +
                    `🎂 سن: ${p.age}\n` +
                    `📍 ولایت: ${p.province}\n` +
                    `💼 شغل: ${p.job}\n` +
                    `🎯 هدف: ${p.purpose}`;
    
    // Send Profile to requester
    if (p.photoId) {
        await ctx.replyWithPhoto(p.photoId, { caption: caption, parse_mode: 'Markdown' });
    } else {
        await ctx.reply(caption, { parse_mode: 'Markdown' });
    }

    // Notify the partner
    try {
        await ctx.telegram.sendMessage(partnerId, TEXTS.profile_viewed);
    } catch (e) {}
}

// --- MATCHING LOGIC ---

async function startSearching(ctx) {
    if (ctx.user.status !== 'idle') return ctx.reply('شما در حال جستجو یا چت هستید.');

    // Find Partner
    const partner = await User.findOne({ 
        status: 'searching', 
        telegramId: { $ne: ctx.user.telegramId } 
    });

    if (partner) {
        // MATCH FOUND
        ctx.user.status = 'chatting';
        ctx.user.partnerId = partner.telegramId;
        await ctx.user.save();

        partner.status = 'chatting';
        partner.partnerId = ctx.user.telegramId;
        await partner.save();

        // Send "Connected" message with Chat Menu
        await ctx.telegram.sendMessage(ctx.user.telegramId, TEXTS.connected, getChatMenu());
        await ctx.telegram.sendMessage(partner.telegramId, TEXTS.connected, getChatMenu());
        
    } else {
        // NO MATCH -> QUEUE
        ctx.user.status = 'searching';
        await ctx.user.save();
        ctx.reply(TEXTS.searching, Markup.keyboard([[TEXTS.stop_search]]).resize());
    }
}

async function stopSearching(ctx) {
    if (ctx.user.status === 'searching') {
        ctx.user.status = 'idle';
        await ctx.user.save();
        ctx.reply('جستجو متوقف شد.', getMainMenu());
    }
}

async function endChat(userId1, userId2, ctx) {
    await User.updateOne({ telegramId: userId1 }, { status: 'idle', partnerId: null });
    await User.updateOne({ telegramId: userId2 }, { status: 'idle', partnerId: null });

    try {
        await ctx.telegram.sendMessage(userId1, TEXTS.you_disconnected, getMainMenu());
        await ctx.telegram.sendMessage(userId2, TEXTS.partner_disconnected, getMainMenu());
    } catch (e) {
        console.log('Error sending end chat msg');
    }
}

// --- SERVER ---
const app = express();
app.get('/', (req, res) => res.send('Afghan Bot Running'));

app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
    bot.launch();
    console.log('Bot started');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
