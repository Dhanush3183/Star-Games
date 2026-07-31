const BOARD_SIZE = 400;
const TILE_SIZE = 100;
const PLAYER_RADIUS = 15;
const PLAYER_SPEED = 200; // units per second
const TICK_RATE = 20; // 20 times a second
const DT = 1 / TICK_RATE;

const BLOCKS = [
    { x: 0, y: 0, w: 100, h: 100 },       // Row 0, Col 0
    { x: 200, y: 100, w: 100, h: 100 },   // Row 1, Col 2
    { x: 200, y: 300, w: 100, h: 100 }    // Row 3, Col 2
];

function initGame(players) {
    const gameState = {
        gameId: 'spikeAttack',
        players: players.map((p, i) => ({
            id: p.id,
            color: p.color,
            score: 4,
            x: 50 + (i * 100), // simplistic spawn
            y: 250,
            dx: 0,
            dy: 0,
            hitThisRound: false,
            active: true
        })),
        phase: 'safe', // safe, warning, attack, hold, retract
        phaseTimeLeft: 3.0,
        attackSide: null, // top, bottom, left, right
        winner: null,
        draw: false,
        ended: false
    };
    return gameState;
}

function updatePhysics(gameState) {
    if (gameState.ended) return gameState;

    // Update phase
    gameState.phaseTimeLeft -= DT;
    if (gameState.phaseTimeLeft <= 0) {
        advancePhase(gameState);
    }

    // Move players
    for (let i = 0; i < gameState.players.length; i++) {
        const p1 = gameState.players[i];
        if (!p1.active) continue;

        // Apply velocity
        p1.x += p1.dx * PLAYER_SPEED * DT;
        p1.y += p1.dy * PLAYER_SPEED * DT;

        // Board boundary collisions
        if (p1.x - PLAYER_RADIUS < 0) p1.x = PLAYER_RADIUS;
        if (p1.x + PLAYER_RADIUS > BOARD_SIZE) p1.x = BOARD_SIZE - PLAYER_RADIUS;
        if (p1.y - PLAYER_RADIUS < 0) p1.y = PLAYER_RADIUS;
        if (p1.y + PLAYER_RADIUS > BOARD_SIZE) p1.y = BOARD_SIZE - PLAYER_RADIUS;

        // Block collisions (AABB vs Circle)
        for (const b of BLOCKS) {
            resolveCircleRectCollision(p1, b);
        }
        
        // Player vs Player pushing
        for (let j = i + 1; j < gameState.players.length; j++) {
            const p2 = gameState.players[j];
            if (!p2.active) continue;
            resolveCircleCircleCollision(p1, p2);
        }
    }

    // Spike hit detection
    if (gameState.phase === 'attack' || gameState.phase === 'hold') {
        checkSpikeHits(gameState);
    }

    // Check game over
    if (!gameState.ended) {
        let anyoneDead = false;
        for (const p of gameState.players) {
            if (p.score <= 0) {
                p.active = false;
                anyoneDead = true;
            }
        }
        if (anyoneDead) {
            endGame(gameState);
        }
    }

    return gameState;
}

function resolveCircleRectCollision(circle, rect) {
    let testX = circle.x;
    let testY = circle.y;

    if (circle.x < rect.x) testX = rect.x;
    else if (circle.x > rect.x + rect.w) testX = rect.x + rect.w;

    if (circle.y < rect.y) testY = rect.y;
    else if (circle.y > rect.y + rect.h) testY = rect.y + rect.h;

    const distX = circle.x - testX;
    const distY = circle.y - testY;
    const distance = Math.sqrt((distX * distX) + (distY * distY));

    if (distance <= PLAYER_RADIUS) {
        // Collision! Push circle out
        const overlap = PLAYER_RADIUS - distance;
        // If distance is 0 (exactly inside), push randomly
        const nx = distance === 0 ? 1 : distX / distance;
        const ny = distance === 0 ? 0 : distY / distance;
        circle.x += nx * overlap;
        circle.y += ny * overlap;
    }
}

function resolveCircleCircleCollision(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < PLAYER_RADIUS * 2 && distance > 0) {
        const overlap = (PLAYER_RADIUS * 2) - distance;
        const nx = dx / distance;
        const ny = dy / distance;
        
        // Push both away from each other equally
        p1.x += nx * (overlap / 2);
        p1.y += ny * (overlap / 2);
        p2.x -= nx * (overlap / 2);
        p2.y -= ny * (overlap / 2);
    }
}

