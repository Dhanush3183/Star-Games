const COLORS = ['red', 'yellow', 'green', 'blue'];

function createDeck() {
    let deck = [];
    let idCounter = 0;
    
    // Number and Action cards per color
    COLORS.forEach(color => {
        // One '0'
        deck.push({ id: idCounter++, color, type: 'number', value: '0' });
        // Two '1'-'9', Skip, Reverse, Draw2
        for (let i = 1; i <= 9; i++) {
            deck.push({ id: idCounter++, color, type: 'number', value: String(i) });
            deck.push({ id: idCounter++, color, type: 'number', value: String(i) });
        }
        for (let i = 0; i < 2; i++) {
            deck.push({ id: idCounter++, color, type: 'skip', value: '🚫' });
            deck.push({ id: idCounter++, color, type: 'reverse', value: '🔄' });
            deck.push({ id: idCounter++, color, type: 'draw2', value: '+2' });
        }
    });

    // Wilds
    for (let i = 0; i < 4; i++) {
        deck.push({ id: idCounter++, color: 'wild', type: 'wild', value: 'Wild' });
        deck.push({ id: idCounter++, color: 'wild', type: 'draw4', value: '+4' });
    }

    return shuffle(deck);
}

function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

function initGame(players) {
    const gameState = {
        players: players.map(p => ({
            id: p.id,
            nickname: p.nickname,
            color: p.color,
            active: true,
            hand: [],
            cardsLeft: 7, // Sent to clients to hide hands
            hasCalledUno: false
        })),
        turnIndex: 0,
        deck: createDeck(),
        discardPile: [],
        direction: 1, // 1 for clockwise, -1 for counter-clockwise
        activeColor: null, // used when a Wild is played
        winner: null,
        draw: false,
        ended: false,
        pendingAction: null
    };

    // Deal 7 cards to each player
    for (let i = 0; i < 7; i++) {
        gameState.players.forEach(p => p.hand.push(gameState.deck.pop()));
    }
    
    // Initial discard (must not be wild)
    let initialCard = gameState.deck.pop();
    while (initialCard.color === 'wild') {
        gameState.deck.unshift(initialCard);
        initialCard = gameState.deck.pop();
    }
    gameState.discardPile.push(initialCard);
    gameState.activeColor = initialCard.color;

    return gameState;
}

function recycleDiscardPile(gameState) {
    const top = gameState.discardPile.pop();
    gameState.deck = shuffle([...gameState.discardPile]);
    gameState.discardPile = [top];
}

function processMove(gameState, player, moveData) {
    if (gameState.ended) return { valid: false };
    
    const currentPlayer = gameState.players[gameState.turnIndex];
    if (currentPlayer.id !== player.id) return { valid: false };

    let pState = gameState.players.find(p => p.id === player.id);

    if (moveData.action === 'draw') {
        if (gameState.deck.length === 0) recycleDiscardPile(gameState);
        const card = gameState.deck.pop();
        pState.hand.push(card);
        pState.cardsLeft = pState.hand.length;
        
        // Pass turn
        gameState.turnIndex = getNextPlayerIndex(gameState, 1);
        
        return { valid: true, gameState };
    } 
    else if (moveData.action === 'play') {
        const cardIndex = moveData.cardIndex;
        const wildColor = moveData.wildColor;
        
        const card = pState.hand[cardIndex];
        if (!card) return { valid: false };
        
        const top = gameState.discardPile[gameState.discardPile.length - 1];
        
        // Validation
        const isValid = (card.color === 'wild') || 
                        (card.color === (gameState.activeColor || top.color)) || 
                        (card.value === top.value);
                        
        if (!isValid) return { valid: false };
        
        // Play card
        pState.hand.splice(cardIndex, 1);
        pState.cardsLeft = pState.hand.length;
        gameState.discardPile.push(card);
        
        if (card.color !== 'wild') {
            gameState.activeColor = card.color;
        } else {
            gameState.activeColor = wildColor || 'red'; // fallback
        }
        
        if (pState.hand.length === 0) {
            gameState.ended = true;
            gameState.winner = player.id;
            return { valid: true, gameState, match: true };
        }
        
        // Handle Action Cards
        let skipCount = 0;
        let cardsToDraw = 0;
        
        if (card.type === 'skip') {
            skipCount = 1;
        } else if (card.type === 'reverse') {
            if (gameState.players.length === 2) {
                skipCount = 1;
            } else {
                gameState.direction *= -1;
            }
        } else if (card.type === 'draw2') {
            cardsToDraw = 2;
            skipCount = 1;
        } else if (card.type === 'draw4') {
            cardsToDraw = 4;
            skipCount = 1;
        }
        
        if (cardsToDraw > 0) {
            let nextIndex = getNextPlayerIndex(gameState, 1);
            for (let i = 0; i < cardsToDraw; i++) {
                if (gameState.deck.length === 0) recycleDiscardPile(gameState);
                gameState.players[nextIndex].hand.push(gameState.deck.pop());
                gameState.players[nextIndex].cardsLeft = gameState.players[nextIndex].hand.length;
            }
        }
        
        gameState.turnIndex = getNextPlayerIndex(gameState, 1 + skipCount);
        
        return { valid: true, gameState, match: true };
    }

    return { valid: false };
}

function getNextPlayerIndex(gameState, steps = 1) {
    let next = gameState.turnIndex + (gameState.direction * steps);
    const n = gameState.players.length;
    next = ((next % n) + n) % n; // Handles negative numbers
    return next;
}

module.exports = {
    initGame,
    processMove
};
