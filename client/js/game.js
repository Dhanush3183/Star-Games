let currentRoom = null;
let currentGameState = null;

const gameNames = {
    chainReaction: 'Chain Reaction',
    ticTacToe: 'Tic Tac Toe',
    connectFour: 'Connect Four',
    drawAndGuess: 'Draw and Guess',
    spikeAttack: 'Spike Attack',
    memoryCards: 'Memory Cards',
    uno: 'UNO'
};

const _gameSocket = setupSocket();

_gameSocket.on('gameStateUpdated', (data) => {
    if (data.gameState) {
        currentGameState = data.gameState;
        if (data.moveData && data.moveData.steps && data.moveData.steps.length > 1) {
            playChainReactionAnimations(data.gameState, data.moveData.steps);
        } else {
            renderBoard(currentGameState, data.moveData);
            updateGameHeader();
            checkGameOver();
        }
    } else {
        currentGameState = data;
        renderBoard(currentGameState);
        updateGameHeader();
        checkGameOver();
    }
    updatePlayersListUI();
});

_gameSocket.on('sa-sync', (gameState) => {
    currentGameState = gameState;
    renderBoard(currentGameState);
    updatePlayersListUI();
});

_gameSocket.on('playerDisconnected', (player) => {
    document.getElementById('disconnectOverlay').style.display = 'flex';
    document.getElementById('disconnectMessage').innerText = `${player.nickname} disconnected.`;
});

_gameSocket.on('gameAborted', () => {
    alert("Not enough players to continue. Returning to lobby.");
    window.location.href = 'lobby.html';
});

_gameSocket.on('gameStarted', (data) => {
    if (window.location.pathname.includes('game.html')) {
        // Instead of reloading, smoothly reset the game UI
        currentGameState = data.gameState;
        currentRoom = data.room;
        window.eliminatedPlayers = [];
        
        document.getElementById('gameOverOverlay').style.display = 'none';
        document.getElementById('boardContainer').innerHTML = ''; // Force board recreation
        
        updateGameUI(data.room);
    }
});

function updateGameUI(room) {
    currentRoom = room;
    if (room.gameState) {
        currentGameState = room.gameState;
    }
    
    document.getElementById('gameNameDisplay').innerText = gameNames[room.selectedGame] || 'Game';
    document.getElementById('roomCodeBadge').innerText = `Code: ${room.code}`;
    
    updatePlayersListUI();
    
    // Check if disconnected player reconnected
    if (room.players.every(p => p.connected)) {
        document.getElementById('disconnectOverlay').style.display = 'none';
    }
    
    updateGameHeader();
    if (!document.getElementById('boardContainer').children.length) {
        initBoard();
        renderBoard(currentGameState);
    }
}

