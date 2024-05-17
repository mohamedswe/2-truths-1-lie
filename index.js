const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const PORT = 8000;

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors());
app.use(express.json());

const gameSessions = {};

app.post('/submit-statements', (req, res) => {
    const { sessionId, userId, truths, lie } = req.body;
    if (!gameSessions[sessionId]) {
        gameSessions[sessionId] = { players: {}, state: 'collecting' };
    }
    gameSessions[sessionId].players[userId] = { truths, lie, hasGuessed: false, score: 0 };
    console.log(`Statements received and saved for user ${userId} in session ${sessionId}`);
    res.json({ message: 'Statements received and saved' });
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join_game', ({ sessionId, userId }) => {
        if (!gameSessions[sessionId]) {
            gameSessions[sessionId] = { players: {}, state: 'waiting' };
        }
        if (!gameSessions[sessionId].players[userId]) {
            gameSessions[sessionId].players[userId] = { truths: [], lie: '', hasGuessed: false, score: 0 };
        }
        socket.join(sessionId);
        console.log(`User ${userId} joined game session ${sessionId}`);
    });

    socket.on('guess', ({ sessionId, userId, guess }) => {
        const session = gameSessions[sessionId];
        if (session && session.state === 'guessing') {
            const players = session.players;
            Object.keys(players).forEach(id => {
                if (players[id].lie === guess && id !== userId) {
                    players[userId].score += 1;  // Increment score for correct guess
                    players[id].score -= 1;    // Decrement score for being guessed
                }
            });
            players[userId].hasGuessed = true;
            if (Object.values(players).every(player => player.hasGuessed)) {
                session.state = 'end';
                io.to(sessionId).emit('end_game', players);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // Cleanup user from all sessions to avoid memory leaks
        Object.keys(gameSessions).forEach(sessionId => {
            const session = gameSessions[sessionId];
            if (session.players[socket.id]) {
                delete session.players[socket.id];
                if (Object.keys(session.players).length === 0) {
                    delete gameSessions[sessionId]; // Delete the session if empty
                }
            }
        });
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
