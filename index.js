require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const ADMIN_ID = parseInt(process.env.ADMIN_ID);
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN || !MONGO_URI || !ADMIN_ID) {
    console.error('❌ Missing .env variables (BOT_TOKEN, MONGO_URI, or ADMIN_ID)');
    process.exit(1);
}

// --- DARI TEXTS (Fixed & Completed) ---
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
    no_photo_btn: '🚫 بدون عکس',
    
    // Chat & System
    connected: '✅ وصل شدید! شروع به چت کنید. 👋',
    partner_disconnected: '🚫 طرف مقابل مکالمه را قطع کرد.',
    you_disconnected: '🚫 شما مکالمه را قطع کردید.',
    searching: '🔍 در حال جستجو... لطفا صبر کنید.',
    search_stopped: '🛑 جستجو متوقف شد.',
    spam_warn: '⚠️ شما خیلی سریع پیام میدهید! ۵ دقیقه محدود شدید.',
    link_blocked: '🚫 ارسال لینک یا آیدی مجاز نیست!',
    banned_msg: '⛔️ حساب شما توسط ادمین مسدود شده است.',
    profile_viewed: '👁 یک نفر پروفایل شما را مشاهده کرد.',
    self_vote: '⚠️ نمیتوانید به خودتان رای دهید!',
    
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
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ DB Connected'))
    .catch(e => console.error('❌ DB Error:', e));

const userSchema = new mongoose.Schema({
    telegramId: { type: Number, required: true, unique: true },
    displayName: String,
    regStep: { type: String, default: 'intro' },
    isEditing: { type: Boolean, default: false },
    profile: { 
        gender: String, 
        age: String, 
        province: String, 
        job: String, 
        purpose: String, 
        photoId: String 
    },
    stats: { likes: { type: Number, default: 0 }, dislikes: { type: Number, default: 0 } },
    status: { type: String, default: 'idle' }, // idle, searching, chatting
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

const getMainMenu = () => Markup.keyboard([
    [TEXTS.btn_connect], 
    [TEXTS.btn_profile, TEXTS.btn_edit]
]).resize();

const getChatMenu = () => Markup.keyboard([
    ['🚫 قطع مکالمه', '📄 مشاهده پروفایل'], 
    [TEXTS.report_btn]
]).resize();

const getEditMenu = () => Markup.keyboard([
    ['✏️ نام', '✏️ عکس'], 
    ['✏️ سن', '✏️ جنسیت'], 
    ['✏️ ولایت', '✏️ شغل'], 
    ['✏️ هدف', '🔙 برگشت به منوی اصلی']
]).resize();

// Helper to delete previous system messages to keep chat clean
async function cleanPrev(ctx) {
    if (ctx.user && ctx.user.lastMsgId) {
        try { 
            await ctx.deleteMessage(ctx.user.lastMsgId); 
        } catch (e) {
            // Ignore error if message is too old or already deleted
        }
        ctx.user.lastMsgId = null;
        await ctx.user.save();
    }
}

// --- MIDDLEWARE (Security & User Loader) ---
bot.use(async (ctx, next) => {
    try {
        if (!ctx.chat || ctx.chat.type !== 'private') return;
        
        // Load or Create User
        let user = await User.findOne({ telegramId: ctx.from.id });
        if (!user) { 
            user = new User({ telegramId: ctx.from.id, regStep: 'intro' }); 
            await user.save(); 
        }
        
        // 1. Ban Check
        if (user.banned) return ctx.reply(TEXTS.banned_msg);

        // 2. Mute Check
        if (user.muteUntil > Date.now()) return ctx.reply(TEXTS.spam_warn);

        // 3. Anti-Spam (Skip for Admin)
        if (ctx.from.id !== ADMIN_ID && ctx.message) {
            const now = Date.now();
            const timeDiff = now - user.lastMsgTimestamp;
            
            // Allow 1 message every 1.5 seconds
            if (timeDiff < 1500) {
                user.spamScore++;
                if (user.spamScore > 4) {
                    user.muteUntil = new Date(now + 5 * 60000); // 5 min mute
                    user.spamScore = 0;
                    await user.save();
                    return ctx.reply(TEXTS.spam_warn);
                }
            } else { 
                user.spamScore = 0; 
            }
            user.lastMsgTimestamp = now;
            await user.save();
        }

        ctx.user = user;
        return next();
    } catch (e) { console.error('Middleware Error:', e); }
});

// --- ADMIN COMMANDS ---
bot.command('ban', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const targetId = parseInt(ctx.message.text.split(' ')[1]);
    if (!targetId) return ctx.reply('❌ آیدی وارد نشد. مثال: /ban 12345');
    
    await User.updateOne({ telegramId: targetId }, { banned: true, status: 'idle', partnerId: null });
    // If they were chatting, notify the partner (optional, strictly disconnect logic handles cleanup)
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
    const online = await User.countDocuments({ status: { $ne: 'idle' } });
    ctx.reply(`📊 آمار ربات:\n👥 کل کاربران: ${total}\n🟢 آنلاین (چت/سرچ): ${online}\n🚫 بن شده: ${banned}`);
});

bot.command('broadcast', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const msg = ctx.message.text.replace('/broadcast ', '');
    if (!msg || msg === '/broadcast') return ctx.reply('متن پیام کو؟');
    
    const users = await User.find({ banned: false });
    let count = 0;
    ctx.reply(`⏳ در حال ارسال به ${users.length} کاربر...`);
    
    for (let u of users) {
        try {
            await ctx.telegram.sendMessage(u.telegramId, `📢 **پیام ادمین:**\n\n${msg}`, { parse_mode: 'Markdown' });
            count++;
            // Small delay to avoid hitting Telegram limits
            await new Promise(r => setTimeout(r, 50)); 
        } catch (e) {
            // User blocked bot
        }
    }
    ctx.reply(`✅ پیام به ${count} نفر ارسال شد.`);
});

