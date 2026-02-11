require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

// --- DARI TEXTS & MESSAGES ---
const TEXTS = {
    // Intro
    intro: `🇦🇫 **به ربات افغان کانکت خوش آمدید!** 🇦🇫\n\n` +
           `اینجا میتوانید به صورت **کاملا ناشناس** با هموطنان خود صحبت کنید، دوست پیدا کنید و سرگرم شوید.\n\n` +
           `🔒 **امنیت شما:** اطلاعات شخصی شما (شماره و آیدی) محفوظ است.\n` +
           `⚡️ **سرعت بالا:** بدون نیاز به فیلترشکن سنگین.\n` +
           `🖼 **پروفایل:** قابلیت ساخت پروفایل حرفه ای.\n\n` +
           `👇 برای شروع، لطفا مشخصات خود را تکمیل کنید.`,

    // Menus
    main_menu_title: '🏠 **منوی اصلی**\nیکی از گزینه‌های زیر را انتخاب کنید:',
    search_menu_title: '🧐 **به کی وصلت کنم؟**\nنوع جستجو را انتخاب کنید:',
    
    // Buttons
    btn_connect: '🎲 وصل شدن به ناشناس',
    btn_profile: '👤 پروفایل من',
    btn_edit: '✏️ ویرایش پروفایل',
    
    // Search Buttons
    btn_search_random: '🎲 جستجو شانسی',
    btn_search_boy: '👦 جستجو پسر',
    btn_search_girl: '👩 جستجو دختر',
    btn_back: '🔙 برگشت',

    // Registration
    ask_name: '📝 **مرحله ۱ از ۷**\n\nلطفا **نام** یا **لقب** خود را بنویسید:',
    ask_gender: '🚻 **مرحله ۲ از ۷**\n\nجنسیت خود را انتخاب کنید:',
    ask_age: '🎂 **مرحله ۳ از ۷**\n\nسن خود را انتخاب کنید:',
    ask_province: '📍 **مرحله ۴ از ۷**\n\nاز کدام ولایت هستید؟',
    ask_job: '💼 **مرحله ۵ از ۷**\n\nشغل شما چیست؟',
    ask_purpose: '🎯 **مرحله ۶ از ۷**\n\nهدف شما از اینجا بودن چیست؟',
    ask_photo: '📸 **مرحله ۷ از ۷**\n\nیک عکس برای پروفایل خود بفرستید:\n(یا دکمه "بدون عکس" را بزنید)',
    
    // Chat Status
    searching_random: '🔍 در حال جستجوی **شانسی**... لطفا صبر کنید.',
    searching_boy: '🔍 در حال جستجوی **پسر**... لطفا صبر کنید.',
    searching_girl: '🔍 در حال جستجوی **دختر**... لطفا صبر کنید.',
    connected: '✅ **وصل شدید!**\nشروع به چت کنید. سلام بدهید! 👋',
    partner_disconnected: '🚫 طرف مقابل مکالمه را قطع کرد.',
    you_disconnected: '🚫 شما مکالمه را قطع کردید.',
    not_found: '😔 کاربری با این مشخصات پیدا نشد. لطفا "جستجو شانسی" را امتحان کنید.',
    
    // Notifications
    profile_viewed: '👁 طرف مقابل پروفایل شما را دید.',
    liked: '❤️ لایک کردید.',
    disliked: '💔 دیس‌لایک کردید.',
    self_vote: 'شما نمیتوانید به خودتان رای دهید.',
};

// Data Lists
const GENDERS = ['پسر 👦', 'دختر 👧'];
const PROVINCES = ['کابل', 'هرات', 'قندهار', 'بلخ', 'ننگرهار', 'بامیان', 'غزنی', 'بدخشان', 'کندز', 'خارج از کشور', 'دیگر'];
const JOBS = ['کارگر 🛠', 'شغل آزاد 💼', 'محصل 🎓', 'بیکار 🏠', 'کارمند 📝', 'داکتر 🩺', 'اینجینیر 📐'];
const PURPOSES = ['سرگرمی 😂', 'پیدا کردن دوست 🤝', 'ازدواج 💍', 'چت کردن 💬', 'درد دل 💔'];
const AGES = Array.from({ length: 51 }, (_, i) => (i + 15).toString()); // 15 to 65

// --- DATABASE ---
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB Error:', err));

const userSchema = new mongoose.Schema({
    telegramId: { type: Number, required: true, unique: true },
    firstName: String,
    displayName: String,
    
    // Registration
    regStep: { type: String, default: 'intro' }, // Starts at intro
    isEditing: { type: Boolean, default: false },
    
    // Profile Data
    profile: {
        gender: String,
        age: String,
        province: String,
        job: String,
        purpose: String,
        photoId: String
    },
    
    // Stats
    stats: {
        likes: { type: Number, default: 0 },
        dislikes: { type: Number, default: 0 }
    },
    
    // Chat State
    status: { type: String, default: 'idle' }, // idle, searching
    searchType: { type: String, default: 'random' }, // random, boy, girl
    partnerId: Number
});

