require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const ADMIN_ID = 7786874990; // YOUR ID
const PORT = process.env.PORT || 3000;

// --- DARI TEXTS ---
const TEXTS = {
    intro: `🇦🇫 به ربات افغان کانکت خوش آمدید!\n\nاینجا میتوانید به صورت کاملا ناشناس با هموطنان خود گپ بزنید و دوست پیدا کنید.\n\n🔒 امنیت شما اولویت ماست.\n👇 برای شروع، لطفا مشخصات خود را تکمیل کنید.`,
    main_menu_title: '🏠 منوی اصلی:',
    btn_connect: '🎲 وصل شدن به ناشناس',
    btn_profile: '👤 پروفایل من',
    btn_edit: '✏️ ویرایش پروفایل',
    ask_name: '📝 لطفا نام یا لقب خود را بنویسید:',
    ask_gender: '🚻 جنسیت خود را انتخاب کنید:',
    ask_age: '🎂 سن خود را انتخاب کنید:',
    ask_province: '📍 از کدام ولایت هستید؟',
    ask_job: '💼 شغل شما چیست؟',
    ask_purpose: '🎯 هدف شما از اینجا بودن چیست؟',
    ask_photo: '📸 یک عکس برای پروفایل بفرستید (یا دکمه "بدون عکس" را بزنید):',
    connected: `✅ **وصل شدید!**\n\n⚠️ **هشدار:**\n۱. ارسال لینک و آیدی ممنوع است.\n۲. ایجاد مزاحمت باعث مسدود شدن دایمی شما میگردد.\n\n👇 پیام خود را بفرستید:`,
    partner_disconnected: '🚫 طرف مقابل مکالمه را قطع کرد.',
    you_disconnected: '🚫 شما مکالمه را قطع کردید.',
    searching: '🔍 در حال جستجو... لطفا صبر کنید.',
    spam_warn: '⚠️ شما بیش از حد سریع پیام میفرستید! ۵ دقیقه محدود شدید.',
    link_blocked: '🚫 ارسال لینک یا آیدی مجاز نیست!',
    report_sent: '✅ گزارش شما ثبت شد و توسط ادمین بررسی میگردد.',
    banned_msg: '❌ شما به دلیل تخلف از قوانین، از سیستم مسدود شده‌اید.'
};

const PROVINCES = ['کابل', 'هرات', 'قندهار', 'بلخ', 'ننگرهار', 'هلمند', 'کندز', 'فاریاب', 'غزنی', 'پکتیا', 'جوزجان', 'تخار', 'بدخشان', 'بغلان', 'خوست', 'سمنگان', 'نیمروز', 'سرپل', 'فراه', 'کنر', 'لوگر', 'زابل', 'لغمان', 'پکتیکا', 'پنجشیر', 'پروان', 'اروزگان', 'کاپیسا', 'بامیان', 'میدان وردک', 'غور', 'دایکندی', 'نورستان', 'بادغیس', 'خارج از کشور'];
const GENDERS = ['پسر 👦', 'دختر 👧'];
const JOBS = ['کارگر 🛠', 'شغل آزاد 💼', 'محصل 🎓', 'بیکار 🏠', 'کارمند 📝', 'داکتر 🩺', 'اینجینیر 📐'];
const PURPOSES = ['سرگرمی 😂', 'پیدا کردن دوست 🤝', 'درد دل 💔'];
const AGES = Array.from({ length: 66 }, (_, i) => (i + 15).toString());

// --- DATABASE ---
mongoose.connect(MONGO_URI).then(() => console.log('DB Connected'));