// --- MAIN LOGIC ---
bot.start(async (ctx) => {
    // If user is already registered, show main menu
    if (ctx.user.regStep === 'completed') {
        return ctx.reply(TEXTS.main_menu_title, getMainMenu());
    }

    // Otherwise, start registration
    ctx.user.regStep = 'intro'; await ctx.user.save();
    const m = await ctx.reply(TEXTS.intro);
    ctx.user.lastMsgId = m.message_id; await ctx.user.save();
    
    setTimeout(async () => {
        await cleanPrev(ctx);
        ctx.user.regStep = 'name'; await ctx.user.save();
        const m2 = await ctx.reply(TEXTS.ask_name, Markup.removeKeyboard());
        ctx.user.lastMsgId = m2.message_id; await ctx.user.save();
    }, 3000);
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

        // Forward Message
        try { 
            await ctx.copyMessage(user.partnerId); 
        } catch (e) { 
            // If partner blocked bot, end chat
            await endChat(ctx.from.id, user.partnerId, ctx); 
        }
        return;
    }

    // 2. REGISTRATION & EDITING FLOW
    if (user.regStep !== 'completed') {
        // If editing and user clicks an unrelated menu button, ignore or handle? 
        // Better to force flow completion or use a "Cancel" command.
        // For now, let's process the input.
        return stepHandler(ctx);
    }

    // 3. MENUS
    if (text === TEXTS.btn_connect) {
        return ctx.reply(TEXTS.search_menu_title, Markup.keyboard([
            ['🎲 جستجو شانسی'], 
            ['👦 جستجو پسر', '👩 جستجو دختر'], 
            [TEXTS.btn_back]
        ]).resize());
    }

    if (text === TEXTS.btn_profile) return showProfile(ctx, user, true);
    
    if (text === TEXTS.btn_edit) return ctx.reply('بخش مورد نظر را انتخاب کنید:', getEditMenu());
    
    if (text === TEXTS.btn_back || text === '🔙 برگشت به منوی اصلی') return ctx.reply(TEXTS.main_menu_title, getMainMenu());
    
    // Search Actions
    if (text === '🎲 جستجو شانسی') return startSearch(ctx, 'random');
    if (text === '👦 جستجو پسر') return startSearch(ctx, 'boy');
    if (text === '👩 جستجو دختر') return startSearch(ctx, 'girl');
    if (text === '❌ لغو جستجو') return stopSearch(ctx);

    // EDIT TRIGGER
    if (text && text.startsWith('✏️')) {
        user.isEditing = true;
        
        const keyMap = {
            'نام': 'name',
            'عکس': 'photo',
            'سن': 'age',
            'جنسیت': 'gender',
            'ولایت': 'province',
            'شغل': 'job',
            'هدف': 'purpose'
        };

        // Find which button was clicked
        let foundKey = null;
        for (const [k, v] of Object.entries(keyMap)) {
            if (text.includes(k)) foundKey = v;
        }

        if (foundKey) {
            user.regStep = foundKey;
            await user.save();
            
            const prompts = {
                name: TEXTS.ask_name,
                photo: TEXTS.ask_photo,
                age: TEXTS.ask_age,
                gender: TEXTS.ask_gender,
                province: TEXTS.ask_province,
                job: TEXTS.ask_job,
                purpose: TEXTS.ask_purpose
            };
            
            // Keyboards for specific steps
            let keyboard = Markup.removeKeyboard(); // Default
            if (foundKey === 'gender') keyboard = Markup.keyboard(chunk(GENDERS, 2)).resize();
            if (foundKey === 'age') keyboard = Markup.keyboard(chunk(AGES, 6)).resize();
            if (foundKey === 'province') keyboard = Markup.keyboard(chunk(PROVINCES, 3)).resize();
            if (foundKey === 'job') keyboard = Markup.keyboard(chunk(JOBS, 2)).resize();
            if (foundKey === 'purpose') keyboard = Markup.keyboard(chunk(PURPOSES, 2)).resize();
            if (foundKey === 'photo') keyboard = Markup.keyboard([[TEXTS.no_photo_btn]]).resize();

            await ctx.reply(prompts[foundKey], keyboard);
            return;
        }
    }
});

