const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');

const Schema = mongoose.Schema;

const RoomSchema = new Schema({
  name: { type: String, required: true, index: { unique: true } },
  description: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Validation of room no repeated
RoomSchema.plugin(uniqueValidator, { message: '{PATH} already exists!' });

module.exports = mongoose.model('Room', RoomSchema);