const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const rooms = {};

io.on('connection', (socket) => {
  console.log('มีผู้เล่นเชื่อมต่อ:', socket.id);

  // ผู้เล่นสร้างห้อง
  socket.on('createRoom', (roomCode) => {
    socket.join(roomCode);
    rooms[roomCode] = { host: socket.id, players: [socket.id] };
    socket.emit('roomCreated', roomCode);
  });

  // ผู้เล่นเข้าร่วมห้อง
  socket.on('joinRoom', (roomCode) => {
    if (rooms[roomCode]) {
      socket.join(roomCode);
      rooms[roomCode].players.push(socket.id);
      io.to(roomCode).emit('playerJoined', rooms[roomCode].players.length);
      socket.emit('joinSuccess', roomCode);
    } else {
      socket.emit('errorMsg', 'ไม่พบห้องนี้!');
    }
  });

  // รับส่งข้อมูลการเล่นเกมในห้อง
  socket.on('gameAction', (data) => {
    socket.to(data.roomCode).emit('updateGame', data);
  });

  socket.on('disconnect', () => {
    console.log('ผู้เล่นตัดการเชื่อมต่อ:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