const User = mongoose.model('User', userSchema);

// --- BOT SETUP ---
const bot = new Telegraf(BOT_TOKEN);

// --- KEYBOARDS ---
const getMainMenu = () => Markup.keyboard([
    [TEXTS.btn_connect],
    [TEXTS.btn_profile, TEXTS.btn_edit]
]).resize();

const getSearchMenu = () => Markup.keyboard([
    [TEXTS.btn_search_random],
    [TEXTS.btn_search_boy, TEXTS.btn_search_girl],
    [TEXTS.btn_back]
]).resize();

const getChatMenu = () => Markup.keyboard([
    ['🚫 قطع مکالمه', '📄 مشاهده پروفایل طرف']
]).resize();

const getEditMenu = () => Markup.keyboard([
    ['✏️ نام', '✏️ عکس'],
    ['✏️ سن', '✏️ جنسیت'],
    ['✏️ ولایت', '✏️ شغل'],
    ['✏️ هدف', '🔙 برگشت']
]).resize();

// Chunk helper for grids
function chunk(arr, size) {
    return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size)
    );
}

// --- MIDDLEWARE ---
bot.use(async (ctx, next) => {
    if (!ctx.chat || ctx.chat.type !== 'private') return;
    
    let user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) {
        user = new User({
            telegramId: ctx.from.id,
            firstName: ctx.from.first_name,
            regStep: 'intro' // First time user
        });
        await user.save();
    }
    ctx.user = user;
    return next();
});

// --- COMMANDS ---

bot.command('reset', async (ctx) => {
    await User.deleteOne({ telegramId: ctx.from.id });
    ctx.reply('🔄 حساب شما پاک شد. /start را بزنید.', Markup.removeKeyboard());
});

bot.start(async (ctx) => {
    // If user is new or incomplete
    if (ctx.user.regStep !== 'completed') {
        ctx.user.regStep = 'intro';
        await ctx.user.save();
        
        // 1. Send Intro Message
        await ctx.reply(TEXTS.intro, { parse_mode: 'Markdown' });
        
        // 2. Short delay then ask Name
        setTimeout(async () => {
             ctx.user.regStep = 'name';
             await ctx.user.save();
             await ctx.reply(TEXTS.ask_name, Markup.removeKeyboard());
        }, 1500);
        return;
    }
    
    ctx.reply(TEXTS.main_menu_title, getMainMenu());
});

// --- ACTIONS (LIKE/DISLIKE) ---
bot.action(/^(like|dislike)_(\d+)$/, async (ctx) => {
    const type = ctx.match[1];
    const targetId = parseInt(ctx.match[2]);

    if (targetId === ctx.from.id) return ctx.answerCbQuery(TEXTS.self_vote);

    const target = await User.findOne({ telegramId: targetId });
    if (!target) return ctx.answerCbQuery('User not found');

    if (type === 'like') {
        target.stats.likes += 1;
        ctx.answerCbQuery(TEXTS.liked);
    } else {
        target.stats.dislikes += 1;
        ctx.answerCbQuery(TEXTS.disliked);
    }
    await target.save();

    // Update Buttons Live
    try {
        await ctx.editMessageReplyMarkup({
            inline_keyboard: [[
                { text: `👍 ${target.stats.likes}`, callback_data: `like_${targetId}` },
                { text: `👎 ${target.stats.dislikes}`, callback_data: `dislike_${targetId}` }
            ]]
        });
    } catch (e) {} // Prevent error if count didn't change visually
});