function updatePlayersListUI() {
    if (!currentRoom) return;
    const playersList = document.getElementById('gamePlayersList');
    playersList.innerHTML = '';
    
    currentRoom.players.forEach(p => {
        const item = document.createElement('div');
        item.className = 'player-item-sm';
        item.style.borderLeftColor = p.color;
        
        let scoreHtml = '';
        if ((currentRoom.selectedGame === 'drawAndGuess' || currentRoom.selectedGame === 'memoryCards') && currentGameState && currentGameState.players) {
            const statePlayer = currentGameState.players.find(sp => sp.id === p.id);
            if (statePlayer) {
                scoreHtml = `<span style="margin-left:auto; font-weight:bold; color:var(--primary);">${statePlayer.score} pts</span>`;
            }
        }
        
        item.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.5rem; width:100%;">
                <div class="status-dot ${p.connected ? 'online' : 'offline'}"></div>
                <span style="color: ${p.color}; font-weight: bold;">${p.nickname}</span>
                ${scoreHtml}
            </div>
            ${p.readyToRestart ? '<span>✅</span>' : ''}
        `;
        playersList.appendChild(item);
    });
}

function updateGameHeader() {
    if (!currentGameState) return;
    
    const turnIndicator = document.getElementById('turnIndicator');
    
    if (currentGameState.winner || currentGameState.draw) {
        turnIndicator.innerText = "Game Over";
        turnIndicator.style.color = "var(--text-main)";
        return;
    }
    
    const currentPlayer = currentGameState.players[currentGameState.turnIndex];
    const isMe = currentPlayer.id === _gameSocket.id;
    
    turnIndicator.innerText = isMe ? "Your Turn!" : `${getNickname(currentPlayer.id)}'s Turn`;
    turnIndicator.style.color = currentPlayer.color;
    turnIndicator.style.textShadow = `0 0 10px ${currentPlayer.color}`;
}

function getNickname(id) {
    if (!currentRoom) return "Player";
    const p = currentRoom.players.find(p => p.id === id);
    return p ? p.nickname : "Player";
}

function initBoard() {
    const container = document.getElementById('boardContainer');
    container.innerHTML = '';
    
    if (currentRoom.selectedGame === 'chainReaction') {
        const board = document.createElement('div');
        board.className = 'cr-board';
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 6; c++) {
                const cell = document.createElement('div');
                cell.className = 'cr-cell';
                cell.id = `cr-${r}-${c}`;
                cell.onclick = () => makeMove({r, c});
                board.appendChild(cell);
            }
        }
        container.appendChild(board);
        
    } else if (currentRoom.selectedGame === 'ticTacToe') {
        const board = document.createElement('div');
        board.className = 'ttt-board';
        board.style.position = 'relative';
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                const cell = document.createElement('div');
                cell.className = 'ttt-cell';
                cell.id = `ttt-${r}-${c}`;
                cell.onclick = () => makeMove({r, c});
                board.appendChild(cell);
            }
        }
        
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("id", "ttt-svg");
        svg.style.position = "absolute";
        svg.style.top = "0";
        svg.style.left = "0";
        svg.style.width = "100%";
        svg.style.height = "100%";
        svg.style.pointerEvents = "none";
        svg.style.zIndex = "10";
        board.appendChild(svg);
        
        container.appendChild(board);
        
    } else if (currentRoom.selectedGame === 'connectFour') {
        const board = document.createElement('div');
        board.className = 'c4-board';
        board.style.position = 'relative';
        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 8; c++) {
                const cell = document.createElement('div');
                cell.className = 'c4-cell';
                cell.id = `c4-${r}-${c}`;
                cell.onclick = () => makeMove({c});
                board.appendChild(cell);
            }
        }
        
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("id", "c4-svg");
        svg.style.position = "absolute";
        svg.style.top = "0";
        svg.style.left = "0";
        svg.style.width = "100%";
        svg.style.height = "100%";
        svg.style.pointerEvents = "none";
        svg.style.zIndex = "10";
        board.appendChild(svg);
        
        container.appendChild(board);
    } else if (currentRoom.selectedGame === 'drawAndGuess') {
        initDrawAndGuess(container);
    } else if (currentRoom.selectedGame === 'spikeAttack') {
        initSpikeAttack(container);
    } else if (currentRoom.selectedGame === 'memoryCards') {
        const board = document.createElement('div');
        board.className = 'mc-board';
        for (let i = 0; i < 36; i++) {
            const cell = document.createElement('div');
            cell.className = 'mc-card';
            cell.id = `mc-card-${i}`;
            cell.onclick = () => makeMove({cardIndex: i});
            
            const inner = document.createElement('div');
            inner.className = 'mc-card-inner';
            
            const front = document.createElement('div');
            front.className = 'mc-card-front';
            front.innerText = '?';
            
            const back = document.createElement('div');
            back.className = 'mc-card-back';
            back.id = `mc-card-back-${i}`;
            
            inner.appendChild(front);
            inner.appendChild(back);
            cell.appendChild(inner);
            
            board.appendChild(cell);
        }
        container.appendChild(board);
    } else if (currentRoom.selectedGame === 'uno') {
        const board = document.createElement('div');
        board.className = 'uno-layout';
        board.innerHTML = `
            <div class="active-color-indicator" id="activeColorBadge"></div>
            <div class="uno-top" id="unoTopArea"></div>
            <div class="uno-left" id="unoLeftArea"></div>
            <div class="uno-right" id="unoRightArea"></div>
            <div class="uno-center">
                <div class="uno-pile uno-draw-pile" id="drawPile" onclick="makeMove({action: 'draw'})"></div>
                <div class="uno-discard-pile" id="discardPile"></div>
                <div id="directionIndicator" style="position: absolute; top: -50px; left: 50%; transform: translateX(-50%); color: #fff; font-weight: bold; font-size: 1.5rem;">Direction: ↻</div>
            </div>
            <div class="uno-bottom">
                <h2 id="activePlayerLabel" style="color: #fff; margin-bottom: 0.5rem;">Your Turn</h2>
                <div class="player-hand" id="playerHand"></div>
            </div>
            
            <button class="btn-uno-call" onclick="makeMove({action: 'callUno'})">UNO</button>
            
            <div class="color-picker-modal" id="colorPickerModal" style="display: none;">
                <div class="color-grid">
                    <button class="color-btn color-red" onclick="makeMove({action: 'play', cardIndex: window.unoPendingIndex, wildColor: 'red'}); document.getElementById('colorPickerModal').style.display = 'none';"></button>
                    <button class="color-btn color-blue" onclick="makeMove({action: 'play', cardIndex: window.unoPendingIndex, wildColor: 'blue'}); document.getElementById('colorPickerModal').style.display = 'none';"></button>
                    <button class="color-btn color-green" onclick="makeMove({action: 'play', cardIndex: window.unoPendingIndex, wildColor: 'green'}); document.getElementById('colorPickerModal').style.display = 'none';"></button>
                    <button class="color-btn color-yellow" onclick="makeMove({action: 'play', cardIndex: window.unoPendingIndex, wildColor: 'yellow'}); document.getElementById('colorPickerModal').style.display = 'none';"></button>
                </div>
            </div>
        `;
        container.appendChild(board);
    }
}

