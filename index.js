const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app); // ✅ only ONE server created

const io = new Server(server, {
  cors: {
    origin: "*", // Use your frontend URL in production
    methods: ["GET", "POST"],
  },
});

app.use(cors());

io.on("connection", (socket) => {
  console.log("New socket connected:", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`User joined room: ${roomId}`);
    io.to(roomId).emit("user-count", io.sockets.adapter.rooms.get(roomId)?.size || 1);
  });

  socket.on("message", ({ roomId, message }) => {
    io.to(roomId).emit("message", { message });
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms].filter((r) => r !== socket.id);
    rooms.forEach((roomId) => {
      setTimeout(() => {
        const count = io.sockets.adapter.rooms.get(roomId)?.size || 0;
        io.to(roomId).emit("user-count", count);
      }, 100);
    });
  });
});

const PORT = process.env.PORT || 3001; // ✅ use Render's assigned port
server.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
});
