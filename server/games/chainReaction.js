// Chain Reaction Logic
// 9 rows, 6 cols

function initGame(players) {
  const board = [];
  for (let r = 0; r < 9; r++) {
    const row = [];
    for (let c = 0; c < 6; c++) {
      row.push({ owner: null, atoms: 0 });
    }
    board.push(row);
  }
  
  return {
    gameId: 'chainReaction',
    board,
    turnIndex: 0,
    players: players.map(p => ({ id: p.id, color: p.color, active: true })),
    winner: null,
    moveCount: 0
  };
}

function processMove(gameState, player, r, c) {
  if (gameState.winner) return { valid: false, reason: 'Game over' };
  
  // Check if it's player's turn
  const currentPlayer = gameState.players[gameState.turnIndex];
  if (currentPlayer.id !== player.id) return { valid: false, reason: 'Not your turn' };
  
  // Check if it's their first move
  let ownsCells = false;
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 6; col++) {
      if (gameState.board[row][col].owner === player.color) {
        ownsCells = true;
        break;
      }
    }
    if (ownsCells) break;
  }
  
  const cell = gameState.board[r][c];
  if (ownsCells) {
    if (cell.owner !== player.color) {
      return { valid: false, reason: 'You can only increment your existing circles' };
    }
  } else {
    if (cell.owner !== null) {
      return { valid: false, reason: 'Cell owned by opponent' };
    }
  }
  
  gameState.moveCount++;
  
  const steps = [];
  
  // Add atom
  cell.atoms++;
  cell.owner = player.color;
  
  steps.push(JSON.parse(JSON.stringify(gameState.board)));
  
  // Process explosions
  const toProcess = [];
  if (cell.atoms >= 4) {
      toProcess.push({ r, c });
  }
  
  while (toProcess.length > 0) {
    const current = toProcess.shift();
    const cr = current.r;
    const cc = current.c;
    const cCell = gameState.board[cr][cc];
    
    if (cCell.atoms >= 4) {
      cCell.atoms -= 4;
      if (cCell.atoms === 0) cCell.owner = null;
      
      const neighbors = [
        { r: cr - 1, c: cc },
        { r: cr + 1, c: cc },
        { r: cr, c: cc - 1 },
        { r: cr, c: cc + 1 }
      ];
      
      let exploded = false;
      for (const n of neighbors) {
        if (n.r >= 0 && n.r < 9 && n.c >= 0 && n.c < 6) {
          const nCell = gameState.board[n.r][n.c];
          nCell.atoms++;
          nCell.owner = player.color;
          exploded = true;
          if (nCell.atoms >= 4 && !toProcess.find(p => p.r === n.r && p.c === n.c)) {
            toProcess.push({ r: n.r, c: n.c });
          }
        }
      }
      
      if (exploded) {
         steps.push(JSON.parse(JSON.stringify(gameState.board)));
      }
    }
  }
  
  // Check win condition (only after everyone had at least one turn)
  if (gameState.moveCount >= gameState.players.length) {
    const activeColors = new Set();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 6; c++) {
        if (gameState.board[r][c].owner) {
          activeColors.add(gameState.board[r][c].owner);
        }
      }
    }
    
    for (const p of gameState.players) {
      if (p.active && !activeColors.has(p.color)) {
        p.active = false;
      }
    }
    
    const remainingPlayers = gameState.players.filter(p => p.active);
    if (remainingPlayers.length === 1) {
      gameState.winner = remainingPlayers[0].id;
    }
  }
  
  // Next turn
  if (!gameState.winner) {
    do {
      gameState.turnIndex = (gameState.turnIndex + 1) % gameState.players.length;
    } while (!gameState.players[gameState.turnIndex].active);
  }
  
  return { valid: true, gameState, steps };
}

module.exports = {
  initGame,
  processMove
};
