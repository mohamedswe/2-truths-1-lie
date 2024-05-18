const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const PORT = 8000;

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Be careful with this in production
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

let gameSessions = {};

app.post('/create-session', (req, res) => {
    const sessionId = Date.now().toString();  // Simple unique session ID generator
    gameSessions[sessionId] = { players: {}, state: 'waiting', sessionId: sessionId };
    res.json({ message: 'Session created', sessionId: sessionId });
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join_game', ({ sessionId, userId }) => {
        if (gameSessions[sessionId]) {
            if (!gameSessions[sessionId].players[userId]) {
                gameSessions[sessionId].players[userId] = { truths: [], lie: '', hasGuessed: false, score: 0 };
                socket.join(sessionId);
                console.log(`User ${userId} joined game session ${sessionId}`);
                io.to(sessionId).emit('update_session', gameSessions[sessionId]);
            }
        } else {
            socket.emit('error', 'Session does not exist');
        }
    });

    socket.on('submit_statements', ({ sessionId, userId, truths, lie }) => {
        if (gameSessions[sessionId] && gameSessions[sessionId].players[userId]) {
            gameSessions[sessionId].players[userId].truths = truths;
            gameSessions[sessionId].players[userId].lie = lie;
            console.log(`Statements received and saved for user ${userId} in session ${sessionId}`);
            socket.to(sessionId).emit('statements_updated', { userId, truths, lie });
        }
    });

    socket.on('start_game', ({ sessionId }) => {
        if (gameSessions[sessionId]) {
            gameSessions[sessionId].state = 'playing';
            io.to(sessionId).emit('game_started', gameSessions[sessionId]);
        }
    });

    socket.on('guess', ({ sessionId, userId, guess }) => {
        const session = gameSessions[sessionId];
        if (session && session.state === 'playing') {
            const players = session.players;
            Object.keys(players).forEach(id => {
                if (players[id].lie === guess && id !== userId) {
                    players[userId].score += 1;  // Increment score for correct guess
                    players[id].score -= 1;    // Decrement score for being guessed
                }
            });
            players[userId].hasGuessed = true;
            if (Object.values(players).every(player => player.hasGuessed)) {
                session.state = 'ended';
                io.to(sessionId).emit('end_game', { players: session.players });
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
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
