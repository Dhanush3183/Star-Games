// Global state
let audioCtx = null;
let isMuted = false;

// Audio context initialization (must be after user interaction in some browsers)
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Generate simple sounds using oscillators
function playSound(type) {
    if (isMuted) return;
    initAudio();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'join') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.setValueAtTime(400, now + 0.1);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'leave') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(300, now + 0.1);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'drop') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    } else if (type === 'explosion') {
        // Noise-like sound using many frequencies
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.3);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'win') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now); // A4
        osc.frequency.setValueAtTime(554.37, now + 0.1); // C#5
        osc.frequency.setValueAtTime(659.25, now + 0.2); // E5
        osc.frequency.setValueAtTime(880, now + 0.3); // A5
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
    }
}

function toggleGlobalMute() {
    isMuted = !isMuted;
    return isMuted;
}

// Nickname Management
function validateAndSaveNickname() {
    const input = document.getElementById('nicknameInput');
    const error = document.getElementById('nicknameError');
    const nickname = input.value.trim();
    
    // Min 2, Max 16, alphanumeric + spaces + underscores
    const regex = /^[a-zA-Z0-9_ ]{2,16}$/;
    
    if (!regex.test(nickname)) {
        error.innerText = 'Nickname must be 2-16 chars (letters, numbers, space, _).';
        return false;
    }
    
    sessionStorage.setItem('nickname', nickname);
    return true;
}

function checkNickname() {
    const nickname = sessionStorage.getItem('nickname');
    if (!nickname) {
        window.location.href = 'index.html';
    }
}

// Particles background
function initParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    
    for (let i = 0; i < 50; i++) {
        createParticle(container);
    }
}

function createParticle(container) {
    const p = document.createElement('div');
    const size = Math.random() * 5 + 2;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.background = 'rgba(255, 255, 255, 0.2)';
    p.style.position = 'absolute';
    p.style.borderRadius = '50%';
    
    // Random position
    p.style.left = `${Math.random() * 100}vw`;
    p.style.top = `${Math.random() * 100}vh`;
    
    // Random animation
    const duration = Math.random() * 10 + 10;
    p.style.animation = `float ${duration}s linear infinite`;
    
    container.appendChild(p);
}

// Global floating animation for particles
const styleSheet = document.createElement("style");
styleSheet.innerText = `
@keyframes float {
    0% { transform: translateY(0) translateX(0); opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { transform: translateY(-100vh) translateX(20px); opacity: 0; }
}
`;
document.head.appendChild(styleSheet);

// Populate nickname input if it exists (for index.html)
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('nicknameInput');
    if (input) {
        const existing = sessionStorage.getItem('nickname');
        if (existing) input.value = existing;
    }
});
