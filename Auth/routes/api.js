const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/User");

// =============================================================================
// CHATBOT ROUTES - Accessible by both users and admins
// =============================================================================

// Chat endpoint - Forward to AI service (users and admins can access)
router.post("/chat", auth(["user", "admin"]), async (req, res) => {
  try {
    const { message } = req.body;
    const { regNo, role } = req.user;

    if (!message || message.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    // TODO: Forward to actual AI service (FastAPI)
    // For now, return a mock response
    const mockResponse = {
      response: `Hello ${role} ${regNo}! You asked: "${message}". This is a mock response from the chatbot.`,
      timestamp: new Date().toISOString(),
      user: regNo,
      role: role,
    };

    res.json({
      success: true,
      data: mockResponse,
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process chat message",
    });
  }
});

// Get chat history (both users and admins can access their own data)
router.get("/chat/history", auth(["user", "admin"]), async (req, res) => {
  try {
    const { regNo } = req.user;

    // TODO: Implement chat history retrieval from database
    // For now, return mock data
    const mockHistory = [
      {
        message: "What are the library hours?",
        response: "Library is open from 8 AM to 10 PM",
        timestamp: "2024-09-26T10:00:00Z",
      },
      {
        message: "How to apply for scholarships?",
        response: "You can apply for scholarships through the student portal",
        timestamp: "2024-09-26T09:30:00Z",
      },
    ];

    res.json({
      success: true,
      data: {
        regNo,
        chatHistory: mockHistory,
      },
    });
  } catch (error) {
    console.error("Chat history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve chat history",
    });
  }
});

// =============================================================================
// DASHBOARD ROUTES - Admin only access
// =============================================================================

// Get all users (Admin only)
router.get("/admin/users", auth(["admin"]), async (req, res) => {
  try {
    const users = await User.find({}, { passwordHash: 0 }).sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      data: {
        totalUsers: users.length,
        users: users,
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve users",
    });
  }
});

// Get dashboard analytics (Admin only)
router.get("/admin/analytics", auth(["admin"]), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: "user" });
    const totalAdmins = await User.countDocuments({ role: "admin" });

    // TODO: Add real analytics data (chat counts, active users, etc.)
    const mockAnalytics = {
      totalUsers,
      totalAdmins,
      totalChats: 150,
      activeUsersToday: 25,
      topQueries: [
        { query: "Library hours", count: 45 },
        { query: "Admission requirements", count: 32 },
        { query: "Fee structure", count: 28 },
      ],
    };

    res.json({
      success: true,
      data: mockAnalytics,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve analytics",
    });
  }
});

// Delete user (Admin only)
router.delete("/admin/users/:regNo", auth(["admin"]), async (req, res) => {
  try {
    const { regNo } = req.params;
    const adminRegNo = req.user.regNo;

    // Prevent admin from deleting themselves
    if (regNo === adminRegNo) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete your own account",
      });
    }

    const deletedUser = await User.findOneAndDelete({ regNo });

    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User deleted successfully",
      data: {
        deletedUser: {
          regNo: deletedUser.regNo,
          role: deletedUser.role,
        },
      },
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
    });
  }
});

// =============================================================================
// USER PROFILE ROUTES - Both users and admins can access their own profile
// =============================================================================

// Get current user profile
router.get("/profile", auth(["user", "admin"]), async (req, res) => {
  try {
    const { regNo } = req.user;

    const user = await User.findOne({ regNo }, { passwordHash: 0 });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve profile",
    });
  }
});

module.exports = router;
