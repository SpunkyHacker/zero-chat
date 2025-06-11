const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://zero-chat-frontend-lc4mncvgi-spunkyhackers-projects.vercel.app/", // ✅ Change to your frontend domain
    methods: ["GET", "POST"]
  }
});

app.use(cors());

app.get("/", (req, res) => {
  res.send("✅ Zero-Chat backend is live!");
});

// --- In-memory message cache and rate-limiting ---
const messageCache = {};
const rateLimitMap = {};

const RATE_LIMIT = 3; // messages
const TIME_WINDOW = 1000; // ms

function isRateLimited(ip) {
  const now = Date.now();
  if (!rateLimitMap[ip]) {
    rateLimitMap[ip] = [];
  }
  rateLimitMap[ip] = rateLimitMap[ip].filter(t => now - t < TIME_WINDOW);
  if (rateLimitMap[ip].length >= RATE_LIMIT) {
    return true;
  }
  rateLimitMap[ip].push(now);
  return false;
}

// --- Socket.IO logic ---
io.on("connection", (socket) => {
  const ip = socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;
  console.log("✅ New socket connected:", socket.id, "from", ip);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    const count = io.sockets.adapter.rooms.get(roomId)?.size || 1;
    io.to(roomId).emit("user-count", count);
    console.log(`🟢 User joined room: ${roomId} | Users: ${count}`);
  });

  socket.on("leave-room", (roomId) => {
    socket.leave(roomId);
    const count = io.sockets.adapter.rooms.get(roomId)?.size || 0;
    io.to(roomId).emit("user-count", count);
    console.log(`🔴 User left room: ${roomId} | Users: ${count}`);
  });

  socket.on("send-message", ({ roomId, message }) => {
    if (isRateLimited(ip)) {
      console.log("⚠️ Rate limit hit from:", ip);
      return;
    }
    io.to(roomId).emit("receive-message", message);
    console.log(`💬 Message in ${roomId}: ${message.text}`);
  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        const count = (io.sockets.adapter.rooms.get(roomId)?.size || 1) - 1;
        io.to(roomId).emit("user-count", count);
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

// --- Start the server ---
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Socket.io server running on port ${PORT}`);
});