window.unoPlayCard = function(index, color) {
    if (color === 'wild') {
        window.unoPendingIndex = index;
        document.getElementById('colorPickerModal').style.display = 'flex';
    } else {
        makeMove({action: 'play', cardIndex: index});
    }
};

function createUnoCardUI(card, isHand = false, index = null, isPlayable = false) {
    const el = document.createElement('div');
    el.className = `uno-card ${card.color}`;
    el.innerText = card.value;
    
    if (isHand && isPlayable) {
        el.classList.add('playable');
        el.onclick = () => window.unoPlayCard(index, card.color);
    }
    return el;
}

function playChainReactionAnimations(finalGameState, steps) {
    let stepIndex = 0;
    
    // Temporarily block clicks during animation
    const container = document.getElementById('boardContainer');
    container.style.pointerEvents = 'none';
    
    function nextStep() {
        if (stepIndex < steps.length) {
            const tempState = { ...finalGameState, board: steps[stepIndex] };
            renderBoard(tempState, { explosions: true });
            stepIndex++;
            setTimeout(nextStep, 550);
        } else {
            container.style.pointerEvents = 'auto';
            renderBoard(finalGameState);
            updateGameHeader();
            checkGameOver();
        }
    }
    
    nextStep();
}

function renderBoard(gameState, moveData = null) {
    if (!gameState) return;
    
    if (currentRoom.selectedGame === 'chainReaction') {
        if (moveData && moveData.explosions) {
            playSound('explosion');
        } else if (moveData) {
            playSound('drop');
        }
        
        // Track elimination
        if (gameState.moveCount >= gameState.players.length) {
            gameState.players.forEach(p => {
                if (!p.active && (!window.eliminatedPlayers || !window.eliminatedPlayers.includes(p.id))) {
                    window.eliminatedPlayers = window.eliminatedPlayers || [];
                    window.eliminatedPlayers.push(p.id);
                    
                    const toast = document.createElement('div');
                    toast.className = 'glass-panel-sm animate-in text-center';
                    toast.style.position = 'fixed';
                    toast.style.top = '20px';
                    toast.style.left = '50%';
                    toast.style.transform = 'translateX(-50%)';
                    toast.style.zIndex = '1000';
                    toast.style.boxShadow = `0 0 20px ${p.color}`;
                    
                    if (p.id === _gameSocket.id) {
                        toast.innerHTML = `<h3 class="error-text">You are eliminated!</h3><p>You can spectate the rest of the game.</p>`;
                    } else {
                        toast.innerHTML = `<h3><span style="color:${p.color}">${getNickname(p.id)}</span> has been eliminated!</h3>`;
                    }
                    
                    document.body.appendChild(toast);
                    setTimeout(() => {
                        if (document.body.contains(toast)) {
                            toast.style.animation = 'float 1s linear forwards';
                            setTimeout(() => toast.remove(), 1000);
                        }
                    }, 4000);
                }
            });
        }
        
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 6; c++) {
                const cellData = gameState.board[r][c];
                const cellUI = document.getElementById(`cr-${r}-${c}`);
                if (!cellUI) continue;
                
                cellUI.innerHTML = '';
                if (cellData.atoms > 0) {
                    const container = document.createElement('div');
                    container.className = `atom-container atom-${cellData.atoms}`;
                    container.style.backgroundColor = cellData.owner;
                    
                    for (let i = 0; i < cellData.atoms; i++) {
                        const a = document.createElement('div');
                        a.className = 'atom';
                        container.appendChild(a);
                    }
                    cellUI.appendChild(container);
                }
            }
        }
        
    } else if (currentRoom.selectedGame === 'ticTacToe') {
        if (moveData) playSound('drop');
        
        // Symbols based on color for consistency
        const getSymbol = (color) => {
            if (color === '#ff3366') return 'X'; // Red
            if (color === '#33ccff') return 'O'; // Blue
            return '△'; // Green
        };
        
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                const val = gameState.board[r][c];
                const cellUI = document.getElementById(`ttt-${r}-${c}`);
                if (!cellUI) continue;
                
                if (val) {
                    cellUI.innerText = getSymbol(val);
                    cellUI.style.color = val;
                } else {
                    cellUI.innerText = '';
                }
            }
        }
        
        const svg = document.getElementById('ttt-svg');
        if (svg) {
            while (svg.firstChild) svg.removeChild(svg.firstChild);
            if (gameState.winningLine) {
                const [start, end] = gameState.winningLine;
                const startCell = document.getElementById(`ttt-${start[0]}-${start[1]}`);
                const endCell = document.getElementById(`ttt-${end[0]}-${end[1]}`);
                if (startCell && endCell) {
                    const boardRect = svg.getBoundingClientRect();
                    const startRect = startCell.getBoundingClientRect();
                    const endRect = endCell.getBoundingClientRect();
                    
                    const x1 = startRect.left - boardRect.left + startRect.width / 2;
                    const y1 = startRect.top - boardRect.top + startRect.height / 2;
                    const x2 = endRect.left - boardRect.left + endRect.width / 2;
                    const y2 = endRect.top - boardRect.top + endRect.height / 2;
                    
                    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    line.setAttribute("x1", x1);
                    line.setAttribute("y1", y1);
                    line.setAttribute("x2", x2);
                    line.setAttribute("y2", y2);
                    line.setAttribute("stroke", "white");
                    line.setAttribute("stroke-width", "6");
                    line.setAttribute("stroke-linecap", "round");
                    
                    // Basic animation
                    const length = Math.hypot(x2 - x1, y2 - y1);
                    line.style.strokeDasharray = length;
                    line.style.strokeDashoffset = length;
                    line.style.transition = "stroke-dashoffset 0.4s ease-in-out";
                    
                    svg.appendChild(line);
                    
                    // Trigger reflow
                    line.getBoundingClientRect();
                    line.style.strokeDashoffset = "0";
                }
            }
        }
        
    } else if (currentRoom.selectedGame === 'connectFour') {
        if (moveData) playSound('drop');
        
        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 8; c++) {
                const val = gameState.board[r][c];
                const cellUI = document.getElementById(`c4-${r}-${c}`);
                if (!cellUI) continue;
                
                // Keep the holes, just add discs inside if they exist and are not already there
                if (val) {
                    if (!cellUI.querySelector('.c4-disc')) {
                        const disc = document.createElement('div');
                        disc.className = 'c4-disc';
                        disc.style.backgroundColor = val;
                        // Avoid animating all discs on full re-render if we can, 
                        // but since we recreate it, it's fine for now.
                        // Ideally we only animate the newly added one.
                        if (moveData && moveData.r === r && moveData.c === c) {
                            disc.style.animation = 'dropIn 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                        } else {
                            disc.style.animation = 'none'; // Disable animation for already placed discs
                        }
                        cellUI.appendChild(disc);
                    }
                } else {
                    cellUI.innerHTML = '';
                }
            }
        }
        
        const svg = document.getElementById('c4-svg');
        if (svg) {
            while (svg.firstChild) svg.removeChild(svg.firstChild);
            if (gameState.winningLine) {
                const [start, end] = gameState.winningLine;
                const startCell = document.getElementById(`c4-${start[0]}-${start[1]}`);
                const endCell = document.getElementById(`c4-${end[0]}-${end[1]}`);
                if (startCell && endCell) {
                    const boardRect = svg.getBoundingClientRect();
                    const startRect = startCell.getBoundingClientRect();
                    const endRect = endCell.getBoundingClientRect();
                    
                    const x1 = startRect.left - boardRect.left + startRect.width / 2;
                    const y1 = startRect.top - boardRect.top + startRect.height / 2;
                    const x2 = endRect.left - boardRect.left + endRect.width / 2;
                    const y2 = endRect.top - boardRect.top + endRect.height / 2;
                    
                    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    line.setAttribute("x1", x1);
                    line.setAttribute("y1", y1);
                    line.setAttribute("x2", x2);
                    line.setAttribute("y2", y2);
                    line.setAttribute("stroke", "white");
                    line.setAttribute("stroke-width", "6");
                    line.setAttribute("stroke-linecap", "round");
                    
                    // Basic animation
                    const length = Math.hypot(x2 - x1, y2 - y1);
                    line.style.strokeDasharray = length;
                    line.style.strokeDashoffset = length;
                    line.style.transition = "stroke-dashoffset 0.4s ease-in-out";
                    
                    svg.appendChild(line);
                    
                    // Trigger reflow
                    line.getBoundingClientRect();
                    line.style.strokeDashoffset = "0";
                }
            }
        }
    } else if (currentRoom.selectedGame === 'drawAndGuess') {
        renderDrawAndGuess(gameState, moveData);
    } else if (currentRoom.selectedGame === 'spikeAttack') {
        renderSpikeAttack(gameState);
    } else if (currentRoom.selectedGame === 'memoryCards') {
        if (moveData && moveData.match) {
            playSound('drop');
        } else if (moveData) {
            playSound('click');
        }
        
        for (let i = 0; i < 36; i++) {
            const cardData = gameState.board[i];
            const cardUI = document.getElementById(`mc-card-${i}`);
            const backUI = document.getElementById(`mc-card-back-${i}`);
            if (!cardUI || !backUI || !cardData) continue;
            
            if (cardData.isFlipped || cardData.isMatched) {
                cardUI.classList.add('flipped');
                backUI.innerText = cardData.value;
            } else {
                cardUI.classList.remove('flipped');
            }
            
            if (cardData.isMatched) {
                cardUI.classList.add('matched');
            } else {
                cardUI.classList.remove('matched');
            }
        }
    } else if (currentRoom.selectedGame === 'uno') {
        const topCard = gameState.discardPile[gameState.discardPile.length - 1];
        
        const dirIndicator = document.getElementById('directionIndicator');
        if (dirIndicator) dirIndicator.innerText = gameState.direction === 1 ? 'Direction: ↻' : 'Direction: ↺';
        
        const colorBadge = document.getElementById('activeColorBadge');
        if (colorBadge) {
            if (topCard && topCard.color === 'wild' && gameState.activeColor) {
                colorBadge.style.display = 'block';
                colorBadge.style.background = getColorHex(gameState.activeColor);
                colorBadge.innerText = 'Color: ' + gameState.activeColor.toUpperCase();
            } else {
                colorBadge.style.display = 'none';
            }
        }

        const discardUI = document.getElementById('discardPile');
        if (discardUI && topCard) {
            discardUI.innerHTML = '';
            discardUI.appendChild(createUnoCardUI(topCard, false));
        }

        const topArea = document.getElementById('unoTopArea');
        const leftArea = document.getElementById('unoLeftArea');
        const rightArea = document.getElementById('unoRightArea');
        
        if (topArea) topArea.innerHTML = '';
        if (leftArea) leftArea.innerHTML = '';
        if (rightArea) rightArea.innerHTML = '';
        
        const otherPlayers = gameState.players.filter(p => p.id !== _gameSocket.id);
        otherPlayers.forEach((p, idx) => {
            const oppDiv = document.createElement('div');
            oppDiv.className = 'opponent-area';
            oppDiv.innerHTML = `<h3 style="color:#fff">${p.nickname}</h3><div style="color:#aaa">${p.cardsLeft} Cards</div>`;
            const cardsDiv = document.createElement('div');
            cardsDiv.className = 'opponent-cards';
            for (let i = 0; i < p.cardsLeft; i++) {
                const hidden = document.createElement('div');
                hidden.className = 'uno-card-mini';
                cardsDiv.appendChild(hidden);
            }
            oppDiv.appendChild(cardsDiv);
            
            if (otherPlayers.length === 1) {
                // 2 player game, opponent goes top
                if (topArea) topArea.appendChild(oppDiv);
            } else if (otherPlayers.length === 2) {
                // 3 player game, one left, one right
                if (idx === 0 && leftArea) leftArea.appendChild(oppDiv);
                if (idx === 1 && rightArea) rightArea.appendChild(oppDiv);
            }
        });

        const handUI = document.getElementById('playerHand');
        const activePlayerLabel = document.getElementById('activePlayerLabel');
        const myState = gameState.players.find(p => p.id === _gameSocket.id);
        const currentPlayer = gameState.players[gameState.turnIndex];
        
        if (activePlayerLabel) {
            activePlayerLabel.innerText = currentPlayer.id === _gameSocket.id ? "Your Turn" : `${currentPlayer.nickname}'s Turn`;
            activePlayerLabel.style.color = currentPlayer.color;
        }
        
        if (handUI && myState && myState.hand) {
            handUI.innerHTML = '';
            const isMyTurn = currentPlayer.id === _gameSocket.id;
            
            myState.hand.forEach((card, idx) => {
                const playable = isMyTurn && isUnoPlayable(card, gameState);
                handUI.appendChild(createUnoCardUI(card, true, idx, playable));
            });
        }
    }
}

