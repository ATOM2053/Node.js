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
let bannedPlayers = {}; // เก็บข้อมูลแบน { uid: { reason, expireTime } }

// 🔑 กำหนดรหัสผ่านลับสำหรับแอดมิน (สามารถเปลี่ยนเป็นรหัสของคุณเองได้เลย)
const ADMIN_SECRET_KEY = "my_secret_admin_code_999";

// รายการอีเวนต์ 50 แบบบนเซิร์ฟเวอร์
const EVENTS_DATABASE = [
    { id: 1, name: "❄️ พายุหิมะโปรยปราย", theme: { bg: "#0d1b2a", felt: "#1b263b", gold: "#778da9" } },
    { id: 2, name: "🔥 มหกรรมไฟโลกันตร์", theme: { bg: "#2b0a0a", felt: "#3b1212", gold: "#ff4500" } },
    { id: 3, name: "⚡ พายุสายฟ้าคะนอง", theme: { bg: "#1a103c", felt: "#24144e", gold: "#e0aaff" } },
    { id: 4, name: "🌸 ฤดูดอกซากุระบาน", theme: { bg: "#2d1525", felt: "#4a233d", gold: "#ffb5a7" } },
    { id: 5, name: "💰 ฝนเงินฝนทองคำ", theme: { bg: "#1f1a00", felt: "#332c00", gold: "#ffd700" } },
    { id: 6, name: "🌊 คลื่นยักษ์ใสมหาสมุทร", theme: { bg: "#03045e", felt: "#0077b6", gold: "#90e0ef" } },
    { id: 7, name: "🌙 คืนเดือนมืดรัตติกาล", theme: { bg: "#050505", felt: "#111111", gold: "#888888" } },
    { id: 8, name: "☀️ แดดจ้ากลางทะเลทราย", theme: { bg: "#3a2e00", felt: "#5c4600", gold: "#ffb703" } },
    { id: 9, name: "🔮 มิติเวทมนตร์เรืองแสง", theme: { bg: "#240046", felt: "#3c096c", gold: "#e0aaff" } },
    { id: 10, name: "🍀 ฤดูใบไม้ผลิเขียวขจี", theme: { bg: "#0b2514", felt: "#13381e", gold: "#52b788" } },
    { id: 11, name: "💎 ยุคเพชรพลอยระยิบระยับ", theme: { bg: "#102231", felt: "#1b3b5c", gold: "#48cae4" } },
    { id: 12, name: "🎃 เทศกาลฮาโลวีนลึกลับ", theme: { bg: "#291b00", felt: "#422d00", gold: "#f77f00" } },
    { id: 13, name: "🎄 เทศกาลคริสต์มาสสุขสันต์", theme: { bg: "#1b0000", felt: "#2b0000", gold: "#d90429" } },
    { id: 14, name: "🚀 ท่องอวกาศไร้ขอบเขต", theme: { bg: "#000814", felt: "#001d3d", gold: "#ffc300" } },
    { id: 15, name: "👑 งานเลี้ยงราชวงศ์ชั้นสูง", theme: { bg: "#220022", felt: "#380038", gold: "#e0aaff" } },
    { id: 16, name: "🐉 ปลุกพลังมังกรโบราณ", theme: { bg: "#38040e", felt: "#5c0617", gold: "#ff595e" } },
    { id: 17, name: "🦄 ดินแดนยูนิคอร์นแฟนตาซี", theme: { bg: "#2a1a3a", felt: "#4a2a6a", gold: "#ffc6ff" } },
    { id: 18, name: "🦾 ยุคหุ่นยนต์ไซเบอร์พังก์", theme: { bg: "#0b090a", felt: "#161a1d", gold: "#e5383b" } },
    { id: 19, name: "🏝️ เกาะสวรรค์เขตร้อนชื้น", theme: { bg: "#003049", felt: "#005f73", gold: "#94d2bd" } },
    { id: 20, name: "🌋 ภูเขาไฟกำลังปะทุ", theme: { bg: "#3a0000", felt: "#6a040f", gold: "#faa307" } },
    { id: 21, name: "🌌 กาแล็กซีทางช้างเผือก", theme: { bg: "#0b001a", felt: "#1b003a", gold: "#c77dff" } },
    { id: 22, name: "🛡️ สงครามเกราะเหล็ก", theme: { bg: "#1f1f1f", felt: "#2b2b2b", gold: "#adb5bd" } },
    { id: 23, name: "🏮 เทศกาลโคมลอย", theme: { bg: "#260b00", felt: "#4a1500", gold: "#fb8500" } },
    { id: 24, name: "🍫 อาณาจักรช็อกโกแลต", theme: { bg: "#221100", felt: "#3d1f00", gold: "#dda15e" } },
    { id: 25, name: "🌊 คลื่นสึนามิพัดถล่ม", theme: { bg: "#001219", felt: "#005f73", gold: "#00bbd4" } },
    { id: 26, name: "🌪️ พายุทอร์นาโดหมุนวน", theme: { bg: "#1c1c1c", felt: "#333333", gold: "#d3d3d3" } },
    { id: 27, name: "🌈 สายรุ้งหลังฝน", theme: { bg: "#180e2b", felt: "#2c1654", gold: "#ffb703" } },
    { id: 28, name: "🍄 ป่าเห็ดเรืองแสง", theme: { bg: "#0f1c14", felt: "#1b3a28", gold: "#70e000" } },
    { id: 29, name: "🍀 สี่แฉกแห่งโชคลาภ", theme: { bg: "#061a0b", felt: "#0d3b19", gold: "#38b000" } },
    { id: 30, name: "⚡ พลังงานพลาสม่า", theme: { bg: "#0d0221", felt: "#240046", gold: "#ff007f" } },
    { id: 31, name: "🕰️ ยุคนาฬิกาย้อนเวลา", theme: { bg: "#261c14", felt: "#3d2d21", gold: "#d4a373" } },
    { id: 32, name: "🧊 ยุคน้ำแข็งเกาะตัว", theme: { bg: "#001845", felt: "#023e8a", gold: "#ade8f4" } },
    { id: 33, name: "🍯 น้ำผึ้งหวานละมุน", theme: { bg: "#2b1f00", felt: "#4d3800", gold: "#ffb703" } },
    { id: 34, name: "🔮 ลูกแก้วพยากรณ์", theme: { bg: "#1a0b2e", felt: "#301255", gold: "#9d4edd" } },
    { id: 35, name: "🔥 เปลวไฟสีฟ้าคราม", theme: { bg: "#03045e", felt: "#023e8a", gold: "#00b4d8" } },
    { id: 36, name: "🌸 ทุ่งลาเวนเดอร์", theme: { bg: "#1d0f2b", felt: "#3c1e57", gold: "#e0aaff" } },
    { id: 37, name: "⚔️ ลานประลองกลاديเอเตอร์", theme: { bg: "#2b0a0a", felt: "#4a1212", gold: "#d4af37" } },
    { id: 38, name: "🛡️ บาตรคุ้มกันพลังงาน", theme: { bg: "#001f3f", felt: "#003366", gold: "#7fdbff" } },
    { id: 39, name: "🎯 เป้าหมายสมบูรณ์แบบ", theme: { bg: "#1b1b1b", felt: "#2d2d2d", gold: "#ff4d4d" } },
    { id: 40, name: "🌟 ฝนดาวตกประกายแสง", theme: { bg: "#0a001a", felt: "#1a0038", gold: "#ffea00" } },
    { id: 41, name: "🗝️ กุญแจสมบัติลับ", theme: { bg: "#1f170a", felt: "#3d2e14", gold: "#e9c46a" } },
    { id: 42, name: "👑 มงกุฎทองคำแท้", theme: { bg: "#221a00", felt: "#3d2f00", gold: "#ffd700" } },
    { id: 43, name: "🕯️ แสงเทียนยามค่ำคืน", theme: { bg: "#2b1800", felt: "#4d2c00", gold: "#f4a261" } },
    { id: 44, name: "🧨 ประทัดเฉลิมฉลอง", theme: { bg: "#2b0000", felt: "#520000", gold: "#ff0054" } },
    { id: 45, name: "🎈 ปาร์ตี้ลูกโป่งสวรรค์", theme: { bg: "#001a2b", felt: "#00334d", gold: "#00f5d4" } },
    { id: 46, name: "🎠 สวนสนุกมหาสนุก", theme: { bg: "#2b002b", felt: "#520052", gold: "#ff70a6" } },
    { id: 47, name: "🎪 คณะละครสัตว์แฟนตาซี", theme: { bg: "#2b1a00", felt: "#523300", gold: "#ffb703" } },
    { id: 48, name: "⛵ เรือโจรสลัดข้ามภพ", theme: { bg: "#141414", felt: "#222222", gold: "#c68b59" } },
    { id: 49, name: "🏰 ปราสาทเจ้าหญิงนิทรา", theme: { bg: "#2b0a1a", felt: "#521433", gold: "#ffc8dd" } },
    { id: 50, name: "⚡ พลังงานซูเปอร์โนวา", theme: { bg: "#1a001a", felt: "#380038", gold: "#ff00ff" } }
];

