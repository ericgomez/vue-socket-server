const Room = require('./../models/Room');

const Rooms = {
  /**
   * LOAD ALL ROOMS
   * @param io
   * @returns {Promise<void>}
   */
  loaded: async (io) => {
    await io.in('live').emit('ROOMS_LOADED', { rooms: await Rooms.find() });
  },
  /**
   * FIND ALL ROOMS AND POPULATE WITH OWNER
   * @returns {Promise<any>}
   */
  find: async () => {
    return await Room.find().populate('owner').exec();
  },
  /**
   * CREATE A NEW ROOM
   * @param data
   * @param io
   * @param socket
   * @returns {Promise<void>}
   */
  create: async (data, io, socket) => {
    const newRoom = new Room(data);
    const dbRoom = await newRoom.save().then(model => model.populate('owner').execPopulate());

    await io.in('live').emit('ROOMS_LOADED', { rooms: await Rooms.find() });
    await socket.broadcast.emit('NEW_ROOM_CREATED', { room: dbRoom });
  },
  /**
   * JOIN ON A ROOM
   * @param room
   * @param username
   * @param usersInRoom
   * @param socket
   * @param io
   * @returns {Promise<void>}
   */
  join: async (room, username, usersInRoom, socket, io) => {
    await socket.join(room);
    await socket.to(room).emit('USER_JOINED', {
      message: `El usuario ${username} ha entrado en la sala`
    });
    await io.in(room).emit('USERS_IN_ROOM', usersInRoom);
    await Rooms.emitCountUsersInLiveRooms(usersInRoom.length, room, io);
  },
  /**
   * LEAVES A ROOM
   * @param room
   * @param username
   * @param usersInRoom
   * @param socket
   * @param io
   * @returns {Promise<void>}
   */
  leave: async (room, username, usersInRoom, socket, io) => {
    await socket.leave(room); // Abandonar sala
    await socket.to(room).emit('USER_LEAVE_ROOM', {
      message: `El usuario ${username} ha abandonado la sala`
    });
    await socket.to(room).emit('USERS_IN_ROOM', usersInRoom);

    // EMIT TO LIVE ROOM FOR UPDATE COUNT USERS ON ROOMS LIST
    await Rooms.emitCountUsersInLiveRooms(usersInRoom.length, room, io);
  },
  /**
   * EMIT NEW MESSAGE TO ALL ON ANY ROOM
   * @param room
   * @param message
   * @param io
   * @returns {Promise<void>}
   */
  newMessage: async (room, message, io) => {
    await io.in(room).emit("NEW_MESSAGE", message);
  },
  /**
   * EMIT NEW MESSAGE TO ALL ON PRIVATE ROOMS
   * @param newMessage
   * @param io
   * @returns {Promise<void>}
   */
  newPrivateMessage: async (newMessage, io) => {
    await io.in(newMessage.room).emit("NEW_PRIVATE_MESSAGE", newMessage);
  },
  /**
   * CREATE AND JOIN TO PRIVATE ROOM
   * @param data
   * @param from
   * @param room
   * @param to
   * @param socket
   * @param io
   * @returns {Promise<void>}
   */
  createPrivateRoom: async (data, from, room, to, socket, io) => {
    await socket.leave(data.currentRoom); // Abandonar sala actual
    await socket.join(room); // Unirse a nueva sala
    io.to(to).emit('SEND_INVITATION_TO_PRIVATE_ROOM', {
      message: `Hola ${data.user.username}, el usuario ${from} te invita a charlar en la sala ${data.name}`,
      room,
      data
    });
  },
  /**
   * SOCKET JOIN TO PRIVATE ROOM
   * @param data
   * @param username
   * @param socket
   * @param io
   * @returns {Promise<void>}
   */
  joinPrivateRoom: async (data, username, socket, io) => {
    await Rooms.leaveAllRooms(io, socket, username); // Abandonar todas las salas
    await socket.join(data.room); // Unirse a nueva sala
    await socket.to(data.room).emit('USER_JOINED_TO_PRIVATE_ROOM', `El usuario ${username} se ha unido al chat privado`,);
    await io.in(data.room).emit('START_PRIVATE_ROOM', data);
  },
  /**
   * LEAVES A PRIVATE ROOM
   * @param room
   * @param usersInRoom
   * @param username
   * @param socket
   * @param io
   * @returns {Promise<void>}
   */
  leavePrivateRoom: async (room, usersInRoom, username, socket, io) => {
    await socket.leave(room); // Abandonar sala
    await socket.to(room).emit('USER_LEAVE_ROOM', {
      message: `El usuario ${username} ha abandonado la sala`,
      usersInRoom
    });
    await io.in(room).emit('USER_LEAVE_PRIVATE_ROOM', room);
  },

  /**
   * EMIT TO LIVE ROOM FOR UPDATE COUNT USERS ON ROOMS LIST
   * @param countUsers
   * @param room
   * @param io
   * @returns {Promise<void>}
   */
  emitCountUsersInLiveRooms: async (countUsers, room, io) => {
    await io.in('live').emit('COUNT_USERS_IN_ROOM', { countUsers, room });
  },
  /**
   * SOCKET LEAVE ALL ROOMS
   * @param io
   * @param socket
   * @param username
   * @returns {Promise<void>}
   */
  leaveAllRooms: async (io, socket, username) => {
    const rooms = io.sockets.sockets[socket.id].rooms;
    for (let room in rooms) {
      if (room !== 'live') {
        await socket.leave(room); // Abandonar sala
        await socket.to(room).emit('USER_LEAVE_ROOM', {
          message: `El usuario ${username} ha abandonado la sala`,
        });
      }
    }
  }
};

module.exports = Rooms;
