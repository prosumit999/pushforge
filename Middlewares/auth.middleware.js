const jwt = require("jsonwebtoken");

const authenticate = (req, res, next) => {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ error: "Authentication token required" });
    }

    const jwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV !== "production" ? "supersecretkey_change_me_in_production" : null);
    if (!jwtSecret) {
      return res.status(500).json({ error: "Server authentication error: JWT_SECRET environment variable missing" });
    }
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired authentication token" });
  }
};

module.exports = authenticate;
