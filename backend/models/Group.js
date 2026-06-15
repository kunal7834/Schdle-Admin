const mongoose = require('mongoose');

const MemberSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  rollNumber: { type: String, default: '' },
}, { _id: false });

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  members: { type: [MemberSchema], default: [] },
}, { versionKey: false });

module.exports = mongoose.model('Group', GroupSchema);
