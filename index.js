require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

// --- DARI TEXTS (CLEANED) ---
const TEXTS = {
    intro: `🇦🇫 به ربات افغان کانکت خوش آمدید! 🇦🇫\n\n` +
           `اینجا میتوانید به صورت کاملا ناشناس با هموطنان خود صحبت کنید و دوست پیدا کنید.\n\n` +
           `🔒 امنیت شما: اطلاعات شخصی شما محفوظ است.\n` +
           `👇 برای شروع، لطفا مشخصات خود را تکمیل کنید.`,

    main_menu_title: '🏠 منوی اصلی\nیکی از گزینه‌های زیر را انتخاب کنید:',
    search_menu_title: '🧐 به کی وصلت کنم؟\nنوع جستجو را انتخاب کنید:',
    
    btn_connect: '🎲 وصل شدن به ناشناس',
    btn_profile: '👤 پروفایل من',
    btn_edit: '✏️ ویرایش پروفایل',
    btn_search_random: '🎲 جستجو شانسی',
    btn_search_boy: '👦 جستجو پسر',
    btn_search_girl: '👩 جستجو دختر',
    btn_back: '🔙 برگشت',

    ask_name: '📝 مرحله ۱ از ۷\n\nلطفا نام یا لقب خود را بنویسید:',
    ask_gender: '🚻 مرحله ۲ از ۷\n\nجنسیت خود را انتخاب کنید:',
    ask_age: '🎂 مرحله ۳ از ۷\n\nسن خود را انتخاب کنید:',
    ask_province: '📍 مرحله ۴ از ۷\n\nاز کدام ولایت هستید؟',
    ask_job: '💼 مرحله ۵ از ۷\n\nشغل شما چیست؟',
    ask_purpose: '🎯 مرحله ۶ از ۷\n\nهدف شما از اینجا بودن چیست؟',
    ask_photo: '📸 مرحله ۷ از ۷\n\nیک عکس برای پروفایل خود بفرستید یا دکمه "بدون عکس" را بزنید:',
    
    connected: '✅ وصل شدید! شروع به چت کنید. 👋',
    partner_disconnected: '🚫 طرف مقابل مکالمه را قطع کرد.',
    you_disconnected: '🚫 شما مکالمه را قطع کردید.',
    searching: '🔍 در حال جستجو... لطفا صبر کنید.',
    profile_viewed: '👁 طرف مقابل پروفایل شما را دید.',
    self_vote: 'نمیتوانید به خودتان رای دهید.',
};

// FULL AFGHANISTAN PROVINCES (34)
const PROVINCES = [
    'کابل', 'هرات', 'قندهار', 'بلخ', 'ننگرهار', 'هلمند', 'کندز', 'فاریاب', 'غزنی', 'پکتیا', 
    'جوزجان', 'تخار', 'بدخشان', 'بغلان', 'خوست', 'سمنگان', 'نیمروز', 'سرپل', 'فراه', 'کنر', 
    'لوگر', 'زابل', 'لغمان', 'پکتیکا', 'پنجشیر', 'پروان', 'اروزگان', 'کاپیسا', 'بامیان', 'میدان وردک', 
    'غور', 'دایکندی', 'نورستان', 'بادغیس', 'خارج از کشور'
];

const GENDERS = ['پسر 👦', 'دختر 👧'];
const JOBS = ['کارگر 🛠', 'شغل آزاد 💼', 'محصل 🎓', 'بیکار 🏠', 'کارمند 📝', 'داکتر 🩺', 'اینجینیر 📐'];
const PURPOSES = ['سرگرمی 😂', 'پیدا کردن دوست 🤝', 'درد دل 💔'];
const AGES = Array.from({ length: 51 }, (_, i) => (i + 15).toString());

// --- DATABASE ---
mongoose.connect(MONGO_URI).then(() => console.log('DB Connected'));

const userSchema = new mongoose.Schema({
    telegramId: { type: Number, required: true, unique: true },
    displayName: String,
    regStep: { type: String, default: 'intro' },
    isEditing: { type: Boolean, default: false },
    profile: { gender: String, age: String, province: String, job: String, purpose: String, photoId: String },
    stats: { likes: { type: Number, default: 0 }, dislikes: { type: Number, default: 0 } },
    status: { type: String, default: 'idle' },
    partnerId: Number,
    lastMsgId: Number // For Anti-Flood cleaning
});

const User = mongoose.model('User', userSchema);
const bot = new Telegraf(BOT_TOKEN);