let currentGlobalEvent = EVENTS_DATABASE[0];
let eventEndTime = Date.now() + 10 * 60 * 1000; 
let usedEventIds = [];

function rotateGlobalEvent() {
    let availableEvents = EVENTS_DATABASE.filter(e => !usedEventIds.includes(e.id));
    if (availableEvents.length === 0) {
        usedEventIds = [];
        availableEvents = EVENTS_DATABASE;
    }
    let randomIndex = Math.floor(Math.random() * availableEvents.length);
    currentGlobalEvent = availableEvents[randomIndex];
    usedEventIds.push(currentGlobalEvent.id);
    eventEndTime = Date.now() + 10 * 60 * 1000;
}

rotateGlobalEvent();

setInterval(() => {
    rotateGlobalEvent();
}, 60 * 60 * 1000);

setInterval(() => {
    let timeLeft = Math.max(0, Math.floor((eventEndTime - Date.now()) / 1000));
    if (timeLeft <= 0) {
        rotateGlobalEvent();
        timeLeft = 600;
    }
    io.emit('sync_event', { event: currentGlobalEvent, timeLeft: timeLeft });
}, 1000);

io.on('connection', (socket) => {
  console.log('ผู้เล่นเชื่อมต่อ:', socket.id);

  let initialTimeLeft = Math.max(0, Math.floor((eventEndTime - Date.now()) / 1000));
  socket.emit('sync_event', { event: currentGlobalEvent, timeLeft: initialTimeLeft });

  // 1. เข้าร่วมเกมและเช็คแบน
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
      socketId: socket.id,
      name: data.name,
      credit: data.credit || 1000,
      token: data.token || 100,
      uid: data.uid || socket.id,
      pets: data.myPets || []
    };
    io.emit('update_players_list', onlinePlayers);
  });

  // ซิงค์ข้อมูลผู้เล่น (localStorage)
  socket.on('update_player_data', (data) => {
    if (onlinePlayers[socket.id]) {
      onlinePlayers[socket.id].credit = data.credit;
      onlinePlayers[socket.id].token = data.token;
      onlinePlayers[socket.id].pets = data.pets;
      io.emit('update_players_list', onlinePlayers);
    }
  });

  // 2. ระบบโอนเงินข้ามผู้เล่นผ่าน Socket.io
  socket.on('transfer_money', (data) => {
    let sender = onlinePlayers[socket.id];
    let targetSocketId = data.targetSocketId;
    let amount = parseInt(data.amount);

    if (sender && onlinePlayers[targetSocketId] && amount > 0) {
      if (sender.credit >= amount) {
        sender.credit -= amount;
        onlinePlayers[targetSocketId].credit += amount;

        io.to(targetSocketId).emit('receive_transfer', { from: sender.name, amount: amount, newBalance: onlinePlayers[targetSocketId].credit });
        socket.emit('transfer_success', { to: onlinePlayers[targetSocketId].name, amount: amount, newBalance: sender.credit });
        io.emit('update_players_list', onlinePlayers);
      } else {
        socket.emit('alert_message', { message: "❌ เครดิตของคุณไม่พอโอน!" });
      }
    }
  });

  // 3. ระบบแชทส่วนกลาง
  socket.on('send_global_chat', (data) => {
    io.emit('receive_global_chat', data);
  });

  // 4. ระบบท้า PvP (ส่งป๊อปอัปเด่นชัด)
  socket.on('send_pvp_invite', (data) => {
    let targetSocketId = data.targetSocketId;
    if (onlinePlayers[socket.id] && onlinePlayers[targetSocketId]) {
      io.to(targetSocketId).emit('receive_pvp_invite', {
        fromSocketId: socket.id,
        fromName: onlinePlayers[socket.id].name
      });
    }
  });

  socket.on('accept_pvp_invite', (data) => {
    io.to(data.fromSocketId).emit('pvp_accepted', { opponentName: onlinePlayers[socket.id]?.name });
  });

  // ================= ADMIN PANEL COMMANDS (SECURED) ================= //

  // แบนผู้เล่น (เด้งออกทันที พร้อมเหตุผล)
  socket.on('admin_ban_player', (data) => {
    if (data.adminKey !== ADMIN_SECRET_KEY) {
      socket.emit('alert_message', { message: "❌ รหัสแอดมินไม่ถูกต้อง!" });
      return;
    }

    let targetId = data.targetUid;
    let durationMinutes = parseInt(data.duration) || 60;
    let expireTime = Date.now() + (durationMinutes * 60 * 1000);

    bannedPlayers[targetId] = {
      reason: data.reason || "ทำผิดกฎระเบียบเซิร์ฟเวอร์",
      expireTime: expireTime
    };

    for (let sId in onlinePlayers) {
      if (onlinePlayers[sId].uid === targetId) {
        io.to(sId).emit('force_logout', { 
          reason: bannedPlayers[targetId].reason, 
          expireTime: expireTime 
        });
        io.sockets.sockets.get(sId)?.disconnect(true);
        break;
      }
    }
    io.emit('update_players_list', onlinePlayers);
  });

  // ปลดแบนผู้เล่น
  socket.on('admin_unban_player', (data) => {
    if (data.adminKey !== ADMIN_SECRET_KEY) return;
    delete bannedPlayers[data.targetUid];
  });

  // เสกเงิน / แจกโทเคน
  socket.on('admin_give_assets', (data) => {
    if (data.adminKey !== ADMIN_SECRET_KEY) return;
    let targetSocketId = data.targetSocketId;
    if (onlinePlayers[targetSocketId]) {
      if (data.type === 'credit') {
        onlinePlayers[targetSocketId].credit += parseInt(data.amount);
      } else if (data.type === 'token') {
        onlinePlayers[targetSocketId].token += parseInt(data.amount);
      }
      io.to(targetSocketId).emit('admin_reward_noti', { type: data.type, amount: data.amount });
      io.emit('update_players_list', onlinePlayers);
    }
  });

  // เสกสัตว์เลี้ยง
  socket.on('admin_give_pet', (data) => {
    if (data.adminKey !== ADMIN_SECRET_KEY) return;
    let targetSocketId = data.targetSocketId;
    if (onlinePlayers[targetSocketId]) {
      let newPet = { id: Date.now(), name: data.petName, power: parseInt(data.petPower) || 500, main: false, sub: false };
      onlinePlayers[targetSocketId].pets.push(newPet);
      io.to(targetSocketId).emit('pet_received', newPet);
      io.emit('update_players_list', onlinePlayers);
    }
  });

  // รีเซิร์ฟเวอร์ (แจ้งเตือนเด้งออกทุกคน)
  socket.on('admin_restart_server', (data) => {
    if (data.adminKey !== ADMIN_SECRET_KEY) return;
    io.emit('server_restarting', { message: data.message || "⚠️ เซิร์ฟเวอร์กำลังรีสตาร์ทเพื่ออัปเดตระบบ!" });
    setTimeout(() => {
      process.exit(0);
    }, 3000);
  });

  // แจกเงินทุกคนในเซิร์ฟเวอร์ (Airdrop)
  socket.on('admin_airdrop_money', (data) => {
    if (data.adminKey !== ADMIN_SECRET_KEY) return;
    let amount = parseInt(data.amount) || 1000;
    for (let sId in onlinePlayers) {
      onlinePlayers[sId].credit += amount;
      io.to(sId).emit('airdrop_received', { amount: amount });
    }
    io.emit('update_players_list', onlinePlayers);
  });

  // ================================================================= //

  socket.on('disconnect', () => {
    delete onlinePlayers[socket.id];
    io.emit('update_players_list', onlinePlayers);
  });
});

server.listen(3000, () => {
  console.log('🚀 Server is running smoothly on port 3000 (Online Multiplayer Ready)');
});
