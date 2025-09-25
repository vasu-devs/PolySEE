const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// LOGIN - Public endpoint for users and admins
router.post("/login", async (req, res) => {
  try {
    const { regNo, password } = req.body;

    // Validate input
    if (!regNo || !password) {
      return res.status(400).json({
        success: false,
        message: "Registration number and password are required",
      });
    }

    // Find user
    const user = await User.findOne({ regNo: regNo.trim() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        regNo: user.regNo,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          regNo: user.regNo,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// REGISTER - Dev only endpoint to create users/admins
router.post("/register", async (req, res) => {
  try {
    // Check environment - only allow in development
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        success: false,
        message: "Registration is disabled in production",
      });
    }

    const { regNo, password, role = "user" } = req.body;

    // Validate input
    if (!regNo || !password) {
      return res.status(400).json({
        success: false,
        message: "Registration number and password are required",
      });
    }

    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be either 'user' or 'admin'",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ regNo: regNo.trim() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this registration number already exists",
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create new user
    const newUser = new User({
      regNo: regNo.trim(),
      passwordHash,
      role,
    });

    await newUser.save();

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: {
        regNo: newUser.regNo,
        role: newUser.role,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// VERIFY TOKEN - Get current user info
router.get("/me", (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token, JWT_SECRET);

    res.json({
      success: true,
      data: {
        userId: payload.userId,
        regNo: payload.regNo,
        role: payload.role,
        iat: payload.iat,
        exp: payload.exp,
      },
    });
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
});

module.exports = router;
