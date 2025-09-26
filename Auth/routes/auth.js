const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

// Health check route
router.get("/health", (req, res) => {
  res.json({
    status: "Auth service is running",
    timestamp: new Date().toISOString(),
  });
});

// REGISTER: expects { regNo, password, role }
router.post("/register", async (req, res) => {
  const { regNo, password, role } = req.body;

  // Validate required fields
  if (!regNo || !password || !role) {
    return res
      .status(400)
      .json({ error: "Missing required fields: regNo, password, role" });
  }

  // Validate role
  if (!["user", "admin"].includes(role)) {
    return res.status(400).json({ error: "Role must be 'user' or 'admin'" });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ regNo });
    if (existingUser) {
      return res
        .status(409)
        .json({ error: "User with this registration number already exists" });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create new user
    const newUser = new User({
      regNo,
      passwordHash,
      role,
    });

    await newUser.save();

    res.status(201).json({
      message: "User registered successfully",
      regNo: newUser.regNo,
      role: newUser.role,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

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
