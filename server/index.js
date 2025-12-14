const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

// Serve static files from the client directory
// Serve static files from the client directory
const path = require('path');
app.use(express.static(path.join(__dirname, '../client/dist')));

// Serve uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- File Upload Setup ---
const multer = require('multer');
const fs = require('fs');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        // Sanitize filename
        const saneName = file.originalname.replace(/[^a-z0-9.]/gi, '_');
        cb(null, uniqueSuffix + '-' + saneName);
    }
});
const upload = multer({ storage: storage });

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'No file uploaded' });
    }
    // Return the URL to access the file
    // We return a relative URL, so the client constructs based on its location (or we can return full if we knew host)
    // Client is using relative path for display now, so returning `/uploads/filename` is correct.
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
        status: 'ok',
        url: fileUrl,
        type: req.file.mimetype,
        name: req.file.originalname
    });
});

// Handle React routing, return all requests to React app
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for dev simplicity; lock down in prod
        methods: ["GET", "POST"]
    },
    path: '/socket.io'
});

const { saveMessage, getMessagesForRoom, createUser, verifyUser, deleteMessage, resetRoom, getRecentChats, markMessagesRead, updateUserAvatar } = require('./database');

// --- Global State for Presence ---
const onlineUsers = new Map(); // phone -> socketId
// Helper to broadcast presence
const broadcastPresence = (phone, isOnline) => {
    // Notify everyone (or ideally just people who have this user in contacts)
    // For MVP broadcast to all
    io.emit('user_presence', { phone, isOnline });
};