// --- REPORT ACTION HANDLER ---
bot.action(/^rep_(.*)_(.*)$/, async (ctx) => {
    try {
        const reasonMap = {
            'harass': 'مزاحمت',
            'spam': 'تبلیغات',
            'rude': 'بی‌ادبی',
            'scam': 'کلاهبرداری'
        };
        const rawReason = ctx.match[1];
        const reason = reasonMap[rawReason] || rawReason;
        const offenderId = parseInt(ctx.match[2]);
        const reporterId = ctx.from.id;

        await ctx.answerCbQuery('گزارش ثبت شد');
        await ctx.editMessageText(TEXTS.report_sent);

        const adminMsg = `🚨 **گزارش جدید!**\n\n` +
                         `👤 گزارش‌دهنده: \`${reporterId}\`\n` +
                         `👿 متخلف: \`${offenderId}\`\n` +
                         `⚠️ علت: ${reason}\n\n` +
                         `👇 عملیات (کپی کن و بفرست): \n` +
                         `/ban ${offenderId}`;
        
        await ctx.telegram.sendMessage(ADMIN_ID, adminMsg, { parse_mode: 'Markdown' });
    } catch (e) { console.error('Report Error:', e); }
});

// --- REGISTRATION STEP HANDLER ---
async function stepHandler(ctx) {
    const user = ctx.user;
    const text = ctx.message.text;
    const isEdit = user.isEditing;

    // Helper to move to next step or finish
    const next = async (step) => {
        await cleanPrev(ctx);
        
        if (isEdit) {
            // If editing, save and go back to menu
            user.regStep = 'completed'; 
            user.isEditing = false; 
            await user.save(); 
            await ctx.reply('✅ تغییرات ذخیره شد.', getEditMenu()); 
        } else {
            // If registering, move to next step
            user.regStep = step; 
            await user.save();
            
            // Define prompts and keyboards for all steps
            const stepConfig = {
                name:     { text: TEXTS.ask_name,     kb: Markup.removeKeyboard() }, // Should not happen here usually
                gender:   { text: TEXTS.ask_gender,   kb: Markup.keyboard(chunk(GENDERS, 2)).resize() },
                age:      { text: TEXTS.ask_age,      kb: Markup.keyboard(chunk(AGES, 6)).resize() },
                province: { text: TEXTS.ask_province, kb: Markup.keyboard(chunk(PROVINCES, 3)).resize() },
                job:      { text: TEXTS.ask_job,      kb: Markup.keyboard(chunk(JOBS, 2)).resize() },
                purpose:  { text: TEXTS.ask_purpose,  kb: Markup.keyboard(chunk(PURPOSES, 2)).resize() },
                photo:    { text: TEXTS.ask_photo,    kb: Markup.keyboard([[TEXTS.no_photo_btn]]).resize() }
            };

            const conf = stepConfig[step];
            if (conf) {
                const m = await ctx.reply(conf.text, conf.kb);
                ctx.user.lastMsgId = m.message_id; 
                await ctx.user.save();
            }
        }
    };

    // Logic per step
    if (user.regStep === 'name') { 
        if (!text) return ctx.reply('لطفا متن ارسال کنید.');
        user.displayName = text; 
        return next('gender'); 
    }
    
    if (user.regStep === 'gender') { 
        if (!GENDERS.includes(text)) return ctx.reply('لطفا از دکمه‌ها استفاده کنید.');
        user.profile.gender = text; 
        return next('age'); 
    }
    
    if (user.regStep === 'age') { 
        if (!AGES.includes(text)) return ctx.reply('لطفا از دکمه‌ها استفاده کنید.');
        user.profile.age = text; 
        return next('province'); 
    }
    
    if (user.regStep === 'province') { 
        if (!PROVINCES.includes(text)) return ctx.reply('لطفا از دکمه‌ها استفاده کنید.');
        user.profile.province = text; 
        return next('job'); 
    }
    
    if (user.regStep === 'job') { 
        if (!JOBS.includes(text)) return ctx.reply('لطفا از دکمه‌ها استفاده کنید.');
        user.profile.job = text; 
        return next('purpose'); 
    }
    
    if (user.regStep === 'purpose') { 
        if (!PURPOSES.includes(text)) return ctx.reply('لطفا از دکمه‌ها استفاده کنید.');
        user.profile.purpose = text; 
        return next('photo'); 
    }
    
    if (user.regStep === 'photo') {
        if (text === TEXTS.no_photo_btn) {
            user.profile.photoId = null;
        } else if (ctx.message.photo) {
            user.profile.photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        } else {
            return ctx.reply('لطفا عکس ارسال کنید یا دکمه "بدون عکس" را بزنید.');
        }

        user.regStep = 'completed'; 
        user.isEditing = false; 
        await user.save();
        await cleanPrev(ctx); 
        await ctx.reply('🎉 پروفایل تکمیل شد!', getMainMenu());
    }
}

