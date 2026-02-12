require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const ADMIN_ID = process.env.ADMIN_ID; // Your TG ID
const PORT = process.env.PORT || 3000;

// --- DARI TEXTS ---
const TEXTS = {
    intro: `🇦🇫 به ربات افغان کانکت خوش آمدید!\n\nاینجا میتوانید به صورت کاملا ناشناس چت کنید.\n\n👇 برای شروع، مشخصات خود را تکمیل کنید.`,
    main_menu_title: '🏠 منوی اصلی:',
    btn_connect: '🎲 وصل شدن به ناشناس',
    btn_profile: '👤 پروفایل من',
    btn_edit: '✏️ ویرایش پروفایل',
    btn_back: '🔙 برگشت',
    connected: '✅ وصل شدید! شروع به چت کنید. 👋',
    partner_disconnected: '🚫 طرف مقابل مکالمه را قطع کرد.',
    you_disconnected: '🚫 شما مکالمه را قطع کردید.',
    searching: '🔍 در حال جستجو... لطفا صبر کنید.',
    spam_warn: '⚠️ شما بیش از حد سریع پیام میفرستید! ۵ دقیقه محدود شدید.',
    link_blocked: '🚫 ارسال لینک یا آیدی مجاز نیست!',
    banned_msg: '❌ حساب شما به دلیل تخلف توسط مدیریت مسدود شده است.',
    report_sent: '✅ گزارش شما ثبت و به مدیریت ارسال شد.',
    ask_report_reason: '📝 لطفا دلیل گزارش خود را بنویسید:'
};

const PROVINCES = ['کابل', 'هرات', 'قندهار', 'بلخ', 'ننگرهار', 'هلمند', 'کندز', 'فاریاب', 'غزنی', 'پکتیا', 'جوزجان', 'تخار', 'بدخشان', 'بغلان', 'خوست', 'سمنگان', 'نیمروز', 'سرپل', 'فراه', 'کنر', 'لوگر', 'زابل', 'لغمان', 'پکتیکا', 'پنجشیر', 'پروان', 'اروزگان', 'کاپیسا', 'بامیان', 'میدان وردک', 'غور', 'دایکندی', 'نورستان', 'بادغیس', 'خارج از کشور'];
const GENDERS = ['پسر 👦', 'دختر 👧'];
const JOBS = ['کارگر 🛠', 'شغل آزاد 💼', 'محصل 🎓', 'بیکار 🏠', 'کارمند 📝', 'داکتر 🩺', 'اینجینیر 📐'];
const PURPOSES = ['سرگرمی 😂', 'پیدا کردن دوست 🤝', 'درد دل 💔'];
const AGES = Array.from({ length: 66 }, (_, i) => (i + 15).toString());

// --- DATABASE SCHEMA ---
mongoose.connect(MONGO_URI).then(() => console.log('DB Connected'));

