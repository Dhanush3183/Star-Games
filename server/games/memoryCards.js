function initGame(players) {
    const gameState = {
        players: players.map(p => ({
            id: p.id,
            nickname: p.nickname,
            color: p.color,
            active: true,
            score: 0
        })),
        turnIndex: 0,
        board: [],
        flippedCards: [],
        matchedPairsCount: 0,
        isBoardLocked: false,
        winner: null,
        draw: false,
        ended: false
    };

    // Generate pairs (using icons)
    const icons = ['🍎', '🍌', '🍇', '🍉', '🍓', '🍒', '🍑', '🍍', '🥝', '🍋', '🍈', '🥥', '🥭', '🍐', '🍊', '🫐', '🥑', '🍅'];
    const values = [];
    for (const icon of icons) {
        values.push(icon, icon);
    }

    // Shuffle (Fisher-Yates)
    for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [values[i], values[j]] = [values[j], values[i]];
    }

    // Create cards
    gameState.board = values.map((val, idx) => ({
        id: idx,
        value: val,
        isFlipped: false,
        isMatched: false
    }));

    return gameState;
}

function processMove(gameState, player, cardIndex) {
    if (gameState.ended) return { valid: false };
    
    const currentPlayer = gameState.players[gameState.turnIndex];
    if (currentPlayer.id !== player.id) return { valid: false };
    if (gameState.isBoardLocked) return { valid: false };
    
    const card = gameState.board[cardIndex];
    if (!card || card.isFlipped || card.isMatched) return { valid: false };

    // Flip the card
    card.isFlipped = true;
    gameState.flippedCards.push(cardIndex);

    const result = { valid: true, gameState };

    // Check if 2 cards are flipped
    if (gameState.flippedCards.length === 2) {
        gameState.isBoardLocked = true;
        const [firstIndex, secondIndex] = gameState.flippedCards;
        const firstCard = gameState.board[firstIndex];
        const secondCard = gameState.board[secondIndex];

        if (firstCard.value === secondCard.value) {
            // Match!
            firstCard.isMatched = true;
            secondCard.isMatched = true;
            currentPlayer.score += 1;
            gameState.matchedPairsCount += 1;
            gameState.flippedCards = [];
            gameState.isBoardLocked = false;
            result.match = true;

            // Player keeps their turn

            // Check win condition
            if (gameState.matchedPairsCount === 18) {
                gameState.ended = true;
                
                // Determine winner
                let highestScore = -1;
                let winners = [];
                for (const p of gameState.players) {
                    if (p.score > highestScore) {
                        highestScore = p.score;
                        winners = [p.id];
                    } else if (p.score === highestScore) {
                        winners.push(p.id);
                    }
                }

                if (winners.length > 1) {
                    gameState.draw = true;
                } else {
                    gameState.winner = winners[0];
                }
            }
        } else {
            // Mismatch
            result.mismatchDelay = true;
        }
    }

    return result;
}

function resolveMismatch(gameState) {
    if (gameState.flippedCards.length === 2) {
        const [firstIndex, secondIndex] = gameState.flippedCards;
        gameState.board[firstIndex].isFlipped = false;
        gameState.board[secondIndex].isFlipped = false;
        gameState.flippedCards = [];
        gameState.isBoardLocked = false;
        
        // Pass turn
        gameState.turnIndex = (gameState.turnIndex + 1) % gameState.players.length;
    }
    return gameState;
}

module.exports = {
    initGame,
    processMove,
    resolveMismatch
};
