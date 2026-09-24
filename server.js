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
      debt: data.debt || 0,
      tokens: data.tokens || 10,
      uid: data.uid || socket.id,
      avatar: data.avatar || "",
      myPets: data.myPets || []
    };
    io.emit('update_players_list', onlinePlayers);
  });

  socket.on('update_user_status', (data) => {
    if (onlinePlayers[socket.id]) {
      if (data.credit !== undefined) onlinePlayers[socket.id].credit = data.credit;
      if (data.avatar !== undefined) onlinePlayers[socket.id].avatar = data.avatar;
      if (data.name !== undefined) onlinePlayers[socket.id].name = data.name;
      if (data.tokens !== undefined) onlinePlayers[socket.id].tokens = data.tokens;
      if (data.myPets !== undefined) onlinePlayers[socket.id].myPets = data.myPets;
      io.emit('update_players_list', onlinePlayers);
    }
  });

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
    socket.emit('search_player_response', foundPlayer);
  });

  // [ข้อ 1] ระบบแอดมินแบนผู้เล่น (รองรับทั้ง UID, ชื่อ หรือรหัสโทรศัพท์ไอดี)
  socket.on('admin_ban_user', (data) => {
    let targetKey = data.target.toLowerCase();
    for (let [id, player] of Object.entries(onlinePlayers)) {
      if (player.uid.toLowerCase() === targetKey || player.name.toLowerCase().includes(targetKey)) {
        io.to(id).emit('force_logout', { reason: data.reason });
        const targetSocket = io.sockets.sockets.get(id);
        if (targetSocket) targetSocket.disconnect(true);
        break;
      }
    }
  });

  // [ข้อ 1] แอดมินเสกเงินให้ผู้เล่นตาม UID หรือชื่อ
  socket.on('admin_give_money', (data) => {
    let targetKey = data.target.toLowerCase();
    for (let [id, player] of Object.entries(onlinePlayers)) {
      if (player.uid.toLowerCase() === targetKey || player.name.toLowerCase().includes(targetKey)) {
        player.credit += data.amount;
        io.to(id).emit('receive_broadcast_money', { amount: data.amount });
        break;
      }
    }
    io.emit('update_players_list', onlinePlayers);
  });

  // [ข้อ 1] แอดมินแจกโทเคน
  socket.on('admin_give_token', (data) => {
    let targetKey = data.target.toLowerCase();
    for (let [id, player] of Object.entries(onlinePlayers)) {
      if (player.uid.toLowerCase() === targetKey || player.name.toLowerCase().includes(targetKey)) {
        player.tokens = (player.tokens || 0) + data.amount;
        break;
      }
    }
  });

  // [ข้อ 1] แอดมินแจกสัตว์เลี้ยง
  socket.on('admin_give_pet', (data) => {
    let targetKey = data.target.toLowerCase();
    for (let [id, player] of Object.entries(onlinePlayers)) {
      if (player.uid.toLowerCase() === targetKey || player.name.toLowerCase().includes(targetKey)) {
        if (!player.myPets) player.myPets = [];
        player.myPets.push(data.pet);
        break;
      }
    }
  });

  // [ข้อ 1] แอดมินยกเซิร์ฟเวอร์ (เตะทุกคนออก)
  socket.on('admin_kick_server', () => {
    io.emit('force_logout', { reason: "แอดมินทำการรีเซ็ต/ยกเซิร์ฟเวอร์" });
    for (let [id, socketObj] of io.sockets.sockets) {
      socketObj.disconnect(true);
    }
  });

  socket.on('broadcast_money', (data) => {
    io.emit('receive_broadcast_money', { amount: data.amount });
  });

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
