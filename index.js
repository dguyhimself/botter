require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

// --- DARI TEXTS (Cleaned up, No Asterisks) ---
const TEXTS = {
    // Intro
    intro: `🇦🇫 به ربات افغان کانکت خوش آمدید! 🇦🇫\n\n` +
           `اینجا میتوانید به صورت کاملا ناشناس با هموطنان خود صحبت کنید.\n\n` +
           `🔒 امنیت شما: اطلاعات شخصی شما محفوظ است.\n` +
           `⚡️ سرعت بالا: بدون نیاز به فیلترشکن.\n` +
           `👇 برای شروع، لطفا مشخصات خود را تکمیل کنید.`,

    // Menus
    main_menu_title: '🏠 منوی اصلی\nیکی از گزینه‌های زیر را انتخاب کنید:',
    search_menu_title: '🧐 به کی وصلت کنم؟\nنوع جستجو را انتخاب کنید:',
    edit_menu_title: '✏️ کدام بخش را ویرایش میکنید؟',

    // Buttons
    btn_connect: '🎲 وصل شدن به ناشناس',
    btn_profile: '👤 پروفایل من',
    btn_edit: '✏️ ویرایش پروفایل',
    
    // Search Buttons
    btn_search_random: '🎲 جستجو شانسی',
    btn_search_boy: '👦 جستجو پسر',
    btn_search_girl: '👩 جستجو دختر',
    btn_back: '🔙 برگشت',

    // Registration Steps
    ask_name: '📝 مرحله ۱ از ۷\n\nلطفا نام یا لقب خود را بنویسید:',
    ask_gender: '🚻 مرحله ۲ از ۷\n\nجنسیت خود را انتخاب کنید:',
    ask_age: '🎂 مرحله ۳ از ۷\n\nسن خود را انتخاب کنید:',
    ask_province: '📍 مرحله ۴ از ۷\n\nاز کدام ولایت هستید؟',
    ask_job: '💼 مرحله ۵ از ۷\n\nشغل شما چیست؟',
    ask_purpose: '🎯 مرحله ۶ از ۷\n\nهدف شما از اینجا بودن چیست؟',
    ask_photo: '📸 مرحله ۷ از ۷\n\nیک عکس برای پروفایل خود بفرستید:\n(یا دکمه "بدون عکس" را بزنید)',
    
    // Chat Status
    searching_random: '🔍 در حال جستجوی شانسی... لطفا صبر کنید.',
    searching_boy: '🔍 در حال جستجوی پسر... لطفا صبر کنید.',
    searching_girl: '🔍 در حال جستجوی دختر... لطفا صبر کنید.',
    connected: '✅ وصل شدید!\nشروع به چت کنید. سلام بدهید! 👋',
    partner_disconnected: '🚫 طرف مقابل مکالمه را قطع کرد.',
    you_disconnected: '🚫 شما مکالمه را قطع کردید.',
    
    // Notifications
    profile_viewed: '👁 طرف مقابل پروفایل شما را دید.',
    liked: '❤️ لایک کردید.',
    disliked: '💔 دیس‌لایک کردید.',
    self_vote: 'شما نمیتوانید به خودتان رای دهید.',
    saved: '✅ تغییرات ذخیره شد.',
};

// --- DATA LISTS ---
const GENDERS = ['پسر 👦', 'دختر 👧'];

// Full 34 Provinces of Afghanistan
const PROVINCES = [
    'کابل', 'هرات', 'قندهار', 'بلخ', 'ننگرهار', 'بامیان', 'غزنی', 'بدخشان', 
    'کندز', 'هلمند', 'تخار', 'پکتیا', 'پکتیکا', 'خوست', 'کنر', 'لوگر', 
    'وردک', 'پروان', 'کاپیسا', 'پنجشیر', 'لغمان', 'نورستان', 'نیمروز', 
    'فراه', 'بادغیس', 'غور', 'دایکندی', 'ارزگان', 'زابل', 'سرپل', 
    'سمنگان', 'جوزجان', 'فاریاب', 'خارج از کشور'
];

const JOBS = ['کارگر 🛠', 'شغل آزاد 💼', 'محصل 🎓', 'بیکار 🏠', 'کارمند 📝', 'داکتر 🩺', 'اینجینیر 📐'];
// Filtered Purposes
const PURPOSES = ['سرگرمی 😂', 'پیدا کردن دوست 🤝', 'درد دل 💔']; 
const AGES = Array.from({ length: 51 }, (_, i) => (i + 15).toString()); // 15 to 65

// --- DATABASE ---
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB Error:', err));

