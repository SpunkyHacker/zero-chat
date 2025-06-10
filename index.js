const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all for dev. Tighten this in production.
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// In-memory data stores
const roomUsers = {};
const rateLimit = new Map();

io.on("connection", (socket) => {
  const ip = socket.handshake.address;
  console.log("New socket connected:", socket.id, ip);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;

    if (!roomUsers[roomId]) roomUsers[roomId] = new Set();
    roomUsers[roomId].add(socket.id);

    console.log(`✅ ${socket.id} joined ${roomId}`);
    io.to(roomId).emit("user-count", roomUsers[roomId].size);
  });

  socket.on("message", ({ roomId, text }) => {
    const now = Date.now();
    const limit = rateLimit.get(ip) || { last: 0, count: 0 };

    if (now - limit.last < 1000) {
      limit.count += 1;
    } else {
      limit.count = 1;
      limit.last = now;
    }

    rateLimit.set(ip, limit);

    if (limit.count > 3) {
      console.log(`⚠️ Spam detected from ${ip}. Disconnecting.`);
      socket.emit("warning", "You're sending messages too fast. Slow down!");
      socket.disconnect();
      return;
    }

    io.to(roomId).emit("message", { text });
  });

  socket.on("disconnect", () => {
    const roomId = socket.roomId;
    if (roomId && roomUsers[roomId]) {
      roomUsers[roomId].delete(socket.id);
      if (roomUsers[roomId].size === 0) {
        delete roomUsers[roomId];
        console.log(`💥 Room ${roomId} deleted`);
      } else {
        io.to(roomId).emit("user-count", roomUsers[roomId].size);
      }
    }

    console.log(`❌ ${socket.id} disconnected`);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Socket.io server running on http://localhost:${PORT}`);
});