io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // --- Validation Helper ---
    const validateIndianPhone = (ph) => {
        if (!ph) return null;
        // The client should send normalized 10 digit, but we double check
        const digits = ph.replace(/\D/g, '');
        if (digits.length === 10 && /^[6-9]/.test(digits)) {
            return digits;
        }
        return null;
    };

    // --- Authentication ---
    socket.on('register', async ({ username, phone, password }, callback) => {
        const validPhone = validateIndianPhone(phone);
        if (!validPhone) {
            return callback({ status: 'error', message: 'Invalid phone number format' });
        }
        try {
            await createUser(username, validPhone, password);
            callback({ status: 'ok' });
        } catch (err) {
            callback({ status: 'error', message: 'Phone number already registered or invalid data' });
        }
    });

    socket.on('login', async ({ phone, password }, callback) => {
        // Login doesn't technically need strict validation if we just match DB,
        // but it helps prevent useless DB queries.
        try {
            const user = await verifyUser(phone, password);
            if (user) {
                // Store user info in socket
                socket.data.user = { username: user.username, phone: user.phone, avatar: user.avatar };

                // Presence Logic
                onlineUsers.set(user.phone, socket.id);
                broadcastPresence(user.phone, true);

                callback({ status: 'ok', username: user.username, phone: user.phone, avatar: user.avatar });
            } else {
                callback({ status: 'error', message: 'Invalid credentials' });
            }
        } catch (err) {
            callback({ status: 'error', message: 'Internal server error' });
        }
    });

    // --- Profile Management ---
    socket.on('update_profile', async ({ avatar }, callback) => {
        const user = socket.data.user;
        if (!user) return callback({ status: 'error', message: 'Not authenticated' });

        try {
            // Update in DB
            await updateUserAvatar(user.phone, avatar);
            // Update local socket data
            user.avatar = avatar;
            socket.data.user = user;
            callback({ status: 'ok' });
        } catch (err) {
            console.error("Error updating profile", err);
            callback({ status: 'error' });
        }
    });

    // --- Data Fetching ---
    socket.on('get_recent_chats', async (callback) => {
        const currentUser = socket.data.user;
        if (!currentUser) return callback([]);
        try {
            const chats = await getRecentChats(currentUser.phone);
            callback(chats);
        } catch (err) {
            console.error("Error fetching chats", err);
            callback([]);
        }
    });

    // --- Room Management ---
    const roomHosts = {}; // { roomId: hostSocketId } - kept for legacy or potential group usage later

    socket.on('start_chat', async ({ targetPhone }, callback) => {
        const currentUser = socket.data.user;
        if (!currentUser) {
            return callback({ status: 'error', message: 'Not authenticated' });
        }

        const validTarget = validateIndianPhone(targetPhone);
        if (!validTarget) {
            return callback({ status: 'error', message: 'Invalid target phone number' });
        }

        // Deterministic Room ID: sort phone numbers to ensure a unique room for the pair
        const participants = [currentUser.phone, validTarget].sort();
        const roomId = participants.join('_');

        socket.join(roomId);
        console.log(`User ${currentUser.phone} joined chat with ${validTarget} in room: ${roomId}`);

        try {
            const messages = await getMessagesForRoom(roomId);
            socket.emit('load_messages', messages);
            callback({ status: 'ok', roomId });
        } catch (err) {
            console.error("Error loading messages for chat", err);
            callback({ status: 'error', message: 'Could not load chat' });
        }
    });

    socket.on('join_room', async (data) => {
        socket.join(data);
        console.log(`User with ID: ${socket.id} joined room: ${data}`);

        try {
            const messages = await getMessagesForRoom(data);
            socket.emit('load_messages', messages);
        } catch (err) {
            console.error("Error loading messages", err);
        }
    });

    // --- Chat & Controls ---
    socket.on('send_message', async (data) => {
        try {
            const id = await saveMessage(data);
            const dataWithId = { ...data, id, status: 'sent', avatar: socket.data.user?.avatar }; // Default status
            io.in(data.room).emit('receive_message', dataWithId);
        } catch (err) {
            console.error("Error saving message", err);
        }
    });

    socket.on('typing_start', ({ room }) => {
        socket.to(room).emit('user_typing', { phone: socket.data.user?.phone });
    });

    socket.on('typing_stop', ({ room }) => {
        socket.to(room).emit('user_stop_typing', { phone: socket.data.user?.phone });
    });

    socket.on('mark_read', async ({ room }) => {
        const currentUser = socket.data.user;
        if (!currentUser) return;

        try {
            await markMessagesRead(room, currentUser.phone);
            // Notify other participant that messages in this room are read
            socket.to(room).emit('messages_read_update', { room, readBy: currentUser.phone });
        } catch (err) {
            console.error("Error marking read", err);
        }
    });

    socket.on('delete_message', async ({ id, room }) => {
        try {
            await deleteMessage(id);
            io.in(room).emit('message_deleted', id);
        } catch (err) {
            console.error("Error deleting message", err);
        }
    });

    socket.on('reset_room', async (room) => {
        try {
            await resetRoom(room);
            io.in(room).emit('room_reset');
        } catch (err) {
            console.error("Error resetting room", err);
        }
    });

    socket.on('disconnect', async () => {
        console.log('User Disconnected', socket.id);

        if (socket.data.user) {
            onlineUsers.delete(socket.data.user.phone);
            broadcastPresence(socket.data.user.phone, false);
        }

        // Check if user was a host (Legacy logic logic kept as is)
        for (const [roomId, hostId] of Object.entries(roomHosts)) {
            if (hostId === socket.id) {
                console.log(`Host ${socket.id} left room ${roomId}. Closing room.`);

                // Notify users in the room
                io.in(roomId).emit('room_closed');

                // Clear DB messages for this room
                try {
                    await resetRoom(roomId);
                } catch (err) {
                    console.error(`Error resetting room ${roomId}`, err);
                }

                // Remove from local map
                delete roomHosts[roomId];

                // Force disconnect all clients in that room (optional, but 'room_closed' event should handle UI redirection)
                // io.in(roomId).disconnectSockets(); 
                break;
            }
        }
    });

    // --- WebRTC Signaling ---
    socket.on('call_offer', (data) => {
        socket.to(data.room).emit('call_offer', data);
    });

    socket.on('call_answer', (data) => {
        socket.to(data.room).emit('call_answer', data);
    });

    socket.on('ice_candidate', (data) => {
        socket.to(data.room).emit('ice_candidate', data);
    });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
});
