require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const ADMIN_ID = parseInt(process.env.ADMIN_ID); // YOUR ID
const PORT = process.env.PORT || 3000;

// --- DARI TEXTS ---
const TEXTS = {
    intro: `🇦🇫 به ربات افغان کانکت خوش آمدید!\n\nاینجا میتوانید به صورت کاملا ناشناس با هموطنان خود صحبت کنید.\n🔒 امنیت: آیدی شما مخفی است.\n👇 برای شروع، مشخصات خود را تکمیل کنید.`,
    main_menu_title: '🏠 منوی اصلی:',
    search_menu_title: '🧐 نوع جستجو را انتخاب کنید:',
    
    btn_connect: '🎲 وصل شدن به ناشناس',
    btn_profile: '👤 پروفایل من',
    btn_edit: '✏️ ویرایش پروفایل',
    btn_back: '🔙 برگشت',
    
    // Registration
    ask_name: '📝 لطفا نام یا لقب خود را بنویسید:',
    ask_gender: '🚻 جنسیت خود را انتخاب کنید:',
    ask_age: '🎂 سن خود را انتخاب کنید:',
    ask_province: '📍 از کدام ولایت هستید؟',
    ask_job: '💼 شغل شما چیست؟',
    ask_purpose: '🎯 هدف شما از اینجا بودن چیست؟',
    ask_photo: '📸 عکس پروفایل بفرستید (یا دکمه "بدون عکس"):',
    
    // Chat & System
    connected: '✅ وصل شدید! شروع به چت کنید. 👋',
    partner_disconnected: '🚫 طرف مقابل مکالمه را قطع کرد.',
    you_disconnected: '🚫 شما مکالمه را قطع کردید.',
    searching: '🔍 در حال جستجو... لطفا صبر کنید.',
    spam_warn: '⚠️ شما خیلی سریع پیام میدهید! ۵ دقیقه محدود شدید.',
    link_blocked: '🚫 ارسال لینک یا آیدی مجاز نیست!',
    banned_msg: '⛔️ حساب شما توسط ادمین مسدود شده است.',
    
    // Reporting
    report_btn: '⚠️ گزارش تخلف',
    report_ask: 'علت گزارش چیست؟',
    report_sent: '✅ گزارش شما برای ادمین ارسال شد.',
    report_reasons: ['تبلیغات/لینک', 'بی‌ادبی/توهین', 'مزاحمت', 'اسکم/کلاهبرداری']
};

const PROVINCES = ['کابل', 'هرات', 'قندهار', 'بلخ', 'ننگرهار', 'هلمند', 'کندز', 'فاریاب', 'غزنی', 'پکتیا', 'جوزجان', 'تخار', 'بدخشان', 'بغلان', 'خوست', 'سمنگان', 'نیمروز', 'سرپل', 'فراه', 'کنر', 'لوگر', 'زابل', 'لغمان', 'پکتیکا', 'پنجشیر', 'پروان', 'اروزگان', 'کاپیسا', 'بامیان', 'میدان وردک', 'غور', 'دایکندی', 'نورستان', 'بادغیس', 'خارج از کشور'];
const GENDERS = ['پسر 👦', 'دختر 👧'];
const JOBS = ['کارگر 🛠', 'شغل آزاد 💼', 'محصل 🎓', 'بیکار 🏠', 'کارمند 📝', 'داکتر 🩺', 'اینجینیر 📐'];
const PURPOSES = ['سرگرمی 😂', 'پیدا کردن دوست 🤝', 'درد دل 💔'];
const AGES = Array.from({ length: 66 }, (_, i) => (i + 15).toString());

// --- DATABASE ---
mongoose.connect(MONGO_URI).then(() => console.log('DB Connected')).catch(e => console.error(e));

