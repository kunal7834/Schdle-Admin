const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  time: { type: String, required: true },
  venue: { type: String, default: '' },
  date: { type: String, required: true },
  sections: { type: [String], default: [] },
  courseCode: { type: String, default: '' },
  source: { type: String, default: 'manual' },
  createdBy: { type: String, default: '' },
  createdAt: { type: String, default: () => new Date().toISOString() },
}, { versionKey: false });

module.exports = mongoose.model('Event', EventSchema);