// --- TEXT HANDLER ---
bot.on(['text', 'photo'], async (ctx) => {
    const user = ctx.user;
    const text = ctx.message.text;

    // 1. CHATTING
    if (user.status === 'chatting' && user.partnerId) {
        if (text === '🚫 قطع مکالمه') return endChat(ctx.from.id, user.partnerId, ctx);
        if (text === '📄 مشاهده پروفایل طرف') return showPartnerProfile(ctx, user.partnerId);
        
        try { await ctx.copyMessage(user.partnerId); } 
        catch (e) { await endChat(ctx.from.id, user.partnerId, ctx); }
        return;
    }

    // 2. REGISTRATION
    if (user.regStep !== 'completed') return stepHandler(ctx);

    // 3. MENUS
    // Main Menu
    if (text === TEXTS.btn_connect) {
        return ctx.reply(TEXTS.search_menu_title, getSearchMenu());
    }
    if (text === TEXTS.btn_profile) return showProfile(ctx, user, true);
    if (text === TEXTS.btn_edit) return ctx.reply('بخش مورد نظر را انتخاب کنید:', getEditMenu());

    // Search Menu
    if (text === TEXTS.btn_search_random) return startSearch(ctx, 'random');
    if (text === TEXTS.btn_search_boy) return startSearch(ctx, 'boy');
    if (text === TEXTS.btn_search_girl) return startSearch(ctx, 'girl');
    if (text === TEXTS.btn_back) return ctx.reply(TEXTS.main_menu_title, getMainMenu());
    if (text === '❌ لغو جستجو') return stopSearch(ctx);

    // Edit Menu
    if (text === '🔙 برگشت') return ctx.reply(TEXTS.main_menu_title, getMainMenu());
    if (text && text.startsWith('✏️')) {
        user.isEditing = true;
        if (text.includes('نام')) user.regStep = 'name';
        if (text.includes('عکس')) user.regStep = 'photo';
        if (text.includes('سن')) user.regStep = 'age';
        if (text.includes('جنسیت')) user.regStep = 'gender';
        if (text.includes('ولایت')) user.regStep = 'province';
        if (text.includes('شغل')) user.regStep = 'job';
        if (text.includes('هدف')) user.regStep = 'purpose';
        await user.save();
        return stepHandler(ctx);
    }
});

// --- STEP HANDLER (REGISTRATION) ---
async function stepHandler(ctx) {
    const user = ctx.user;
    const text = ctx.message.text;
    const isEdit = user.isEditing;

    const saveAndNext = async (step) => {
        if (isEdit) {
            user.regStep = 'completed';
            user.isEditing = false;
            await user.save();
            ctx.reply('✅ تغییرات ذخیره شد.', getEditMenu());
        } else {
            user.regStep = step;
            await user.save();
            promptStep(ctx, step);
        }
    };

    if (user.regStep === 'intro') {
        // Just in case they get stuck here
        user.regStep = 'name';
        await user.save();
        return ctx.reply(TEXTS.ask_name, Markup.removeKeyboard());
    }

    if (user.regStep === 'name') {
        if (!text || text.startsWith('/')) return ctx.reply(TEXTS.ask_name);
        user.displayName = text;
        return saveAndNext('gender');
    }

    if (user.regStep === 'gender') {
        if (!GENDERS.includes(text)) return ctx.reply(TEXTS.ask_gender, Markup.keyboard(chunk(GENDERS, 2)).resize());
        user.profile.gender = text;
        return saveAndNext('age');
    }

    if (user.regStep === 'age') {
        if (!AGES.includes(text)) return ctx.reply(TEXTS.ask_age, Markup.keyboard(chunk(AGES, 6)).resize());
        user.profile.age = text;
        return saveAndNext('province');
    }

    if (user.regStep === 'province') {
        if (!PROVINCES.includes(text)) return ctx.reply(TEXTS.ask_province, Markup.keyboard(chunk(PROVINCES, 3)).resize());
        user.profile.province = text;
        return saveAndNext('job');
    }

    if (user.regStep === 'job') {
        if (!JOBS.includes(text)) return ctx.reply(TEXTS.ask_job, Markup.keyboard(chunk(JOBS, 2)).resize());
        user.profile.job = text;
        return saveAndNext('purpose');
    }

    if (user.regStep === 'purpose') {
        if (!PURPOSES.includes(text)) return ctx.reply(TEXTS.ask_purpose, Markup.keyboard(chunk(PURPOSES, 2)).resize());
        user.profile.purpose = text;
        return saveAndNext('photo');
    }

    if (user.regStep === 'photo') {
        if (!ctx.message.photo && text !== 'بدون عکس') return ctx.reply(TEXTS.ask_photo, Markup.keyboard([['بدون عکس']]).resize());
        
        if (ctx.message.photo) user.profile.photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        else user.profile.photoId = null;

        user.regStep = 'completed';
        user.isEditing = false;
        await user.save();
        ctx.reply('🎉 پروفایل تکمیل شد! حالا میتوانید چت کنید.', getMainMenu());
    }
}

async function promptStep(ctx, step) {
    if (step === 'gender') ctx.reply(TEXTS.ask_gender, Markup.keyboard(chunk(GENDERS, 2)).resize());
    if (step === 'age') ctx.reply(TEXTS.ask_age, Markup.keyboard(chunk(AGES, 6)).resize());
    if (step === 'province') ctx.reply(TEXTS.ask_province, Markup.keyboard(chunk(PROVINCES, 3)).resize());
    if (step === 'job') ctx.reply(TEXTS.ask_job, Markup.keyboard(chunk(JOBS, 2)).resize());
    if (step === 'purpose') ctx.reply(TEXTS.ask_purpose, Markup.keyboard(chunk(PURPOSES, 2)).resize());
    if (step === 'photo') ctx.reply(TEXTS.ask_photo, Markup.keyboard([['بدون عکس']]).resize());
}

