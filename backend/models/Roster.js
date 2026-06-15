const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  rollNumber: { type: String, default: '' },
  gender: { type: String, default: '' },
}, { _id: false });

const RosterSchema = new mongoose.Schema({
  section: { type: String, required: true, unique: true },
  students: { type: [StudentSchema], default: [] },
}, { versionKey: false });

module.exports = mongoose.model('Roster', RosterSchema);
