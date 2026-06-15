const mongoose = require('mongoose');

const MasterMetaSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'master' },
  uploadedAt: { type: String, default: '' },
  fileName: { type: String, default: '' },
  classCount: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 },
}, { versionKey: false });

module.exports = mongoose.model('MasterMeta', MasterMetaSchema);
