import config from "./config";
import app from "./core/app";

app.listen(config.port, config.host, () => {
  console.log(`${config.name} listening on http://${config.host}:${config.port}`);
});