const userSchema = new mongoose.Schema({
    telegramId: { type: Number, required: true, unique: true },
    displayName: String,
    regStep: { type: String, default: 'intro' },
    isEditing: { type: Boolean, default: false },
    profile: { gender: String, age: String, province: String, job: String, purpose: String, photoId: String },
    stats: { likes: { type: Number, default: 0 }, dislikes: { type: Number, default: 0 } },
    status: { type: String, default: 'idle' },
    partnerId: Number,
    lastMsgId: Number,
    
    // Security & Admin
    banned: { type: Boolean, default: false },
    muteUntil: { type: Date, default: Date.now },
    lastMsgTimestamp: { type: Number, default: 0 },
    spamScore: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);
const bot = new Telegraf(BOT_TOKEN);

// --- HELPERS ---
const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
const getMainMenu = () => Markup.keyboard([[TEXTS.btn_connect], [TEXTS.btn_profile, TEXTS.btn_edit]]).resize();
const getChatMenu = () => Markup.keyboard([['🚫 قطع مکالمه', '📄 مشاهده پروفایل'], [TEXTS.report_btn]]).resize(); // Report button added
const getEditMenu = () => Markup.keyboard([['✏️ نام', '✏️ عکس'], ['✏️ سن', '✏️ جنسیت'], ['✏️ ولایت', '✏️ شغل'], ['✏️ هدف', '🔙 برگشت به منوی اصلی']]).resize();

async function cleanPrev(ctx) {
    if (ctx.user.lastMsgId) {
        try { await ctx.deleteMessage(ctx.user.lastMsgId); } catch (e) {}
        ctx.user.lastMsgId = null;
        await ctx.user.save();
    }
}

// --- MIDDLEWARE (Security Layer) ---
bot.use(async (ctx, next) => {
    try {
        if (!ctx.chat || ctx.chat.type !== 'private') return;
        
        let user = await User.findOne({ telegramId: ctx.from.id });
        if (!user) { user = new User({ telegramId: ctx.from.id, regStep: 'intro' }); await user.save(); }
        
        // 1. Ban Check
        if (user.banned) return ctx.reply(TEXTS.banned_msg);

        // 2. Mute Check
        if (user.muteUntil > Date.now()) return ctx.reply(TEXTS.spam_warn);

        // 3. Anti-Spam (Skip for Admin)
        if (ctx.from.id !== ADMIN_ID) {
            const now = Date.now();
            if (now - user.lastMsgTimestamp < 1500) {
                user.spamScore++;
                if (user.spamScore > 5) {
                    user.muteUntil = new Date(now + 5 * 60000); // 5 min mute
                    user.spamScore = 0;
                    await user.save();
                    return ctx.reply(TEXTS.spam_warn);
                }
            } else { user.spamScore = 0; }
            user.lastMsgTimestamp = now;
            await user.save();
        }

        ctx.user = user;
        return next();
    } catch (e) { console.error(e); }
});

// --- ADMIN COMMANDS ---
// Format: /ban 123456789
bot.command('ban', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const targetId = parseInt(ctx.message.text.split(' ')[1]);
    if (!targetId) return ctx.reply('❌ آیدی وارد نشد. مثال: /ban 12345');
    await User.updateOne({ telegramId: targetId }, { banned: true, status: 'idle', partnerId: null });
    ctx.reply(`✅ کاربر ${targetId} بن شد.`);
});

bot.command('unban', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const targetId = parseInt(ctx.message.text.split(' ')[1]);
    if (!targetId) return ctx.reply('❌ آیدی وارد نشد.');
    await User.updateOne({ telegramId: targetId }, { banned: false });
    ctx.reply(`✅ کاربر ${targetId} آنبن شد.`);
});

bot.command('stats', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const total = await User.countDocuments();
    const banned = await User.countDocuments({ banned: true });
    ctx.reply(`📊 آمار ربات:\n👥 کل کاربران: ${total}\n🚫 بن شده: ${banned}`);
});

bot.command('broadcast', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const msg = ctx.message.text.replace('/broadcast ', '');
    if (!msg) return ctx.reply('متن پیام کو؟');
    const users = await User.find({ banned: false });
    let count = 0;
    ctx.reply('⏳ در حال ارسال...');
    for (let u of users) {
        try {
            await ctx.telegram.sendMessage(u.telegramId, `📢 **پیام ادمین:**\n\n${msg}`, { parse_mode: 'Markdown' });
            count++;
        } catch (e) {}
    }
    ctx.reply(`✅ پیام به ${count} نفر ارسال شد.`);
});


