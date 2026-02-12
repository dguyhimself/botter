require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;
const ADMIN_ID = 7786874990; // <<< تمیز: آیدی عددی خود را اینجا قرار دهید

// --- DARI TEXTS ---
const TEXTS = {
    intro: `🇦🇫 به ربات افغان کانکت خوش آمدید!\n\nاینجا میتوانید به صورت ناشناس چت کنید.\n👇 برای شروع، لطفا مشخصات خود را تکمیل کنید.`,
    main_menu_title: '🏠 منوی اصلی:',
    search_menu_title: '🧐 نوع جستجو را انتخاب کنید:',
    btn_connect: '🎲 وصل شدن به ناشناس',
    btn_profile: '👤 پروفایل من',
    btn_edit: '✏️ ویرایش پروفایل',
    btn_report: '🚩 گزارش تخلف',
    btn_back: '🔙 برگشت',
    connected: `✅ **وصل شدید!**\n\n⚠️ **قوانین:**\n۱. از ارسال لینک و آیدی خودداری کنید.\n۲. احترام متقابل را رعایت کنید.\n۳. اسپم کردن باعث مسدود شدن آیدی شما می‌شود.`,
    partner_disconnected: '🚫 طرف مقابل مکالمه را قطع کرد.',
    you_disconnected: '🚫 شما مکالمه را قطع کردید.',
    searching: '🔍 در حال جستجو... لطفا صبر کنید.',
    link_blocked: '🚫 ارسال لینک یا آیدی مجاز نیست!',
    spam_warn: '⚠️ شما به دلیل اسپم محدود شدید.',
    banned_msg: '❌ حساب شما به دلیل تخلف توسط ادمین مسدود شده است.',
};

// --- DATABASE SCHEMA ---
mongoose.connect(MONGO_URI).then(() => console.log('DB Connected'));

const userSchema = new mongoose.Schema({
    telegramId: { type: Number, required: true, unique: true },
    afId: { type: String, unique: true }, // Afghan ID: AF-XXXXXX
    displayName: String,
    regStep: { type: String, default: 'intro' },
    isEditing: { type: Boolean, default: false },
    profile: { gender: String, age: String, province: String, job: String, purpose: String, photoId: String },
    stats: { likes: { type: Number, default: 0 }, dislikes: { type: Number, default: 0 } },
    status: { type: String, default: 'idle' },
    partnerId: Number,
    // Management
    isBanned: { type: Boolean, default: false },
    muteUntil: { type: Date, default: Date.now },
    lastMsgTimestamp: { type: Number, default: 0 },
    spamScore: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);
const bot = new Telegraf(BOT_TOKEN);

// --- HELPERS ---
const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
const genAfId = () => `AF-${Math.floor(100000 + Math.random() * 900000)}`;

const getMainMenu = () => Markup.keyboard([[TEXTS.btn_connect], [TEXTS.btn_profile, TEXTS.btn_edit]]).resize();
const getChatMenu = () => Markup.keyboard([['🚫 قطع مکالمه', '📄 پروفایل طرف'], [TEXTS.btn_report]]).resize();

// --- MIDDLEWARE ---
bot.use(async (ctx, next) => {
    try {
        if (!ctx.chat || ctx.chat.type !== 'private') return;
        let user = await User.findOne({ telegramId: ctx.from.id });
        if (!user) {
            user = new User({ telegramId: ctx.from.id, afId: genAfId(), regStep: 'intro' });
            await user.save();
        }
        if (user.isBanned) return ctx.reply(TEXTS.banned_msg);
        if (user.muteUntil > Date.now()) return ctx.reply('🚫 شما موقتا محدود هستید.');

        // Spam Protection
        const now = Date.now();
        if (now - user.lastMsgTimestamp < 1200) {
            user.spamScore++;
            if (user.spamScore > 6) {
                user.muteUntil = new Date(now + 10 * 60000); // 10 min auto-mute
                await user.save();
                return ctx.reply(TEXTS.spam_warn);
            }
        } else user.spamScore = 0;
        user.lastMsgTimestamp = now;
        await user.save();

        ctx.user = user;
        return next();
    } catch (e) { console.error(e); }
});

// --- ADMIN PANEL ---
bot.command('admin', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const count = await User.countDocuments();
    ctx.reply(`👨‍✈️ **پنل مدیریت**\n\nتعداد کل کاربران: ${count}\n\nدستورات:\n\`/ban AF-ID\` - مسدود کردن\n\`/unban AF-ID\` - آزاد کردن\n\`/mute AF-ID\` - سایلنت ۲۴ ساعته\n\`/broadcast متن\` - پیام همگانی`, { parse_mode: 'Markdown' });
});

