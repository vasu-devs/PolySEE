const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

// LOGIN: expects { regNo, password }
router.post("/login", async (req, res) => {
  const { regNo, password } = req.body;
  if (!regNo || !password)
    return res.status(400).json({ error: "missing fields" });

  const user = await User.findOne({ regNo });
  if (!user) return res.status(401).json({ error: "invalid credentials" });

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(401).json({ error: "invalid credentials" });

  const token = jwt.sign({ regNo: user.regNo, role: user.role }, JWT_SECRET, {
    expiresIn: "24h",
  });
  return res.json({ token, regNo: user.regNo, role: user.role });
});

// VERIFY token: return payload
router.get("/me", (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).end();
  const token = auth.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    res.json(payload);
  } catch (e) {
    res.status(401).end();
  }
});

module.exports = router;