const userSchema = new mongoose.Schema({
    telegramId: { type: Number, required: true, unique: true },
    botUserId: String, 
    displayName: String,
    regStep: { type: String, default: 'intro' },
    isEditing: { type: Boolean, default: false },
    profile: { gender: String, age: String, province: String, job: String, purpose: String, photoId: String },
    stats: { likes: { type: Number, default: 0 }, dislikes: { type: Number, default: 0 } },
    status: { type: String, default: 'idle' },
    partnerId: Number,
    lastMsgId: Number,
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
const getSearchMenu = () => Markup.keyboard([['🎲 جستجو شانسی'], ['👦 جستجو پسر', '👩 جستجو دختر'], ['🔙 برگشت']]).resize();
const getChatMenu = () => Markup.keyboard([['🚫 قطع مکالمه', '📄 پروفایل طرف'], ['🚩 گزارش هم‌صحبت']]).resize();

async function cleanPrev(ctx) {
    if (ctx.user && ctx.user.lastMsgId) {
        try { await ctx.deleteMessage(ctx.user.lastMsgId); } catch (e) {}
    }
}

// --- MIDDLEWARE ---
bot.use(async (ctx, next) => {
    try {
        if (!ctx.chat || ctx.chat.type !== 'private') return;
        let user = await User.findOne({ telegramId: ctx.from.id });
        
        if (!user) {
            const count = await User.countDocuments();
            user = new User({ 
                telegramId: ctx.from.id, 
                botUserId: `u${1000 + count + 1}`,
                regStep: 'intro' 
            });
            await user.save();
        }

        // Emergency ID Fix (If someone has ID as undefined)
        if (!user.botUserId) {
            const count = await User.countDocuments();
            user.botUserId = `u${1000 + count + 1}`;
            await user.save();
        }
        
        if (user.isBanned) return ctx.reply(TEXTS.banned_msg);
        if (user.muteUntil > Date.now()) return ctx.reply(TEXTS.spam_warn);

        const now = Date.now();
        if (now - user.lastMsgTimestamp < 1500) {
            user.spamScore++;
            if (user.spamScore > 6) {
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

// --- ADMIN PANEL ---
bot.command('stats', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const count = await User.countDocuments();
    const active = await User.countDocuments({ status: 'chatting' });
    ctx.reply(`📊 آمار کل کاربران: ${count}\n💬 کاربران در حال چت: ${active}`);
});

bot.command('ban', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const id = ctx.message.text.split(' ')[1];
    if(!id) return ctx.reply('مثال: /ban u1001');
    const target = await User.findOneAndUpdate({ botUserId: id }, { isBanned: true });
    ctx.reply(target ? `✅ کاربر ${id} مسدود شد.` : '❌ کاربر یافت نشد.');
});

bot.command('unban', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const id = ctx.message.text.split(' ')[1];
    if(!id) return ctx.reply('مثال: /unban u1001');
    const target = await User.findOneAndUpdate({ botUserId: id }, { isBanned: false });
    ctx.reply(target ? `✅ کاربر ${id} آزاد شد.` : '❌ کاربر یافت نشد.');
});

// --- LOGIC ---
bot.start(async (ctx) => {
    const user = ctx.user;
    if (user.regStep !== 'completed') {
        user.regStep = 'intro'; await user.save();
        const m = await ctx.reply(TEXTS.intro);
        user.lastMsgId = m.message_id; await user.save();
        
        setTimeout(async () => {
            await cleanPrev(ctx);
            user.regStep = 'name'; await user.save();
            const m2 = await ctx.reply(TEXTS.ask_name, Markup.removeKeyboard());
            user.lastMsgId = m2.message_id; await user.save();
        }, 3000);
        return;
    }
    await ctx.reply(`سلام خوش آمدید!\nآیدی شما: ${user.botUserId}`, getMainMenu());
});

bot.on(['text', 'photo'], async (ctx) => {
    const user = ctx.user;
    const text = ctx.message.text || "";

    if (user.status === 'chatting' && user.partnerId) {
        if (text === '🚫 قطع مکالمه') return endChat(ctx.from.id, user.partnerId, ctx);
        if (text === '📄 پروفایل طرف') {
            const partner = await User.findOne({ telegramId: user.partnerId });
            return showProfile(ctx, partner, false);
        }
        if (text === '🚩 گزارش هم‌صحبت') {
            return ctx.reply('دلیل گزارش خود را انتخاب کنید:', Markup.inlineKeyboard([
                [Markup.button.callback('بی‌ادبی / فحاشی', `rep_toxic_${user.partnerId}`)],
                [Markup.button.callback('تبلیغات / لینک', `rep_ads_${user.partnerId}`)],
                [Markup.button.callback('محتوای غیراخلاقی', `rep_porn_${user.partnerId}`)]
            ]));
        }

        const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(t\.me\/[^\s]+)|(@[^\s]+)/gi;
        if (linkRegex.test(text)) return ctx.reply(TEXTS.link_blocked);

        try { await ctx.copyMessage(user.partnerId); } catch (e) { await endChat(ctx.from.id, user.partnerId, ctx); }
        return;
    }

    if (user.regStep !== 'completed') return stepHandler(ctx);

    if (text === TEXTS.btn_connect) return ctx.reply(TEXTS.search_menu_title, getSearchMenu());
    if (text === TEXTS.btn_profile) return showProfile(ctx, user, true);
    if (text === TEXTS.btn_edit) return ctx.reply('کدام بخش را ویرایش میکنید؟', Markup.keyboard([['✏️ نام', '✏️ عکس'], ['✏️ سن', '✏️ ولایت'], ['🔙 برگشت']]).resize());
    if (text === '🎲 جستجو شانسی') return startSearch(ctx, 'random');
    if (text === '👦 جستجو پسر') return startSearch(ctx, 'boy');
    if (text === '👩 جستجو دختر') return startSearch(ctx, 'girl');
    if (text === '🔙 برگشت') return ctx.reply(TEXTS.main_menu_title, getMainMenu());
    if (text === '❌ لغو جستجو') return stopSearch(ctx);

    if (text && text.startsWith('✏️')) {
        user.isEditing = true;
        const keys = {'نام':'name','عکس':'photo','سن':'age','جنسیت':'gender','ولایت':'province','شغل':'job','هدف':'purpose'};
        for (let k in keys) if (text.includes(k)) {
            user.regStep = keys[k]; await user.save();
            if (['name','photo'].includes(keys[k])) await ctx.reply('لطفا مقدار جدید را بفرستید:', Markup.removeKeyboard());
            else {
                const maps = { gender: [GENDERS, 2], age: [AGES, 6], province: [PROVINCES, 3] };
                await ctx.reply('انتخاب کنید:', Markup.keyboard(chunk(maps[keys[k]][0], maps[keys[k]][1])).resize());
            }
            return;
        }
    }
});

bot.action(/^rep_(.*)_(\d+)$/, async (ctx) => {
    const reason = ctx.match[1];
    const targetId = ctx.match[2];
    const targetUser = await User.findOne({ telegramId: targetId });
    await bot.telegram.sendMessage(ADMIN_ID, `🚩 گزارش جدید\nشاکی: ${ctx.user.botUserId}\nمتهم: ${targetUser.botUserId}\nدلیل: ${reason}`);
    await ctx.answerCbQuery(TEXTS.report_sent);
    await ctx.editMessageText(TEXTS.report_sent);
});

async function stepHandler(ctx) {
    const user = ctx.user;
    const text = ctx.message.text;
    const isEdit = user.isEditing;

    const next = async (step) => {
        await cleanPrev(ctx);
        if (isEdit) { 
            user.regStep = 'completed'; user.isEditing = false; await user.save(); 
            await ctx.reply('✅ تغییرات با موفقیت ذخیره شد.', getMainMenu()); 
        } else {
            user.regStep = step; await user.save();
            const maps = { gender: [TEXTS.ask_gender, GENDERS, 2], age: [TEXTS.ask_age, AGES, 6], province: [TEXTS.ask_province, PROVINCES, 3], job: [TEXTS.ask_job, JOBS, 2], purpose: [TEXTS.ask_purpose, PURPOSES, 2], photo: [TEXTS.ask_photo, [['بدون عکس']], 1] };
            const s = maps[step];
            const m = await ctx.reply(s[0], step === 'name' ? Markup.removeKeyboard() : Markup.keyboard(chunk(s[1], s[2])).resize());
            user.lastMsgId = m.message_id; await user.save();
        }
    };

    if (user.regStep === 'name') { if (!text || text.startsWith('/')) return; user.displayName = text; return next('gender'); }
    if (user.regStep === 'gender') { if (!GENDERS.includes(text)) return; user.profile.gender = text; return next('age'); }
    if (user.regStep === 'age') { if (!AGES.includes(text)) return; user.profile.age = text; return next('province'); }
    if (user.regStep === 'province') { if (!PROVINCES.includes(text)) return; user.profile.province = text; return next('job'); }
    if (user.regStep === 'job') { if (!JOBS.includes(text)) return; user.profile.job = text; return next('purpose'); }
    if (user.regStep === 'purpose') { if (!PURPOSES.includes(text)) return; user.profile.purpose = text; return next('photo'); }
    if (user.regStep === 'photo') {
        user.profile.photoId = ctx.message.photo ? ctx.message.photo[ctx.message.photo.length - 1].file_id : null;
        user.regStep = 'completed'; user.isEditing = false; await user.save();
        await cleanPrev(ctx); await ctx.reply(`🎉 پروفایل شما با آیدی ${user.botUserId} ساخته شد!`, getMainMenu());
    }
}

async function showProfile(ctx, user, isSelf) {
    const p = user.profile;
    const caption = `🎫 **آیدی کاربر: ${user.botUserId}**\n\n👤 نام: ${user.displayName}\n🚻 جنسیت: ${p.gender}\n🎂 سن: ${p.age}\n📍 ولایت: ${p.province}\n💼 شغل: ${p.job}\n🎯 هدف: ${p.purpose}`;
    const buttons = { inline_keyboard: [[{ text: `👍 ${user.stats.likes}`, callback_data: `like_${user.telegramId}` }, { text: `👎 ${user.stats.dislikes}`, callback_data: `dislike_${user.telegramId}` }]] };
    if (p.photoId) await ctx.replyWithPhoto(p.photoId, { caption, reply_markup: buttons });
    else await ctx.reply(caption, { reply_markup: buttons });
    if (!isSelf) try { await ctx.telegram.sendMessage(user.telegramId, TEXTS.profile_viewed); } catch (e) {}
}

bot.action(/^(like|dislike)_(\d+)$/, async (ctx) => {
    const type = ctx.match[1];
    const targetId = parseInt(ctx.match[2]);
    if (targetId === ctx.from.id) return ctx.answerCbQuery('نمیتوانید به خود رای دهید.');
    const target = await User.findOne({ telegramId: targetId });
    if (type === 'like') target.stats.likes++; else target.stats.dislikes++;
    await target.save();
    try { await ctx.editMessageReplyMarkup({ inline_keyboard: [[{ text: `👍 ${target.stats.likes}`, callback_data: `like_${targetId}` }, { text: `👎 ${target.stats.dislikes}`, callback_data: `dislike_${targetId}` }]] }); } catch (e) {}
    ctx.answerCbQuery('انجام شد');
});

async function startSearch(ctx, type) {
    let filter = { status: 'searching', telegramId: { $ne: ctx.user.telegramId } };
    if (type !== 'random') filter['profile.gender'] = { $regex: type === 'boy' ? 'پسر' : 'دختر' };
    const partner = await User.findOne(filter);
    if (partner) {
        ctx.user.status = 'chatting'; ctx.user.partnerId = partner.telegramId;
        partner.status = 'chatting'; partner.partnerId = ctx.user.telegramId;
        await ctx.user.save(); await partner.save();
        await ctx.telegram.sendMessage(ctx.user.telegramId, TEXTS.connected, { parse_mode: 'Markdown', ...getChatMenu() });
        await ctx.telegram.sendMessage(partner.telegramId, TEXTS.connected, { parse_mode: 'Markdown', ...getChatMenu() });
    } else {
        ctx.user.status = 'searching'; await ctx.user.save();
        await ctx.reply(TEXTS.searching, Markup.keyboard([['❌ لغو جستجو']]).resize());
    }
}

async function stopSearch(ctx) { ctx.user.status = 'idle'; await ctx.user.save(); await ctx.reply('جستجو متوقف شد.', getMainMenu()); }

async function endChat(id1, id2, ctx) {
    await User.updateMany({ telegramId: { $in: [id1, id2] } }, { status: 'idle', partnerId: null });
    try { await ctx.telegram.sendMessage(id1, TEXTS.you_disconnected, getMainMenu()); } catch (e) {}
    try { await ctx.telegram.sendMessage(id2, TEXTS.partner_disconnected, getMainMenu()); } catch (e) {}
}

const app = express(); app.get('/', (r, s) => s.send('Afghan Connect v8.1 Ready'));
app.listen(PORT, () => { bot.launch(); console.log('Bot v8.1 Production Active'); });
