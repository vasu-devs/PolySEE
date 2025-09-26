const express = require('express');
const router = express.Router();
const User = require('../models/User');

// POST /api/dev/insert
router.post('/insert', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Forbidden in production' });
  }
  const { regNo, password, role } = req.body;
  if (!regNo || !password || !role) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  try {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(password, 10);
    const user = new User({ regNo, password, passwordHash: hash, role });
    await user.save();
    // Fetch user including password and passwordHash
    const userWithPassword = await User.findById(user._id).lean();
    res.json({ success: true, user: userWithPassword });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;