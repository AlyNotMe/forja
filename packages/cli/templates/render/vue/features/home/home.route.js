const router = require("express").Router();

router.get("/", (req, res) => {
  res.json({
    message: `Welcome to ${req.app.get("config").name} — this is the API server.`,
    client: "run `npm run dev` inside client/ for the Vue dev server",
  });
});

module.exports = router;
