// Connect Four Logic (7 rows, 8 cols, 4-in-a-row)

function initGame(players) {
  const board = Array(7).fill(null).map(() => Array(8).fill(null));
  
  return {
    gameId: 'connectFour',
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
    [1, 1],  // diagonal right down
    [1, -1]  // diagonal left down
  ];
  
  for (const [dr, dc] of directions) {
    let count = 1;
    let cells = [[r, c]];
    // Check positive direction
    let cr = r + dr;
    let cc = c + dc;
    while (cr >= 0 && cr < 7 && cc >= 0 && cc < 8 && board[cr][cc] === color) {
      count++;
      cells.push([cr, cc]);
      cr += dr;
      cc += dc;
    }
    // Check negative direction
    cr = r - dr;
    cc = c - dc;
    while (cr >= 0 && cr < 7 && cc >= 0 && cc < 8 && board[cr][cc] === color) {
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

function processMove(gameState, player, c) {
  if (gameState.winner || gameState.draw) return { valid: false, reason: 'Game over' };
  
  const currentPlayer = gameState.players[gameState.turnIndex];
  if (currentPlayer.id !== player.id) return { valid: false, reason: 'Not your turn' };
  
  if (c < 0 || c >= 8) return { valid: false, reason: 'Invalid column' };
  
  // Find lowest available row in column c
  let r = -1;
  for (let row = 6; row >= 0; row--) {
    if (gameState.board[row][c] === null) {
      r = row;
      break;
    }
  }
  
  if (r === -1) return { valid: false, reason: 'Column full' };
  
  gameState.board[r][c] = player.color;
  gameState.moveCount++;
  
  const winResult = checkWin(gameState.board, r, c, player.color);
  if (winResult.win) {
    gameState.winner = player.id;
    gameState.winningLine = winResult.line;
  } else if (gameState.moveCount === 7 * 8) {
    gameState.draw = true;
  } else {
    gameState.turnIndex = (gameState.turnIndex + 1) % gameState.players.length;
  }
  
  // Return the row where the disc landed so client can animate properly
  return { valid: true, gameState, r, c };
}

module.exports = { initGame, processMove };
