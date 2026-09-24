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

// เก็บข้อมูลผู้เล่นทั้งหมดที่เชื่อมต่อในเซิร์ฟเวอร์
let onlinePlayers = {};

io.on('connection', (socket) => {
  console.log('มีผู้เล่นเชื่อมต่อ:', socket.id);

  // เมื่อผู้เล่นล็อกอินหรือเข้าเกม
  socket.on('join_game', (data) => {
    onlinePlayers[socket.id] = {
      name: data.name,
      credit: data.credit || 1000,
      debt: data.debt || 0,
      tokens: data.tokens || 10,
      uid: data.uid || socket.id,
      avatar: data.avatar || ""
    };
    io.emit('update_players_list', onlinePlayers);
  });

  // อัปเดตสถานะเครดิต/โปรไฟล์
  socket.on('update_user_status', (data) => {
    if (onlinePlayers[socket.id]) {
      if (data.credit !== undefined) onlinePlayers[socket.id].credit = data.credit;
      if (data.avatar !== undefined) onlinePlayers[socket.id].avatar = data.avatar;
      if (data.name !== undefined) onlinePlayers[socket.id].name = data.name;
      io.emit('update_players_list', onlinePlayers);
    }
  });

  // ระบบค้นหาเพื่อนจากเซิร์ฟเวอร์กลาง
  socket.on('search_player_request', (keyword) => {
    let foundPlayer = null;
    let lowerKey = keyword.toLowerCase();

    for (let id in onlinePlayers) {
      let p = onlinePlayers[id];
      if (p.uid.toLowerCase() === lowerKey || p.name.toLowerCase().includes(lowerKey)) {
        foundPlayer = p;
        break;
      }
    }

    // ส่งผลลัพธ์กลับไปให้คนที่ค้นหา
    socket.emit('search_player_response', foundPlayer);
  });

  // ระบบแอดมินสั่งแบนผู้เล่น
  socket.on('admin_ban_user', (data) => {
    for (let [id, player] of Object.entries(onlinePlayers)) {
      if (player.uid === data.targetUid) {
        io.to(id).emit('force_logout', { reason: data.reason });
        const targetSocket = io.sockets.sockets.get(id);
        if (targetSocket) targetSocket.disconnect(true);
        break;
      }
    }
  });

  // ระบบโอนเงินให้ทุกคนในเซิร์ฟเวอร์
  socket.on('broadcast_money', (data) => {
    io.emit('receive_broadcast_money', { amount: data.amount });
  });

  // ระบบส่งคำเชิญ PvP
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