const userSchema = new mongoose.Schema({
    telegramId: { type: Number, required: true, unique: true },
    firstName: String,
    displayName: String,
    regStep: { type: String, default: 'intro' }, 
    isEditing: { type: Boolean, default: false },
    lastMsgId: Number, // To track message deletion
    profile: {
        gender: String,
        age: String,
        province: String,
        job: String,
        purpose: String,
        photoId: String
    },
    stats: {
        likes: { type: Number, default: 0 },
        dislikes: { type: Number, default: 0 }
    },
    status: { type: String, default: 'idle' }, 
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

function chunk(arr, size) {
    return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size)
    );
}

// --- HELPER: SAFE DELETE ---
// This deletes the previous bot message to keep chat clean
async function cleanLastMessage(ctx, user) {
    try {
        if (user.lastMsgId) {
            await ctx.telegram.deleteMessage(ctx.chat.id, user.lastMsgId);
            user.lastMsgId = null;
            await user.save();
        }
    } catch (e) {
        // Message might be too old or already deleted
    }
}

// --- MIDDLEWARE ---
bot.use(async (ctx, next) => {
    if (!ctx.chat || ctx.chat.type !== 'private') return;
    
    let user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) {
        user = new User({
            telegramId: ctx.from.id,
            firstName: ctx.from.first_name,
            regStep: 'intro'
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
    if (ctx.user.regStep !== 'completed') {
        ctx.user.regStep = 'intro';
        await ctx.user.save();
        await ctx.reply(TEXTS.intro, { parse_mode: 'Markdown' });
        
        setTimeout(async () => {
             ctx.user.regStep = 'name';
             const msg = await ctx.reply(TEXTS.ask_name, Markup.removeKeyboard());
             ctx.user.lastMsgId = msg.message_id; // Track message
             await ctx.user.save();
        }, 1500);
        return;
    }
    const msg = await ctx.reply(TEXTS.main_menu_title, getMainMenu());
    ctx.user.lastMsgId = msg.message_id;
    await ctx.user.save();
});

// --- ACTIONS ---
bot.action(/^(like|dislike)_(\d+)$/, async (ctx) => {
    const type = ctx.match[1];
    const targetId = parseInt(ctx.match[2]);
    if (targetId === ctx.from.id) return ctx.answerCbQuery(TEXTS.self_vote);

    const target = await User.findOne({ telegramId: targetId });
    if (!target) return ctx.answerCbQuery('Error');

    if (type === 'like') {
        target.stats.likes += 1;
        ctx.answerCbQuery(TEXTS.liked);
    } else {
        target.stats.dislikes += 1;
        ctx.answerCbQuery(TEXTS.disliked);
    }
    await target.save();

    try {
        await ctx.editMessageReplyMarkup({
            inline_keyboard: [[
                { text: `👍 ${target.stats.likes}`, callback_data: `like_${targetId}` },
                { text: `👎 ${target.stats.dislikes}`, callback_data: `dislike_${targetId}` }
            ]]
        });
    } catch (e) {} 
});

// --- MAIN HANDLER ---
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
    if (text === TEXTS.btn_connect) {
        await cleanLastMessage(ctx, user); // Remove Main Menu
        const msg = await ctx.reply(TEXTS.search_menu_title, getSearchMenu());
        user.lastMsgId = msg.message_id;
        await user.save();
        return;
    }
    
    if (text === TEXTS.btn_profile) {
        await cleanLastMessage(ctx, user);
        return showProfile(ctx, user, true);
    }

    if (text === TEXTS.btn_edit) {
        await cleanLastMessage(ctx, user);
        const msg = await ctx.reply(TEXTS.edit_menu_title, getEditMenu());
        user.lastMsgId = msg.message_id;
        await user.save();
        return;
    }

    // Search Logic
    if (text === TEXTS.btn_search_random) return startSearch(ctx, 'random');
    if (text === TEXTS.btn_search_boy) return startSearch(ctx, 'boy');
    if (text === TEXTS.btn_search_girl) return startSearch(ctx, 'girl');
    
    // Back Buttons (Clean up and go back)
    if (text === TEXTS.btn_back || text === '🔙 برگشت' || text === '❌ لغو جستجو') {
        if (user.status === 'searching') await stopSearch(ctx);
        else {
            await cleanLastMessage(ctx, user); // Remove current menu
            const msg = await ctx.reply(TEXTS.main_menu_title, getMainMenu());
            user.lastMsgId = msg.message_id;
            await user.save();
        }
        return;
    }

    // Edit Triggers (Clean up menu, show prompt)
    if (text && text.startsWith('✏️')) {
        await cleanLastMessage(ctx, user); // Remove Edit Menu
        user.isEditing = true;
        if (text.includes('نام')) user.regStep = 'name';
        if (text.includes('عکس')) user.regStep = 'photo';
        if (text.includes('سن')) user.regStep = 'age';
        if (text.includes('جنسیت')) user.regStep = 'gender';
        if (text.includes('ولایت')) user.regStep = 'province';
        if (text.includes('شغل')) user.regStep = 'job';
        if (text.includes('هدف')) user.regStep = 'purpose';
        await user.save();
        return stepHandler(ctx); // Trigger prompt immediately
    }
});

