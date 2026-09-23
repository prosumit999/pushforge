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

    const jwtSecret = process.env.JWT_SECRET || "supersecretkey_change_me_in_production";
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired authentication token" });
  }
};

module.exports = authenticate;
