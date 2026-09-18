const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { 
    origin: "*", 
    methods: ["GET", "POST"] 
  }
});

// กำหนดให้เซิร์ฟเวอร์เปิดไฟล์หน้าเว็บ (HTML) ที่อยู่ในโฟลเดอร์เดียวกัน
app.use(express.static(path.join(__dirname)));

// เก็บข้อมูลห้องหรือผู้เล่น (ถ้ามีระบบห้องเกม)
const rooms = {};

io.on('connection', (socket) => {
  console.log('มีผู้เล่นเชื่อมต่อเข้ามาแล้ว:', socket.id);

  // ตัวอย่าง: รับข้อมูลเมื่อผู้เล่นทำกิจกรรมในเกม
  socket.on('player_action', (data) => {
    // ส่งข้อมูลไปบอกผู้เล่นคนอื่นๆ ในเวลาเดียวกัน
    io.emit('update_game', data);
  });

  socket.on('disconnect', () => {
    console.log('ผู้เล่นออกจากระบบ:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
