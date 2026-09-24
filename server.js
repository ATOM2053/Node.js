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

let onlinePlayers = {};

io.on('connection', (socket) => {
  console.log('มีผู้เล่นเชื่อมต่อ:', socket.id);

  socket.on('join_game', (data) => {
    onlinePlayers[socket.id] = {
      name: data.name,
      credit: data.credit || 1000,
      uid: data.uid || socket.id
    };
    io.emit('update_players_list', onlinePlayers);
  });

  socket.on('update_user_status', (data) => {
    if (onlinePlayers[socket.id]) {
      onlinePlayers[socket.id].credit = data.credit;
      io.emit('update_players_list', onlinePlayers);
    }
  });

  // ระบบแอดมินสั่งแบนผู้เล่นใช้งานได้จริง
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

  // ระบบโอนเงินให้ทุกคนที่อยู่ในเซิร์ฟเวอร์
  socket.on('broadcast_money', (data) => {
    io.emit('receive_broadcast_money', { amount: data.amount });
  });

  // ระบบส่งคำเชิญ PvP ไปยังผู้เล่นทุกคนในเซิร์ฟเวอร์ผ่าน UID
  socket.on('send_pvp_invite', (data) => {
    let targetSocketId = null;
    for (let [id, player] of Object.entries(onlinePlayers)) {
      if (player.uid === data.targetUid) {
        targetSocketId = id;
        break;
      }
    }
    if (targetSocketId) {
      io.to(targetSocketId).emit('receive_pvp_invite', {
        senderUid: data.senderUid,
        senderName: data.senderName,
        senderPet: data.senderPet
      });
    }
  });

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
