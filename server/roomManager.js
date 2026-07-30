const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms.has(code));
  return code;
}

function createRoom(hostId, maxPlayers, selectedGame = null) {
  const code = generateRoomCode();
  const room = {
    code,
    host: hostId,
    maxPlayers: parseInt(maxPlayers) || 2,
    players: [], // Array of { id, nickname, color, connected }
    selectedGame,
    gameState: null, // Will hold game specific state
    status: 'lobby', // 'lobby', 'playing', 'finished'
    lastActive: Date.now(),
    disconnectTimers: {} // track timeout for disconnects
  };
  rooms.set(code, room);
  return room;
}

function getRoom(code) {
  return rooms.get(code);
}

function removeRoom(code) {
  rooms.delete(code);
}

// Automatically remove inactive rooms after 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.lastActive > 10 * 60 * 1000) {
      rooms.delete(code);
    }
  }
}, 60 * 1000);

module.exports = {
  createRoom,
  getRoom,
  removeRoom,
  rooms
};
