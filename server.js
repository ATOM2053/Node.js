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
let bannedPlayers = {}; // เก็บเวลาหมดอายุการแบน { [uid]: expireTimestamp }

io.on('connection', (socket) => {
  console.log('ผู้เล่นเชื่อมต่อ:', socket.id);

  socket.on('join_game', (data) => {
    // [ข้อ 2] ตรวจสอบเวลาแบนและส่งเวลานับถอยหลังกลับไปหากยังไม่หมดโทษ
    if (bannedPlayers[data.uid]) {
      if (bannedPlayers[data.uid] > Date.now()) {
        socket.emit('force_logout', { 
          reason: "คุณถูกแบนชั่วคราว", 
          expireTime: bannedPlayers[data.uid] 
        });
        return;
      } else {
        delete bannedPlayers[data.uid]; // พ้นโทษแบนแล้ว
      }
    }

    onlinePlayers[socket.id] = {
      name: data.name,
      credit: data.credit || 1000,
      uid: data.uid || socket.id,
      pets: data.myPets || []
    };
    io.emit('update_players_list', onlinePlayers);
  });

  // [ข้อ 2] ระบบแบนพร้อมกำหนดระยะเวลาและบันทึกเวลาหมดอายุ
  socket.on('admin_ban_user', (data) => {
    let targetKey = data.target.toLowerCase();
    let durationMs = 0;
    
    if (data.duration === '5_minutes') durationMs = 5 * 60 * 1000;
    else if (data.duration === '24_hours') durationMs = 24 * 60 * 60 * 1000;
    else durationMs = 365 * 24 * 60 * 60 * 1000; // ถาวร

    let expireTime = Date.now() + durationMs;

    for (let [id, player] of Object.entries(onlinePlayers)) {
      if (player.uid.toLowerCase() === targetKey || player.name.toLowerCase().includes(targetKey)) {
        bannedPlayers[player.uid] = expireTime;
        io.to(id).emit('force_logout', { 
          reason: `คุณถูกแบนเป็นเวลา ${data.duration}`, 
          expireTime: expireTime 
        });
        const targetSocket = io.sockets.sockets.get(id);
        if (targetSocket) targetSocket.disconnect(true);
        break;
      }
    }
  });

  // [ข้อ 1] ระบบส่งคำเชิญ PvP
  socket.on('send_pvp_invite', (data) => {
    for (let [id, player] of Object.entries(onlinePlayers)) {
      if (player.uid === data.targetUid) {
        io.to(id).emit('receive_pvp_invite', {
          senderUid: data.senderUid,
          senderName: data.senderName,
          senderPets: data.senderPets
        });
        break;
      }
    }
  });

  // [ข้อ 1] เมื่อผู้เล่นกดยอมรับคำเชิญ จะทำการสร้างห้องประลองเฉพาะสำหรับทั้งสองคน
  socket.on('accept_pvp_invite', (data) => {
    let targetSocketId = null;
    for (let [id, player] of Object.entries(onlinePlayers)) {
      if (player.uid === data.targetUid) {
        targetSocketId = id;
        break;
      }
    }
    if (targetSocketId) {
      io.to(socket.id).emit('start_pvp_match', {
        player1: { uid: data.myUid, pets: data.myPets },
        player2: { uid: data.targetUid, pets: onlinePlayers[targetSocketId]?.pets || [] }
      });
      io.to(targetSocketId).emit('start_pvp_match', {
        player1: { uid: data.targetUid, pets: onlinePlayers[targetSocketId]?.pets || [] },
        player2: { uid: data.myUid, pets: data.myPets }
      });
    }
  });

  socket.on('disconnect', () => {
    delete onlinePlayers[socket.id];
    io.emit('update_players_list', onlinePlayers);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
