const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(path.join(__dirname)));

// เก็บรายชื่อผู้เล่นที่ออนไลน์อยู่
let onlinePlayers = {};

io.on('connection', (socket) => {
  console.log('มีผู้เล่นเชื่อมต่อ:', socket.id);

  // เมื่อมีผู้เล่นส่งชื่อเข้ามา
  socket.on('join_game', (data) => {
    onlinePlayers[socket.id] = {
      name: data.name,
      credit: data.credit || 1000,
      uid: data.uid || socket.id
    };
    // ส่งรายชื่ออัปเดตทั้งหมดให้ทุกคนเห็นพร้อมกัน
    io.emit('update_players_list', onlinePlayers);
  });

  // อัปเดตข้อมูลเครดิตเมื่อมีการเล่นหรือเปลี่ยนแปลง
  socket.on('update_user_status', (data) => {
    if (onlinePlayers[socket.id]) {
      onlinePlayers[socket.id].credit = data.credit;
      io.emit('update_players_list', onlinePlayers);
    }
  });

  // รองรับคำสั่งแอดมินสั่งแบนผู้เล่น
  socket.on('admin_ban_user', (data) => {
    for (let [id, player] of Object.entries(onlinePlayers)) {
      if (player.uid === data.targetUid) {
        io.to(id).emit('force_logout', { reason: data.reason });
        const targetSocket = io.sockets.sockets.get(id);
        if (targetSocket) {
          targetSocket.disconnect(true);
        }
        break;
      }
    }
  });

  // เมื่อผู้เล่นหลุดการเชื่อมต่อหรือปิดเว็บ
  socket.on('disconnect', () => {
    console.log('ผู้เล่นออกจากระบบ:', socket.id);
    delete onlinePlayers[socket.id];
    io.emit('update_players_list', onlinePlayers);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
