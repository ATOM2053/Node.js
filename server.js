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
let bannedPlayers = {}; // เก็บข้อมูลการแบน { [uid]: { expireTime, reason } }

io.on('connection', (socket) => {
  console.log('ผู้เล่นเชื่อมต่อ:', socket.id);

  socket.on('join_game', (data) => {
    // [ข้อ 2] ตรวจสอบสถานะการแบน พร้อมเวลาหมดอายุและสาเหตุ
    if (bannedPlayers[data.uid]) {
      let banInfo = bannedPlayers[data.uid];
      if (banInfo.expireTime > Date.now()) {
        socket.emit('force_logout', { 
          reason: banInfo.reason, 
          expireTime: banInfo.expireTime 
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

  // [ข้อ 2] ระบบแบนพร้อมบันทึกสาเหตุและเวลานับถอยหลัง
  socket.on('admin_ban_user', (data) => {
    let targetKey = data.target.toLowerCase();
    let durationMs = 0;
    
    if (data.duration === '5_minutes') durationMs = 5 * 60 * 1000;
    else if (data.duration === '24_hours') durationMs = 24 * 60 * 60 * 1000;
    else if (data.duration === '1_year') durationMs = 365 * 24 * 60 * 60 * 1000;
    else durationMs = 100 * 365 * 24 * 60 * 60 * 1000; // ถาวร

    let expireTime = Date.now() + durationMs;
    let banReason = data.reason || "ทำผิดกฎของคาสิโน";

    for (let [id, player] of Object.entries(onlinePlayers)) {
      if (player.uid.toLowerCase() === targetKey || player.name.toLowerCase().includes(targetKey)) {
        bannedPlayers[player.uid] = { expireTime: expireTime, reason: banReason };
        io.to(id).emit('force_logout', { 
          reason: banReason, 
          expireTime: expireTime 
        });
        const targetSocket = io.sockets.sockets.get(id);
        if (targetSocket) targetSocket.disconnect(true);
        break;
      }
    }
  });

  socket.on('admin_unban_user', (data) => {
    let targetKey = data.target.toLowerCase();
    for (let [uid, info] of Object.entries(bannedPlayers)) {
      if (uid.toLowerCase() === targetKey) {
        delete bannedPlayers[uid];
      }
    }
  });

  // [ข้อ 3] ระบบรีเซิร์ฟเวอร์ เตะทุกคนออกจากเซิร์ฟทันทีพร้อมข้อความแจ้งเตือน
  socket.on('admin_restart_server', (data) => {
    io.emit('server_restart_kick', { message: data.message });
    // ปิดการเชื่อมต่อทุก Socket
    for (let [id, socketObj] of io.sockets.sockets) {
      socketObj.disconnect(true);
    }
    onlinePlayers = {};
  });

  // [ข้อ 1] ระบบโอนเงินข้ามอุปกรณ์ระหว่างผู้เล่น (คนละโทรศัพท์)
  socket.on('transfer_money_request', (data) => {
    for (let [id, player] of Object.entries(onlinePlayers)) {
      if (player.uid === data.recipientUid) {
        player.credit += data.amount;
        io.to(id).emit('receive_money_transfer', {
          amount: data.amount,
          senderName: data.senderName
        });
        break;
      }
    }
  });

  // [ข้อ 4] ระบบแจ้งเตือนคำเชิญ PvP ทั่วทุกหน้าจอ
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

  socket.on('accept_pvp_invite', (data) => {
    let targetSocketId = null;
    for (let [id, player] of Object.entries(onlinePlayers)) {
      if (player.uid === data.targetUid) {
        targetSocketId = id;
        break;
      }
    }
    if (targetSocketId) {
      io.to(socket.id).emit('start_pvp_match', {});
      io.to(targetSocketId).emit('start_pvp_match', {});
    }
  });

  // [ข้อ 5] ระบบแชทโลก (Global Chat) กระจายข้อความหาทุกคน
  socket.on('send_global_chat', (data) => {
    io.emit('receive_global_chat', {
      sender: data.sender,
      message: data.message
    });
  });

  socket.on('search_player_request', (keyword) => {
    let foundUser = null;
    let kw = keyword.toLowerCase();
    for (let id in onlinePlayers) {
      let p = onlinePlayers[id];
      if (p.uid.toLowerCase() === kw || p.name.toLowerCase().includes(kw)) {
        foundUser = p;
        break;
      }
    }
    socket.emit('search_player_response', foundUser);
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
