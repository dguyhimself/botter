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

// --- DARI TEXTS ---
const TEXTS = {
    intro: `👋 <b>سلام دوست عزیز!</b>\n\n` +
           `🚀 <b>به "دریاب" خوش آمدید!</b>\n` +
           `<i>(پیشرفته‌ترین شبکه چت ناشناس در افغانستان)</i>\n\n` +
           `در اینجا میتوانید دوستان جدید را <b>دریابید</b> و بدون نگرانی از فاش شدن هویتتان، آزادانه گفتگو کنید.\n\n` +
           `✨ <b>ویژگی‌های دریاب:</b>\n` +
           `🔒 <b>امنیت کامل:</b> چت‌ها کاملا محرمانه و ناشناس هستند.\n` +
           `💎 <b>سطح کاربری:</b> ارتقا به VIP و الماس برای تمایز.\n` +
           `🎯 <b>جستجوی هوشمند:</b> پیدا کردن هم‌صحبت بر اساس ولایت و جنسیت.\n\n` +
           `👇 <b>برای شروع، پروفایل خود را تکمیل کنید:</b>`,
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

    btn_advanced: '🔍 جستجو پیشرفته (رایگان)',
    adv_menu_title: '🛠 فیلترهای جستجو را تنظیم کنید:\n\nنکته: انتخاب "همه" یعنی آن گزینه برایتان مهم نیست.',
    filter_set: '✅ فیلتر تنظیم شد.',
    
    // Chat & System
    connected: '✅ وصل شدید! شروع به چت کنید. 👋',
    partner_disconnected: '🚫 طرف مقابل مکالمه را قطع کرد.',
    you_disconnected: '🚫 شما مکالمه را قطع کردید.',
    searching: '🔍 در حال جستجو... لطفا صبر کنید.',
    search_stopped: '🛑 جستجو متوقف شد.',
    spam_warn: '⚠️ شما خیلی سریع پیام میدهید! ۵ دقیقه محدود شدید.',
    link_blocked: '🚫 ارسال لینک یا آیدی مجاز نیست!',
    
    // Ban & Mute Systems (FIXED)
    banned_msg: '⛔️ حساب شما مسدود شده است.',
    banned_reason: '⛔️ شما بن شدید.\n📝 دلیل: ', 
    muted_msg: '🤐 شما توسط ادمین میوت شدید.\n⏳ مدت زمان: ', 
    unmuted_msg: '🗣 سکوت شما برداشته شد. میتوانید چت کنید.',
    mute_error: '🤐 شما در حالت سکوت هستید.\n⏳ زمان باقی‌مانده: ', 
    profile_viewed: '👁 کاربر پروفایل شما را مشاهده کرد.',
    self_vote: '⚠️ نمیتوانید به خودتان رای دهید!',

// Credits & Referral
    credit_balance: '💰 موجودی سکه: ',
    low_credit: '⚠️ موجودی سکه شما کافی نیست!',
    low_credit_msg: 'برای این جستجو نیاز به سکه دارید.\n\n👇 از دکمه زیر لینک دعوت خود را بگیرید و دوستانتان را دعوت کنید تا سکه رایگان بگیرید.',
    referral_title: '💰 کسب درآمد (سکه رایگان)',
    referral_desc: '🎁 با دعوت هر دوست، ۵ سکه دریافت کنید!\n\n🔗 لینک اختصاصی شما:',
    referral_reward: '🎉 تبریک! یکی از دوستان شما عضو شد و ۵ سکه دریافت کردید.',
    
    // --- UPDATED SHOP TEXTS ---
    btn_shop: '💰 فروشگاه / دریافت سکه', // New Button Name
    shop_msg: `💎 <b>فروشگاه سکه</b>\n\n` +
              `با خرید سکه، علاوه بر امکانات جستجو، نشان‌های <b>VIP</b> و <b>VVIP</b> دریافت کنید!\n\n` +
              `👇 <b>تعرفه بسته‌ها:</b>\n\n` +
              `🥉 <b>۵۰ سکه</b> = ۵۰ افغانی\n` +
              `🌟 <b>۱۲۰ سکه</b> = ۱۰۰ افغانی (دریافت نشان VIP در پروفایل)\n` +
              `💎 <b>۳۰۰ سکه</b> = ۲۰۰ افغانی (دریافت نشان VVIP در پروفایل)\n\n` +
              `💳 برای خرید، روی دکمه "ارتباط با ادمین" کلیک کنید.\n` +
              `🎁 همچنین میتوانید با دعوت دوستان، سکه رایگان بگیرید.`,

    btn_settings: '⚙️ تنظیمات', // New Button
    settings_title: '⚙️ به بخش تنظیمات خوش آمدید.',
    blocked_list: '🚫 لیست سیاه (کاربران مسدود شده)',
    blocked_empty: '✅ لیست سیاه شما خالی است.',
    blocked_count: '👥 تعداد افراد مسدود شده: ',
    unblock_all_btn: '♻️ حذف همه از لیست سیاه',
    unblock_done: '✅ تمام کاربران از لیست سیاه خارج شدند.',
    
    // Reporting
    report_btn: '⚠️ گزارش تخلف',
    report_ask: 'علت گزارش چیست؟',
    report_sent: '✅ گزارش شما برای ادمین ارسال شد.',
    report_reasons: ['تبلیغات/لینک', 'بی‌ادبی/توهین', 'مزاحمت', 'اسکم/کلاهبرداری']
};

// --- GIFT CONFIGURATION ---
const GIFT_PRICES = {
    rose:    { cost: 50,  icon: '🌹', name: 'گل رز' },
    crown:   { cost: 200, icon: '👑', name: 'تاج' }, // Replaces Trophy (Mid Tier)
    diamond: { cost: 500, icon: '💎', name: 'الماس' }       // Most Expensive (Top Tier)
};

const ICEBREAKERS = [
    'اگر میتوانستی یک ابرقدرت داشته باشی، چی انتخاب میکردی؟ 🦸‍♂️',
    'آخرین آهنگی که گوش دادی چی بود؟ 🎧',
    'بدترین غذایی که تا حالا خوردی چی بوده؟ 🤢',
    'اگر ۱ میلیارد پول داشتی، اولین چیزی که میخریدی چی بود؟ 💰',
    'فیلم مورد علاقه ات چیست؟ 🎬',
    'خنده دار ترین خاطره مکتبت را بگو 😂',
    'اگر حیوان بودی، دوست داشتی چی باشی؟ 🦁',
    'یک راز که به کسی نگفتی را بگو 🤫',
    'طرفدار کدام تیم فوتبال هستی؟ ⚽️'
];

const TRANSLATIONS = {
    gender: 'جنسیت',
    province: 'ولایت',
    age: 'سن',
    job: 'شغل',
    purpose: 'هدف'
};

