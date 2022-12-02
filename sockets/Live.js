const Live = {
  join: async (count, socket, io) => {
    // socketsJoin makes the matching Socket instances join the specified rooms
    socket.join('live'); // join the room 'live'

    // emit to all clients in 'live'
    io.in('live').emit('COUNT_SOCKETS', count);
  }
};

module.exports = Live;