// --- PROFILE DISPLAY (FIXED BUTTONS) ---
async function showProfile(ctx, user, isSelf) {
    const p = user.profile;
    const name = user.displayName || 'بی‌نام';
    
    // Formatting Icons based on gender
    const genderIcon = p.gender.includes('پسر') ? '👦' : '👧';
    
    const caption = `🎫 **پروفایل کاربری**\n\n` +
                    `👤 **نام:** ${name}\n` +
                    `🚻 **جنسیت:** ${p.gender}\n` +
                    `🎂 **سن:** ${p.age}\n` +
                    `📍 **ولایت:** ${p.province}\n` +
                    `💼 **شغل:** ${p.job}\n` +
                    `🎯 **هدف:** ${p.purpose}\n\n` +
                    `❤️ ${user.stats.likes}   |   💔 ${user.stats.dislikes}`;

    // Define Buttons Explicitly
    const buttons = {
        inline_keyboard: [[
            { text: `👍 ${user.stats.likes}`, callback_data: `like_${user.telegramId}` },
            { text: `👎 ${user.stats.dislikes}`, callback_data: `dislike_${user.telegramId}` }
        ]]
    };

    if (p.photoId) {
        await ctx.replyWithPhoto(p.photoId, { 
            caption: caption, 
            parse_mode: 'Markdown',
            reply_markup: buttons 
        });
    } else {
        await ctx.reply(caption, { 
            parse_mode: 'Markdown',
            reply_markup: buttons
        });
    }
}

async function showPartnerProfile(ctx, partnerId) {
    const partner = await User.findOne({ telegramId: partnerId });
    if (partner) {
        await showProfile(ctx, partner, false);
        try { await ctx.telegram.sendMessage(partnerId, TEXTS.profile_viewed); } catch (e) {}
    } else {
        ctx.reply('خطا در دریافت پروفایل.');
    }
}

// --- ADVANCED MATCHING LOGIC ---
async function startSearch(ctx, type) {
    if (ctx.user.status !== 'idle') return ctx.reply('شما در حال جستجو یا چت هستید.');

    // Define Filter
    let filter = { 
        status: 'searching', 
        telegramId: { $ne: ctx.user.telegramId } 
    };

    if (type === 'boy') {
        filter['profile.gender'] = { $regex: 'پسر' }; // Matches 'پسر 👦'
        ctx.reply(TEXTS.searching_boy, Markup.keyboard([['❌ لغو جستجو']]).resize());
    } else if (type === 'girl') {
        filter['profile.gender'] = { $regex: 'دختر' };
        ctx.reply(TEXTS.searching_girl, Markup.keyboard([['❌ لغو جستجو']]).resize());
    } else {
        ctx.reply(TEXTS.searching_random, Markup.keyboard([['❌ لغو جستجو']]).resize());
    }

    // Try to find match
    const partner = await User.findOne(filter);

    if (partner) {
        // MATCH!
        ctx.user.status = 'chatting';
        ctx.user.partnerId = partner.telegramId;
        ctx.user.searchType = 'idle'; // Reset search type
        
        partner.status = 'chatting';
        partner.partnerId = ctx.user.telegramId;
        partner.searchType = 'idle';

        await ctx.user.save();
        await partner.save();

        await ctx.telegram.sendMessage(ctx.user.telegramId, TEXTS.connected, getChatMenu());
        await ctx.telegram.sendMessage(partner.telegramId, TEXTS.connected, getChatMenu());
    } else {
        // NO MATCH -> Add to Queue
        ctx.user.status = 'searching';
        ctx.user.searchType = type;
        await ctx.user.save();
    }
}

async function stopSearch(ctx) {
    ctx.user.status = 'idle';
    ctx.user.searchType = 'random';
    await ctx.user.save();
    ctx.reply('جستجو متوقف شد.', getMainMenu());
}

async function endChat(id1, id2, ctx) {
    await User.updateOne({ telegramId: id1 }, { status: 'idle', partnerId: null });
    await User.updateOne({ telegramId: id2 }, { status: 'idle', partnerId: null });
    try {
        await ctx.telegram.sendMessage(id1, TEXTS.you_disconnected, getMainMenu());
        await ctx.telegram.sendMessage(id2, TEXTS.partner_disconnected, getMainMenu());
    } catch (e) {}
}

// --- SERVER ---
const app = express();
app.get('/', (req, res) => res.send('Afghan Bot V4 Running'));
app.listen(PORT, () => {
    bot.launch();
    console.log('Bot V4 Started');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