// --- STEP HANDLER (With Cleaning) ---
async function stepHandler(ctx) {
    const user = ctx.user;
    const text = ctx.message.text;
    const isEdit = user.isEditing;

    // Helper to Save Data, Clean Messages, and Prompt Next
    const saveAndNext = async (step) => {
        // Delete User's Input
        try { await ctx.deleteMessage(); } catch(e) {}
        
        // Delete Bot's Previous Question
        await cleanLastMessage(ctx, user);

        if (isEdit) {
            user.regStep = 'completed';
            user.isEditing = false;
            await user.save();
            const msg = await ctx.reply(TEXTS.saved, getEditMenu());
            user.lastMsgId = msg.message_id;
            await user.save();
        } else {
            user.regStep = step;
            await user.save();
            await promptStep(ctx, step);
        }
    };

    // INTRO
    if (user.regStep === 'intro') {
        user.regStep = 'name';
        await user.save();
        const msg = await ctx.reply(TEXTS.ask_name, Markup.removeKeyboard());
        user.lastMsgId = msg.message_id;
        await user.save();
        return;
    }

    // NAME
    if (user.regStep === 'name') {
        if (!text || text.startsWith('/')) {
            // Just prompt (if not already prompted)
            const msg = await ctx.reply(TEXTS.ask_name, Markup.removeKeyboard());
            user.lastMsgId = msg.message_id;
            await user.save();
            return;
        }
        user.displayName = text;
        return saveAndNext('gender');
    }

    // GENDER
    if (user.regStep === 'gender') {
        if (!GENDERS.includes(text)) {
             await cleanLastMessage(ctx, user); // clean old invalid
             const msg = await ctx.reply(TEXTS.ask_gender, Markup.keyboard(chunk(GENDERS, 2)).resize());
             user.lastMsgId = msg.message_id;
             await user.save();
             return;
        }
        user.profile.gender = text;
        return saveAndNext('age');
    }

    // AGE
    if (user.regStep === 'age') {
        if (!AGES.includes(text)) {
            await cleanLastMessage(ctx, user);
            const msg = await ctx.reply(TEXTS.ask_age, Markup.keyboard(chunk(AGES, 6)).resize());
            user.lastMsgId = msg.message_id;
            await user.save();
            return;
        }
        user.profile.age = text;
        return saveAndNext('province');
    }

    // PROVINCE
    if (user.regStep === 'province') {
        if (!PROVINCES.includes(text)) {
            await cleanLastMessage(ctx, user);
            const msg = await ctx.reply(TEXTS.ask_province, Markup.keyboard(chunk(PROVINCES, 3)).resize());
            user.lastMsgId = msg.message_id;
            await user.save();
            return;
        }
        user.profile.province = text;
        return saveAndNext('job');
    }

    // JOB
    if (user.regStep === 'job') {
        if (!JOBS.includes(text)) {
            await cleanLastMessage(ctx, user);
            const msg = await ctx.reply(TEXTS.ask_job, Markup.keyboard(chunk(JOBS, 2)).resize());
            user.lastMsgId = msg.message_id;
            await user.save();
            return;
        }
        user.profile.job = text;
        return saveAndNext('purpose');
    }

    // PURPOSE
    if (user.regStep === 'purpose') {
        if (!PURPOSES.includes(text)) {
            await cleanLastMessage(ctx, user);
            const msg = await ctx.reply(TEXTS.ask_purpose, Markup.keyboard(chunk(PURPOSES, 2)).resize());
            user.lastMsgId = msg.message_id;
            await user.save();
            return;
        }
        user.profile.purpose = text;
        return saveAndNext('photo');
    }

    // PHOTO
    if (user.regStep === 'photo') {
        if (!ctx.message.photo && text !== 'بدون عکس') {
            await cleanLastMessage(ctx, user);
            const msg = await ctx.reply(TEXTS.ask_photo, Markup.keyboard([['بدون عکس']]).resize());
            user.lastMsgId = msg.message_id;
            await user.save();
            return;
        }
        
        if (ctx.message.photo) user.profile.photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        else user.profile.photoId = null;

        // Finalize
        try { await ctx.deleteMessage(); } catch(e) {}
        await cleanLastMessage(ctx, user);

        user.regStep = 'completed';
        user.isEditing = false;
        await user.save();
        const msg = await ctx.reply('🎉 پروفایل تکمیل شد! حالا میتوانید چت کنید.', getMainMenu());
        user.lastMsgId = msg.message_id;
        await user.save();
    }
}

