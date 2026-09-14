module.exports = function authGuard(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "unauthenticated" });
  }
  next();
};
