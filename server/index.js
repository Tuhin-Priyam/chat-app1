const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

// Serve static files from the client directory
const path = require('path');
app.use(express.static(path.join(__dirname, '../client/dist')));

// Handle React routing, return all requests to React app
// Handle React routing, return all requests to React app
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for dev simplicity; lock down in prod
        methods: ["GET", "POST"]
    }
});

const { saveMessage, getMessagesForRoom, createUser, verifyUser, deleteMessage, resetRoom } = require('./database');

io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // --- Authentication ---
    socket.on('register', async ({ username, password }, callback) => {
        try {
            await createUser(username, password);
            callback({ status: 'ok' });
        } catch (err) {
            callback({ status: 'error', message: 'Username already taken or invalid' });
        }
    });

    socket.on('login', async ({ username, password }, callback) => {
        try {
            const isValid = await verifyUser(username, password);
            if (isValid) {
                callback({ status: 'ok' });
            } else {
                callback({ status: 'error', message: 'Invalid credentials' });
            }
        } catch (err) {
            callback({ status: 'error', message: 'Internal server error' });
        }
    });

    // --- Room Management ---
    socket.on('create_room', (callback) => {
        const roomId = Math.floor(100000 + Math.random() * 900000).toString();
        callback({ roomId });
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
            const dataWithId = { ...data, id };
            io.in(data.room).emit('receive_message', dataWithId);
        } catch (err) {
            console.error("Error saving message", err);
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

    socket.on('disconnect', () => {
        console.log('User Disconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
});