// --- PROFILE HANDLER ---
async function showProfile(ctx, targetUser, isSelf) {
    if (!targetUser) return ctx.reply('کاربر یافت نشد.');
    
    const p = targetUser.profile;
    const caption = `🎫 پروفایل کاربری\n\n` +
                    `👤 نام: ${targetUser.displayName || 'نامشخص'}\n` +
                    `🚻 جنسیت: ${p.gender || '?'}\n` +
                    `🎂 سن: ${p.age || '?'}\n` +
                    `📍 ولایت: ${p.province || '?'}\n` +
                    `💼 شغل: ${p.job || '?'}\n` +
                    `🎯 هدف: ${p.purpose || '?'}\n` +
                    `👍 ${targetUser.stats.likes} | 👎 ${targetUser.stats.dislikes}`;

    const buttons = Markup.inlineKeyboard([
        [
            Markup.button.callback(`👍 لایک`, `like_${targetUser.telegramId}`),
            Markup.button.callback(`👎 دیس‌لایک`, `dislike_${targetUser.telegramId}`)
        ]
    ]);

    if (p.photoId) {
        await ctx.replyWithPhoto(p.photoId, { caption, reply_markup: buttons.reply_markup });
    } else {
        await ctx.reply(caption, buttons);
    }

    if (!isSelf) {
        try { 
            await ctx.telegram.sendMessage(targetUser.telegramId, TEXTS.profile_viewed); 
        } catch (e) {}
    }
}

