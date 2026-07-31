// Spike Attack Client Logic

let saCanvas = null;
let saCtx = null;
let saInput = { dx: 0, dy: 0 };
let saInputInterval = null;

function initSpikeAttack(container) {
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; position:relative;">
            <canvas id="sa-canvas" width="400" height="400" style="background:#f5e1da; border:10px solid #222; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.5);"></canvas>
            
            <div id="sa-joystick-container" style="position:absolute; bottom:20px; left:20px; width:120px; height:120px; background:rgba(0,0,0,0.2); border-radius:50%; touch-action:none; display:flex; justify-content:center; align-items:center; z-index:50;">
                <div id="sa-joystick-knob" style="width:50px; height:50px; background:rgba(255,255,255,0.7); border-radius:50%; box-shadow:0 4px 10px rgba(0,0,0,0.3); position:absolute;"></div>
            </div>
            
            <div style="position:absolute; bottom:20px; right:20px; background:rgba(0,0,0,0.5); color:white; padding:10px; border-radius:8px; font-size:12px; pointer-events:none;">
                WASD / Arrows to move
            </div>
        </div>
    `;

    saCanvas = document.getElementById('sa-canvas');
    saCtx = saCanvas.getContext('2d');

    setupSpikeAttackControls();
}

function setupSpikeAttackControls() {
    // Keyboard controls
    const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false };

    function updateInputFromKeys() {
        let dx = 0;
        let dy = 0;
        if (keys.w || keys.ArrowUp) dy -= 1;
        if (keys.s || keys.ArrowDown) dy += 1;
        if (keys.a || keys.ArrowLeft) dx -= 1;
        if (keys.d || keys.ArrowRight) dx += 1;
        
        // Normalize
        if (dx !== 0 && dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;
        }
        
        saInput.dx = dx;
        saInput.dy = dy;
    }

    window.addEventListener('keydown', (e) => {
        if (keys.hasOwnProperty(e.key)) {
            keys[e.key] = true;
            updateInputFromKeys();
        }
    });

    window.addEventListener('keyup', (e) => {
        if (keys.hasOwnProperty(e.key)) {
            keys[e.key] = false;
            updateInputFromKeys();
        }
    });

    // Virtual Joystick Controls
    const joystickContainer = document.getElementById('sa-joystick-container');
    const joystickKnob = document.getElementById('sa-joystick-knob');
    let isDragging = false;
    const maxRadius = 40;

    function handleJoystickStart(e) {
        isDragging = true;
        handleJoystickMove(e);
    }

    function handleJoystickMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        
        const rect = joystickContainer.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        let clientX, clientY;
        if (e.touches) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        
        let dx = clientX - centerX;
        let dy = clientY - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > maxRadius) {
            dx = (dx / distance) * maxRadius;
            dy = (dy / distance) * maxRadius;
        }
        
        joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
        
        saInput.dx = dx / maxRadius;
        saInput.dy = dy / maxRadius;
    }

    function handleJoystickEnd() {
        isDragging = false;
        joystickKnob.style.transform = `translate(0px, 0px)`;
        saInput.dx = 0;
        saInput.dy = 0;
        updateInputFromKeys(); // Fallback to keyboard if it's still being pressed
    }

    joystickContainer.addEventListener('mousedown', handleJoystickStart);
    window.addEventListener('mousemove', handleJoystickMove);
    window.addEventListener('mouseup', handleJoystickEnd);
    
    joystickContainer.addEventListener('touchstart', handleJoystickStart, {passive: false});
    window.addEventListener('touchmove', handleJoystickMove, {passive: false});
    window.addEventListener('touchend', handleJoystickEnd);
    window.addEventListener('touchcancel', handleJoystickEnd);

    // Send input to server regularly
    if (saInputInterval) clearInterval(saInputInterval);
    saInputInterval = setInterval(() => {
        if (typeof _gameSocket !== 'undefined' && currentRoom && currentRoom.selectedGame === 'spikeAttack') {
            _gameSocket.emit('sa-input', saInput);
        }
    }, 1000 / 20); // 20 times a second matches server tick
}

function renderSpikeAttack(gameState) {
    if (!saCtx || !saCanvas) return;
    
    // Clear
    saCtx.clearRect(0, 0, saCanvas.width, saCanvas.height);
    
    // Draw Checkerboard floor (4x4)
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            saCtx.fillStyle = (r + c) % 2 === 0 ? '#ffb399' : '#ff9980';
            saCtx.fillRect(c * 100, r * 100, 100, 100);
        }
    }
    
    // Draw Warning Lights
    if (gameState.phase === 'warning') {
        saCtx.fillStyle = `rgba(255, 0, 0, ${0.5 + Math.sin(Date.now() / 100) * 0.3})`; // pulsing
        if (gameState.attackSide === 'left') saCtx.fillRect(0, 0, 15, 400);
        else if (gameState.attackSide === 'right') saCtx.fillRect(385, 0, 15, 400);
        else if (gameState.attackSide === 'top') saCtx.fillRect(0, 0, 400, 15);
        else if (gameState.attackSide === 'bottom') saCtx.fillRect(0, 385, 400, 15);
    }
    
    // Draw Blocks
    const blocks = [
        { x: 0, y: 0, w: 100, h: 100 },
        { x: 200, y: 100, w: 100, h: 100 },
        { x: 200, y: 300, w: 100, h: 100 }
    ];
    saCtx.fillStyle = '#5c4a72';
    for (const b of blocks) {
        // Draw base block
        saCtx.fillRect(b.x, b.y, b.w, b.h);
        // Draw block highlight/shadow for 3D effect
        saCtx.fillStyle = '#4a3a5c';
        saCtx.fillRect(b.x + 5, b.y + b.h - 15, b.w - 10, 15);
        saCtx.fillStyle = '#5c4a72';
    }
    
    // Draw Players
    for (const p of gameState.players) {
        if (!p.active) continue;
        
        saCtx.beginPath();
        saCtx.arc(p.x, p.y, 15, 0, Math.PI * 2);
        saCtx.fillStyle = p.color;
        saCtx.fill();
        saCtx.lineWidth = 3;
        saCtx.strokeStyle = '#000';
        saCtx.stroke();
        
        // Draw Eyes to show direction (very simple)
        saCtx.fillStyle = 'white';
        saCtx.beginPath(); saCtx.arc(p.x - 5, p.y - 3, 4, 0, Math.PI*2); saCtx.fill();
        saCtx.beginPath(); saCtx.arc(p.x + 5, p.y - 3, 4, 0, Math.PI*2); saCtx.fill();
        saCtx.fillStyle = 'black';
        saCtx.beginPath(); saCtx.arc(p.x - 5, p.y - 3, 2, 0, Math.PI*2); saCtx.fill();
        saCtx.beginPath(); saCtx.arc(p.x + 5, p.y - 3, 2, 0, Math.PI*2); saCtx.fill();
        
        // Draw small score bubble above player
        saCtx.font = "bold 12px Arial";
        saCtx.textAlign = "center";
        saCtx.fillStyle = "white";
        // Score pill
        saCtx.fillStyle = 'rgba(0,0,0,0.6)';
        saCtx.beginPath();
        saCtx.roundRect(p.x - 10, p.y - 30, 20, 14, 5);
        saCtx.fill();
        saCtx.fillStyle = 'white';
        saCtx.fillText(p.score, p.x, p.y - 20);
    }
    
    // Draw Spikes
    if (gameState.phase === 'attack' || gameState.phase === 'hold' || gameState.phase === 'retract') {
        // Draw spikes based on hitboxes logic from server
        // Calculate hitboxes
        const hitboxes = [];
        if (gameState.attackSide === 'left') {
            for (let r = 0; r < 4; r++) {
                let limitX = 400;
                for (const b of blocks) if (b.y === r * 100 && b.x < limitX) limitX = b.x;
                hitboxes.push({ x: 0, y: r * 100, w: limitX, h: 100, side: 'left' });
            }
        } else if (gameState.attackSide === 'right') {
            for (let r = 0; r < 4; r++) {
                let startX = 0;
                for (const b of blocks) if (b.y === r * 100 && (b.x + b.w) > startX) startX = b.x + b.w;
                hitboxes.push({ x: startX, y: r * 100, w: 400 - startX, h: 100, side: 'right' });
            }
        } else if (gameState.attackSide === 'top') {
            for (let c = 0; c < 4; c++) {
                let limitY = 400;
                for (const b of blocks) if (b.x === c * 100 && b.y < limitY) limitY = b.y;
                hitboxes.push({ x: c * 100, y: 0, w: 100, h: limitY, side: 'top' });
            }
        } else if (gameState.attackSide === 'bottom') {
            for (let c = 0; c < 4; c++) {
                let startY = 0;
                for (const b of blocks) if (b.x === c * 100 && (b.y + b.h) > startY) startY = b.y + b.h;
                hitboxes.push({ x: c * 100, y: startY, w: 100, h: 400 - startY, side: 'bottom' });
            }
        }
        
        for (const box of hitboxes) {
            // Depending on phase, animate spike extension
            let extensionRatio = 1.0; // hold phase
            if (gameState.phase === 'attack') {
                extensionRatio = 1.0 - (gameState.phaseTimeLeft / 0.7); 
            } else if (gameState.phase === 'retract') {
                extensionRatio = gameState.phaseTimeLeft / 0.7;
            }
            
            if (extensionRatio < 0) extensionRatio = 0;
            if (extensionRatio > 1) extensionRatio = 1;
            
            let drawBox = { ...box };
            if (box.side === 'left') drawBox.w *= extensionRatio;
            if (box.side === 'right') {
                const fullW = drawBox.w;
                drawBox.w *= extensionRatio;
                drawBox.x += (fullW - drawBox.w); // extend from right
            }
            if (box.side === 'top') drawBox.h *= extensionRatio;
            if (box.side === 'bottom') {
                const fullH = drawBox.h;
                drawBox.h *= extensionRatio;
                drawBox.y += (fullH - drawBox.h); // extend from bottom
            }
            
            // Draw Spike Base Metallic Pillar
            const grad = saCtx.createLinearGradient(drawBox.x, drawBox.y, drawBox.x + (box.side==='top'||box.side==='bottom'?drawBox.w:0), drawBox.y + (box.side==='left'||box.side==='right'?drawBox.h:0));
            grad.addColorStop(0, '#555');
            grad.addColorStop(0.5, '#777');
            grad.addColorStop(1, '#333');
            saCtx.fillStyle = grad;
            saCtx.strokeStyle = '#222';
            saCtx.lineWidth = 2;
            
            saCtx.fillRect(drawBox.x, drawBox.y, drawBox.w, drawBox.h);
            saCtx.strokeRect(drawBox.x, drawBox.y, drawBox.w, drawBox.h);
            
            // Draw 3 sharp metallic spike tips per block
            saCtx.fillStyle = '#e0e0e0';
            saCtx.beginPath();
            const numSpikes = 3;
            const spikeSize = 100 / numSpikes;
            
            if (box.side === 'left') {
                for(let i=0; i<numSpikes; i++) {
                    let sy = drawBox.y + (i * spikeSize);
                    saCtx.moveTo(drawBox.x + drawBox.w, sy + 5);
                    saCtx.lineTo(drawBox.x + drawBox.w + 25, sy + spikeSize/2);
                    saCtx.lineTo(drawBox.x + drawBox.w, sy + spikeSize - 5);
                }
            } else if (box.side === 'right') {
                for(let i=0; i<numSpikes; i++) {
                    let sy = drawBox.y + (i * spikeSize);
                    saCtx.moveTo(drawBox.x, sy + 5);
                    saCtx.lineTo(drawBox.x - 25, sy + spikeSize/2);
                    saCtx.lineTo(drawBox.x, sy + spikeSize - 5);
                }
            } else if (box.side === 'top') {
                for(let i=0; i<numSpikes; i++) {
                    let sx = drawBox.x + (i * spikeSize);
                    saCtx.moveTo(sx + 5, drawBox.y + drawBox.h);
                    saCtx.lineTo(sx + spikeSize/2, drawBox.y + drawBox.h + 25);
                    saCtx.lineTo(sx + spikeSize - 5, drawBox.y + drawBox.h);
                }
            } else if (box.side === 'bottom') {
                for(let i=0; i<numSpikes; i++) {
                    let sx = drawBox.x + (i * spikeSize);
                    saCtx.moveTo(sx + 5, drawBox.y);
                    saCtx.lineTo(sx + spikeSize/2, drawBox.y - 25);
                    saCtx.lineTo(sx + spikeSize - 5, drawBox.y);
                }
            }
            saCtx.fill();
            saCtx.stroke();
        }
    }
}