bot.command('ban', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const targetAfId = ctx.message.text.split(' ')[1];
    const target = await User.findOneAndUpdate({ afId: targetAfId }, { isBanned: true });
    ctx.reply(target ? `✅ کاربر ${targetAfId} مسدود شد.` : '❌ پیدا نشد.');
});

bot.command('unban', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const targetAfId = ctx.message.text.split(' ')[1];
    const target = await User.findOneAndUpdate({ afId: targetAfId }, { isBanned: false });
    ctx.reply(target ? `✅ کاربر ${targetAfId} آزاد شد.` : '❌ پیدا نشد.');
});

bot.command('broadcast', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const msg = ctx.message.text.replace('/broadcast ', '');
    const users = await User.find({}, 'telegramId');
    let success = 0;
    for (let u of users) {
        try { await ctx.telegram.sendMessage(u.telegramId, `📢 **اطلاعیه مدیریت:**\n\n${msg}`, { parse_mode: 'Markdown' }); success++; } catch (e) {}
    }
    ctx.reply(`✅ پیام به ${success} نفر ارسال شد.`);
});

// --- REPORT SYSTEM ---
bot.hears(TEXTS.btn_report, async (ctx) => {
    if (ctx.user.status !== 'chatting') return;
    ctx.reply('علت گزارش را انتخاب کنید:', Markup.inlineKeyboard([
        [Markup.button.callback('🔞 محتوای غیراخلاقی', `rep_porn_${ctx.user.partnerId}`)],
        [Markup.button.callback('🔗 ارسال لینک/تبلیغ', `rep_link_${ctx.user.partnerId}`)],
        [Markup.button.callback('🤬 بدرفتاری/فحاشی', `rep_abuse_${ctx.user.partnerId}`)]
    ]));
});

bot.action(/^rep_(.*)_(\d+)$/, async (ctx) => {
    const reason = ctx.match[1];
    const targetId = ctx.match[2];
    const targetUser = await User.findOne({ telegramId: targetId });
    
    await ctx.telegram.sendMessage(ADMIN_ID, `🚩 **گزارش جدید**\n\nگزارش دهنده: ${ctx.user.afId}\nمتخلف: ${targetUser.afId}\nعلت: ${reason}`);
    await ctx.answerCbQuery('گزارش شما دریافت شد و توسط مدیریت بررسی می‌شود.');
    await ctx.editMessageText('✅ گزارش ارسال شد.');
});

// --- MAIN LOGIC ---
bot.on(['text', 'photo'], async (ctx) => {
    const user = ctx.user;
    const text = ctx.message.text || "";

    if (user.status === 'chatting' && user.partnerId) {
        if (text === '🚫 قطع مکالمه') return endChat(ctx.from.id, user.partnerId, ctx);
        if (text === '📄 پروفایل طرف') {
            const partner = await User.findOne({ telegramId: user.partnerId });
            return showProfile(ctx, partner, false);
        }
        // Link Filter
        if (/(https?:\/\/|t\.me\/|@|www\.)/gi.test(text)) return ctx.reply(TEXTS.link_blocked);

        try { await ctx.copyMessage(user.partnerId); } catch (e) { await endChat(ctx.from.id, user.partnerId, ctx); }
        return;
    }

    if (user.regStep !== 'completed') return stepHandler(ctx);

    if (text === TEXTS.btn_connect) return ctx.reply(TEXTS.search_menu_title, Markup.keyboard([['🎲 جستجو شانسی'], ['👦 پسر', '👩 دختر'], [TEXTS.btn_back]]).resize());
    if (text === TEXTS.btn_profile) return showProfile(ctx, user, true);
    if (text === TEXTS.btn_edit) return ctx.reply('بخش ویرایش:', Markup.keyboard([['✏️ نام', '✏️ عکس'], ['✏️ سن', '✏️ ولایت'], ['🔙 برگشت']]).resize());
    if (text === '🎲 جستجو شانسی') return startSearch(ctx, 'random');
    if (text === '👦 پسر') return startSearch(ctx, 'boy');
    if (text === '👩 دختر') return startSearch(ctx, 'girl');
    if (text === TEXTS.btn_back || text === '🔙 برگشت') return ctx.reply(TEXTS.main_menu_title, getMainMenu());
});

