const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Authentication middleware with role-based access control
const auth = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      // Check for authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          message: "Access denied. No token provided.",
        });
      }

      // Extract token
      const token = authHeader.split(" ")[1];
      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Access denied. Invalid token format.",
        });
      }

      // Verify token
      const payload = jwt.verify(token, JWT_SECRET);

      // Check if user role is allowed
      if (allowedRoles.length > 0 && !allowedRoles.includes(payload.role)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required role: ${allowedRoles.join(" or ")}`,
        });
      }

      // Attach user info to request
      req.user = {
        userId: payload.userId,
        regNo: payload.regNo,
        role: payload.role,
      };

      next();
    } catch (error) {
      console.error("Auth middleware error:", error);

      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          message: "Access denied. Invalid token.",
        });
      }

      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Access denied. Token expired.",
        });
      }

      return res.status(401).json({
        success: false,
        message: "Access denied. Token verification failed.",
      });
    }
  };
};

module.exports = auth;