// --- MAIN LOGIC ---
bot.start(async (ctx) => {
    if (ctx.user.regStep !== 'completed') {
        ctx.user.regStep = 'intro'; await ctx.user.save();
        const m = await ctx.reply(TEXTS.intro);
        ctx.user.lastMsgId = m.message_id; await ctx.user.save();
        setTimeout(async () => {
            await cleanPrev(ctx);
            ctx.user.regStep = 'name'; await ctx.user.save();
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

    // 1. CHAT MODE
    if (user.status === 'chatting' && user.partnerId) {
        if (text === '🚫 قطع مکالمه') return endChat(ctx.from.id, user.partnerId, ctx);
        if (text === '📄 مشاهده پروفایل') {
            const partner = await User.findOne({ telegramId: user.partnerId });
            return showProfile(ctx, partner, false);
        }
        
        // REPORT TRIGGER
        if (text === TEXTS.report_btn) {
            return ctx.reply(TEXTS.report_ask, Markup.inlineKeyboard([
                [Markup.button.callback('مزاحمت', `rep_harass_${user.partnerId}`)],
                [Markup.button.callback('تبلیغات', `rep_spam_${user.partnerId}`)],
                [Markup.button.callback('بی‌ادبی', `rep_rude_${user.partnerId}`)],
                [Markup.button.callback('کلاهبرداری', `rep_scam_${user.partnerId}`)]
            ]));
        }
        
        // Link Block
        if (/(https?:\/\/|t\.me\/|@[\w]+)/gi.test(text)) return ctx.reply(TEXTS.link_blocked);

        try { await ctx.copyMessage(user.partnerId); } catch (e) { await endChat(ctx.from.id, user.partnerId, ctx); }
        return;
    }

    // 2. REGISTRATION
    if (user.regStep !== 'completed') {
        if (user.isEditing && text.startsWith('✏️')) return;
        return stepHandler(ctx);
    }

    // 3. MENUS
    if (text === TEXTS.btn_connect) return ctx.reply(TEXTS.search_menu_title, Markup.keyboard([['🎲 جستجو شانسی'], ['👦 جستجو پسر', '👩 جستجو دختر'], [TEXTS.btn_back]]).resize());
    if (text === TEXTS.btn_profile) return showProfile(ctx, user, true);
    if (text === TEXTS.btn_edit) return ctx.reply('بخش مورد نظر را انتخاب کنید:', getEditMenu());
    if (text === TEXTS.btn_back || text === '🔙 برگشت به منوی اصلی') return ctx.reply(TEXTS.main_menu_title, getMainMenu());
    
    if (text === '🎲 جستجو شانسی') return startSearch(ctx, 'random');
    if (text === '👦 جستجو پسر') return startSearch(ctx, 'boy');
    if (text === '👩 جستجو دختر') return startSearch(ctx, 'girl');
    if (text === '❌ لغو جستجو') return stopSearch(ctx);

    // EDITING
    if (text && text.startsWith('✏️')) {
        user.isEditing = true;
        const keys = {'نام':'name','عکس':'photo','سن':'age','جنسیت':'gender','ولایت':'province','شغل':'job','هدف':'purpose'};
        for (let k in keys) if (text.includes(k)) {
            user.regStep = keys[k]; await user.save();
            const prompts = {name: TEXTS.ask_name, photo: TEXTS.ask_photo, age: TEXTS.ask_age, gender: TEXTS.ask_gender, province: TEXTS.ask_province, job: TEXTS.ask_job, purpose: TEXTS.ask_purpose};
            if (['name','photo'].includes(keys[k])) await ctx.reply(prompts[keys[k]], Markup.removeKeyboard());
            else {
                const maps = { gender: [GENDERS, 2], age: [AGES, 6], province: [PROVINCES, 3], job: [JOBS, 2], purpose: [PURPOSES, 2] };
                await ctx.reply(prompts[keys[k]], Markup.keyboard(chunk(maps[keys[k]][0], maps[keys[k]][1])).resize());
            }
            return;
        }
    }
});

// --- REPORT ACTION HANDLER ---
bot.action(/^rep_(.*)_(.*)$/, async (ctx) => {
    const reason = ctx.match[1]; // harass, spam, etc
    const offenderId = parseInt(ctx.match[2]);
    const reporterId = ctx.from.id;

    // Notify User
    ctx.answerCbQuery('گزارش ثبت شد');
    ctx.editMessageText(TEXTS.report_sent);

    // NOTIFY ADMIN
    const adminMsg = `🚨 **گزارش جدید!**\n\n` +
                     `👤 گزارش‌دهنده: \`${reporterId}\`\n` +
                     `👿 متخلف: \`${offenderId}\`\n` +
                     `⚠️ علت: ${reason}\n\n` +
                     `👇 عملیات (کپی کن و بفرست): \n` +
                     `/ban ${offenderId}`;
    
    try {
        await ctx.telegram.sendMessage(ADMIN_ID, adminMsg, { parse_mode: 'Markdown' });
    } catch (e) { console.log('Admin ID not set or invalid'); }
});

// --- CORE FUNCTIONS ---
async function stepHandler(ctx) {
    const user = ctx.user;
    const text = ctx.message.text;
    const isEdit = user.isEditing;

    const next = async (step) => {
        await cleanPrev(ctx);
        if (isEdit) { user.regStep = 'completed'; user.isEditing = false; await user.save(); await ctx.reply('✅ تغییرات ذخیره شد.', getEditMenu()); }
        else {
            user.regStep = step; await user.save();
            const maps = { gender: [TEXTS.ask_gender, GENDERS, 2], age: [TEXTS.ask_age, AGES, 6], province: [TEXTS.ask_province, PROVINCES, 3], job: [TEXTS.ask_job, JOBS, 2], purpose: [TEXTS.ask_purpose, PURPOSES, 2], photo: [TEXTS.ask_photo, [['بدون عکس']], 1] };
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
        user.regStep = 'completed'; user.isEditing = false; await user.save();
        await cleanPrev(ctx); await ctx.reply('🎉 پروفایل تکمیل شد!', getMainMenu());
    }
}

async function showProfile(ctx, user, isSelf) {
    const p = user.profile;
    const caption = `🎫 پروفایل کاربری\n\n👤 نام: ${user.displayName}\n🚻 جنسیت: ${p.gender}\n🎂 سن: ${p.age}\n📍 ولایت: ${p.province}\n💼 شغل: ${p.job}\n🎯 هدف: ${p.purpose}`;
    const buttons = { inline_keyboard: [[{ text: `👍 ${user.stats.likes}`, callback_data: `like_${user.telegramId}` }, { text: `👎 ${user.stats.dislikes}`, callback_data: `dislike_${user.telegramId}` }]] };
    if (p.photoId) await ctx.replyWithPhoto(p.photoId, { caption, reply_markup: buttons });
    else await ctx.reply(caption, { reply_markup: buttons });
    if (!isSelf) try { await ctx.telegram.sendMessage(user.telegramId, TEXTS.profile_viewed); } catch (e) {}
}

bot.action(/^(like|dislike)_(\d+)$/, async (ctx) => {
    const type = ctx.match[1];
    const targetId = parseInt(ctx.match[2]);
    if (targetId === ctx.from.id) return ctx.answerCbQuery(TEXTS.self_vote);
    const target = await User.findOne({ telegramId: targetId });
    if (type === 'like') target.stats.likes++; else target.stats.dislikes++;
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
        const menu = getChatMenu();
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

const app = express(); app.get('/', (req, res) => res.send('Afghan Connect v8.0 Admin'));
app.listen(PORT, () => { bot.launch(); console.log('Bot v8.0 Online'); });

process.on('uncaughtException', (err) => console.error('Error:', err));
