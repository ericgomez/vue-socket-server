const express = require('express');
const { createServer } = require('http');
const { Server } = require("socket.io");
const socketioJwt = require('socketio-jwt');
const cors = require('cors');
require('./connections/mongodb');

// sockets
const Live = require("./sockets/Live");
const Rooms = require("./sockets/Room");

const authRouter = require('./routes/auth');

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/api', authRouter);

io.use(socketioJwt.authorize({
  secret: process.env.SECRET_PRIVATE_KEY,
  handshake: true,
  timeout: 15000
}));

let countSockets = 0;
let roomsUsers = {};
let roomsMessages = {};
let sockets = {};

io.on('connection', async (socket) => {
  console.log("Socket connected!");
  // TOTAL CLIENTS
  countSockets++;

  // USER LOGGED
  const token = socket.decoded_token;

  await Live.join(countSockets, socket, io);

  // SAVE THE USER ID ON SOCKET FOR PRIVATE CHAT
  sockets[token.id] = socket;

  // FETCH ALL ROOMS
  socket.on('rooms/all', async () => {
    await Rooms.loaded(io);
  });

  // CREATE A NEW ROOM
  socket.on('rooms/create', async (data) => {
    data.owner = token.id;
    await Rooms.create(data, io, socket);
  });

  // JOIN TO ROOM
  socket.on('rooms/join', async (room) => {
    token.socketId = socket.id;

    if (!roomsUsers[room]) {
      roomsUsers[room] = [token];
      roomsMessages[room] = [];
    } else {
      roomsUsers[room].push(token);
    }
    // avoid duplicates
    roomsUsers[room] = [...new Map(roomsUsers[room].map(item => [item['username'], item])).values()];
    await Rooms.join(room, token.username, roomsUsers[room], socket, io);
  });

  // LEAVE A ROOM
  socket.on('rooms/leave', async (room) => {
    if (roomsUsers[room]) {
      roomsUsers[room] = roomsUsers[room].filter(u => u.id !== token.id);
    }

    await Rooms.leave(room, token.username, roomsUsers[room], socket, io);
  });

  // SEND A MESSAGE PUBLIC/PRIVATE ROOM
  socket.on('rooms/message', async ({ room, message, privateRoom = false }) => {
    const newMessage = {
      user: token.username,
      message,
      room
    };

    roomsMessages[room].push(`${newMessage.user}: ${newMessage.message}`);

    if (privateRoom) {
      await Rooms.newPrivateMessage(newMessage, io);
    } else {
      await Rooms.newMessage(room, newMessage, io);
    }
  });

  /**
   * CREATE A PRIVATE ROOM
   */
  socket.on('rooms/createPrivateRoom', async (data) => {
    const room = data.roomId;

    if (!roomsUsers[room]) {
      roomsUsers[room] = [token];
      roomsMessages[room] = [];
    } else {
      roomsUsers[room].push(token);
    }

    const to = sockets[data.user.id].id;
    await Rooms.createPrivateRoom(data, token.username, room, to, socket, io);
  });

  /**
   * JOIN TO PRIVATE ROOM
   */
  socket.on('rooms/joinPrivateRoom', async (data) => {
    roomsUsers[data.room].push(token);
    data.usersInRoom = roomsUsers[data.room];

    await Rooms.joinPrivateRoom(data, token.username, socket, io);
  });

  /**
   * LEAVE PRIVATE ROOM
   */
  socket.on('rooms/leavePrivateRoom', async (room) => {
    if (roomsUsers[room]) {
      roomsUsers[room] = roomsUsers[room].filter(u => u.id !== token.id);
    }

    await Rooms.leavePrivateRoom(room, roomsUsers[room], token.username, socket, io);
  });

  /**
   * USER CLOSE SESSION
   */
  socket.on('logout', async (username) => {
    const rooms = io.sockets.sockets[socket.id].rooms;

    for (let room in rooms) {
      if (roomsUsers && roomsUsers[room]) {
        roomsUsers[room] = roomsUsers[room].filter(u => u.id !== token.id);

        await Rooms.leave(room, username, roomsUsers[room], socket, io);
        await Rooms.emitCountUsersInLiveRooms(roomsUsers[room].length, room, io);
      }
    }
  });

  /**
   * SOCKET DISCONNECTED
   */
  socket.on('disconnect', async () => {
    countSockets--;
    socket.broadcast.emit('COUNT_SOCKETS', countSockets);
    console.log("USER DISCONNECTED");
  });
});

// LISTEN SERVER
server.listen(process.env.PORT, () => {
  console.log(`listening on *:${process.env.PORT}`);
});

module.exports = app;