const PROVINCES = ['کابل', 'هرات', 'قندهار', 'بلخ', 'ننگرهار', 'هلمند', 'کندز', 'فاریاب', 'غزنی', 'پکتیا', 'جوزجان', 'تخار', 'بدخشان', 'بغلان', 'خوست', 'سمنگان', 'نیمروز', 'سرپل', 'فراه', 'کنر', 'لوگر', 'زابل', 'لغمان', 'پکتیکا', 'پنجشیر', 'پروان', 'اروزگان', 'کاپیسا', 'بامیان', 'میدان وردک', 'غور', 'دایکندی', 'نورستان', 'بادغیس', 'خارج از کشور'];
const GENDERS = ['پسر 👦', 'دختر 👧'];
const JOBS = ['کارگر 🛠', 'شغل آزاد 💼', 'محصل 🎓', 'بیکار 🏠', 'کارمند 📝', 'داکتر 🩺', 'تاجر 💎'];
const PURPOSES = ['سرگرمی 🎭', 'پیدا کردن دوست 🤝', 'درد دل 💔'];
const AGES = Array.from({ length: 66 }, (_, i) => (i + 15).toString());

// --- DATABASE ---
mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('✅ DB Connected');
        
        // --- FIX FOR E11000 ERROR ---
        try {
            // This forces MongoDB to delete the old, conflicting index causing the crash
            await mongoose.connection.collection('users').dropIndex('botUserId_1');
            console.log('🗑️ Fixed: Deleted old/bad database index "botUserId_1"');
        } catch (e) {
            // If the index is already gone, ignore this error
        }
    })
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
    searchFilters: {
        gender: { type: String, default: 'all' },
        province: { type: String, default: 'all' },
        age: { type: String, default: 'all' },
        job: { type: String, default: 'all' },
        purpose: { type: String, default: 'all' }
    },
    searchGender: { type: String, default: 'all' }, // <--- ADD THIS LINE HERE
    credits: { type: Number, default: 0 },
    invitedBy: { type: Number },
    stats: { 
        likes: { type: Number, default: 0 }, 
        dislikes: { type: Number, default: 0 },
        likedBy: { type: [Number], default: [] },     // Stores IDs of Likers
        dislikedBy: { type: [Number], default: [] }   // Stores IDs of Dislikers (New)
    },
    // --- NEW: GIFTS SYSTEM ---
    gifts: {
        rose: { type: Number, default: 0 },
        crown: { type: Number, default: 0 },   // Changed from 'trophy'
        diamond: { type: Number, default: 0 }
    },
    // -------------------------
    blockedUsers: { type: [Number], default: [] },
    status: { type: String, default: 'idle' },
    partnerId: Number,
    lastMsgId: Number,
    lastReceivedMsgId: Number,
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
    [TEXTS.btn_profile, TEXTS.btn_edit],
    [TEXTS.btn_shop, TEXTS.btn_settings] // Changed to btn_shop
]).resize();

const getSettingsMenu = () => Markup.keyboard([
    ['❤️ چه کسانی مرا لایک کردند؟'], // New Premium Button
    [TEXTS.blocked_list],
    [TEXTS.btn_back]
]).resize();

const getChatMenu = () => Markup.keyboard([
    ['🚫 قطع مکالمه', '📄 مشاهده پروفایل'], 
    ['⛔️ بلاک کردن این کاربر', TEXTS.report_btn]
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
        
        // 1. Ban Check (FIXED: Admin is immune)
        if (user.banned) {
            // If it is the Admin, auto-unban them immediately
            if (ctx.from.id === ADMIN_ID) {
                user.banned = false;
                await user.save();
                await ctx.reply('🔓 ادمین گرامی، شما از حالت بن خارج شدید.');
            } else {
                // If it's a normal user, stop them
                return ctx.reply(TEXTS.banned_msg);
            }
        }

        // 2. Mute Check
        if (user.muteUntil > Date.now()) {
            const remainingMs = user.muteUntil - Date.now();
            const remainingMins = Math.ceil(remainingMs / 60000);
            return ctx.reply(`${TEXTS.mute_error} ${remainingMins} دقیقه.`);
        }

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
// --- ADMIN COMMANDS ---

// Usage: /ban 12345 Reason
bot.command('ban', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    
    const args = ctx.message.text.split(' ');
    const targetId = parseInt(args[1]);
    const reason = args.slice(2).join(' ') || 'رعایت نکردن قوانین'; // Default reason

    if (!targetId) return ctx.reply('❌ فرمت: /ban [ID] [Reason]');

    // --- PREVENT BANNING ADMIN ---
    if (targetId === ADMIN_ID) {
        return ctx.reply('😳 شما نمیتوانید ادمین (خودتان) را بن کنید!');
    }
    // -----------------------------
    
    // Update DB
    await User.updateOne({ telegramId: targetId }, { banned: true, status: 'idle', partnerId: null });
    
    ctx.reply(`✅ کاربر ${targetId} بن شد.\n📝 دلیل: ${reason}`);

    // Notify User (Fixed undefined error)
    try {
        await ctx.telegram.sendMessage(targetId, `${TEXTS.banned_reason} ${reason}`);
    } catch (e) {} 
});

bot.command('unban', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const targetId = parseInt(ctx.message.text.split(' ')[1]);
    if (!targetId) return ctx.reply('❌ آیدی وارد نشد.');
    
    await User.updateOne({ telegramId: targetId }, { banned: false });
    ctx.reply(`✅ کاربر ${targetId} آنبن شد.`);
    try { await ctx.telegram.sendMessage(targetId, '✅ حساب شما باز شد.'); } catch (e) {}
});

// Usage: /mute 12345 30
bot.command('mute', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    
    const args = ctx.message.text.split(' ');
    const targetId = parseInt(args[1]);
    let minutes = parseInt(args[2]);

    if (!targetId) return ctx.reply('❌ فرمت: /mute [ID] [Time(Optional)]');
    if (!minutes || isNaN(minutes)) minutes = 15; // Default 15 minutes

    const muteUntil = new Date(Date.now() + minutes * 60000);
    
    await User.updateOne({ telegramId: targetId }, { muteUntil: muteUntil });
    
    ctx.reply(`✅ کاربر ${targetId} برای ${minutes} دقیقه میوت شد.`);
    
    // Notify User (Fixed undefined error)
    try {
        await ctx.telegram.sendMessage(targetId, `${TEXTS.muted_msg} ${minutes} دقیقه.`);
    } catch (e) {}
});

