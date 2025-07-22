const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { Client, Intents } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

// مفتاح التشفير (يجب أن يكون معقدًا ويتم تخزينه بشكل آمن)
const ENCRYPTION_KEY = 'a1b2c3d4e5f6g7h8a1b2c3d4e5f6g7h8';

// تخزين البوتات النشطة
const activeBots = new Map();

app.use(bodyParser.json());

// تشفير البيانات
function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// فك تشفير البيانات
function decrypt(text) {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

// تشغيل بوت جديد
app.post('/start-bot', (req, res) => {
    try {
        const { encryptedData } = req.body;
        const decryptedData = decrypt(encryptedData);
        const { token, serverId, roomId } = JSON.parse(decryptedData);
        
        // إذا كان البوت نشطًا بالفعل، نوقفه أولاً
        if (activeBots.has(token)) {
            activeBots.get(token).destroy();
            activeBots.delete(token);
        }
        
        // إنشاء وتشغيل البوت الجديد
        const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
        
        client.on('ready', () => {
            console.log(`Bot ${client.user.tag} is ready!`);
            activeBots.set(token, client);
            res.status(200).json({ success: true, message: 'Bot started successfully' });
        });
        
        client.on('error', error => {
            console.error('Bot error:', error);
            res.status(500).json({ success: false, message: 'Bot error occurred' });
        });
        
        client.login(token);
        
    } catch (error) {
        console.error('Error starting bot:', error);
        res.status(400).json({ success: false, message: 'Invalid request' });
    }
});

// إيقاف بوت
app.post('/stop-bot', (req, res) => {
    try {
        const { encryptedData } = req.body;
        const decryptedData = decrypt(encryptedData);
        const { token } = JSON.parse(decryptedData);
        
        if (activeBots.has(token)) {
            activeBots.get(token).destroy();
            activeBots.delete(token);
            res.status(200).json({ success: true, message: 'Bot stopped successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Bot not found' });
        }
    } catch (error) {
        console.error('Error stopping bot:', error);
        res.status(400).json({ success: false, message: 'Invalid request' });
    }
});

// التحقق من حالة البوت
app.post('/check-bot', (req, res) => {
    try {
        const { encryptedData } = req.body;
        const decryptedData = decrypt(encryptedData);
        const { token } = JSON.parse(decryptedData);
        
        const isActive = activeBots.has(token);
        res.status(200).json({ success: true, active: isActive });
    } catch (error) {
        console.error('Error checking bot:', error);
        res.status(400).json({ success: false, message: 'Invalid request' });
    }
});

// بدء الخادم
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// التأكد من إيقاف جميع البوتات عند إيقاف الخادم
process.on('SIGINT', () => {
    activeBots.forEach(bot => bot.destroy());
    process.exit();
});