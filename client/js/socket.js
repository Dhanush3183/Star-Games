let _socket = null;

function setupSocket() {
    if (_socket) return _socket;
    
    // Connect to same origin in dev, or specific backend URL in production
    // (Vercel/Render envs usually inject a base URL, or we rely on relative paths if hosted together)
    // For this setup, we assume it's hosted together or we hardcode the Render URL later.
    // For now, we connect to the current host. 
    // In actual deployment, you'd do: const url = window.location.hostname.includes('localhost') ? 'http://localhost:3000' : 'https://your-render-app.onrender.com';
    const serverUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000' : '';
    
    _socket = io(serverUrl);
    
    _socket.on('connect', () => {
        console.log('Connected to server');
    });

    _socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });

    _socket.on('roomUpdated', (room) => {
        updateLobbyUI(room);
        if (typeof updateGameUI === 'function') {
            updateGameUI(room);
        }
    });

    _socket.on('gameStarted', (data) => {
        sessionStorage.setItem('roomData', JSON.stringify(data.room));
        if (window.location.pathname.includes('lobby.html')) {
            window.location.href = 'game.html';
        }
    });

    return _socket;
}

function updateLobbyUI(room) {
    // Only applies if we are on the lobby page
    const roomCodeDisplay = document.getElementById('roomCodeText');
    if (!roomCodeDisplay) return; // Not on lobby page

    roomCodeDisplay.innerText = room.code;
    
    document.getElementById('playerCount').innerText = `${room.players.length} / ${room.maxPlayers} Players`;
    
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '';
    
    room.players.forEach(p => {
        const item = document.createElement('div');
        item.className = 'player-item';
        item.style.borderLeftColor = p.color;
        
        const isHost = p.id === room.host;
        
        item.innerHTML = `
            <div class="player-info">
                <div class="status-dot ${p.connected ? 'online' : 'offline'}" title="${p.connected ? 'Online' : 'Disconnected'}"></div>
                <span style="color: ${p.color}; font-weight: bold;">${p.nickname}</span>
                ${isHost ? '<span class="host-badge">HOST</span>' : ''}
            </div>
            <div>
                ${p.id === _socket.id ? '(You)' : ''}
            </div>
        `;
        playersList.appendChild(item);
    });
    
    const hostControls = document.getElementById('hostControls');
    const guestControls = document.getElementById('guestControls');
    const startBtn = document.getElementById('btnStartGame');
    const guestGameSpan = document.getElementById('guestSelectedGame');
    
    const gameNames = {
        chainReaction: 'Chain Reaction',
        ticTacToe: 'Tic Tac Toe',
        connectFour: 'Connect Four',
        drawAndGuess: 'Draw & Guess'
    };
    
    if (_socket.id === room.host) {
        hostControls.style.display = 'block';
        guestControls.style.display = 'none';
        
        // Sync select value if changed by server/another way
        const select = document.getElementById('lobbyGameSelect');
        if (room.selectedGame && select.value !== room.selectedGame) {
            select.value = room.selectedGame;
        }
        
        startBtn.disabled = !(room.players.length === room.maxPlayers && room.selectedGame);
    } else {
        hostControls.style.display = 'none';
        guestControls.style.display = 'block';
        
        guestGameSpan.innerText = room.selectedGame ? gameNames[room.selectedGame] : 'Waiting for host to select...';
    }
}