bot.command('unmute', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const targetId = parseInt(ctx.message.text.split(' ')[1]);
    if (!targetId) return ctx.reply('❌ آیدی وارد نشد.');

    // Set muteUntil to current time to unmute immediately
    await User.updateOne({ telegramId: targetId }, { muteUntil: Date.now() });
    
    ctx.reply(`✅ کاربر ${targetId} آن‌میوت شد.`);
    
    // Notify User (Fixed undefined error)
    try { 
        await ctx.telegram.sendMessage(targetId, TEXTS.unmuted_msg); 
    } catch (e) {}
});
// Usage: /give 123456789 100
bot.command('give', async (ctx) => {
    // 1. Security Check
    if (ctx.from.id !== ADMIN_ID) return;

    // 2. Parse Data
    const args = ctx.message.text.split(' ');
    const targetId = parseInt(args[1]);
    const amount = parseInt(args[2]);

    // 3. Validation
    if (!targetId || isNaN(targetId) || !amount || isNaN(amount)) {
        return ctx.reply('❌ فرمت اشتباه است!\n✅ مثال: /give 123456789 100');
    }

    try {
        // 4. Find User
        const user = await User.findOne({ telegramId: targetId });
        if (!user) return ctx.reply('❌ کاربر با این آیدی یافت نشد.');

        // 5. Update Credits
        user.credits += amount;
        await user.save();

        // 6. Confirm to Admin
        await ctx.reply(
            `✅ عملیات موفقیت‌آمیز بود.\n\n` +
            `👤 کاربر: <code>${targetId}</code>\n` +
            `➕ مقدار: ${amount} سکه\n` +
            `💰 موجودی جدید: ${user.credits} سکه`,
            { parse_mode: 'HTML' }
        );

        // 7. Notify the User (Professional Receipt)
        const receiptMsg = `🎉 <b>حساب شما شارژ شد!</b>\n\n` +
                           `➕ <b>مقدار شارژ:</b> ${amount} سکه\n` +
                           `💰 <b>موجودی جدید:</b> ${user.credits} سکه\n\n` +
                           `🛍 <i>از خرید و اعتماد شما سپاسگزاریم.</i>`;

        await ctx.telegram.sendMessage(targetId, receiptMsg, { parse_mode: 'HTML' });

    } catch (e) {
        console.error(e);
        ctx.reply('⚠️ سکه اضافه شد، اما نتوانستم به کاربر پیام بفرستم (شاید ربات را بلاک کرده).');
    }
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

bot.start(async (ctx) => {
    // 1. Check if user exists
    let user = await User.findOne({ telegramId: ctx.from.id });
    
    // --- FIX: RESET STATUS ON START ---
    if (user && user.status === 'searching') {
        user.status = 'idle';
        user.searchGender = null;
        await user.save();
        await ctx.reply(TEXTS.search_stopped); // Optional: Tell them search stopped
    }
    
    // 2. If NEW USER, handle Referral
    if (!user) {
        const referrerId = parseInt(ctx.startPayload); // Gets the ID from t.me/bot?start=12345
        
        user = new User({ 
            telegramId: ctx.from.id, 
            regStep: 'intro',
            invitedBy: referrerId || null 
        });
        await user.save();

        // Award the Referrer (if valid)
        if (referrerId && referrerId !== ctx.from.id) {
            const referrer = await User.findOne({ telegramId: referrerId });
            if (referrer) {
                referrer.credits += 5; // +5 Credits Reward
                await referrer.save();
                // Notify Referrer
                try {
                    await ctx.telegram.sendMessage(referrerId, `${TEXTS.referral_reward}\n💰 موجودی جدید: ${referrer.credits}`);
                } catch (e) {}
            }
        }
    }

    // 3. Normal Start Flow
    if (user.regStep === 'completed') {
        return ctx.reply(TEXTS.main_menu_title, getMainMenu());
    }

    // Start Registration
    ctx.user = user; // Ensure ctx.user is set
    ctx.user.regStep = 'intro'; await ctx.user.save();
    
    // We add { parse_mode: 'HTML' } so the bold text works
    const m = await ctx.reply(TEXTS.intro, { parse_mode: 'HTML' });
    
    setTimeout(async () => {
        await cleanPrev(ctx);
        ctx.user.regStep = 'name'; await ctx.user.save();
        const m2 = await ctx.reply(TEXTS.ask_name, Markup.removeKeyboard());
        ctx.user.lastMsgId = m2.message_id; await ctx.user.save();
    }, 3000);
});
// --- WHO LIKED ME (PREMIUM FEATURE) ---
bot.hears('❤️ چه کسانی مرا لایک کردند؟', async (ctx) => {
    const user = ctx.user;

    // 1. Check VIP Status (Must have > 100 coins or be VIP)
    // You can adjust this number (e.g., 120 for VIP)
    const REQUIRED_COINS = 100; 
    
    if (user.credits < REQUIRED_COINS) {
        return ctx.reply(
            `🔒 <b>این قابلیت مخصوص کاربران VIP است!</b>\n\n` +
            `برای مشاهده لیست افرادی که شما را لایک کرده‌اند، باید حساب VIP داشته باشید (حداقل ${REQUIRED_COINS} سکه موجودی).\n\n` +
            `💎 <b>مزایای VIP:</b>\n` +
            `✅ مشاهده لیست لایک‌کنندگان\n` +
            `✅ نشان ویژه در پروفایل\n` +
            `✅ اولویت در جستجو\n\n` +
            `👇 جهت خرید سکه یا دریافت رایگان اقدام کنید:`, 
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💳 خرید سکه (ارتقا به VIP)', callback_data: 'show_shop_info' }],
                        [{ text: '🎁 دریافت سکه رایگان', callback_data: 'get_ref_link' }]
                    ]
                }
            }
        );
    }

    // 2. Fetch Likers
    const likerIds = user.stats.likedBy;
    
    if (!likerIds || likerIds.length === 0) {
        return ctx.reply('💔 هنوز کسی شما را لایک نکرده است.');
    }

    // Limit to last 10 people to avoid lag
    const recentLikers = likerIds.slice(-10).reverse(); 
    
    // Find these users in DB to get their names
    const profiles = await User.find({ telegramId: { $in: recentLikers } });

    if (profiles.length === 0) {
        return ctx.reply('💔 لیست لایک‌کنندگان در دسترس نیست.');
    }

    // 3. Create List with Buttons
    let msg = `😍 <b>لیست طرفداران شما (VIP):</b>\n\n` +
              `👇 برای مشاهده پروفایل کامل، روی نام کلیک کنید:`;

    const buttons = [];
    profiles.forEach(p => {
        // Sanitize Name
        const name = p.displayName || 'کاربر ناشناس';
        // Create a button for each person: "Name | Age | Province"
        const btnText = `${name} (${p.profile.age || '?'} ساله - ${p.profile.province || '?'})`;
        
        // Add button that triggers view_profile
        buttons.push([Markup.button.callback(btnText, `view_profile_${p.telegramId}`)]);
    });

    await ctx.reply(msg, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
    });
});
// We add sticker, animation (GIFs), video, and voice to the list so the bot detects them
bot.on(['text', 'photo', 'sticker', 'animation', 'video', 'voice'], async (ctx) => {
    const user = ctx.user;
    const text = ctx.message.text || "";

    // 1. CHAT MODE
    if (user.status === 'chatting' && user.partnerId) {

        // If it is NOT text and NOT a photo, send a warning and stop.
        if (!ctx.message.text && !ctx.message.photo) {
            return ctx.reply('🚫 ارسال استیکر، گیف، ویدیو یا ویس مجاز نیست!\nفقط متن و عکس ارسال کنید.');
        }
        
        // --- BLOCK ACTION ---
        if (text === '⛔️ بلاک کردن این کاربر') {
            // Add partner ID to my blocked list
            user.blockedUsers.push(user.partnerId);
            await user.save();
            
            await ctx.reply(`✅ کاربر بلاک شد. دیگر با این شخص وصل نخواهید شد.`);
            
            // End the chat
            return endChat(ctx.from.id, user.partnerId, ctx);
        }
        // --------------------

        if (text === '🚫 قطع مکالمه') return endChat(ctx.from.id, user.partnerId, ctx);
        
        if (text === '📄 مشاهده پروفایل') {
            const partner = await User.findOne({ telegramId: user.partnerId });
            return showProfile(ctx, partner, false);
        }


        if (text === '🎁 ارسال هدیه') {
            return ctx.reply('🎁 <b>کدام هدیه را ارسال میکنید؟</b>\n\n' +
                `هدیه‌ها در پروفایل طرف مقابل نمایش داده میشوند و نشانه محبت شماست! 👇`, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: `🌹 گل رز (${GIFT_PRICES.rose.cost} سکه)`, callback_data: 'gift_rose' }
                        ],
                        [
                            { text: `💎 الماس (${GIFT_PRICES.diamond.cost} سکه)`, callback_data: 'gift_diamond' }
                        ],
                        [
                            { text: `🏆 جام طلایی (${GIFT_PRICES.trophy.cost} سکه)`, callback_data: 'gift_trophy' }
                        ],
                        [{ text: '🔙 منصرف شدم', callback_data: 'cancel_gift' }]
                    ]
                }
            });
        }
        
        
        // REPORT TRIGGER (Keep your existing report code here)
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

        // --- CHAT ACTIONS (Typing Indicator Fixed) ---
        try {
            const actionType = ctx.message.photo ? 'upload_photo' : 'typing';
            
            // 1. Send the "Typing..." status to the partner
            await ctx.telegram.sendChatAction(user.partnerId, actionType);

            // 2. If it is TEXT, wait 800ms so the user actually sees "Typing..."
            // (Photos are naturally slow, so they don't need a delay)
            if (!ctx.message.photo) {
                await new Promise(resolve => setTimeout(resolve, 800));
            }

        } catch (e) {
            // If partner blocked bot, end chat immediately
            await endChat(ctx.from.id, user.partnerId, ctx);
            return;
        }
        // ---------------------------------------------

        // Forward Message
        try { 
            const sentMsg = await ctx.copyMessage(user.partnerId); 
            await User.updateOne({ telegramId: user.partnerId }, { lastReceivedMsgId: sentMsg.message_id });
        } catch (e) { 
            await endChat(ctx.from.id, user.partnerId, ctx); 
        }
        return;
    }

    // --- SEARCH FILTER INPUT HANDLING ---
    if (user.regStep && user.regStep.startsWith('search_')) {
        const type = user.regStep.replace('search_', '');
        
        // Save the filter
        // If user typed "همه", save 'all'
        user.searchFilters[type] = (text === 'همه') ? 'all' : text;
        
        // Reset state
        user.regStep = 'completed';
        await user.save();
        
        await ctx.reply(`✅ فیلتر ${TRANSLATIONS[type]} تنظیم شد.`, Markup.removeKeyboard());
        return showAdvancedMenu(ctx); // Show the menu again
    }
    // ------------------------------------

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
            ['🎲 جستجو شانسی'], // Removed "(رایگان)"
            ['👦 جستجو پسر', '👩 جستجو دختر'], // Removed "(۲ سکه)"
            ['🔍 جستجو پیشرفته'], // Removed "(۱۰ سکه)"
            [TEXTS.btn_back]
        ]).resize());
    }

    // --- ADD THIS LINE HERE ---
    if (text === TEXTS.btn_advanced) return showAdvancedMenu(ctx);
    // --------------------------

    // --- PASTE THE SHOP LOGIC HERE ---
    if (text === TEXTS.btn_shop) {
        const adminUser = 'dguyhimself'; // Ensure this username is correct
        
        return ctx.reply(TEXTS.shop_msg, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '👤 ارتباط با ادمین (خرید فوری)', url: `https://t.me/${adminUser}` }],
                    [{ text: '🎁 دریافت لینک دعوت (رایگان)', callback_data: 'get_ref_link' }]
                ]
            }
        });
    }
    // --------------------------------

    

    if (text === TEXTS.btn_profile) return showProfile(ctx, user, true);
    
    if (text === TEXTS.btn_edit) return ctx.reply('بخش مورد نظر را انتخاب کنید:', getEditMenu());
    
    if (text === TEXTS.btn_back || text === '🔙 برگشت به منوی اصلی') return ctx.reply(TEXTS.main_menu_title, getMainMenu());

    // --- NEW SETTINGS LOGIC ---
    if (text === TEXTS.btn_settings) {
        return ctx.reply(TEXTS.settings_title, getSettingsMenu());
    }

    if (text === TEXTS.blocked_list) {
        const count = user.blockedUsers.length;
        if (count === 0) {
            return ctx.reply(TEXTS.blocked_empty);
        } else {
            // Show count and an Inline Button to Unblock All
            return ctx.reply(
                `${TEXTS.blocked_count} ${count} نفر`, 
                Markup.inlineKeyboard([
                    [Markup.button.callback(TEXTS.unblock_all_btn, 'action_unblock_all')]
                ])
            );
        }
    }
    
