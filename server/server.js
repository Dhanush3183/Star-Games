const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const setupSocketHandlers = require('./socketHandler');

const app = express();
const server = http.createServer(app);

// Prevent server from crashing on unhandled errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// CORS for deployment (Vercel frontend, Render backend)
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all for simplicity, can be restricted to frontend URL in prod
    methods: ['GET', 'POST']
  }
});

app.use(cors());

// In development, we can serve the client files if we want to run both together locally
app.use(express.static(path.join(__dirname, '../client')));

// Basic health check route
app.get('/ping', (req, res) => {
  res.send('pong');
});

// Setup socket logic
setupSocketHandlers(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
