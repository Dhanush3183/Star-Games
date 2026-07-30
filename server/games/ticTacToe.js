// Tic Tac Toe Logic (5x5, 4-in-a-row)

function initGame(players) {
  const board = Array(5).fill(null).map(() => Array(5).fill(null));
  
  // Assign symbols based on color for simplicity (or we can just use colors)
  // The prompt asks for X, O, Triangle (△). We can handle symbols in the frontend based on player index.
  
  return {
    gameId: 'ticTacToe',
    board,
    turnIndex: 0,
    players: players.map(p => ({ id: p.id, color: p.color })),
    winner: null,
    draw: false,
    moveCount: 0
  };
}

function checkWin(board, r, c, color) {
  const directions = [
    [0, 1],  // horizontal
    [1, 0],  // vertical
    [1, 1],  // diagonal right
    [1, -1]  // diagonal left
  ];
  
  for (const [dr, dc] of directions) {
    let count = 1;
    let cells = [[r, c]];
    // Check positive direction
    let cr = r + dr;
    let cc = c + dc;
    while (cr >= 0 && cr < 5 && cc >= 0 && cc < 5 && board[cr][cc] === color) {
      count++;
      cells.push([cr, cc]);
      cr += dr;
      cc += dc;
    }
    // Check negative direction
    cr = r - dr;
    cc = c - dc;
    while (cr >= 0 && cr < 5 && cc >= 0 && cc < 5 && board[cr][cc] === color) {
      count++;
      cells.push([cr, cc]);
      cr -= dr;
      cc -= dc;
    }
    
    if (count >= 4) {
      cells.sort((a, b) => a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]);
      return { win: true, line: [cells[0], cells[cells.length - 1]] };
    }
  }
  return { win: false };
}

function processMove(gameState, player, r, c) {
  if (gameState.winner || gameState.draw) return { valid: false, reason: 'Game over' };
  
  const currentPlayer = gameState.players[gameState.turnIndex];
  if (currentPlayer.id !== player.id) return { valid: false, reason: 'Not your turn' };
  
  if (r < 0 || r >= 5 || c < 0 || c >= 5 || gameState.board[r][c] !== null) {
    return { valid: false, reason: 'Invalid move' };
  }
  
  gameState.board[r][c] = player.color;
  gameState.moveCount++;
  
  const winResult = checkWin(gameState.board, r, c, player.color);
  if (winResult.win) {
    gameState.winner = player.id;
    gameState.winningLine = winResult.line;
  } else if (gameState.moveCount === 25) {
    gameState.draw = true;
  } else {
    gameState.turnIndex = (gameState.turnIndex + 1) % gameState.players.length;
  }
  
  return { valid: true, gameState };
}

module.exports = { initGame, processMove };
