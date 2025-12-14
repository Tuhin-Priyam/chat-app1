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

const { saveMessage, getMessagesForRoom } = require('./database');

io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    socket.on('join_room', async (data) => {
        socket.join(data);
        console.log(`User with ID: ${socket.id} joined room: ${data}`);

        // Load message history
        try {
            const messages = await getMessagesForRoom(data);
            socket.emit('load_messages', messages);
        } catch (err) {
            console.error("Error loading messages", err);
        }
    });

    socket.on('send_message', async (data) => {
        // Save message to database
        try {
            await saveMessage(data);
            // Broadcast to room (excluding sender)
            socket.to(data.room).emit('receive_message', data);
        } catch (err) {
            console.error("Error saving message", err);
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