function isUnoPlayable(card, gameState) {
    const top = gameState.discardPile[gameState.discardPile.length - 1];
    if (card.color === 'wild') return true;
    if (card.color === (gameState.activeColor || top.color)) return true;
    if (card.value === top.value) return true;
    return false;
}

function getColorHex(color) {
    switch(color) {
        case 'red': return '#ef4444';
        case 'blue': return '#3b82f6';
        case 'green': return '#22c55e';
        case 'yellow': return '#eab308';
        default: return '#111';
    }
}

function makeMove(data) {
    if (!currentGameState) return;
    const currentPlayer = currentGameState.players[currentGameState.turnIndex];
    if (currentPlayer.id !== _gameSocket.id) return;
    
    if (currentGameState.winner || currentGameState.draw) return;
    
    _gameSocket.emit('makeMove', data);
}

function checkGameOver() {
    if (!currentGameState) return;
    
    if (currentGameState.winner || currentGameState.draw) {
        setTimeout(() => {
            document.getElementById('gameOverOverlay').style.display = 'flex';
            document.getElementById('btnVoteRestart').disabled = false;
            document.getElementById('restartStatus').innerText = '';
            
            const title = document.getElementById('gameOverTitle');
            const msg = document.getElementById('gameOverMessage');
            
            if (currentGameState.winner) {
                playSound('win');
                const winnerId = currentGameState.winner;
                const isMe = winnerId === _gameSocket.id;
                const nickname = getNickname(winnerId);
                
                if (isMe) {
                    title.innerText = "Victory!";
                    title.className = "gradient-text";
                } else {
                    title.innerText = "Defeat";
                    title.className = "error-text";
                }
                msg.innerText = `${nickname} wins the game!`;
                
                // Confetti effect
                for(let i=0; i<100; i++) {
                    const conf = document.createElement('div');
                    conf.className = 'confetti';
                    conf.style.left = Math.random() * 100 + 'vw';
                    conf.style.animationDuration = (Math.random() * 2 + 2) + 's';
                    conf.style.backgroundColor = ['#ff3366', '#33ccff', '#99ff99', '#f093fb', '#00f2fe'][Math.floor(Math.random()*5)];
                    document.body.appendChild(conf);
                    setTimeout(() => conf.remove(), 4000);
                }
                
            } else if (currentGameState.draw) {
                title.innerText = "Draw!";
                title.className = "";
                title.style.color = "var(--text-main)";
                msg.innerText = "It's a tie!";
            }
        }, currentGameState.winningLine ? 800 : 500);
    } else {
        document.getElementById('gameOverOverlay').style.display = 'none';
    }
}

