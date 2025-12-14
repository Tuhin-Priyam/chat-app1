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
    const roomHosts = {}; // { roomId: hostSocketId }

    socket.on('create_room', (callback) => {
        const roomId = Math.floor(100000 + Math.random() * 900000).toString();
        roomHosts[roomId] = socket.id;
        console.log(`Room created: ${roomId} by Host: ${socket.id}`);
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

    socket.on('disconnect', async () => {
        console.log('User Disconnected', socket.id);

        // Check if user was a host
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
