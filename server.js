const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// --- Basic In-Memory Storage ---
let chatHistory = [];
const MAX_HISTORY = 100;
let users = {};

// --- Middleware ---
app.use(express.static(path.join(__dirname, 'public')));

// --- Fallback Route for SPA ---
app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Socket.IO Connection Logic ---
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // 1. Handle User Joining
    socket.on('user joined', ({ userType }) => {
        if (!userType || (userType !== 'lawyer' && userType !== 'client')) {
            console.warn(`Invalid userType received from ${socket.id}: ${userType}`);
            socket.disconnect(true);
            return;
        }

        console.log(`User ${socket.id} identified as: ${userType}`);
        users[socket.id] = userType;

        socket.emit('chat history', chatHistory); // Send history to this user
        socket.broadcast.emit('system message', `A ${userType} has joined the chat.`); // Notify others
    });

    // 2. Handle Incoming Chat Messages
    socket.on('chat message', (messageData) => {
        if (!messageData || typeof messageData.text !== 'string' || !messageData.sender) {
            console.warn(`Invalid message format received from ${socket.id}:`, messageData);
            return;
        }
        messageData.timestamp = messageData.timestamp || new Date().toISOString();

        console.log(`Message from ${messageData.sender} (${socket.id}): ${messageData.text}`);

        chatHistory.push(messageData);
        if (chatHistory.length > MAX_HISTORY) {
            chatHistory = chatHistory.slice(-MAX_HISTORY);
        }

        io.emit('chat message', messageData); // Broadcast to everyone
    });

    // 3. Handle Disconnect
    socket.on('disconnect', (reason) => {
        const userType = users[socket.id] || 'user';
        console.log(`User ${userType} (${socket.id}) disconnected: ${reason}`);
        delete users[socket.id];
        socket.broadcast.emit('system message', `A ${userType} has left the chat.`);
    });
});

// --- Start Server ---
server.listen(PORT, () => {
    console.log(`Server listening on *:${PORT}`);
});