const userSchema = new mongoose.Schema({
    telegramId: { type: Number, required: true, unique: true },
    shortId: { type: String, unique: true }, // Unique 6-digit ID
    displayName: String,
    regStep: { type: String, default: 'intro' },
    isEditing: { type: Boolean, default: false },
    profile: { gender: String, age: String, province: String, job: String, purpose: String, photoId: String },
    stats: { likes: { type: Number, default: 0 }, dislikes: { type: Number, default: 0 } },
    status: { type: String, default: 'idle' }, // idle, searching, chatting, reporting
    partnerId: Number,
    lastMsgId: Number,
    // Security & Admin
    isBanned: { type: Boolean, default: false },
    muteUntil: { type: Date, default: Date.now },
    lastMsgTimestamp: { type: Number, default: 0 },
    spamScore: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);
const bot = new Telegraf(BOT_TOKEN);

// --- HELPERS ---
const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
const getMainMenu = () => Markup.keyboard([[TEXTS.btn_connect], [TEXTS.btn_profile, TEXTS.btn_edit]]).resize();

async function cleanPrev(ctx) {
    if (ctx.user.lastMsgId) {
        try { await ctx.deleteMessage(ctx.user.lastMsgId); } catch (e) {}
        ctx.user.lastMsgId = null; await ctx.user.save();
    }
}

// Generate unique 6-digit ID
async function generateShortId() {
    let id;
    while (true) {
        id = Math.floor(100000 + Math.random() * 900000).toString();
        const exists = await User.findOne({ shortId: id });
        if (!exists) break;
    }
    return id;
}

// --- MIDDLEWARE ---
bot.use(async (ctx, next) => {
    try {
        if (!ctx.chat || ctx.chat.type !== 'private') return;
        let user = await User.findOne({ telegramId: ctx.from.id });
        if (!user) { 
            const sId = await generateShortId();
            user = new User({ telegramId: ctx.from.id, shortId: sId, regStep: 'intro' }); 
            await user.save(); 
        }
        
        if (user.isBanned) return ctx.reply(TEXTS.banned_msg);
        if (user.muteUntil > Date.now()) return ctx.reply(TEXTS.spam_warn);

        // Anti-Spam
        const now = Date.now();
        if (now - user.lastMsgTimestamp < 1500) {
            user.spamScore++;
            if (user.spamScore > 5) {
                user.muteUntil = new Date(now + 5 * 60000);
                user.spamScore = 0;
                await user.save();
                return ctx.reply(TEXTS.spam_warn);
            }
        } else { user.spamScore = 0; }
        user.lastMsgTimestamp = now;
        await user.save();

        ctx.user = user;
        return next();
    } catch (e) { console.error(e); }
});

// --- ADMIN COMMANDS ---
bot.command('admin', async (ctx) => {
    if (ctx.from.id != ADMIN_ID) return;
    ctx.reply(`🛠 پنل مدیریت:\n\n/stats - آمار کاربران\n/ban ID - مسدود کردن\n/unban ID - رفع مسدودیت\n/mute ID MIN - محدود کردن\n/unmute ID - رفع محدودیت\n/bc MESSAGE - پیام همگانی`);
});

bot.command('stats', async (ctx) => {
    if (ctx.from.id != ADMIN_ID) return;
    const total = await User.countDocuments();
    const banned = await User.countDocuments({ isBanned: true });
    ctx.reply(`📊 کل کاربران: ${total}\n🚫 مسدود شده: ${banned}`);
});

bot.command('ban', async (ctx) => {
    if (ctx.from.id != ADMIN_ID) return;
    const sId = ctx.message.text.split(' ')[1];
    const target = await User.findOneAndUpdate({ shortId: sId }, { isBanned: true });
    if (target) ctx.reply(`✅ کاربر ${sId} مسدود شد.`);
});

bot.command('unban', async (ctx) => {
    if (ctx.from.id != ADMIN_ID) return;
    const sId = ctx.message.text.split(' ')[1];
    const target = await User.findOneAndUpdate({ shortId: sId }, { isBanned: false });
    if (target) ctx.reply(`✅ کاربر ${sId} آزاد شد.`);
});

bot.command('mute', async (ctx) => {
    if (ctx.from.id != ADMIN_ID) return;
    const [_, sId, mins] = ctx.message.text.split(' ');
    const until = new Date(Date.now() + parseInt(mins) * 60000);
    const target = await User.findOneAndUpdate({ shortId: sId }, { muteUntil: until });
    if (target) ctx.reply(`✅ کاربر ${sId} برای ${mins} دقیقه محدود شد.`);
});

bot.command('bc', async (ctx) => {
    if (ctx.from.id != ADMIN_ID) return;
    const msg = ctx.message.text.replace('/bc ', '');
    const users = await User.find({});
    let count = 0;
    for (let u of users) {
        try { await ctx.telegram.sendMessage(u.telegramId, `📢 پیام مدیریت:\n\n${msg}`); count++; } catch(e){}
    }
    ctx.reply(`✅ پیام به ${count} نفر ارسال شد.`);
});

// --- LOGIC ---
bot.start(async (ctx) => {
    if (ctx.user.regStep !== 'completed') {
        ctx.user.regStep = 'intro'; await ctx.user.save();
        const m = await ctx.reply(TEXTS.intro);
        ctx.user.lastMsgId = m.message_id; await ctx.user.save();
        setTimeout(async () => {
            await cleanPrev(ctx); ctx.user.regStep = 'name'; await ctx.user.save();
            const m2 = await ctx.reply(TEXTS.ask_name, Markup.removeKeyboard());
            ctx.user.lastMsgId = m2.message_id; await ctx.user.save();
        }, 3000);
        return;
    }
    await ctx.reply(TEXTS.main_menu_title, getMainMenu());
});

bot.on(['text', 'photo'], async (ctx) => {
    const user = ctx.user;
    const text = ctx.message.text || "";

    // 1. REPORTING REASON HANDLING
    if (user.status === 'reporting' && user.partnerId) {
        const target = await User.findOne({ telegramId: user.partnerId });
        await ctx.telegram.sendMessage(ADMIN_ID, `🚩 گزارش جدید!\n\nفرستنده: ${user.shortId}\nمتخلف: ${target.shortId}\nدلیل: ${text}`);
        user.status = 'chatting'; await user.save();
        return ctx.reply(TEXTS.report_sent, Markup.keyboard([['🚫 قطع مکالمه', '📄 مشاهده پروفایل طرف', '🚩 گزارش تخلف']]).resize());
    }

    // 2. CHATTING RELAY
    if (user.status === 'chatting' && user.partnerId) {
        if (text === '🚫 قطع مکالمه') return endChat(ctx.from.id, user.partnerId, ctx);
        if (text === '📄 مشاهده پروفایل طرف') {
            const partner = await User.findOne({ telegramId: user.partnerId });
            return showProfile(ctx, partner, false);
        }
        if (text === '🚩 گزارش تخلف') {
            user.status = 'reporting'; await user.save();
            return ctx.reply(TEXTS.ask_report_reason, Markup.removeKeyboard());
        }
        
        // Link Filtering
        const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(t\.me\/[^\s]+)|(@[^\s]+)/gi;
        if (linkRegex.test(text)) return ctx.reply(TEXTS.link_blocked);

        try { await ctx.copyMessage(user.partnerId); } catch (e) { await endChat(ctx.from.id, user.partnerId, ctx); }
        return;
    }

    // 3. REGISTRATION
    if (user.regStep !== 'completed') return stepHandler(ctx);

    // 4. MENUS
    if (text === TEXTS.btn_connect) return ctx.reply('🧐 نوع جستجو:', Markup.keyboard([['🎲 جستجو شانسی'], ['👦 جستجو پسر', '👩 جستجو دختر'], [TEXTS.btn_back]]).resize());
    if (text === TEXTS.btn_profile) return showProfile(ctx, user, true);
    if (text === TEXTS.btn_edit) return ctx.reply('بخش مورد نظر:', Markup.keyboard([['✏️ نام', '✏️ عکس'], ['✏️ سن', '✏️ جنسیت'], ['✏️ ولایت', '✏️ شغل'], ['✏️ هدف', '🔙 برگشت به منوی اصلی']]).resize());
    if (text === TEXTS.btn_back || text === '🔙 برگشت به منوی اصلی') return ctx.reply(TEXTS.main_menu_title, getMainMenu());
    
    if (text === '🎲 جستجو شانسی') return startSearch(ctx, 'random');
    if (text === '👦 جستجو پسر') return startSearch(ctx, 'boy');
    if (text === '👩 جستجو دختر') return startSearch(ctx, 'girl');
    if (text === '❌ لغو جستجو') return stopSearch(ctx);

    // Edit Logic
    if (text && text.startsWith('✏️')) {
        user.isEditing = true;
        const keys = {'نام':'name','عکس':'photo','سن':'age','جنسیت':'gender','ولایت':'province','شغل':'job','هدف':'purpose'};
        for (let k in keys) if (text.includes(k)) {
            user.regStep = keys[k]; await user.save();
            if (['name','photo'].includes(keys[k])) await ctx.reply('لطفا مقدار جدید را بفرستید:', Markup.removeKeyboard());
            else {
                const maps = { gender: [GENDERS, 2], age: [AGES, 6], province: [PROVINCES, 3], job: [JOBS, 2], purpose: [PURPOSES, 2] };
                await ctx.reply('انتخاب کنید:', Markup.keyboard(chunk(maps[keys[k]][0], maps[keys[k]][1])).resize());
            }
            return;
        }
    }
});

async function stepHandler(ctx) {
    const user = ctx.user; const text = ctx.message.text; const isEdit = user.isEditing;
    const next = async (step) => {
        await cleanPrev(ctx);
        if (isEdit) { user.regStep = 'completed'; user.isEditing = false; await user.save(); await ctx.reply('✅ ثبت شد.', getMainMenu()); }
        else {
            user.regStep = step; await user.save();
            const maps = { gender: ['🚻 جنسیت:', GENDERS, 2], age: ['🎂 سن:', AGES, 6], province: ['📍 ولایت:', PROVINCES, 3], job: ['💼 شغل:', JOBS, 2], purpose: ['🎯 هدف:', PURPOSES, 2], photo: ['📸 عکس (یا دکمه بدون عکس):', [['بدون عکس']], 1] };
            const s = maps[step];
            const m = await ctx.reply(s[0], step === 'name' ? Markup.removeKeyboard() : Markup.keyboard(chunk(s[1], s[2])).resize());
            ctx.user.lastMsgId = m.message_id; await ctx.user.save();
        }
    };
    if (user.regStep === 'name') { if (!text) return; user.displayName = text; return next('gender'); }
    if (user.regStep === 'gender') { if (!GENDERS.includes(text)) return; user.profile.gender = text; return next('age'); }
    if (user.regStep === 'age') { if (!AGES.includes(text)) return; user.profile.age = text; return next('province'); }
    if (user.regStep === 'province') { if (!PROVINCES.includes(text)) return; user.profile.province = text; return next('job'); }
    if (user.regStep === 'job') { if (!JOBS.includes(text)) return; user.profile.job = text; return next('purpose'); }
    if (user.regStep === 'purpose') { if (!PURPOSES.includes(text)) return; user.profile.purpose = text; return next('photo'); }
    if (user.regStep === 'photo') {
        user.profile.photoId = ctx.message.photo ? ctx.message.photo[ctx.message.photo.length - 1].file_id : null;
        user.regStep = 'completed'; await user.save();
        await cleanPrev(ctx); await ctx.reply('🎉 خوش آمدید!', getMainMenu());
    }
}

async function showProfile(ctx, user, isSelf) {
    const p = user.profile;
    const caption = `🎫 ID: ${user.shortId}\n\n👤 نام: ${user.displayName}\n🚻 جنسیت: ${p.gender}\n🎂 سن: ${p.age}\n📍 ولایت: ${p.province}\n💼 شغل: ${p.job}\n🎯 هدف: ${p.purpose}`;
    const buttons = { inline_keyboard: [[{ text: `👍 ${user.stats.likes}`, callback_data: `like_${user.telegramId}` }, { text: `👎 ${user.stats.dislikes}`, callback_data: `dislike_${user.telegramId}` }]] };
    if (p.photoId) await ctx.replyWithPhoto(p.photoId, { caption, reply_markup: buttons });
    else await ctx.reply(caption, { reply_markup: buttons });
    if (!isSelf) try { await ctx.telegram.sendMessage(user.telegramId, TEXTS.profile_viewed); } catch (e) {}
}

bot.action(/^(like|dislike)_(\d+)$/, async (ctx) => {
    const targetId = parseInt(ctx.match[2]);
    if (targetId === ctx.from.id) return ctx.answerCbQuery('به خودتان رای ندهید!');
    const target = await User.findOne({ telegramId: targetId });
    if (ctx.match[1] === 'like') target.stats.likes++; else target.stats.dislikes++;
    await target.save();
    try { await ctx.editMessageReplyMarkup({ inline_keyboard: [[{ text: `👍 ${target.stats.likes}`, callback_data: `like_${targetId}` }, { text: `👎 ${target.stats.dislikes}`, callback_data: `dislike_${targetId}` }]] }); } catch (e) {}
    ctx.answerCbQuery('ثبت شد');
});

async function startSearch(ctx, type) {
    let filter = { status: 'searching', telegramId: { $ne: ctx.user.telegramId } };
    if (type !== 'random') filter['profile.gender'] = { $regex: type === 'boy' ? 'پسر' : 'دختر' };
    const partner = await User.findOne(filter);
    if (partner) {
        ctx.user.status = 'chatting'; ctx.user.partnerId = partner.telegramId;
        partner.status = 'chatting'; partner.partnerId = ctx.user.telegramId;
        await ctx.user.save(); await partner.save();
        const menu = Markup.keyboard([['🚫 قطع مکالمه', '📄 مشاهده پروفایل طرف', '🚩 گزارش تخلف']]).resize();
        await ctx.telegram.sendMessage(ctx.user.telegramId, TEXTS.connected, menu);
        await ctx.telegram.sendMessage(partner.telegramId, TEXTS.connected, menu);
    } else {
        ctx.user.status = 'searching'; await ctx.user.save();
        await ctx.reply(TEXTS.searching, Markup.keyboard([['❌ لغو جستجو']]).resize());
    }
}

async function stopSearch(ctx) { ctx.user.status = 'idle'; await ctx.user.save(); await ctx.reply('توقف شد.', getMainMenu()); }

async function endChat(id1, id2, ctx) {
    await User.updateMany({ telegramId: { $in: [id1, id2] } }, { status: 'idle', partnerId: null });
    try { await ctx.telegram.sendMessage(id1, TEXTS.you_disconnected, getMainMenu()); } catch (e) {}
    try { await ctx.telegram.sendMessage(id2, TEXTS.partner_disconnected, getMainMenu()); } catch (e) {}
}

const app = express(); app.get('/', (req, res) => res.send('Afghan Connect v8.0 Enterprise'));
app.listen(PORT, () => { bot.launch(); console.log('Bot v8.0 Online with Admin Panel'); });