// Search Actions (Updated with Persian Text & Costs)
    if (text === '❌ لغو جستجو') return stopSearch(ctx); // <--- ADD THIS LINE
    if (text === '🎲 جستجو شانسی') return startSearch(ctx, 'random');
    if (text === '👦 جستجو پسر') return startSearch(ctx, 'boy');
    if (text === '👩 جستجو دختر') return startSearch(ctx, 'girl');
    if (text === '🔍 جستجو پیشرفته') return showAdvancedMenu(ctx);

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

// --- VIEW SPECIFIC PROFILE HANDLER ---

// 1. Handle Button Click from "Who Liked Me" list
bot.action(/^view_profile_(\d+)$/, async (ctx) => {
    const targetId = parseInt(ctx.match[1]);
    const targetUser = await User.findOne({ telegramId: targetId });
    
    // Use true/false depending on if you want them to see the "Gift" button
    // Here we pass 'false' for isSelf so they can gift them back!
    await showProfile(ctx, targetUser, false); 
    await ctx.answerCbQuery();
});

// 2. Handle Command: /profile 123456
bot.command('profile', async (ctx) => {
    const args = ctx.message.text.split(' ');
    const targetId = parseInt(args[1]);

    if (!targetId || isNaN(targetId)) {
        return ctx.reply('❌ فرمت اشتباه است.\n✅ مثال: /profile 123456789');
    }

    const targetUser = await User.findOne({ telegramId: targetId });
    if (!targetUser) {
        return ctx.reply('❌ کاربر با این آیدی در ربات یافت نشد.');
    }

    // Check if it's the user themselves
    const isSelf = (targetId === ctx.from.id);
    await showProfile(ctx, targetUser, isSelf);
});