// --- Draw & Guess Logic ---
let isDrawing = false;
let ctx = null;
let lastX = 0, lastY = 0;
let dgUndoStack = [];

function initDrawAndGuess(container) {
    container.innerHTML = `
        <div class="dg-layout" style="display: flex; gap: 20px; width: 100%; height: 100%;">
            <div class="dg-main" style="flex: 1; display: flex; flex-direction: column; gap: 10px;">
                <div class="dg-top" style="display: flex; justify-content: space-between; align-items: center;">
                    <div id="dg-word-display" style="font-size: 1.5em; font-weight: bold;"></div>
                    <div id="dg-timer" style="font-size: 1.5em; color: var(--accent-main); font-weight: bold;">75s</div>
                </div>
                <div style="position: relative; flex: 1; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <canvas id="dg-canvas" style="width: 100%; height: 100%; display: block; cursor: crosshair;"></canvas>
                    <div id="dg-overlay" style="position: absolute; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.8); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10;">
                        <h2 id="dg-overlay-title" style="color: white; margin-bottom: 20px;">Waiting...</h2>
                        <div id="dg-word-input-container" style="display: none; text-align: center;">
                            <input type="text" id="dg-word-input" placeholder="Enter a word to draw..." class="styled-input" style="padding: 10px; font-size: 1.2em; border-radius: 4px; border: none; outline: none; display: block; margin-bottom: 10px;">
                            <button class="btn btn-primary" onclick="dgSubmitWord()">Start Drawing</button>
                        </div>
                    </div>
                </div>
                <div id="dg-controls" style="display: flex; gap: 10px; align-items: center;">
                    <input type="color" id="dg-color" value="#000000" style="width: 40px; height: 40px; border: none; cursor: pointer; border-radius: 4px; padding: 0;">
                    <input type="range" id="dg-size" min="1" max="20" value="5" style="flex: 1; accent-color: var(--primary-main);">
                    <button class="btn btn-secondary" onclick="dgUndo()">Undo</button>
                    <button class="btn btn-danger" onclick="dgClearCanvas()">Clear</button>
                </div>
            </div>
            <div class="dg-sidebar" style="width: 300px; display: flex; flex-direction: column; gap: 10px;">
                <div id="dg-chat" class="glass-panel" style="flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 5px; background: rgba(0,0,0,0.2);"></div>
                <form id="dg-guess-form" style="display: flex; gap: 5px;" onsubmit="dgSubmitGuess(event)">
                    <input type="text" id="dg-guess-input" placeholder="Type your guess..." class="styled-input" style="flex: 1;" autocomplete="off">
                    <button type="submit" class="btn btn-primary">Send</button>
                </form>
            </div>
        </div>
    `;

    const canvas = document.getElementById('dg-canvas');
    ctx = canvas.getContext('2d');
    
    // Set actual canvas size to match display size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Drawing Event Listeners
    canvas.addEventListener('mousedown', (e) => {
        if (!canDraw()) return;
        saveUndoState();
        if (_gameSocket) _gameSocket.emit('dg-push-undo');
        
        isDrawing = true;
        const pos = getMousePos(canvas, e);
        lastX = pos.x;
        lastY = pos.y;
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing || !canDraw()) return;
        const pos = getMousePos(canvas, e);
        const color = document.getElementById('dg-color').value;
        const size = document.getElementById('dg-size').value;
        
        drawLine(lastX, lastY, pos.x, pos.y, color, size, true);
        
        lastX = pos.x;
        lastY = pos.y;
    });

    canvas.addEventListener('mouseup', () => { isDrawing = false; });
    canvas.addEventListener('mouseout', () => { isDrawing = false; });
}

