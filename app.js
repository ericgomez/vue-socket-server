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
});

server.listen(process.env.PORT, () => {
  console.log(`listening on *:${process.env.PORT}`);
});

module.exports = app;