// --- VOTE ACTION ---
bot.action(/^(like|dislike)_(\d+)$/, async (ctx) => {
    const type = ctx.match[1];
    const targetId = parseInt(ctx.match[2]);
    
    if (targetId === ctx.from.id) return ctx.answerCbQuery(TEXTS.self_vote);
    
    const target = await User.findOne({ telegramId: targetId });
    if (!target) return ctx.answerCbQuery('کاربر یافت نشد');

    if (type === 'like') target.stats.likes++; 
    else target.stats.dislikes++;
    
    await target.save();
    ctx.answerCbQuery('نظر شما ثبت شد');
});

// --- SEARCH LOGIC (FIXED CONCURRENCY) ---
async function startSearch(ctx, type) {
    const userId = ctx.from.id;
    
    // 1. Define Filter
    let filter = { 
        status: 'searching', 
        telegramId: { $ne: userId } 
    };
    
    if (type !== 'random') {
        // Regex to match "پسر" or "دختر" in the string "پسر 👦"
        const genderTerm = type === 'boy' ? 'پسر' : 'دختر';
        filter['profile.gender'] = { $regex: genderTerm };
    }

    // 2. Atomic Find and Update to prevent race conditions
    const partner = await User.findOneAndUpdate(
        filter, 
        { status: 'chatting', partnerId: userId }, 
        { new: true } // Return updated doc
    );

    if (partner) {
        // MATCH FOUND!
        // Update Current User
        ctx.user.status = 'chatting'; 
        ctx.user.partnerId = partner.telegramId;
        await ctx.user.save();

        const menu = getChatMenu();
        await ctx.telegram.sendMessage(userId, TEXTS.connected, menu);
        try {
            await ctx.telegram.sendMessage(partner.telegramId, TEXTS.connected, menu);
        } catch(e) {
            // If partner blocked bot immediately, end chat
            return endChat(userId, partner.telegramId, ctx);
        }
    } else {
        // NO MATCH YET
        ctx.user.status = 'searching'; 
        await ctx.user.save();
        await ctx.reply(TEXTS.searching, Markup.keyboard([['❌ لغو جستجو']]).resize());
    }
}

async function stopSearch(ctx) { 
    if (ctx.user.status === 'chatting') return; // Should use disconnect button
    ctx.user.status = 'idle'; 
    await ctx.user.save(); 
    await ctx.reply(TEXTS.search_stopped, getMainMenu()); 
}

async function endChat(id1, id2, ctx) {
    // Reset both users to idle
    await User.updateMany(
        { telegramId: { $in: [id1, id2] } }, 
        { status: 'idle', partnerId: null }
    );

    const menu = getMainMenu();
    
    // Notify User 1
    try { await ctx.telegram.sendMessage(id1, TEXTS.you_disconnected, menu); } catch (e) {}
    
    // Notify User 2 (if distinct from sender context, or generic send)
    try { await ctx.telegram.sendMessage(id2, TEXTS.partner_disconnected, menu); } catch (e) {}
}

// --- EXPRESS SERVER (Keep Alive) ---
const app = express(); 
app.get('/', (req, res) => res.send('Afghan Connect Bot is Running...'));
app.listen(PORT, () => { 
    console.log(`🚀 Server running on port ${PORT}`);
    bot.launch().then(() => console.log('🤖 Bot Started')); 
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

process.on('uncaughtException', (err) => console.error('🔥 Critical Error:', err));