function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (evt.clientX - rect.left) * scaleX,
        y: (evt.clientY - rect.top) * scaleY
    };
}

function canDraw() {
    if (!currentGameState) return false;
    if (currentGameState.state !== 'drawing') return false;
    const drawer = currentGameState.players[currentGameState.turnIndex];
    return drawer.id === _gameSocket.id;
}

function drawLine(x0, y0, x1, y1, color, size, emit) {
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.closePath();
    
    if (emit && _gameSocket) {
        _gameSocket.emit('dg-draw', { x0, y0, x1, y1, color, size });
    }
}

function saveUndoState() {
    const canvas = document.getElementById('dg-canvas');
    if (!canvas) return;
    dgUndoStack.push(canvas.toDataURL());
    if (dgUndoStack.length > 20) dgUndoStack.shift();
}

function performUndo() {
    if (dgUndoStack.length === 0 || !ctx) return;
    const canvas = document.getElementById('dg-canvas');
    const imgData = dgUndoStack.pop();
    const img = new Image();
    img.src = imgData;
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
    };
}

function dgClearCanvas() {
    if (!canDraw()) return;
    if (!ctx) return;
    saveUndoState();
    if (_gameSocket) _gameSocket.emit('dg-push-undo');
    
    const canvas = document.getElementById('dg-canvas');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    _gameSocket.emit('dg-clear');
}