// --- UNBLOCK ACTION ---
bot.action('action_unblock_all', async (ctx) => {
    try {
        // Clear the array
        await User.updateOne({ telegramId: ctx.from.id }, { blockedUsers: [] });
        
        await ctx.answerCbQuery('انجام شد');
        await ctx.editMessageText(TEXTS.unblock_done);
    } catch (e) {
        console.error(e);
    }
});
// --- SHOP INFO ACTION (Triggered from Low Credit Message) ---
bot.action('show_shop_info', async (ctx) => {
    const adminUser = 'dguyhimself'; // Ensure this username is correct
    const shopMsg = `💎 <b>فروشگاه سکه</b>\n\n` +
              `با خرید سکه، علاوه بر امکانات جستجو، نشان‌های <b>VIP</b> و <b>VVIP</b> دریافت کنید!\n\n` +
              `👇 <b>تعرفه بسته‌ها:</b>\n\n` +
              `🥉 <b>۵۰ سکه</b> = ۵۰ افغانی\n` +
              `🌟 <b>۱۲۰ سکه</b> = ۱۰۰ افغانی (دریافت نشان VIP در پروفایل)\n` +
              `💎 <b>۳۰۰ سکه</b> = ۲۰۰ افغانی (دریافت نشان VVIP در پروفایل)\n\n` +
              `💳 برای خرید، روی دکمه "ارتباط با ادمین" کلیک کنید.\n` +
              `🎁 همچنین میتوانید با دعوت دوستان، سکه رایگان بگیرید.`;

    await ctx.reply(shopMsg, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '👤 پیام به ادمین برای خرید', url: `https://t.me/${adminUser}` }]
            ]
        }
    });
    await ctx.answerCbQuery();
});
bot.action('get_ref_link', async (ctx) => {
    const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
    await ctx.reply(`${TEXTS.referral_desc}\n\n${link}`);
    await ctx.answerCbQuery();
});
// --- ICEBREAKER ACTION ---
bot.action('action_icebreaker', async (ctx) => {
    try {
        const user = ctx.user;
        // 1. Check if they are still chatting
        if (user.status !== 'chatting' || !user.partnerId) {
            return ctx.deleteMessage(); // Delete button if chat ended
        }

        // 2. Pick a random question
        const question = ICEBREAKERS[Math.floor(Math.random() * ICEBREAKERS.length)];
        const msgText = `🎲 <b>سوال پیشنهادی:</b>\n\n${question}`;

        // 3. Send the question to the USER (and delete the button)
        await ctx.deleteMessage(); // This makes the button disappear!
        await ctx.reply(msgText, { parse_mode: 'HTML' });

        // 4. Send the question to the PARTNER
        try {
            await ctx.telegram.sendMessage(user.partnerId, msgText, { parse_mode: 'HTML' });
        } catch (e) {
            // Partner blocked bot
        }

    } catch (e) {
        console.error('Icebreaker Error:', e);
    }
});

// --- 1. OPEN GIFT MENU ---
bot.action(/^pre_gift_(\d+)$/, async (ctx) => {
    const targetId = ctx.match[1]; // Get the ID of the person we are viewing
    
    // Config (Ensure this is defined at top of file as mentioned before)
    // const GIFT_PRICES = { ... } 

    await ctx.reply('🎁 <b>کدام هدیه را ارسال میکنید؟</b>\n\n' +
        `هدیه‌ها در پروفایل طرف مقابل نمایش داده میشوند و نشانه محبت شماست! 👇`, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: `🌹 گل رز (${GIFT_PRICES.rose.cost} سکه)`, callback_data: `send_gift_${targetId}_rose` }
                ],
                [
                    { text: `👑 تاج (${GIFT_PRICES.crown.cost} سکه)`, callback_data: `send_gift_${targetId}_crown` }
                ],
                [
                    { text: `💎 الماس (${GIFT_PRICES.diamond.cost} سکه)`, callback_data: `send_gift_${targetId}_diamond` }
                ],
                [{ text: '🔙 لغو', callback_data: 'delete_msg' }]
            ]
        }
    });
    await ctx.answerCbQuery();
});

// Helper to delete message
bot.action('delete_msg', async (ctx) => {
    await ctx.deleteMessage();
});

// --- 2. PROCESS GIFT TRANSACTION ---
bot.action(/^send_gift_(\d+)_(.*)$/, async (ctx) => {
    const targetId = parseInt(ctx.match[1]); // The person receiving
    const type = ctx.match[2]; // rose, diamond, trophy
    const user = ctx.user;

    // 1. Validation
    if (!GIFT_PRICES[type]) return ctx.answerCbQuery('❌ هدیه نامعتبر است.');
    
    // Prevent gifting yourself (just in case)
    if (user.telegramId === targetId) return ctx.answerCbQuery('نمیتوانید به خودتان هدیه دهید!');

    const item = GIFT_PRICES[type];

    // 2. Check Balance
    if (user.credits < item.cost) {
        return ctx.answerCbQuery(`❌ سکه کافی نیست! نیاز به ${item.cost} سکه دارید.`, { show_alert: true });
    }

    try {
        // 3. Deduct from sender
        user.credits -= item.cost;
        await user.save();

        // 4. Add to target
        const targetUser = await User.findOne({ telegramId: targetId });
        if (targetUser) {
            targetUser.gifts[type] = (targetUser.gifts[type] || 0) + 1;
            await targetUser.save();

            // Notify Target
            const receiveMsg = `🎁 <b>تبریک!</b>\n\n` +
                               `کاربری به شما یک <b>${item.name} ${item.icon}</b> هدیه داد!\n` +
                               `این هدیه به پروفایل شما اضافه شد.`;
            
            try {
                await ctx.telegram.sendMessage(targetId, receiveMsg, { parse_mode: 'HTML' });
            } catch (e) {
                // Target blocked bot, ignore
            }
        }

        // 5. Success Message & Close Menu
        await ctx.deleteMessage(); 
        await ctx.reply(`✅ <b>${item.icon} با موفقیت ارسال شد!</b>\n💰 ${item.cost} سکه کسر گردید.`, { parse_mode: 'HTML' });

    } catch (e) {
        console.error('Gift Error:', e);
        ctx.reply('⚠️ خطا در انجام عملیات.');
    }
});

// --- GIFTING SYSTEM LOGIC ---
bot.action(/^gift_(.*)$/, async (ctx) => {
    const type = ctx.match[1]; // rose, diamond, or trophy
    const user = ctx.user;
    
    // 1. Validation
    if (!GIFT_PRICES[type]) return ctx.answerCbQuery('❌ هدیه نامعتبر است.');
    if (user.status !== 'chatting' || !user.partnerId) {
        return ctx.deleteMessage().catch(() => {}); // Remove menu if chat ended
    }

    const item = GIFT_PRICES[type];

    // 2. Check Balance
    if (user.credits < item.cost) {
        return ctx.answerCbQuery(`❌ سکه کافی نیست! نیاز به ${item.cost} سکه دارید.`, { show_alert: true });
    }

    // 3. Execute Transaction
    try {
        // Deduct from sender
        user.credits -= item.cost;
        await user.save();

        // Add to partner
        const partner = await User.findOne({ telegramId: user.partnerId });
        if (partner) {
            partner.gifts[type] = (partner.gifts[type] || 0) + 1;
            await partner.save();

            // Notify Partner
            const receiveMsg = `🎁 <b>تبریک!</b>\n\n` +
                               `هم‌صحبت شما یک <b>${item.name} ${item.icon}</b> برای شما فرستاد!\n` +
                               `این هدیه به پروفایل شما اضافه شد.`;
            
            await ctx.telegram.sendMessage(partner.telegramId, receiveMsg, { parse_mode: 'HTML' });
        }

        // 4. Success Feedback
        await ctx.deleteMessage(); // Remove the menu
        await ctx.reply(`✅ <b>${item.icon} ارسال شد!</b>\n💰 ${item.cost} سکه کسر گردید.`, { parse_mode: 'HTML' });

    } catch (e) {
        console.error('Gift Error:', e);
        ctx.reply('⚠️ خطا در ارسال هدیه.');
    }
});

