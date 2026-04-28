const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs-extra');
const readline = require('readline');
const { handleMessage } = require('./commands/handler');

const BOT_NAME = "King Dizzy Digital Bot";

// Put your WhatsApp number here (with country code, no + or spaces)
// Example: if your number is +234 704 299 9216, type 2347042999216
const MY_NUMBER = "2348108986958";

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
    });

    // Generate pairing code if not already logged in
    if (!sock.authState.creds.registered) {
        const number = MY_NUMBER.replace(/[^0-9]/g, '');
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(number);
                console.log('\n\n');
                console.log('======================================');
                console.log(`   YOUR PAIRING CODE: ${code}   `);
                console.log('======================================');
                console.log('Go to WhatsApp > Linked Devices > Link with phone number');
                console.log('Enter the code above\n\n');
            } catch (err) {
                console.error('Error generating pairing code:', err);
            }
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting:', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log(`✅ ${BOT_NAME} is now connected!`);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message) return;
        await handleMessage(sock, msg);
    });
}

startBot().catch(console.error);
                    
