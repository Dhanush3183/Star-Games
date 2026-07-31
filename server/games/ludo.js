function initGame(players) {
  const is3Player = players.length === 3;
  const trackLength = 52;
  
  const ludoColors = {
      0: '#22c55e', // Green
      1: '#eab308', // Yellow
      2: '#3b82f6', // Blue
      3: '#ef4444'  // Red
  };

  // Setup player configs
  const playerConfigs = players.map((p, i) => {
    let ludoIndex;
    if (players.length === 2) {
        ludoIndex = i === 0 ? 2 : 0; // 0=Blue, 1=Green
    } else if (players.length === 3) {
        ludoIndex = i === 0 ? 2 : (i === 1 ? 0 : 3); // 0=Blue, 1=Green, 2=Red
    } else {
        ludoIndex = i;
    }
      
    const startCell = ludoIndex * 13;
    const homeTurn = startCell === 0 ? 50 : startCell - 2;
    
    return {
      id: p.id,
      nickname: p.nickname,
      color: ludoColors[ludoIndex],
      ludoIndex,
      startCell,
      homeTurn,
      pawns: Array(4).fill(null).map((_, i) => ({
        id: i,
        status: 'base',
        position: -1
      })),
      rank: null
    };
  });

  const safeCells = [0, 8, 13, 21, 26, 34, 39, 47];

  return {
    gameId: 'ludo',
    is3Player,
    trackLength,
    players: playerConfigs,
    turnIndex: 0,
    diceValue: null,
    diceRolled: false,
    sixCount: 0,
    safeCells,
    winner: null,
    finishedPlayers: 0,
    log: []
  };
}

function processMove(gameState, playerReq, moveData) {
  const playerIndex = gameState.players.findIndex(p => p.id === playerReq.id);
  if (playerIndex === -1 || playerIndex !== gameState.turnIndex) {
    return { valid: false, reason: 'Not your turn' };
  }

  const player = gameState.players[playerIndex];

  if (moveData.action === 'roll') {
    if (gameState.diceRolled) return { valid: false, reason: 'Dice already rolled' };
    
    const roll = Math.floor(Math.random() * 6) + 1;
    gameState.diceValue = roll;
    gameState.diceRolled = true;
    gameState.log.push(`${playerReq.nickname} rolled a ${roll}`);

    if (roll === 6) {
      gameState.sixCount++;
      if (gameState.sixCount === 3) {
        // 3 sixes = lose turn
        gameState.log.push(`${playerReq.nickname} rolled three 6s and lost their turn!`);
        advanceTurn(gameState);
        return { valid: true, gameState, diceRoll: roll };
      }
    } else {
      gameState.sixCount = 0;
    }

    // Auto-advance if no valid moves possible
    if (!hasValidMoves(gameState, player, roll)) {
      gameState.log.push(`${playerReq.nickname} has no valid moves.`);
      setTimeoutTurn(gameState); // Using a custom function to handle extra turn logic
      return { valid: true, gameState, diceRoll: roll, skipped: true };
    }

    return { valid: true, gameState, diceRoll: roll };
  }

  if (moveData.action === 'move') {
    if (!gameState.diceRolled) return { valid: false, reason: 'Roll dice first' };
    
    const pawn = player.pawns.find(p => p.id === moveData.pawnId);
    if (!pawn) return { valid: false, reason: 'Invalid pawn' };

    const roll = gameState.diceValue;
    const { valid, newStatus, newPosition, capture } = calculateMove(gameState, player, pawn, roll);

    if (!valid) return { valid: false, reason: 'Invalid move' };

    pawn.status = newStatus;
    pawn.position = newPosition;

    if (newStatus === 'home') {
      gameState.log.push(`${playerReq.nickname}'s pawn reached HOME!`);
    }

    let grantedExtraTurn = false;
    if (capture) {
      // Find opponent pawn(s) and send to base
      for (const opp of gameState.players) {
        if (opp.id === player.id) continue;
        const oppPawns = opp.pawns.filter(p => p.status === 'track' && p.position === newPosition);
        if (oppPawns.length > 0) {
          oppPawns.forEach(oppPawn => {
            oppPawn.status = 'base';
            oppPawn.position = -1;
          });
          gameState.log.push(`${playerReq.nickname} captured opponent pawn(s)!`);
          grantedExtraTurn = true; // Extra turn for capturing
        }
      }
    }

    // Check if player won
    if (player.pawns.every(p => p.status === 'home')) {
      player.rank = gameState.finishedPlayers + 1;
      gameState.finishedPlayers++;
      gameState.log.push(`${playerReq.nickname} finished at rank ${player.rank}!`);
      
      if (gameState.finishedPlayers === gameState.players.length - 1) {
        // Only 1 player left, game over
        const lastPlayer = gameState.players.find(p => !p.rank);
        if (lastPlayer) lastPlayer.rank = gameState.players.length;
        gameState.winner = gameState.players.find(p => p.rank === 1).id; // For simplicity, first to finish wins overall
      }
    }

    if (roll === 6 || grantedExtraTurn || newStatus === 'home') {
      // Player gets another turn
      gameState.diceRolled = false;
      if (newStatus === 'home') gameState.sixCount = 0; // Reset 6 count if reached home (house rule variation, prevents penalty after scoring)
    } else {
      advanceTurn(gameState);
    }

    return { valid: true, gameState };
  }

  return { valid: false, reason: 'Unknown action' };
}

