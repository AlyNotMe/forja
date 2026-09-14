const router = require("express").Router();
const config = require("../../config");

router.get("/", (req, res) => {
  res.json({
    message: `Welcome to ${config.name} — this is the API server.`,
    client: "run `npm run dev` inside client/ for the Vue dev server",
  });
});

module.exports = router;
