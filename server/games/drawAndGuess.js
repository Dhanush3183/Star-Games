function initGame(players) {
  return {
    gameId: 'drawAndGuess',
    players: players.map(p => ({ id: p.id, color: p.color, score: 0 })),
    turnIndex: 0,
    currentRound: 1,
    maxRounds: 4,
    state: 'choosing', // 'choosing', 'drawing', 'turn_end'
    secretWord: '',
    timeRemaining: 75,
    winner: null,
    draw: false,
    correctGuesser: null
  };
}

function processGuess(gameState, player, guess) {
  if (gameState.state !== 'drawing') return { valid: false };
  
  const currentPlayer = gameState.players[gameState.turnIndex];
  if (player.id === currentPlayer.id) return { valid: false }; // Drawer can't guess
  
  if (guess.trim().toLowerCase() === gameState.secretWord.trim().toLowerCase()) {
    // Correct guess!
    const p = gameState.players.find(p => p.id === player.id);
    p.score += 1;
    gameState.state = 'turn_end';
    gameState.correctGuesser = player.id;
    return { valid: true, correct: true, gameState };
  }
  
  return { valid: true, correct: false, gameState };
}

function advanceTurn(gameState) {
  gameState.state = 'choosing';
  gameState.secretWord = '';
  gameState.correctGuesser = null;
  gameState.timeRemaining = 75;
  
  gameState.turnIndex++;
  if (gameState.turnIndex >= gameState.players.length) {
    gameState.turnIndex = 0;
    gameState.currentRound++;
  }
  
  if (gameState.currentRound > gameState.maxRounds) {
    gameState.state = 'finished';
    
    // Find winner
    let maxScore = -1;
    for (const p of gameState.players) {
        if (p.score > maxScore) maxScore = p.score;
    }
    
    const winners = gameState.players.filter(p => p.score === maxScore);
    if (winners.length === 1) {
        gameState.winner = winners[0].id;
    } else {
        gameState.draw = true; // Tie
    }
  }
  
  return gameState;
}

module.exports = { initGame, processGuess, advanceTurn };