function setTimeoutTurn(gameState) {
  // If player rolled a 6 but had no valid moves, they technically get another turn, 
  // but if they are stuck (e.g. all pawns in base and need a 6, but they rolled a 5), they don't.
  if (gameState.diceValue === 6) {
      gameState.diceRolled = false;
  } else {
      advanceTurn(gameState);
  }
}

function advanceTurn(gameState) {
  gameState.diceRolled = false;
  gameState.sixCount = 0;
  
  do {
    gameState.turnIndex = (gameState.turnIndex + 1) % gameState.players.length;
  } while (gameState.players[gameState.turnIndex].rank !== null && gameState.finishedPlayers < gameState.players.length - 1);
}

function calculateMove(gameState, player, pawn, roll) {
  if (pawn.status === 'base') {
    if (roll === 6) {
      return { valid: true, newStatus: 'track', newPosition: player.startCell, capture: false };
    }
    return { valid: false };
  }

  if (pawn.status === 'track') {
    let newPos = pawn.position;
    let turnToHome = false;
    let stepsLeft = roll;

    while (stepsLeft > 0) {
      if (newPos === player.homeTurn) {
        turnToHome = true;
        break;
      }
      newPos = (newPos + 1) % gameState.trackLength;
      stepsLeft--;
    }

    if (turnToHome) {
      if (stepsLeft > 6) return { valid: false }; // Cannot move beyond home
      if (stepsLeft === 6) {
        return { valid: true, newStatus: 'home', newPosition: 5, capture: false };
      }
      return { valid: true, newStatus: 'homePath', newPosition: stepsLeft - 1, capture: false };
    }

    // Check capture
    let capture = false;
    if (!gameState.safeCells.includes(newPos)) {
      for (const opp of gameState.players) {
        if (opp.id === player.id) continue;
        if (opp.pawns.some(p => p.status === 'track' && p.position === newPos)) {
          capture = true;
          break;
        }
      }
    }

    // Self block rule (can't land on own pawn unless it's a block logic, but here we'll allow sharing space for simplicity)
    // Most simple Ludo rules allow multiple of your own pawns on the same square.

    return { valid: true, newStatus: 'track', newPosition: newPos, capture };
  }

  if (pawn.status === 'homePath') {
    const newPos = pawn.position + roll;
    if (newPos < 5) {
      return { valid: true, newStatus: 'homePath', newPosition: newPos, capture: false };
    } else if (newPos === 5) {
      return { valid: true, newStatus: 'home', newPosition: 5, capture: false };
    } else {
      // Must roll exact number to reach home
      return { valid: false };
    }
  }

  return { valid: false };
}

function hasValidMoves(gameState, player, roll) {
  for (const pawn of player.pawns) {
    if (calculateMove(gameState, player, pawn, roll).valid) return true;
  }
  return false;
}

module.exports = { initGame, processMove };
