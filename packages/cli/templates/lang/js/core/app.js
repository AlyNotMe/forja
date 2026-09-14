const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const { RouteRegistry, MiddlewareRegistry } = require("@forja/core");

// Always resolved from the project root (where the app is started), never from
// __dirname — for a TS project __dirname points into dist/ once compiled, but
// features/, shared/middlewares/ and views/ are never compiled, they only ever
// exist at the project root.
const projectRoot = process.cwd();

const app = express();
app.use(express.json());

// forja.view.json is present only when the chosen render option is a server-side
// view engine (EJS/Pug/Handlebars) — absent for API-only or SPA-frontend projects.
// Same principle as NeoChess-Legacy's config.js `isAlreadyImplement` flag: some
// engines (EJS, Pug) are understood natively by Express once named via
// `app.set("view engine", ...)`; others (Handlebars) need their module's factory
// registered explicitly via `app.engine(...)` first.
const viewConfigPath = path.join(projectRoot, "forja.view.json");
if (fs.existsSync(viewConfigPath)) {
  const view = JSON.parse(fs.readFileSync(viewConfigPath, "utf8"));
  app.set("views", path.join(projectRoot, "views"));

  if (!view.isAlreadyImplement) {
    const mod = require(view.module);
    const factory = view.export ? mod[view.export] : mod;
    app.engine(view.engine, factory(view.options || {}));
  }

  app.set("view engine", view.engine);
}

const middlewareRegistry = new MiddlewareRegistry(app, {
  middlewaresDir: path.join(projectRoot, "shared", "middlewares"),
});
middlewareRegistry.load();

const routeRegistry = new RouteRegistry(app, {
  featuresDir: path.join(projectRoot, "features"),
});
routeRegistry.load();

module.exports = app;
