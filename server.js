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
let bannedPlayers = {}; 

io.on('connection', (socket) => {
  console.log('ผู้เล่นเชื่อมต่อ:', socket.id);

  socket.on('join_game', (data) => {
    if (bannedPlayers[data.uid]) {
      let banInfo = bannedPlayers[data.uid];
      if (banInfo.expireTime > Date.now()) {
        socket.emit('force_logout', { 
          reason: banInfo.reason, 
          expireTime: banInfo.expireTime 
        });
        return;
      } else {
        delete bannedPlayers[data.uid];
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

  socket.on('admin_ban_user', (data) => {
    let targetKey = data.target.toLowerCase();
    let durationMs = 0;
    
    if (data.duration === '5_minutes') durationMs = 5 * 60 * 1000;
    else if (data.duration === '24_hours') durationMs = 24 * 60 * 60 * 1000;
    else if (data.duration === '1_year') durationMs = 365 * 24 * 60 * 60 * 1000;
    else durationMs = 100 * 365 * 24 * 60 * 60 * 1000;

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

  socket.on('admin_restart_server', (data) => {
    io.emit('server_restart_kick', { message: data.message });
    for (let [id, socketObj] of io.sockets.sockets) {
      socketObj.disconnect(true);
    }
    onlinePlayers = {};
  });

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

  socket.on('send_pvp_invite', (data) => {
    for (let [id, player] of Object.entries(onlinePlayers)) {
      if (player.uid === data.targetUid) {
        io.to(id).emit('receive_pvp_invite', {
          senderName: data.senderName,
          senderUid: data.senderUid,
          senderPets: data.senderPets
        });
        break;
      }
    }
  });

  socket.on('accept_pvp_invite', (data) => {
    for (let [id, player] of Object.entries(onlinePlayers)) {
      if (player.uid === data.targetUid) {
        io.to(id).emit('start_pvp_match', { opponentUid: data.myUid });
        socket.emit('start_pvp_match', { opponentUid: data.targetUid });
        break;
      }
    }
  });

  socket.on('broadcast_money', (data) => {
    for (let [id, player] of Object.entries(onlinePlayers)) {
      player.credit += data.amount;
    }
    io.emit('receive_broadcast_money', { amount: data.amount });
  });

  socket.on('send_global_chat', (data) => {
    io.emit('receive_global_chat', data);
  });

  socket.on('search_player_request', (keyword) => {
    let kw = keyword.toLowerCase();
    let foundPlayer = null;
    for (let [id, player] of Object.entries(onlinePlayers)) {
      if (player.uid.toLowerCase() === kw || player.name.toLowerCase().includes(kw)) {
        foundPlayer = player;
        break;
      }
    }
    socket.emit('search_player_response', foundPlayer);
  });

  socket.on('disconnect', () => {
    delete onlinePlayers[socket.id];
    io.emit('update_players_list', onlinePlayers);
    console.log('ผู้เล่นตัดการเชื่อมต่อ:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`เซิร์ฟเวอร์คาสิโนออนไลน์กำลังรันอยู่ที่พอร์ต ${PORT}`);
});