// --- WIZARD HANDLER ---
async function stepHandler(ctx) {
    const user = ctx.user;
    const text = ctx.message.text;
    
    // Logic for Step Registration (Same as v7.0 but uses AF-ID for intro)
    if (user.regStep === 'intro') {
        await ctx.reply(`🆔 آیدی اختصاصی شما: **${user.afId}**`, { parse_mode: 'Markdown' });
        user.regStep = 'name'; await user.save();
        return ctx.reply(TEXTS.ask_name, Markup.removeKeyboard());
    }
    // ... rest of stepHandler logic (Gender, Age, Province, etc.)
    // Note: To keep the response concise, insert the v7.0 stepHandler logic here.
}

async function showProfile(ctx, user, isSelf) {
    const p = user.profile;
    const caption = `🎫 **پروفایل کاربری**\n🆔 آیدی: \`${user.afId}\`\n\n👤 نام: ${user.displayName}\n🚻 جنسیت: ${p.gender}\n🎂 سن: ${p.age}\n📍 ولایت: ${p.province}\n💼 شغل: ${p.job}`;
    const buttons = { inline_keyboard: [[{ text: `👍 ${user.stats.likes}`, callback_data: `like_${user.telegramId}` }, { text: `👎 ${user.stats.dislikes}`, callback_data: `dislike_${user.telegramId}` }]] };
    
    if (p.photoId) await ctx.replyWithPhoto(p.photoId, { caption, reply_markup: buttons, parse_mode: 'Markdown' });
    else await ctx.reply(caption, { reply_markup: buttons, parse_mode: 'Markdown' });
}

async function startSearch(ctx, type) {
    let filter = { status: 'searching', telegramId: { $ne: ctx.user.telegramId } };
    if (type !== 'random') filter['profile.gender'] = { $regex: type === 'boy' ? 'پسر' : 'دختر' };
    const partner = await User.findOne(filter);
    
    if (partner) {
        ctx.user.status = 'chatting'; ctx.user.partnerId = partner.telegramId;
        partner.status = 'chatting'; partner.partnerId = ctx.user.telegramId;
        await ctx.user.save(); await partner.save();
        
        await ctx.telegram.sendMessage(ctx.user.telegramId, TEXTS.connected, { reply_markup: getChatMenu().reply_markup, parse_mode: 'Markdown' });
        await ctx.telegram.sendMessage(partner.telegramId, TEXTS.connected, { reply_markup: getChatMenu().reply_markup, parse_mode: 'Markdown' });
    } else {
        ctx.user.status = 'searching'; await ctx.user.save();
        ctx.reply(TEXTS.searching, Markup.keyboard([['❌ لغو جستجو']]).resize());
    }
}

async function endChat(id1, id2, ctx) {
    await User.updateMany({ telegramId: { $in: [id1, id2] } }, { status: 'idle', partnerId: null });
    await ctx.telegram.sendMessage(id1, TEXTS.you_disconnected, getMainMenu());
    await ctx.telegram.sendMessage(id2, TEXTS.partner_disconnected, getMainMenu());
}

// --- SERVER ---
const app = express(); app.get('/', (r, s) => s.send('Afghan Enterprise v8.0'));
app.listen(PORT, () => { bot.launch(); console.log('Bot v8.0 Online'); });