// --- CLEANING HELPER ---
async function cleanPrev(ctx) {
    if (ctx.user.lastMsgId) {
        try { await ctx.deleteMessage(ctx.user.lastMsgId); } catch (e) {}
    }
}

async function sendClean(ctx, text, extra = {}) {
    await cleanPrev(ctx);
    const msg = await ctx.reply(text, extra);
    ctx.user.lastMsgId = msg.message_id;
    await ctx.user.save();
}

// --- KEYBOARDS ---
const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
const getMainMenu = () => Markup.keyboard([[TEXTS.btn_connect], [TEXTS.btn_profile, TEXTS.btn_edit]]).resize();
const getSearchMenu = () => Markup.keyboard([[TEXTS.btn_search_random], [TEXTS.btn_search_boy, TEXTS.btn_search_girl], [TEXTS.btn_back]]).resize();
const getEditMenu = () => Markup.keyboard([['✏️ نام', '✏️ عکس'], ['✏️ سن', '✏️ جنسیت'], ['✏️ ولایت', '✏️ شغل'], ['✏️ هدف', '🔙 برگشت']]).resize();

// --- MIDDLEWARE ---
bot.use(async (ctx, next) => {
    if (!ctx.chat || ctx.chat.type !== 'private') return;
    let user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) {
        user = new User({ telegramId: ctx.from.id, regStep: 'intro' });
        await user.save();
    }
    ctx.user = user;
    return next();
});

// --- LOGIC ---
bot.start(async (ctx) => {
    if (ctx.user.regStep !== 'completed') {
        ctx.user.regStep = 'intro';
        await ctx.user.save();
        await sendClean(ctx, TEXTS.intro);
        setTimeout(() => { ctx.user.regStep = 'name'; ctx.user.save(); sendClean(ctx, TEXTS.ask_name, Markup.removeKeyboard()); }, 2000);
        return;
    }
    await sendClean(ctx, TEXTS.main_menu_title, getMainMenu());
});

bot.on(['text', 'photo'], async (ctx) => {
    const user = ctx.user;
    const text = ctx.message.text;

    if (user.status === 'chatting' && user.partnerId) {
        if (text === '🚫 قطع مکالمه') return endChat(ctx.from.id, user.partnerId, ctx);
        if (text === '📄 مشاهده پروفایل طرف') {
            const partner = await User.findOne({ telegramId: user.partnerId });
            return showProfile(ctx, partner, false);
        }
        try { await ctx.copyMessage(user.partnerId); } catch (e) { await endChat(ctx.from.id, user.partnerId, ctx); }
        return;
    }

    if (user.regStep !== 'completed') return stepHandler(ctx);

    if (text === TEXTS.btn_connect) return sendClean(ctx, TEXTS.search_menu_title, getSearchMenu());
    if (text === TEXTS.btn_profile) return showProfile(ctx, user, true);
    if (text === TEXTS.btn_edit) return sendClean(ctx, 'بخش مورد نظر را انتخاب کنید:', getEditMenu());
    if (text === TEXTS.btn_search_random) return startSearch(ctx, 'random');
    if (text === TEXTS.btn_search_boy) return startSearch(ctx, 'boy');
    if (text === TEXTS.btn_search_girl) return startSearch(ctx, 'girl');
    if (text === TEXTS.btn_back || text === '🔙 برگشت') return sendClean(ctx, TEXTS.main_menu_title, getMainMenu());
    if (text === '❌ لغو جستجو') return stopSearch(ctx);

    if (text && text.startsWith('✏️')) {
        user.isEditing = true;
        const keys = {'نام':'name','عکس':'photo','سن':'age','جنسیت':'gender','ولایت':'province','شغل':'job','هدف':'purpose'};
        for (let k in keys) if (text.includes(k)) user.regStep = keys[k];
        await user.save();
        return stepHandler(ctx);
    }
});

