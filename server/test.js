const io = require('socket.io-client');
const socket1 = io('http://localhost:3000');
const socket2 = io('http://localhost:3000');

socket1.on('connect', () => {
    socket1.emit('createRoom', { nickname: 'test1', maxPlayers: 2, selectedGame: 'ticTacToe' }, (res) => {
        const code = res.room.code;
        socket2.on('connect', () => {
            socket2.emit('joinRoom', { nickname: 'test2', code }, (res2) => {
                socket1.emit('startGame');
                setTimeout(() => {
                    socket1.disconnect();
                }, 1000);
            });
        });
    });
});
