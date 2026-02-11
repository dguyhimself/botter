require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

// --- DARI TRANSLATIONS ---
const TEXTS = {
    welcome: 'سلام! به ربات چت ناشناس افغان خوش آمدید. 🇦🇫\nبرای شروع لطفا پروفایل خود را تکمیل کنید.',
    main_menu_title: 'منوی اصلی:',
    btn_connect: '🎲 وصل شدن به ناشناس',
    btn_profile: '👤 پروفایل من',
    btn_edit: '✏️ ویرایش پروفایل',
    
    // Registration
    ask_name: 'لطفا نام خود را وارد کنید:',
    ask_gender: 'جنسیت خود را انتخاب کنید:',
    ask_age: 'سن خود را انتخاب کنید:',
    ask_province: 'از کدام ولایت هستید؟',
    ask_job: 'شغل شما چیست؟',
    ask_purpose: 'هدف شما از بودن در اینجا چیست؟',
    ask_photo: 'لطفا یک عکس برای پروفایل خود ارسال کنید (یا دکمه "بدون عکس" را بزنید):',
    
    // Chat
    searching: '🔍 در حال جستجوی هم‌صحبت... لطفا صبر کنید.',
    connected: '✅ به یک نفر وصل شدید!\nالان میتوانید چت کنید.',
    partner_disconnected: '🚫 طرف مقابل مکالمه را قطع کرد.',
    you_disconnected: '🚫 شما مکالمه را قطع کردید.',
    stop_search: '❌ لغو جستجو',
    
    // Notifications
    profile_viewed: '👁 طرف مقابل پروفایل شما را مشاهده کرد.',
    liked: '❤️ شما پروفایل طرف مقابل را لایک کردید.',
    disliked: '💔 شما پروفایل طرف مقابل را دیس‌لایک کردید.',
    self_vote_error: 'شما نمیتوانید به خودتان رای دهید!',
    already_voted: 'شما قبلا رای داده‌اید.',
};

// Options
const GENDERS = ['پسر 👦', 'دختر 👧'];
const PROVINCES = ['کابل', 'هرات', 'قندهار', 'بلخ', 'ننگرهار', 'بامیان', 'غزنی', 'بدخشان', 'کندز', 'خارج از کشور'];
const JOBS = ['کارگر 🛠', 'شغل آزاد 💼', 'محصل 🎓', 'بیکار 🏠', 'کارمند 📝'];
const PURPOSES = ['سرگرمی 😂', 'پیدا کردن دوست 🤝', 'ازدواج 💍', 'چت کردن 💬'];
const AGES = Array.from({ length: 51 }, (_, i) => (i + 15).toString()); // 15 to 65

// --- DATABASE SCHEMA ---
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB error:', err));

