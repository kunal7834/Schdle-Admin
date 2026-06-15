const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const Event = require('./models/Event');
const Roster = require('./models/Roster');
const MasterMeta = require('./models/MasterMeta');
const Group = require('./models/Group');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const MONGODB_URI = process.env.MONGODB_URI;

let connectionPromise = null;
const connectDB = () => {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  if (!connectionPromise) {
    if (!MONGODB_URI) {
      return Promise.reject(new Error('MONGODB_URI environment variable is not set'));
    }
    connectionPromise = mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
    }).catch((err) => {
      // Reset so the next request can retry instead of reusing a rejected promise forever
      connectionPromise = null;
      throw err;
    });
  }
  return connectionPromise;
};

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err.message);
});

// Health check that doesn't require a DB connection, useful for diagnosing deployment issues
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    mongoConfigured: Boolean(MONGODB_URI),
    mongoConnected: mongoose.connection.readyState === 1,
  });
});

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    res.status(500).json({ error: 'Database connection failed', details: err.message });
  }
});

const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'LSM', 'FIN'];

// ---------------- Events ----------------
app.post('/api/events', async (req, res) => {
  try {
    const events = Array.isArray(req.body) ? req.body
      : Array.isArray(req.body.events) ? req.body.events
      : [req.body];

    const created = await Event.insertMany(events, { ordered: false });
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/events', async (req, res) => {
  try {
    const events = await Event.find({}, { _id: 0 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    const result = await Event.deleteOne({ id: req.params.id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- Rosters ----------------
app.post('/api/rosters', async (req, res) => {
  try {
    const { section, students } = req.body;
    if (!section || !SECTIONS.includes(section)) {
      return res.status(400).json({ error: 'Invalid section' });
    }
    const roster = await Roster.findOneAndUpdate(
      { section },
      { section, students: students || [] },
      { upsert: true, new: true, projection: { _id: 0 } }
    );
    res.json(roster);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/rosters', async (req, res) => {
  try {
    const rosters = await Roster.find({}, { _id: 0 });
    const result = Object.fromEntries(SECTIONS.map(s => [s, []]));
    for (const r of rosters) {
      result[r.section] = r.students;
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- Groups ----------------
app.get('/api/groups', async (req, res) => {
  try {
    const groups = await Group.find({}, { _id: 0 });
    const result = Object.fromEntries(groups.map(g => [g.name, g.members]));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/groups', async (req, res) => {
  try {
    const { name, members } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Group name is required' });
    }
    const group = await Group.findOneAndUpdate(
      { name },
      { name, members: members || [] },
      { upsert: true, new: true, projection: { _id: 0 } }
    );
    res.json(group);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/groups/:name', async (req, res) => {
  try {
    const result = await Group.deleteOne({ name: req.params.name });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- Master Schedule ----------------
app.post('/api/master', async (req, res) => {
  try {
    const { events, meta } = req.body;

    await Event.deleteMany({ source: 'master' });

    if (Array.isArray(events) && events.length > 0) {
      const seen = new Set();
      const deduped = events.filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
      await Event.insertMany(deduped, { ordered: false });
    }

    if (meta) {
      await MasterMeta.findOneAndUpdate(
        { key: 'master' },
        { key: 'master', ...meta },
        { upsert: true }
      );
    } else {
      await MasterMeta.deleteOne({ key: 'master' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/master-meta', async (req, res) => {
  try {
    const meta = await MasterMeta.findOne({ key: 'master' }, { _id: 0, key: 0 });
    res.json(meta || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
