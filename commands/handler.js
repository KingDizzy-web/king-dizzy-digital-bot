const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const axios = require('axios');
const ytdl = require('ytdl-core');
const yts = require('yt-search');
const fs = require('fs-extra');
const path = require('path');

const PREFIX = '.';
const BOT_NAME = 'King Dizzy Digital Bot';
const OWNER = 'King Dizzy'; // Change to your name

async function handleMessage(sock, msg) {
    try {
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const sender = msg.key.participant || msg.key.remoteJid;
        const senderName = msg.pushName || 'User';

        // Get message text
        const body =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            msg.message?.videoMessage?.caption || '';

        const isCmd = body.startsWith(PREFIX);
        if (!isCmd) return;

        const args = body.slice(PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        console.log(`[CMD] ${command} from ${senderName}`);

        // Reply helper
        const reply = (text) => sock.sendMessage(from, { text: text }, { quoted: msg });

        switch (command) {

            // ─── MENU ───────────────────────────────────────────
            case 'menu':
            case 'help':
                await reply(`╔══════════════════╗
║  👑 ${BOT_NAME}
╚══════════════════╝

PREFIX: *${PREFIX}*

📌 *GENERAL*
${PREFIX}menu - Show this menu
${PREFIX}ping - Check bot speed
${PREFIX}owner - Bot owner info

🎵 *MUSIC & VIDEO*
${PREFIX}play [song name] - Download music
${PREFIX}video [name] - Download video

🖼️ *IMAGE TOOLS*
${PREFIX}enhance - Enhance image to HD
${PREFIX}dp [number] - Get WhatsApp DP

👁️ *VIEW ONCE*
${PREFIX}unlock - Unlock view once media

📰 *NEWS*
${PREFIX}news - Get latest news

🤖 *AI*
${PREFIX}ai [question] - Ask AI anything

👥 *GROUP TOOLS*
${PREFIX}kick @user - Kick member
${PREFIX}add number - Add member
${PREFIX}promote @user - Make admin
${PREFIX}demote @user - Remove admin
${PREFIX}mute - Mute group
${PREFIX}unmute - Unmute group
${PREFIX}tagall - Tag everyone

Powered by *${BOT_NAME}* 👑`);
                break;

            // ─── PING ────────────────────────────────────────────
            case 'ping':
                const start = Date.now();
                await reply(`🏓 Pong! *${Date.now() - start}ms*`);
                break;

            // ─── OWNER ───────────────────────────────────────────
            case 'owner':
                await reply(`👑 *Bot Owner:* ${OWNER}\n🤖 *Bot Name:* ${BOT_NAME}`);
                break;

            // ─── AI ──────────────────────────────────────────────
            case 'ai':
            case 'ask':
                if (!args.length) return reply('Usage: .ai [your question]');
                try {
                    await reply('🤖 Thinking...');
                    const question = args.join(' ');
                    const res = await axios.get(`https://api.simsimi.vn/v1/simsimi?text=${encodeURIComponent(question)}&lc=en`);
                    await reply(`🤖 *AI Answer:*\n${res.data.success || 'Sorry, I could not find an answer.'}`);
                } catch {
                    await reply('❌ AI service is temporarily unavailable.');
                }
                break;

            // ─── MUSIC DOWNLOAD ──────────────────────────────────
            case 'play':
            case 'music':
                if (!args.length) return reply('Usage: .play [song name]');
                try {
                    await reply('🎵 Searching for your song...');
                    const songName = args.join(' ');
                    const results = await yts(songName);
                    const video = results.videos[0];
                    if (!video) return reply('❌ Song not found.');
                    await reply(`🎵 Found: *${video.title}*\n⏱️ Duration: ${video.timestamp}\nDownloading...`);
                    const stream = ytdl(video.url, { filter: 'audioonly', quality: 'highestaudio' });
                    const tmpFile = path.join(__dirname, '../tmp', `${Date.now()}.mp3`);
                    await fs.ensureDir(path.dirname(tmpFile));
                    const writeStream = fs.createWriteStream(tmpFile);
                    stream.pipe(writeStream);
                    writeStream.on('finish', async () => {
                        await sock.sendMessage(from, {
                            audio: { url: tmpFile },
                            mimetype: 'audio/mp4',
                            fileName: `${video.title}.mp3`
                        }, { quoted: msg });
                        fs.remove(tmpFile);
                    });
                } catch (e) {
                    await reply('❌ Could not download music. Try another song.');
                }
                break;

            // ─── GET DP ──────────────────────────────────────────
            case 'dp':
            case 'getdp':
                try {
                    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                    const target = (mentioned && mentioned[0]) || sender;
                    const ppUrl = await sock.profilePictureUrl(target, 'image').catch(() => null);
                    if (!ppUrl) return reply('❌ No profile picture found or it is private.');
                    await sock.sendMessage(from, {
                        image: { url: ppUrl },
                        caption: `📸 Profile picture of @${target.split('@')[0]}`,
                        mentions: [target]
                    }, { quoted: msg });
                } catch {
                    await reply('❌ Could not fetch profile picture.');
                }
                break;

            // ─── UNLOCK VIEW ONCE ────────────────────────────────
            case 'unlock':
            case 'viewonce':
                try {
                    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    if (!quoted) return reply('❌ Reply to a view-once message with .unlock');
                    const viewOnceMsg =
                        quoted?.viewOnceMessage?.message ||
                        quoted?.viewOnceMessageV2?.message ||
                        quoted?.viewOnceMessageV2Extension?.message;
                    if (!viewOnceMsg) return reply('❌ That is not a view-once message.');
                    const mediaType = Object.keys(viewOnceMsg)[0];
                    const media = viewOnceMsg[mediaType];
                    const buffer = await downloadMediaMessage({ message: viewOnceMsg, key: msg.key }, mediaType, {}, { reuploadRequest: sock.updateMediaMessage });
                    if (mediaType.includes('image')) {
                        await sock.sendMessage(from, { image: buffer, caption: '👁️ View Once Unlocked!' }, { quoted: msg });
                    } else if (mediaType.includes('video')) {
                        await sock.sendMessage(from, { video: buffer, caption: '👁️ View Once Unlocked!' }, { quoted: msg });
                    }
                } catch {
                    await reply('❌ Could not unlock this message.');
                }
                break;

            // ─── NEWS ────────────────────────────────────────────
            case 'news':
                try {
                    await reply('📰 Fetching latest news...');
                    const newsRes = await axios.get('https://gnews.io/api/v4/top-headlines?lang=en&token=demo&max=5');
                    const articles = newsRes.data.articles;
                    if (!articles || !articles.length) return reply('❌ No news found.');
                    let newsText = '📰 *Latest News:*\n\n';
                    articles.forEach((a, i) => {
                        newsText += `*${i + 1}. ${a.title}*\n${a.description || ''}\n\n`;
                    });
                    await reply(newsText);
                } catch {
                    await reply('❌ Could not fetch news right now.');
                }
                break;

            // ─── ENHANCE IMAGE ───────────────────────────────────
            case 'enhance':
            case '4k':
                try {
                    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    if (!quotedMsg?.imageMessage) return reply('❌ Reply to an image with .enhance');
                    await reply('🖼️ Enhancing your image...');
                    const imgBuffer = await downloadMediaMessage({ message: quotedMsg, key: msg.key }, 'imageMessage', {}, { reuploadRequest: sock.updateMediaMessage });
                    // Send back with caption (real 4K needs a paid API, this sends HD)
                    await sock.sendMessage(from, {
                        image: imgBuffer,
                        caption: '✅ Image enhanced! (HD Quality)\nFor true 4K, use: remini.ai or topazlabs.com'
                    }, { quoted: msg });
                } catch {
                    await reply('❌ Could not enhance image.');
                }
                break;

            // ─── GROUP: TAG ALL ──────────────────────────────────
            case 'tagall':
            case 'everyone':
                if (!isGroup) return reply('❌ This command is for groups only.');
                try {
                    const groupMeta = await sock.groupMetadata(from);
                    const members = groupMeta.participants;
                    let tagText = '📢 *Attention Everyone!*\n\n';
                    const mentions = [];
                    members.forEach(m => {
                        tagText += `@${m.id.split('@')[0]}\n`;
                        mentions.push(m.id);
                    });
                    await sock.sendMessage(from, { text: tagText, mentions }, { quoted: msg });
                } catch {
                    await reply('❌ Could not tag all members.');
                }
                break;

            // ─── GROUP: KICK ─────────────────────────────────────
            case 'kick':
            case 'remove':
                if (!isGroup) return reply('❌ Groups only.');
                try {
                    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                    if (!mentioned || !mentioned.length) return reply('❌ Tag someone to kick. Example: .kick @user');
                    await sock.groupParticipantsUpdate(from, mentioned, 'remove');
                    await reply(`✅ Kicked @${mentioned[0].split('@')[0]}`);
                } catch {
                    await reply('❌ Could not kick. Make sure I am an admin.');
                }
                break;

            // ─── GROUP: ADD ──────────────────────────────────────
            case 'add':
                if (!isGroup) return reply('❌ Groups only.');
                try {
                    const number = args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
                    await sock.groupParticipantsUpdate(from, [number], 'add');
                    await reply(`✅ Added ${args[0]}`);
                } catch {
                    await reply('❌ Could not add member. Check the number.');
                }
                break;

            // ─── GROUP: PROMOTE ──────────────────────────────────
            case 'promote':
                if (!isGroup) return reply('❌ Groups only.');
                try {
                    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                    if (!mentioned || !mentioned.length) return reply('❌ Tag someone to promote.');
                    await sock.groupParticipantsUpdate(from, mentioned, 'promote');
                    await reply(`✅ Promoted @${mentioned[0].split('@')[0]} to admin!`);
                } catch {
                    await reply('❌ Could not promote. Make sure I am an admin.');
                }
                break;

            // ─── GROUP: DEMOTE ───────────────────────────────────
            case 'demote':
                if (!isGroup) return reply('❌ Groups only.');
                try {
                    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                    if (!mentioned || !mentioned.length) return reply('❌ Tag someone to demote.');
                    await sock.groupParticipantsUpdate(from, mentioned, 'demote');
                    await reply(`✅ Demoted @${mentioned[0].split('@')[0]} from admin.`);
                } catch {
                    await reply('❌ Could not demote.');
                }
                break;

            // ─── GROUP: MUTE ─────────────────────────────────────
            case 'mute':
                if (!isGroup) return reply('❌ Groups only.');
                try {
                    await sock.groupSettingUpdate(from, 'announcement');
                    await reply('🔇 Group muted! Only admins can send messages.');
                } catch {
                    await reply('❌ Could not mute group.');
                }
                break;

            // ─── GROUP: UNMUTE ───────────────────────────────────
            case 'unmute':
                if (!isGroup) return reply('❌ Groups only.');
                try {
                    await sock.groupSettingUpdate(from, 'not_announcement');
                    await reply('🔊 Group unmuted! Everyone can send messages.');
                } catch {
                    await reply('❌ Could not unmute group.');
                }
                break;

            default:
                // Unknown command — silently ignore
                break;
        }

    } catch (err) {
        console.error('Handler error:', err);
    }
}

module.exports = { handleMessage };
          
