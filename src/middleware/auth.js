const { verifyIdToken } = require("../firebase");

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized - No token" });
  }
  const token = authHeader.substring(7);
  const decoded = await verifyIdToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Unauthorized - Invalid token" });
  }
  req.user = { uid: decoded.uid, email: decoded.email };
  next();
}

module.exports = { authMiddleware };