async function promptStep(ctx, step) {
    let msg;
    if (step === 'gender') msg = await ctx.reply(TEXTS.ask_gender, Markup.keyboard(chunk(GENDERS, 2)).resize());
    if (step === 'age') msg = await ctx.reply(TEXTS.ask_age, Markup.keyboard(chunk(AGES, 6)).resize());
    if (step === 'province') msg = await ctx.reply(TEXTS.ask_province, Markup.keyboard(chunk(PROVINCES, 3)).resize());
    if (step === 'job') msg = await ctx.reply(TEXTS.ask_job, Markup.keyboard(chunk(JOBS, 2)).resize());
    if (step === 'purpose') msg = await ctx.reply(TEXTS.ask_purpose, Markup.keyboard(chunk(PURPOSES, 2)).resize());
    if (step === 'photo') msg = await ctx.reply(TEXTS.ask_photo, Markup.keyboard([['بدون عکس']]).resize());
    
    if (msg) {
        ctx.user.lastMsgId = msg.message_id;
        await ctx.user.save();
    }
}

// --- SHOW PROFILE ---
async function showProfile(ctx, user, isSelf) {
    const p = user.profile;
    const name = user.displayName || 'بی‌نام';
    
    // Clean text without stats
    const caption = `🎫 پروفایل کاربری\n\n` +
                    `👤 نام: ${name}\n` +
                    `🚻 جنسیت: ${p.gender}\n` +
                    `🎂 سن: ${p.age}\n` +
                    `📍 ولایت: ${p.province}\n` +
                    `💼 شغل: ${p.job}\n` +
                    `🎯 هدف: ${p.purpose}`;

    const buttons = {
        inline_keyboard: [[
            { text: `👍 ${user.stats.likes}`, callback_data: `like_${user.telegramId}` },
            { text: `👎 ${user.stats.dislikes}`, callback_data: `dislike_${user.telegramId}` }
        ]]
    };

    let msg;
    if (p.photoId) {
        msg = await ctx.replyWithPhoto(p.photoId, { caption: caption, reply_markup: buttons });
    } else {
        msg = await ctx.reply(caption, { reply_markup: buttons });
    }
    
    // Save Msg ID so we can delete it if they click "Back" (You can implement logic for this later)
    // For now we just leave the profile visible
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

// --- SEARCH ---
async function startSearch(ctx, type) {
    await cleanLastMessage(ctx, ctx.user); // Remove search menu
    
    if (ctx.user.status !== 'idle') return ctx.reply('شما در حال جستجو یا چت هستید.');

    let filter = { status: 'searching', telegramId: { $ne: ctx.user.telegramId } };
    let msgText = TEXTS.searching_random;

    if (type === 'boy') {
        filter['profile.gender'] = { $regex: 'پسر' };
        msgText = TEXTS.searching_boy;
    } else if (type === 'girl') {
        filter['profile.gender'] = { $regex: 'دختر' };
        msgText = TEXTS.searching_girl;
    }

    const partner = await User.findOne(filter);

    if (partner) {
        ctx.user.status = 'chatting';
        ctx.user.partnerId = partner.telegramId;
        partner.status = 'chatting';
        partner.partnerId = ctx.user.telegramId;

        await ctx.user.save();
        await partner.save();

        await ctx.telegram.sendMessage(ctx.user.telegramId, TEXTS.connected, getChatMenu());
        await ctx.telegram.sendMessage(partner.telegramId, TEXTS.connected, getChatMenu());
    } else {
        ctx.user.status = 'searching';
        ctx.user.searchType = type;
        const msg = await ctx.reply(msgText, Markup.keyboard([['❌ لغو جستجو']]).resize());
        ctx.user.lastMsgId = msg.message_id;
        await ctx.user.save();
    }
}

async function stopSearch(ctx) {
    await cleanLastMessage(ctx, ctx.user);
    ctx.user.status = 'idle';
    await ctx.user.save();
    const msg = await ctx.reply('جستجو متوقف شد.', getMainMenu());
    ctx.user.lastMsgId = msg.message_id;
    await ctx.user.save();
}

async function endChat(id1, id2, ctx) {
    await User.updateOne({ telegramId: id1 }, { status: 'idle', partnerId: null });
    await User.updateOne({ telegramId: id2 }, { status: 'idle', partnerId: null });
    
    // We don't track message IDs for disconnect messages to keep it simple, 
    // but they will push the menu down which is fine.
    try {
        await ctx.telegram.sendMessage(id1, TEXTS.you_disconnected, getMainMenu());
        await ctx.telegram.sendMessage(id2, TEXTS.partner_disconnected, getMainMenu());
    } catch (e) {}
}

// --- SERVER ---
const app = express();
app.get('/', (req, res) => res.send('Afghan Bot V5 Running'));
app.listen(PORT, () => {
    bot.launch();
    console.log('Bot V5 Started');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