async function stepHandler(ctx) {
    const user = ctx.user;
    const text = ctx.message.text;
    const isEdit = user.isEditing;

    const next = async (step) => {
        if (isEdit) { user.regStep = 'completed'; user.isEditing = false; await user.save(); await sendClean(ctx, '✅ تغییرات ذخیره شد.', getEditMenu()); }
        else { user.regStep = step; await user.save(); promptStep(ctx, step); }
    };

    if (user.regStep === 'name') { if (!text) return sendClean(ctx, TEXTS.ask_name); user.displayName = text; return next('gender'); }
    if (user.regStep === 'gender') { if (!GENDERS.includes(text)) return sendClean(ctx, TEXTS.ask_gender, Markup.keyboard(chunk(GENDERS, 2)).resize()); user.profile.gender = text; return next('age'); }
    if (user.regStep === 'age') { if (!AGES.includes(text)) return sendClean(ctx, TEXTS.ask_age, Markup.keyboard(chunk(AGES, 6)).resize()); user.profile.age = text; return next('province'); }
    if (user.regStep === 'province') { if (!PROVINCES.includes(text)) return sendClean(ctx, TEXTS.ask_province, Markup.keyboard(chunk(PROVINCES, 3)).resize()); user.profile.province = text; return next('job'); }
    if (user.regStep === 'job') { if (!JOBS.includes(text)) return sendClean(ctx, TEXTS.ask_job, Markup.keyboard(chunk(JOBS, 2)).resize()); user.profile.job = text; return next('purpose'); }
    if (user.regStep === 'purpose') { if (!PURPOSES.includes(text)) return sendClean(ctx, TEXTS.ask_purpose, Markup.keyboard(chunk(PURPOSES, 2)).resize()); user.profile.purpose = text; return next('photo'); }
    if (user.regStep === 'photo') {
        if (!ctx.message.photo && text !== 'بدون عکس') return sendClean(ctx, TEXTS.ask_photo, Markup.keyboard([['بدون عکس']]).resize());
        user.profile.photoId = ctx.message.photo ? ctx.message.photo[ctx.message.photo.length - 1].file_id : null;
        user.regStep = 'completed'; user.isEditing = false; await user.save();
        await sendClean(ctx, '🎉 پروفایل تکمیل شد!', getMainMenu());
    }
}

function promptStep(ctx, step) {
    const maps = { gender: [TEXTS.ask_gender, GENDERS, 2], age: [TEXTS.ask_age, AGES, 6], province: [TEXTS.ask_province, PROVINCES, 3], job: [TEXTS.ask_job, JOBS, 2], purpose: [TEXTS.ask_purpose, PURPOSES, 2] };
    const s = maps[step];
    if (s) sendClean(ctx, s[0], Markup.keyboard(chunk(s[1], s[2])).resize());
    else if (step === 'photo') sendClean(ctx, TEXTS.ask_photo, Markup.keyboard([['بدون عکس']]).resize());
}

async function showProfile(ctx, user, isSelf) {
    const p = user.profile;
    const caption = `🎫 پروفایل کاربری\n\n👤 نام: ${user.displayName}\n🚻 جنسیت: ${p.gender}\n🎂 سن: ${p.age}\n📍 ولایت: ${p.province}\n💼 شغل: ${p.job}\n🎯 هدف: ${p.purpose}`;
    const buttons = { inline_keyboard: [[{ text: `👍 ${user.stats.likes}`, callback_data: `like_${user.telegramId}` }, { text: `👎 ${user.stats.dislikes}`, callback_data: `dislike_${user.telegramId}` }]] };
    
    await cleanPrev(ctx);
    let msg;
    if (p.photoId) msg = await ctx.replyWithPhoto(p.photoId, { caption, reply_markup: buttons });
    else msg = await ctx.reply(caption, { reply_markup: buttons });
    
    ctx.user.lastMsgId = msg.message_id;
    await ctx.user.save();
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
        await ctx.telegram.sendMessage(ctx.user.telegramId, TEXTS.connected, Markup.keyboard([['🚫 قطع مکالمه', '📄 مشاهده پروفایل طرف']]).resize());
        await ctx.telegram.sendMessage(partner.telegramId, TEXTS.connected, Markup.keyboard([['🚫 قطع مکالمه', '📄 مشاهده پروفایل طرف']]).resize());
    } else {
        ctx.user.status = 'searching'; await ctx.user.save();
        await sendClean(ctx, TEXTS.searching, Markup.keyboard([['❌ لغو جستجو']]).resize());
    }
}

async function stopSearch(ctx) { ctx.user.status = 'idle'; await ctx.user.save(); await sendClean(ctx, 'توقف شد.', getMainMenu()); }

async function endChat(id1, id2, ctx) {
    await User.updateMany({ telegramId: { $in: [id1, id2] } }, { status: 'idle', partnerId: null });
    try { await ctx.telegram.sendMessage(id1, TEXTS.you_disconnected, getMainMenu()); } catch (e) {}
    try { await ctx.telegram.sendMessage(id2, TEXTS.partner_disconnected, getMainMenu()); } catch (e) {}
}

const app = express(); app.get('/', (r, s) => s.send('Bot V5 Clean'));
app.listen(PORT, () => { bot.launch(); console.log('Bot V5 Online'); });