const userSchema = new mongoose.Schema({
    telegramId: { type: Number, required: true, unique: true },
    firstName: String, 
    displayName: String,
    
    regStep: { type: String, default: 'name' },
    isEditing: { type: Boolean, default: false },
    
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

const getMainMenu = () => Markup.keyboard([
    [TEXTS.btn_connect],
    [TEXTS.btn_profile, TEXTS.btn_edit]
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

// --- MIDDLEWARE ---
bot.use(async (ctx, next) => {
    if (!ctx.chat || ctx.chat.type !== 'private') return;
    
    let user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) {
        user = new User({
            telegramId: ctx.from.id,
            firstName: ctx.from.first_name,
            regStep: 'name'
        });
        await user.save();
    }
    ctx.user = user;
    return next();
});

// --- COMMANDS ---

bot.command('reset', async (ctx) => {
    await User.deleteOne({ telegramId: ctx.from.id });
    ctx.reply('🔄 حساب شما با موفقیت ریست شد. دوباره /start را بزنید.', Markup.removeKeyboard());
});

bot.start(async (ctx) => {
    if (ctx.user.regStep !== 'completed') {
        return stepHandler(ctx);
    }
    ctx.reply(TEXTS.welcome, getMainMenu());
});

// --- ACTIONS (LIKE / DISLIKE) ---
bot.action(/^(like|dislike)_(\d+)$/, async (ctx) => {
    const action = ctx.match[1]; // 'like' or 'dislike'
    const targetId = parseInt(ctx.match[2]);
    const voterId = ctx.from.id;

    if (targetId === voterId) {
        return ctx.answerCbQuery(TEXTS.self_vote_error);
    }

    // Find target user to update their stats
    const targetUser = await User.findOne({ telegramId: targetId });
    if (!targetUser) return ctx.answerCbQuery('کاربر یافت نشد.');

    // Update DB
    if (action === 'like') {
        targetUser.stats.likes += 1;
        ctx.answerCbQuery(TEXTS.liked);
    } else {
        targetUser.stats.dislikes += 1;
        ctx.answerCbQuery(TEXTS.disliked);
    }
    await targetUser.save();

    // Update the buttons live to show new count
    try {
        const likeBtn = `👍 ${targetUser.stats.likes}`;
        const dislikeBtn = `👎 ${targetUser.stats.dislikes}`;
        
        await ctx.editMessageReplyMarkup({
            inline_keyboard: [[
                Markup.button.callback(likeBtn, `like_${targetId}`),
                Markup.button.callback(dislikeBtn, `dislike_${targetId}`)
            ]]
        });
    } catch (e) {
        // Ignore "message not modified" errors
    }
});

// --- MESSAGE HANDLER ---
bot.on(['text', 'photo'], async (ctx) => {
    const user = ctx.user;
    const text = ctx.message.text;

    // 1. IF CHATTING
    if (user.status === 'chatting' && user.partnerId) {
        if (text === '🚫 قطع مکالمه') return endChat(ctx.from.id, user.partnerId, ctx);
        if (text === '📄 مشاهده پروفایل طرف') return showPartnerProfile(ctx, user.partnerId);

        try {
            await ctx.copyMessage(user.partnerId);
        } catch (error) {
            await endChat(ctx.from.id, user.partnerId, ctx);
        }
        return;
    }

    // 2. REGISTRATION / EDITING
    if (user.regStep !== 'completed') return stepHandler(ctx);

    // 3. MAIN MENU
    if (text === TEXTS.btn_connect) return startSearching(ctx);
    if (text === TEXTS.btn_profile) return showProfile(ctx, user, true); // Show my own profile
    if (text === TEXTS.btn_edit) return ctx.reply('کدام بخش را ویرایش میکنید؟', getEditMenu());
    if (text === TEXTS.stop_search) return stopSearching(ctx);

    // 4. EDIT MENU
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

// --- WIZARD HANDLER ---
async function stepHandler(ctx) {
    const user = ctx.user;
    const text = ctx.message.text;
    const isEdit = user.isEditing;

    const next = async (step) => {
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

    if (user.regStep === 'name') {
        if (!text || text.startsWith('/')) return ctx.reply(TEXTS.ask_name, Markup.removeKeyboard());
        user.displayName = text;
        return next('gender');
    }

    if (user.regStep === 'gender') {
        if (!GENDERS.includes(text)) return ctx.reply(TEXTS.ask_gender, Markup.keyboard(chunkArray(GENDERS, 2)).resize());
        user.profile.gender = text;
        return next('age');
    }

    if (user.regStep === 'age') {
        if (!AGES.includes(text)) return ctx.reply(TEXTS.ask_age, Markup.keyboard(chunkArray(AGES, 6)).resize());
        user.profile.age = text;
        return next('province');
    }

    if (user.regStep === 'province') {
        if (!PROVINCES.includes(text)) return ctx.reply(TEXTS.ask_province, Markup.keyboard(chunkArray(PROVINCES, 3)).resize());
        user.profile.province = text;
        return next('job');
    }

    if (user.regStep === 'job') {
        if (!JOBS.includes(text)) return ctx.reply(TEXTS.ask_job, Markup.keyboard(chunkArray(JOBS, 2)).resize());
        user.profile.job = text;
        return next('purpose');
    }

    if (user.regStep === 'purpose') {
        if (!PURPOSES.includes(text)) return ctx.reply(TEXTS.ask_purpose, Markup.keyboard(chunkArray(PURPOSES, 2)).resize());
        user.profile.purpose = text;
        return next('photo');
    }

    if (user.regStep === 'photo') {
        if (!ctx.message.photo && text !== 'بدون عکس') return ctx.reply(TEXTS.ask_photo, Markup.keyboard([['بدون عکس']]).resize());
        
        if (ctx.message.photo) user.profile.photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        else user.profile.photoId = null;

        user.regStep = 'completed';
        user.isEditing = false;
        await user.save();
        ctx.reply('🎉 پروفایل تکمیل شد!', getMainMenu());
    }
}

async function promptStep(ctx, step) {
    if (step === 'gender') ctx.reply(TEXTS.ask_gender, Markup.keyboard(chunkArray(GENDERS, 2)).resize());
    if (step === 'age') ctx.reply(TEXTS.ask_age, Markup.keyboard(chunkArray(AGES, 6)).resize());
    if (step === 'province') ctx.reply(TEXTS.ask_province, Markup.keyboard(chunkArray(PROVINCES, 3)).resize());
    if (step === 'job') ctx.reply(TEXTS.ask_job, Markup.keyboard(chunkArray(JOBS, 2)).resize());
    if (step === 'purpose') ctx.reply(TEXTS.ask_purpose, Markup.keyboard(chunkArray(PURPOSES, 2)).resize());
    if (step === 'photo') ctx.reply(TEXTS.ask_photo, Markup.keyboard([['بدون عکس']]).resize());
}

// --- PROFILE DISPLAY WITH BUTTONS ---
async function showProfile(ctx, user, isSelf) {
    const p = user.profile;
    const name = user.displayName || 'کاربر';
    const caption = `👤 **پروفایل کاربری**\n\n` +
                    `📛 نام: ${name}\n` +
                    `🚻 جنسیت: ${p.gender}\n` +
                    `🎂 سن: ${p.age}\n` +
                    `📍 ولایت: ${p.province}\n` +
                    `💼 شغل: ${p.job}\n` +
                    `🎯 هدف: ${p.purpose}`;

    // Inline Buttons (Like/Dislike)
    const buttons = [
        Markup.button.callback(`👍 ${user.stats.likes}`, `like_${user.telegramId}`),
        Markup.button.callback(`👎 ${user.stats.dislikes}`, `dislike_${user.telegramId}`)
    ];

    const extra = {
        caption: caption,
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([buttons])
    };

    if (p.photoId) {
        await ctx.replyWithPhoto(p.photoId, extra);
    } else {
        await ctx.reply(caption, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([buttons]) });
    }
}

async function showPartnerProfile(ctx, partnerId) {
    const partner = await User.findOne({ telegramId: partnerId });
    if (!partner) return ctx.reply('خطا.');
    
    await showProfile(ctx, partner, false);
    
    try {
        await ctx.telegram.sendMessage(partnerId, TEXTS.profile_viewed);
    } catch(e) {}
}

// --- MATCHING ---
async function startSearching(ctx) {
    if (ctx.user.status !== 'idle') return ctx.reply('در حال جستجو یا مکالمه هستید.');
    
    const partner = await User.findOne({ status: 'searching', telegramId: { $ne: ctx.user.telegramId } });
    
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
        await ctx.user.save();
        ctx.reply(TEXTS.searching, Markup.keyboard([[TEXTS.stop_search]]).resize());
    }
}

async function stopSearching(ctx) {
    ctx.user.status = 'idle';
    await ctx.user.save();
    ctx.reply('توقف.', getMainMenu());
}

async function endChat(id1, id2, ctx) {
    await User.updateOne({ telegramId: id1 }, { status: 'idle', partnerId: null });
    await User.updateOne({ telegramId: id2 }, { status: 'idle', partnerId: null });
    
    try {
        await ctx.telegram.sendMessage(id1, TEXTS.you_disconnected, getMainMenu());
        await ctx.telegram.sendMessage(id2, TEXTS.partner_disconnected, getMainMenu());
    } catch(e) {}
}

// --- SERVER ---
const app = express();
app.get('/', (req, res) => res.send('Bot Running'));
app.listen(PORT, () => {
    bot.launch();
    console.log('Bot Started V3');
});
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