function dgUndo() {
    if (!canDraw() || dgUndoStack.length === 0) return;
    performUndo();
    if (_gameSocket) _gameSocket.emit('dg-undo');
}

function dgSubmitWord() {
    const input = document.getElementById('dg-word-input');
    const word = input.value.trim();
    if (word) {
        _gameSocket.emit('dg-setWord', word);
        input.value = '';
    }
}

function dgSubmitGuess(e) {
    e.preventDefault();
    if (!currentGameState || currentGameState.state !== 'drawing') return;
    const drawer = currentGameState.players[currentGameState.turnIndex];
    if (drawer.id === _gameSocket.id) return; // Drawer can't guess
    
    const input = document.getElementById('dg-guess-input');
    const guess = input.value.trim();
    if (guess) {
        _gameSocket.emit('dg-guess', guess);
        input.value = '';
    }
}

function renderDrawAndGuess(gameState, moveData) {
    const overlay = document.getElementById('dg-overlay');
    const overlayTitle = document.getElementById('dg-overlay-title');
    const wordInputContainer = document.getElementById('dg-word-input-container');
    const controls = document.getElementById('dg-controls');
    const wordDisplay = document.getElementById('dg-word-display');
    const guessInput = document.getElementById('dg-guess-input');
    
    const drawer = gameState.players[gameState.turnIndex];
    const isMe = drawer.id === _gameSocket.id;
    
    // Update Score display in sidebar (already handled by updateGameHeader/sidebar normally, but let's make sure score is visible)
    // Wait, the sidebar list updates automatically. We just need to make sure score is appended to nickname.
    // In updateGameHeader, it renders the players list. I should probably tweak `updateGameHeader` to show scores.
    
    if (gameState.state === 'choosing') {
        overlay.style.display = 'flex';
        controls.style.display = 'none';
        guessInput.disabled = true;
        
        if (isMe) {
            overlayTitle.innerText = "It's your turn to draw!";
            wordInputContainer.style.display = 'block';
        } else {
            overlayTitle.innerHTML = `<span style="color:${drawer.color}">${getNickname(drawer.id)}</span> is choosing a word...`;
            wordInputContainer.style.display = 'none';
        }
        wordDisplay.innerText = `Round ${gameState.currentRound}/${gameState.maxRounds}`;
        
    } else if (gameState.state === 'drawing') {
        overlay.style.display = 'none';
        
        if (isMe) {
            controls.style.display = 'flex';
            guessInput.disabled = true;
            wordDisplay.innerText = `Word: ${gameState.secretWord}`;
        } else {
            controls.style.display = 'none';
            guessInput.disabled = false;
            // Show underscores for word length
            const masked = gameState.secretWord.replace(/[a-zA-Z]/g, '_ ').trim();
            wordDisplay.innerText = `Guess: ${masked}`;
        }
        
    } else if (gameState.state === 'turn_end') {
        overlay.style.display = 'flex';
        controls.style.display = 'none';
        guessInput.disabled = true;
        
        if (gameState.correctGuesser) {
            const guesser = gameState.players.find(p => p.id === gameState.correctGuesser);
            overlayTitle.innerHTML = `<span style="color:${guesser.color}">${getNickname(guesser.id)}</span> guessed the word!`;
        } else {
            overlayTitle.innerText = "Time's up!";
        }
        wordInputContainer.style.display = 'none';
        wordDisplay.innerText = `The word was: ${gameState.secretWord}`;
    }
}

// Socket hooks for Draw & Guess
if (_gameSocket) {
    _gameSocket.on('dg-draw', (data) => {
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size, false);
    });
    
    _gameSocket.on('dg-clear', () => {
        if (!ctx) return;
        const canvas = document.getElementById('dg-canvas');
        if(canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
    
    _gameSocket.on('dg-push-undo', () => {
        saveUndoState();
    });
    
    _gameSocket.on('dg-undo', () => {
        performUndo();
    });
    
    _gameSocket.on('dg-timer', (time) => {
        const timer = document.getElementById('dg-timer');
        if (timer) timer.innerText = `${time}s`;
    });
    
    _gameSocket.on('dg-chatMessage', (msg) => {
        const chat = document.getElementById('dg-chat');
        if (!chat) return;
        const div = document.createElement('div');
        div.innerHTML = `<b style="color:${msg.color}">${msg.nickname}:</b> ${msg.text}`;
        chat.appendChild(div);
        chat.scrollTop = chat.scrollHeight;
    });
}
