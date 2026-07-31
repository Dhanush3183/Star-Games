const { createRoom, getRoom, removeRoom, rooms } = require('./roomManager');
const chainReaction = require('./games/chainReaction');
const ticTacToe = require('./games/ticTacToe');
const connectFour = require('./games/connectFour');
const drawAndGuess = require('./games/drawAndGuess');
const spikeAttack = require('./games/spikeAttack');
const memoryCards = require('./games/memoryCards');
const uno = require('./games/uno');

const PLAYER_COLORS_2 = ['#ff3366', '#33ccff'];
const PLAYER_COLORS_3 = ['#ff3366', '#33ccff', '#99ff99'];

const games = {
  chainReaction,
  ticTacToe,
  connectFour,
  drawAndGuess,
  spikeAttack,
  memoryCards,
  uno
};

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    
    socket.on('createRoom', ({ nickname, maxPlayers, selectedGame }, callback) => {
      const room = createRoom(socket.id, maxPlayers, selectedGame);
      room.players.push({
        id: socket.id,
        nickname,
        color: room.maxPlayers === 2 ? PLAYER_COLORS_2[0] : PLAYER_COLORS_3[0],
        connected: true,
        readyToRestart: false
      });
      socket.join(room.code);
      socket.roomCode = room.code; // Track room on socket for disconnects
      
      io.to(room.code).emit('roomUpdated', room);
      callback({ success: true, room });
    });
    
    socket.on('joinRoom', ({ nickname, code }, callback) => {
      const room = getRoom(code);
      if (!room) return callback({ success: false, reason: 'Room Not Found' });
      
      // Check if trying to rejoin or transfer socket on refresh
      const existingPlayer = room.players.find(p => p.nickname === nickname);
      if (existingPlayer) {
        const oldId = existingPlayer.id;
        existingPlayer.id = socket.id;
        existingPlayer.connected = true;
        
        // Update ID in gameState to prevent turn logic bugs
        if (room.gameState && room.gameState.players) {
           const gsPlayer = room.gameState.players.find(p => p.id === oldId);
           if (gsPlayer) gsPlayer.id = socket.id;
           if (room.gameState.winner === oldId) room.gameState.winner = socket.id;
        }
        if (room.disconnectTimers[existingPlayer.nickname]) {
          clearTimeout(room.disconnectTimers[existingPlayer.nickname]);
          delete room.disconnectTimers[existingPlayer.nickname];
        }
        socket.join(code);
        socket.roomCode = code;
        io.to(code).emit('roomUpdated', room);
        if (room.status === 'playing') {
           io.to(code).emit('gameStateUpdated', room.gameState);
        }
        return callback({ success: true, room });
      }
      
      if (room.players.length >= room.maxPlayers) {
        return callback({ success: false, reason: 'Room Full' });
      }
      
      // Prevent duplicate nicknames in the same room
      if (room.players.some(p => p.nickname === nickname)) {
        return callback({ success: false, reason: 'Nickname already taken in this room' });
      }
      
      const colors = room.maxPlayers === 2 ? PLAYER_COLORS_2 : PLAYER_COLORS_3;
      const assignedColor = colors[room.players.length];
      
      room.players.push({
        id: socket.id,
        nickname,
        color: assignedColor,
        connected: true,
        readyToRestart: false
      });
      
      socket.join(code);
      socket.roomCode = code;
      room.lastActive = Date.now();
      
      io.to(code).emit('roomUpdated', room);
      callback({ success: true, room });
    });
    
    socket.on('changeGame', (gameId) => {
      const room = getRoom(socket.roomCode);
      if (room && room.host === socket.id && room.status === 'lobby') {
        room.selectedGame = gameId;
        room.lastActive = Date.now();
        io.to(room.code).emit('roomUpdated', room);
      }
    });
    
    socket.on('startGame', () => {
      const room = getRoom(socket.roomCode);
      if (room && room.host === socket.id && room.players.length === room.maxPlayers && room.selectedGame) {
        room.status = 'playing';
        room.lastActive = Date.now();
        room.players.forEach(p => p.readyToRestart = false);
        
        const gameModule = games[room.selectedGame];
        room.startingTurnIndex = 0; // First game starts with host/Player 1
        room.gameState = gameModule.initGame(room.players);
        room.gameState.turnIndex = room.startingTurnIndex;
        
        io.to(room.code).emit('gameStarted', { room, gameState: room.gameState });
      }
    });
    
    socket.on('makeMove', (moveData) => {
      const room = getRoom(socket.roomCode);
      if (room && room.status === 'playing') {
        room.lastActive = Date.now();
        const gameModule = games[room.selectedGame];
        const player = room.players.find(p => p.id === socket.id);
        
        if (!player) return;
        
        let result;
        if (room.selectedGame === 'chainReaction') {
          result = gameModule.processMove(room.gameState, player, moveData.r, moveData.c);
        } else if (room.selectedGame === 'ticTacToe') {
          result = gameModule.processMove(room.gameState, player, moveData.r, moveData.c);
        } else if (room.selectedGame === 'connectFour') {
          result = gameModule.processMove(room.gameState, player, moveData.c);
        } else if (room.selectedGame === 'memoryCards') {
          result = gameModule.processMove(room.gameState, player, moveData.cardIndex);
        } else if (room.selectedGame === 'uno') {
          result = gameModule.processMove(room.gameState, player, moveData);
        }
        
        if (result && result.valid) {
          room.gameState = result.gameState;
          
          io.to(room.code).emit('gameStateUpdated', { 
            gameState: room.gameState, 
            moveData: { ...moveData, ...result } // Includes explosions, landed row, etc.
          });
          
          if (result.mismatchDelay) {
            setTimeout(() => {
              if (room.status === 'playing' && room.selectedGame === 'memoryCards') {
                room.gameState = gameModule.resolveMismatch(room.gameState);
                io.to(room.code).emit('gameStateUpdated', { gameState: room.gameState });
              }
            }, 1000);
          }
        }
      }
    });
    
    socket.on('voteRestart', () => {
      const room = getRoom(socket.roomCode);
      if (room && room.status === 'playing') {
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
          player.readyToRestart = true;
          io.to(room.code).emit('roomUpdated', room);
          
          if (room.players.every(p => p.readyToRestart)) {
            // Everyone ready, restart
            room.players.forEach(p => p.readyToRestart = false);
            
            if (typeof room.startingTurnIndex === 'undefined') room.startingTurnIndex = 0;
            room.startingTurnIndex = (room.startingTurnIndex + 1) % room.players.length;
            
            const gameModule = games[room.selectedGame];
            room.gameState = gameModule.initGame(room.players);
            room.gameState.turnIndex = room.startingTurnIndex;
            
            io.to(room.code).emit('gameStarted', { room, gameState: room.gameState });
          }
        }
      }
    });
    
    socket.on('dg-setWord', (word) => {
      const room = getRoom(socket.roomCode);
      if (room && room.status === 'playing' && room.selectedGame === 'drawAndGuess') {
        const gameState = room.gameState;
        if (gameState.state === 'choosing' && gameState.players[gameState.turnIndex].id === socket.id) {
          gameState.secretWord = word;
          gameState.state = 'drawing';
          room.lastActive = Date.now();
          io.to(room.code).emit('gameStateUpdated', room.gameState);
        }
      }
    });

    socket.on('dg-guess', (guess) => {
      const room = getRoom(socket.roomCode);
      if (room && room.status === 'playing' && room.selectedGame === 'drawAndGuess') {
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;
        
        io.to(room.code).emit('dg-chatMessage', { nickname: player.nickname, color: player.color, text: guess });
        
        const result = games.drawAndGuess.processGuess(room.gameState, player, guess);
        if (result.valid) {
          room.gameState = result.gameState;
          if (result.correct) {
            io.to(room.code).emit('gameStateUpdated', room.gameState);
            setTimeout(() => {
              if (room.status === 'playing' && room.selectedGame === 'drawAndGuess') {
                room.gameState = games.drawAndGuess.advanceTurn(room.gameState);
                io.to(room.code).emit('gameStateUpdated', room.gameState);
                io.to(room.code).emit('dg-clear');
              }
            }, 3000);
          }
        }
      }
    });

    socket.on('dg-draw', (drawData) => {
      const room = getRoom(socket.roomCode);
      if (room && room.status === 'playing' && room.selectedGame === 'drawAndGuess') {
        const gameState = room.gameState;
        if (gameState.state === 'drawing' && gameState.players[gameState.turnIndex].id === socket.id) {
          socket.to(room.code).emit('dg-draw', drawData);
        }
      }
    });

    socket.on('dg-clear', () => {
      const room = getRoom(socket.roomCode);
      if (room && room.status === 'playing' && room.selectedGame === 'drawAndGuess') {
        const gameState = room.gameState;
        if (gameState.state === 'drawing' && gameState.players[gameState.turnIndex].id === socket.id) {
          socket.to(room.code).emit('dg-clear');
        }
      }
    });

    socket.on('dg-push-undo', () => {
      const room = getRoom(socket.roomCode);
      if (room && room.status === 'playing' && room.selectedGame === 'drawAndGuess') {
        const gameState = room.gameState;
        if (gameState.state === 'drawing' && gameState.players[gameState.turnIndex].id === socket.id) {
          socket.to(room.code).emit('dg-push-undo');
        }
      }
    });

    socket.on('dg-undo', () => {
      const room = getRoom(socket.roomCode);
      if (room && room.status === 'playing' && room.selectedGame === 'drawAndGuess') {
        const gameState = room.gameState;
        if (gameState.state === 'drawing' && gameState.players[gameState.turnIndex].id === socket.id) {
          socket.to(room.code).emit('dg-undo');
        }
      }
    });

    socket.on('sa-input', (inputData) => {
      const room = getRoom(socket.roomCode);
      if (room && room.status === 'playing' && room.selectedGame === 'spikeAttack') {
        const player = room.gameState.players.find(p => p.id === socket.id);
        if (player && player.active) {
          player.dx = inputData.dx;
          player.dy = inputData.dy;
        }
      }
    });
    
    socket.on('leaveRoom', () => {
      handleLeave(socket);
    });
    
    socket.on('disconnect', () => {
      handleLeave(socket, true);
    });
    
    function handleLeave(socket, isDisconnect = false) {
      const code = socket.roomCode;
      if (!code) return;
      
      const room = getRoom(code);
      if (!room) return;
      
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        
        if (isDisconnect && room.status === 'playing') {
          player.connected = false;
          io.to(code).emit('playerDisconnected', player);
          
          // 8 sec timeout to remove player
          room.disconnectTimers[player.nickname] = setTimeout(() => {
             const finalRoom = getRoom(code);
             if (finalRoom) {
               finalRoom.players = finalRoom.players.filter(p => p.nickname !== player.nickname);
               checkRoomEmpty(finalRoom);
             }
          }, 8000);
          
        } else {
          // Explicit leave or lobby disconnect
          room.players.splice(playerIndex, 1);
          io.to(code).emit('playerLeft', player);
          checkRoomEmpty(room);
        }
      }
      
      socket.leave(code);
      delete socket.roomCode;
    }
    
    function checkRoomEmpty(room) {
       if (room.players.length === 0) {
          removeRoom(room.code);
       } else {
          // Reassign host if host left
          if (!room.players.find(p => p.id === room.host)) {
             room.host = room.players[0].id;
          }
          if (room.status === 'playing' && room.players.length < 2) {
             room.status = 'lobby'; // Abort game if not enough players
             io.to(room.code).emit('gameAborted');
          }
          io.to(room.code).emit('roomUpdated', room);
       }
    }
    
  });
  
  // Timer for Draw & Guess
  setInterval(() => {
    for (const [code, room] of rooms.entries()) {
      if (room.status === 'playing' && room.selectedGame === 'drawAndGuess') {
        const gameState = room.gameState;
        if (gameState && gameState.state === 'drawing') {
          gameState.timeRemaining--;
          io.to(code).emit('dg-timer', gameState.timeRemaining);
          
          if (gameState.timeRemaining <= 0) {
            room.gameState = games.drawAndGuess.advanceTurn(gameState);
            io.to(code).emit('gameStateUpdated', room.gameState);
            io.to(code).emit('dg-clear');
          }
        }
      }
    }
  }, 1000);

  // Global Server Loop for Spike Attack real-time physics (20 TPS)
  setInterval(() => {
    for (const [code, room] of rooms.entries()) {
      if (room.status === 'playing' && room.selectedGame === 'spikeAttack' && room.gameState && !room.gameState.ended) {
        room.gameState = games.spikeAttack.updatePhysics(room.gameState);
        io.to(code).emit('sa-sync', room.gameState);
        
        if (room.gameState.ended) {
          io.to(code).emit('gameStateUpdated', room.gameState);
        }
      }
    }
  }, 1000 / 20);
}

module.exports = setupSocketHandlers;