bot.action('cancel_gift', async (ctx) => {
    await ctx.deleteMessage();
});

// --- REPORT ACTION HANDLER ---
bot.action(/^rep_(.*)_(.*)$/, async (ctx) => {
    try {
        const reasonMap = { 'harass': 'مزاحمت', 'spam': 'تبلیغات', 'rude': 'بی‌ادبی', 'scam': 'کلاهبرداری' };
        const rawReason = ctx.match[1];
        const reason = reasonMap[rawReason] || rawReason;
        const offenderId = parseInt(ctx.match[2]);
        const reporterId = ctx.from.id;

        // Get the reporter to find the evidence (last received message)
        const reporter = await User.findOne({ telegramId: reporterId });

        await ctx.answerCbQuery('گزارش ثبت شد');
        await ctx.editMessageText(TEXTS.report_sent);

        // 1. Send Admin Alert
        const adminMsg = `🚨 **گزارش جدید!**\n\n` +
                         `👤 گزارش‌دهنده: \`${reporterId}\`\n` +
                         `👿 متخلف: \`${offenderId}\`\n` +
                         `⚠️ علت: ${reason}\n\n` +
                         `👇 **مدرک (آخرین پیام):** در پایین 👇\n` +
                         `🔨 عملیات:\n` +
                         `/ban ${offenderId} [دلیل]\n` +
                         `/mute ${offenderId} [دقیقه]`;
        
        await ctx.telegram.sendMessage(ADMIN_ID, adminMsg, { parse_mode: 'Markdown' });

        // 2. Forward the Evidence (The bad message) to Admin
        if (reporter && reporter.lastReceivedMsgId) {
            try {
                await ctx.telegram.forwardMessage(ADMIN_ID, reporterId, reporter.lastReceivedMsgId);
            } catch (err) {
                await ctx.telegram.sendMessage(ADMIN_ID, '⚠️ پیام مدرک حذف شده یا قابل دسترسی نیست.');
            }
        }
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
            // --- SMART RESIZE LOGIC ---
            // Telegram sends multiple sizes: [small, medium, large, original]
            // We want the version closest to 800px width (Standard HD)
            // This prevents massive 4K files from being saved.
            
            const desiredWidth = 800; // The perfect size for mobile/desktop
            const photos = ctx.message.photo;

            // Find the photo closest to 800px
            const bestPhoto = photos.reduce((prev, curr) => {
                return (Math.abs(curr.width - desiredWidth) < Math.abs(prev.width - desiredWidth) ? curr : prev);
            });

            user.profile.photoId = bestPhoto.file_id;
            // ---------------------------
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

async function showProfile(ctx, targetUser, isSelf) {
    if (!targetUser) return ctx.reply('❌ کاربر یافت نشد.');
    
    const p = targetUser.profile;
    
    // Sanitize name to prevent HTML injection
    const safeName = (targetUser.displayName || 'نامشخص')
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // --- 1. DETERMINE BADGE (VIP / VVIP) ---
    let userBadge = '👤 کاربر عادی';
    
    // Top Tier (300+ coins)
    if (targetUser.credits >= 300) {
        userBadge = '💎 <b>VVIP (Diamond)</b>'; 
    } 
    // Middle Tier (100+ coins)
    else if (targetUser.credits >= 100) {
        userBadge = '🌟 <b>VIP (Gold)</b>';
    }

    // --- 2. GIFTS DISPLAY (Updated Hierarchy) ---
    let giftsDisplay = '';
    const g = targetUser.gifts || {};
    
    // Check if they have ANY gifts (using new keys)
    const hasGifts = (g.rose > 0 || g.diamond > 0 || g.crown > 0);

    if (hasGifts) {
        giftsDisplay += `💎 <b>ویترین هدایا:</b>\n`; 
        
        // Order: Diamond (Top) -> Crown -> Rose
        if (g.diamond > 0) giftsDisplay += `💎 <b>${g.diamond}</b> الماس\n`;
        if (g.crown > 0)   giftsDisplay += `👑 <b>${g.crown}</b> تاج\n`;
        if (g.rose > 0)    giftsDisplay += `🌹 <b>${g.rose}</b> گل رز\n`;
        
        giftsDisplay += `➖➖➖➖➖➖➖➖➖➖\n`;
    }

    // --- 3. HANDLE PRIVACY (Only show exact coins to SELF) ---
    let balanceInfo = '';
    if (isSelf) {
        balanceInfo = `💰 <b>موجودی:</b> ${targetUser.credits} سکه\n`;
    }

    // --- 4. BUILD CAPTION ---
    const caption = `🎫 <b>پروفایل کاربری</b>\n` +
                    `🔰 <b>وضعیت:</b> ${userBadge}\n` + 
                    balanceInfo + 
                    `➖➖➖➖➖➖➖➖➖➖\n` +
                    giftsDisplay + // <--- Gifts appear here
                    `👤 <b>نام:</b> ${safeName}\n` +
                    `🎂 <b>سن:</b> ${p.age || 'تعیین نشده'}\n` +
                    `🚻 <b>جنسیت:</b> ${p.gender || 'تعیین نشده'}\n` +
                    `📍 <b>ولایت:</b> ${p.province || 'تعیین نشده'}\n\n` +
                    `💼 <b>شغل:</b> ${p.job || '---'}\n` +
                    `🎯 <b>هدف:</b> ${p.purpose || '---'}\n` +
                    `➖➖➖➖➖➖➖➖➖➖\n` +
                    `🆔 <b>آیدی عددی:</b> <code>${targetUser.telegramId}</code>`;

    // --- 5. BUILD BUTTONS ---
    let inlineRows = [
        [
            { text: `👍 ${targetUser.stats.likes}`, callback_data: `like_${targetUser.telegramId}` },
            { text: `👎 ${targetUser.stats.dislikes}`, callback_data: `dislike_${targetUser.telegramId}` }
        ]
    ];

    // Only show "Send Gift" if looking at SOMEONE ELSE
    if (!isSelf) {
        inlineRows.push([
            // CHANGED: Fixed text, removed English words
            { text: '🎁 اهدای هدیه', callback_data: `pre_gift_${targetUser.telegramId}` } 
        ]);
    }

    const buttons = { inline_keyboard: inlineRows };

    // Send
    try {
        if (p.photoId) {
            await ctx.replyWithPhoto(p.photoId, { 
                caption: caption, 
                parse_mode: 'HTML', 
                reply_markup: buttons 
            });
        } else {
            await ctx.reply(caption, { 
                parse_mode: 'HTML', 
                reply_markup: buttons 
            });
        }
    } catch (e) {
        console.error('Error sending profile:', e);
        ctx.reply('⚠️ خطا در نمایش پروفایل.');
    }

    // Notify if viewed by someone else
    if (!isSelf) {
        try { 
            await ctx.telegram.sendMessage(targetUser.telegramId, TEXTS.profile_viewed); 
        } catch (e) {}
    }
}


async function showAdvancedMenu(ctx) {
    const f = ctx.user.searchFilters;
    
    // Status Text
    const status = `🕵️ <b>تنظیمات جستجو پیشرفته</b>\n\n` +
                   `🚻 جنسیت: <b>${f.gender === 'all' ? 'همه' : f.gender}</b>\n` +
                   `📍 ولایت: <b>${f.province === 'all' ? 'همه' : f.province}</b>\n` +
                   `🎂 سن: <b>${f.age === 'all' ? 'همه' : f.age}</b>\n` +
                   `💼 شغل: <b>${f.job === 'all' ? 'همه' : f.job}</b>\n` +
                   `🎯 هدف: <b>${f.purpose === 'all' ? 'همه' : f.purpose}</b>\n\n` +
                   `👇 برای تغییر روی دکمه ها کلیک کنید:`;

    // Inline Buttons to toggle settings
    const kb = Markup.inlineKeyboard([
        [Markup.button.callback('تغییر جنسیت', 'set_filter_gender'), Markup.button.callback('تغییر ولایت', 'set_filter_province')],
        [Markup.button.callback('تغییر سن', 'set_filter_age'), Markup.button.callback('تغییر شغل', 'set_filter_job')],
        [Markup.button.callback('تغییر هدف', 'set_filter_purpose')],
        [Markup.button.callback('♻️ ریست کردن (همه)', 'reset_filters')],
        [Markup.button.callback('🚀 شروع جستجو با این فیلترها', 'start_adv_search')]
    ]);

    // Handle editing existing message or sending new
    try {
        await ctx.editMessageText(status, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    } catch (e) {
        await ctx.reply(status, { parse_mode: 'HTML', reply_markup: kb.reply_markup });
    }
}

// 2. Handle "Change..." clicks
bot.action(/^set_filter_(.*)$/, async (ctx) => {
    const type = ctx.match[1];
    ctx.user.regStep = `search_${type}`; // Set a special state
    await ctx.user.save();

    let kb;
    if (type === 'gender') kb = Markup.keyboard(chunk([...GENDERS, 'همه'], 2)).resize();
    if (type === 'province') kb = Markup.keyboard(chunk([...PROVINCES, 'همه'], 3)).resize();
    if (type === 'age') kb = Markup.keyboard(chunk([...AGES, 'همه'], 6)).resize();
    if (type === 'job') kb = Markup.keyboard(chunk([...JOBS, 'همه'], 2)).resize();
    if (type === 'purpose') kb = Markup.keyboard(chunk([...PURPOSES, 'همه'], 2)).resize();

    await ctx.deleteMessage(); // Remove the inline menu to clean up
    await ctx.reply(`لطفا ${TRANSLATIONS[type]} مورد نظر را انتخاب کنید:`, kb);
});

// 3. Reset Filters
bot.action('reset_filters', async (ctx) => {
    ctx.user.searchFilters = { gender: 'all', province: 'all', age: 'all', job: 'all', purpose: 'all' };
    await ctx.user.save();
    await ctx.answerCbQuery('فیلترها ریست شد');
    await showAdvancedMenu(ctx);
});

// 4. Start the Search (Fixed: Check Credits FIRST)
bot.action('start_adv_search', async (ctx) => {
    const user = ctx.user;
    const COST = 10; // Cost for Advanced Search

    // --- 1. Check Balance Immediately ---
    if (user.credits < COST) {
        const needed = COST - user.credits;
        
        // Prepare the Error Message
        const errorMsg = `⚠️ <b>موجودی کافی نیست!</b>\n\n` +
                         `💎 هزینه این جستجو: <b>${COST}</b> سکه\n` +
                         `💰 موجودی فعلی شما: <b>${user.credits}</b> سکه\n` +
                         `❌ کسری: <b>${needed}</b> سکه\n\n` +
                         `👇 برای ادامه، سکه بخرید یا دوستانتان را دعوت کنید:`;

        // Delete the "Advanced Menu" so it doesn't clutter the chat
        await ctx.deleteMessage();

        // Send the error with the Buy/Invite buttons
        return ctx.reply(errorMsg, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💳 خرید سکه (فوری)', callback_data: 'show_shop_info' }],
                    [{ text: '🎁 دریافت لینک دعوت (رایگان)', callback_data: 'get_ref_link' }]
                ]
            }
        });
    }

    // --- 2. If Balance is OK, THEN show "Searching" and proceed ---
    await ctx.deleteMessage();
    await ctx.reply('🚀 در حال جستجو با فیلترهای شما...', Markup.keyboard([['❌ لغو جستجو']]).resize());
    
    // Call the main search function
    return startSearch(ctx, 'advanced');
});
// --- VOTE ACTION (Updates Buttons Dynamically) ---
// --- VOTE ACTION (Updated for "Who Liked Me") ---
// --- VOTE ACTION (Fixed: Anti-Spam & Persist Gift Button) ---
bot.action(/^(like|dislike)_(\d+)$/, async (ctx) => {
    const type = ctx.match[1];
    const targetId = parseInt(ctx.match[2]);
    const voterId = ctx.from.id;

    // 1. Prevent Self-Voting
    if (targetId === voterId) return ctx.answerCbQuery(TEXTS.self_vote);
    
    // 2. Fetch Target
    const target = await User.findOne({ telegramId: targetId });
    if (!target) return ctx.answerCbQuery('کاربر یافت نشد');

    // 3. CHECK DUPLICATE VOTES (Anti-Spam Logic)
    // Check if voterId is already in likedBy OR dislikedBy lists
    const hasLiked = target.stats.likedBy.includes(voterId);
    const hasDisliked = target.stats.dislikedBy && target.stats.dislikedBy.includes(voterId);

    if (hasLiked || hasDisliked) {
        return ctx.answerCbQuery('⚠️ شما قبلاً به این کاربر رای داده‌اید!', { show_alert: true });
    }

    // 4. Apply Vote
    if (type === 'like') {
        target.stats.likes++;
        target.stats.likedBy.push(voterId);
    } else {
        target.stats.dislikes++;
        // Ensure array exists (for old users)
        if (!target.stats.dislikedBy) target.stats.dislikedBy = [];
        target.stats.dislikedBy.push(voterId);
    }
    
    await target.save();

    // 5. Rebuild Keyboard (CRITICAL: Add Gift Button Back)
    // We know viewer != target (checked at step 1), so we ALWAYS add the gift button.
    const newKeyboard = [
        [
            { text: `👍 ${target.stats.likes}`, callback_data: `like_${targetId}` },
            { text: `👎 ${target.stats.dislikes}`, callback_data: `dislike_${targetId}` }
        ],
        [
            { text: '🎁 اهدای هدیه', callback_data: `pre_gift_${targetId}` }
        ]
    ];

    try {
        await ctx.editMessageReplyMarkup({ inline_keyboard: newKeyboard });
    } catch (e) {
        // Ignore "message not modified" errors
    }

    ctx.answerCbQuery('✅ نظر شما ثبت شد');
});
async function startSearch(ctx, type) {
    const userId = ctx.from.id;
    
    // 1. FORCE RELOAD USER
    const user = await User.findOne({ telegramId: userId });
    const userProfile = user.profile || {};

    // --- 2. DETERMINE COST ---
    let cost = 0;
    if (type === 'boy' || type === 'girl') cost = 2;
    if (type === 'advanced') cost = 10;

    // --- 3. CHECK BALANCE ---
    if (user.credits < cost) {
        const needed = cost - user.credits;
        const errorMsg = `⚠️ <b>موجودی کافی نیست!</b>\n\n` +
                         `💎 هزینه این جستجو: <b>${cost}</b> سکه\n` +
                         `💰 موجودی فعلی شما: <b>${user.credits}</b> سکه\n` +
                         `❌ کسری: <b>${needed}</b> سکه\n\n` +
                         `👇 برای ادامه، سکه بخرید یا دوستانتان را دعوت کنید:`;

        return ctx.reply(errorMsg, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💳 خرید سکه (فوری)', callback_data: 'show_shop_info' }],
                    [{ text: '🎁 دریافت لینک دعوت (رایگان)', callback_data: 'get_ref_link' }]
                ]
            }
        });
    }

    // --- 4. DETERMINE MY GENDER ---
    const isGirl = userProfile.gender && (userProfile.gender.includes('دختر') || userProfile.gender.toLowerCase().includes('girl'));
    const myGender = isGirl ? 'girl' : 'boy';

    // --- 5. PREPARE BASE FILTER ---
    let baseFilter = { 
        status: 'searching', 
        telegramId: { $ne: userId, $nin: user.blockedUsers }, 
        blockedUsers: { $ne: userId } 
    };

    let finalFilter = {};

    // --- 6. LOGIC SPLIT ---

    if (type === 'advanced') {
        // === I AM THE FILTERER ===
        // I want to find someone, and I am picky.
        
        finalFilter = { ...baseFilter };

        // 1. Who can I match with?
        // Randoms, other Advanceds, or people looking for me.
        finalFilter.searchGender = { $in: ['all', 'random', 'advanced', myGender] };
        
        // 2. Apply MY Filters to THEM
        const f = user.searchFilters || {}; 
        
        if (f.gender && f.gender !== 'all') {
             if (f.gender.includes('پسر')) finalFilter['profile.gender'] = /پسر|boy/i;
             else if (f.gender.includes('دختر')) finalFilter['profile.gender'] = /دختر|girl/i;
        }
        
        if (f.province && f.province !== 'all') finalFilter['profile.province'] = new RegExp(f.province, 'i');
        if (f.job && f.job !== 'all') finalFilter['profile.job'] = new RegExp(f.job, 'i');
        if (f.age && f.age !== 'all') finalFilter['profile.age'] = f.age;
        if (f.purpose && f.purpose !== 'all') finalFilter['profile.purpose'] = new RegExp(f.purpose, 'i');

    } else {
        // === I AM A RANDOM SEARCHER (OR BOY/GIRL SEARCHER) ===
        // I need to find standard waiters OR Advanced waiters whose requirements I MEET.

        // 1. My target gender (Who am I looking for?)
        let targetGenderRegex;
        if (type === 'boy') targetGenderRegex = /پسر|boy/i;
        if (type === 'girl') targetGenderRegex = /دختر|girl/i;
        // If random, undefined (accepts anyone)

        const matchConditions = [];

        // Condition A: Match Standard Waiters (Legacy/Random people)
        // They must be looking for 'all', 'random', or 'myGender'
        const standardMatch = {
            searchGender: { $in: ['all', 'random', myGender] }
        };
        // If I strictly want a boy/girl, enforce it on the profile
        if (targetGenderRegex) standardMatch['profile.gender'] = targetGenderRegex;
        matchConditions.push(standardMatch);

        // Condition B: Match Advanced Waiters (If I qualify for them)
        // They are looking for 'advanced', but I must match THEIR filters.
        const advancedMatch = {
            searchGender: 'advanced',
            // AND I must match THEIR filters (Reverse Check)
            'searchFilters.gender':   { $in: ['all', 'همه', userProfile.gender] }, 
            'searchFilters.province': { $in: ['all', 'همه', userProfile.province] },
            'searchFilters.age':      { $in: ['all', 'همه', userProfile.age] },
            'searchFilters.job':      { $in: ['all', 'همه', userProfile.job] },
            'searchFilters.purpose':  { $in: ['all', 'همه', userProfile.purpose] }
        };
        // If I strictly want a boy/girl, the Advanced user must also be that gender
        if (targetGenderRegex) advancedMatch['profile.gender'] = targetGenderRegex;
        matchConditions.push(advancedMatch);

        // Combine with $or
        finalFilter = {
            ...baseFilter,
            $or: matchConditions
        };
    }

    // --- 7. EXECUTE SEARCH ---
    const partner = await User.findOneAndUpdate(
        finalFilter, 
        { status: 'chatting', partnerId: userId }, 
        { new: true }
    );

    // --- 8. DEDUCT CREDITS ---
    if (cost > 0) {
        user.credits -= cost;
        await user.save();
        await ctx.reply(`💸 مبلغ ${cost} سکه کسر شد.\n💰 باقیمانده: ${user.credits}`);
    }

    // --- 9. HANDLE RESULT ---
    if (partner) {
        // ✅ MATCH FOUND
        await User.updateOne({ telegramId: userId }, {
            status: 'chatting',
            partnerId: partner.telegramId,
            searchGender: 'all' // Reset
        });
        
        ctx.user.status = 'chatting';
        ctx.user.partnerId = partner.telegramId;

        const menu = getChatMenu();
        await ctx.telegram.sendMessage(userId, TEXTS.connected, menu);
        
        const hint = '🗣 نمیدانی چی بگویی؟';
        const iceBtn = Markup.inlineKeyboard([Markup.button.callback('🎲 یک سوال پیشنهاد بده', 'action_icebreaker')]);

        await ctx.telegram.sendMessage(userId, hint, iceBtn);
        try {
            await ctx.telegram.sendMessage(partner.telegramId, TEXTS.connected, menu);
            await ctx.telegram.sendMessage(partner.telegramId, hint, iceBtn);
        } catch(e) {
            return endChat(userId, partner.telegramId, ctx);
        }

    } else {
        // ⏳ NO MATCH - GO TO WAITING ROOM
        let newSearchGender = type;
        if (type === 'random') newSearchGender = 'all';
        if (type === 'advanced') newSearchGender = 'advanced'; 

        await User.updateOne({ telegramId: userId }, {
            status: 'searching',
            searchGender: newSearchGender
        });

        // Update context
        ctx.user.status = 'searching';
        
        let msg = `${TEXTS.searching}\n`;
        if (type === 'advanced') {
            msg += `⚙️ در حال جستجو با فیلترهای پیشرفته...\n(فقط افرادی که با معیار شما سازگار باشند وصل میشوند)`;
        } else {
            const typeText = (type === 'random' || type === 'all') ? 'شانسی' : (type === 'boy' ? 'پسر' : 'دختر');
            msg += `🔎 فیلتر شما: ${typeText}`;
        }
        await ctx.reply(msg, Markup.keyboard([['❌ لغو جستجو']]).resize());
    }
}
async function stopSearch(ctx) { 
    // If they are actually chatting, "Stop Search" shouldn't work (they should use Disconnect)
    if (ctx.user.status === 'chatting') {
        return ctx.reply('⛔️ شما در حال مکالمه هستید. از دکمه "قطع مکالمه" استفاده کنید.');
    }

    ctx.user.status = 'idle'; 
    ctx.user.searchGender = null; // Clear their filter preference
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
