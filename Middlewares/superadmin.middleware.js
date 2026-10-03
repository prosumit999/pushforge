const jwt = require("jsonwebtoken");

const requireSuperadmin = (req, res, next) => {
  try {
    let token = req.cookies.superadminToken;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ error: "Superadmin authentication required. Token missing." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "supersecretkey_change_me_in_production");

    if (decoded.role !== "superadmin" || decoded.email !== "prosumit999@gmail.com") {
      return res.status(403).json({ error: "Access denied: Superadmin credentials required." });
    }

    req.superadmin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired Superadmin session. Please re-authenticate." });
  }
};

module.exports = {
  requireSuperadmin
};
