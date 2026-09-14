const config = require("./config");
const app = require("./core/app");

app.listen(config.port, config.host, () => {
  console.log(`${config.name} listening on http://${config.host}:${config.port}`);
});