function advancePhase(gameState) {
    switch (gameState.phase) {
        case 'safe':
            gameState.phase = 'warning';
            gameState.phaseTimeLeft = 3.0;
            const sides = ['top', 'bottom', 'left', 'right'];
            gameState.attackSide = sides[Math.floor(Math.random() * sides.length)];
            // Reset hit flags
            gameState.players.forEach(p => p.hitThisRound = false);
            break;
        case 'warning':
            gameState.phase = 'attack';
            gameState.phaseTimeLeft = 0.7;
            break;
        case 'attack':
            gameState.phase = 'hold';
            gameState.phaseTimeLeft = 3.0;
            break;
        case 'hold':
            gameState.phase = 'retract';
            gameState.phaseTimeLeft = 0.7;
            break;
        case 'retract':
            gameState.phase = 'safe';
            gameState.phaseTimeLeft = 3.0;
            gameState.attackSide = null;
            break;
    }
}

function getSpikeHitboxes(side) {
    const hitboxes = [];
    // Spikes cover entire rows/cols from the edge until they hit a block
    if (side === 'left') {
        for (let r = 0; r < 4; r++) {
            let limitX = BOARD_SIZE;
            for (const b of BLOCKS) {
                if (b.y === r * TILE_SIZE && b.x < limitX) limitX = b.x;
            }
            hitboxes.push({ x: 0, y: r * TILE_SIZE, w: limitX, h: TILE_SIZE });
        }
    } else if (side === 'right') {
        for (let r = 0; r < 4; r++) {
            let startX = 0;
            for (const b of BLOCKS) {
                if (b.y === r * TILE_SIZE && (b.x + b.w) > startX) startX = b.x + b.w;
            }
            hitboxes.push({ x: startX, y: r * TILE_SIZE, w: BOARD_SIZE - startX, h: TILE_SIZE });
        }
    } else if (side === 'top') {
        for (let c = 0; c < 4; c++) {
            let limitY = BOARD_SIZE;
            for (const b of BLOCKS) {
                if (b.x === c * TILE_SIZE && b.y < limitY) limitY = b.y;
            }
            hitboxes.push({ x: c * TILE_SIZE, y: 0, w: TILE_SIZE, h: limitY });
        }
    } else if (side === 'bottom') {
        for (let c = 0; c < 4; c++) {
            let startY = 0;
            for (const b of BLOCKS) {
                if (b.x === c * TILE_SIZE && (b.y + b.h) > startY) startY = b.y + b.h;
            }
            hitboxes.push({ x: c * TILE_SIZE, y: startY, w: TILE_SIZE, h: BOARD_SIZE - startY });
        }
    }
    return hitboxes;
}

function checkSpikeHits(gameState) {
    if (!gameState.attackSide) return;
    const hitboxes = getSpikeHitboxes(gameState.attackSide);
    
    for (const p of gameState.players) {
        if (!p.active || p.hitThisRound) continue;
        
        for (const box of hitboxes) {
            // AABB vs Circle
            let testX = p.x;
            let testY = p.y;

            if (p.x < box.x) testX = box.x;
            else if (p.x > box.x + box.w) testX = box.x + box.w;

            if (p.y < box.y) testY = box.y;
            else if (p.y > box.y + box.h) testY = box.y + box.h;

            const distX = p.x - testX;
            const distY = p.y - testY;
            const distance = Math.sqrt((distX * distX) + (distY * distY));

            // Give a little leeway so you don't get unfairly hit on the edge (e.g. radius - 5)
            if (distance <= PLAYER_RADIUS - 5) {
                p.score -= 1;
                p.hitThisRound = true;
                break; // Stop checking other hitboxes for this player
            }
        }
    }
}

function endGame(gameState) {
    gameState.ended = true;
    gameState.phase = 'gameover';
    
    let maxScore = -1;
    for (const p of gameState.players) {
        if (p.score > maxScore) maxScore = p.score;
    }
    
    const winners = gameState.players.filter(p => p.score === maxScore);
    if (winners.length === 1) {
        gameState.winner = winners[0].id;
    } else {
        gameState.draw = true; // Multiple winners handled via draw logic currently in the client
    }
}

module.exports = { initGame, updatePhysics };
