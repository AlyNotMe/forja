🇫🇷 [Version française](README.fr.md)

# Forja

> An unopinionated Node.js/Express framework, following a "free by default, equipped by choice" philosophy.

Forja is a backend foundation inspired by Express (unopinionated, no imposed stack),
shipped with a Vite-style scaffolding CLI (stack choices at install time) and an
AdonisJS-style ecosystem of in-house addons (ORM, security, i18n, realtime...).

The project grew out of extracting and generalizing the application core of
[NeoChess-Legacy](https://github.com/AlyNotMe/NeoChess-Legacy), where a pattern of auto-loaded registries
(routes/middlewares) and a feature-based architecture had already emerged organically.

## Philosophy

- **Unopinionated like Express**: Forja does not force any view engine, any ORM, or
  any frontend framework. It provides a minimal core with extension points. Unlike
  Next.js or Nuxt.js, there is no fixed default stack.
- **Vite-style scaffolding**: the CLI (`forja new`) asks questions at install time
  (language, view engine, frontend, styling, tests, addons...) and generates only the
  code matching the choices made. Nothing unnecessary gets installed.
- **AdonisJS-style addon ecosystem**: beyond the core, Forja offers official
  pluggable addons (`forja add <addon>`): in-house ORM, security/auth, i18n, realtime
  via socket.io, etc. Each addon is optional and decoupled from the core.

## Core architecture

### Registry-driven (auto-discovery)

The core does not maintain a hand-written central routes file. It scans conventional
folders at startup and automatically registers what it finds — implemented in
`@forjajs/core`'s `registry/` module:

- **`RouteRegistry`** recursively scans `features/**/*.route.js`, requires each file,
  and mounts what it exports (an Express Router) onto the app. Dropping a
  `<feature>.route.js` file under `features/` is enough — nothing to register by
  hand.
- **`MiddlewareRegistry`** scans a separate directory (`shared/middlewares/` by
  convention) for **global** middlewares only — things that must run on every
  request (a logger, config attachment...). Files load in alphabetical order.
  Feature-scoped middlewares (an auth guard, say) are deliberately **not**
  auto-mounted here: they'd apply to 100% of requests, which is almost never what a
  guard should do. Those stay a plain `require()` in whichever route file needs them
  — see `@forjajs/addon-auth`'s `auth.route.js`. A middleware reused by several
  features is still just an import, whether it lives in its original feature folder
  or gets promoted to `shared/middlewares/` for clarity — promotion to the registry
  only happens for middlewares that genuinely belong on every request.
- **`wrapAsync`** — Express 4 doesn't forward a rejected promise from an async
  handler to `next()` automatically; this wraps a handler so it does.

This is a direct generalization of the `routeRegistry`/`middlewareRegistry` pattern
found in the NeoChess-Legacy project this framework grew out of — with one real
correction made along the way: NeoChess's actual registry requires each route to be
listed by hand in a central file (an explicit registration API, not true
auto-discovery). Forja's registries scan the filesystem for real, matching what this
document always described as the intended behavior.

### Feature-based (organized by domain, not by technical type)

Unlike classic MVC (`controllers/`, `models/`, `views/` split at the root, which
quickly becomes a dumping ground on larger projects), Forja organizes code by
**business domain**. Everything related to a feature lives in one place:

```
features/
  chess/
    chess.route.js     → detected by the routeRegistry
    chess.engine.js     → the feature's business logic
  auth/
    auth.route.js
    auth.engine.js
```

The auto-discovery mechanism (registry) and the organization convention
(feature-based) are two independent concerns: the former handles *how things load*,
the latter *where things live*. MVC was dropped as the default convention because,
while simple at first, it quickly scatters a single feature's code across several
distant technical folders.

### Contracts (Dependency Inversion)

The core never depends on a concrete stack choice — only on contracts (interfaces)
that any implementation can fulfill. `@forjajs/core` exposes a `contracts/` module:

- **Hasher** — `hash(plain)` / `verify(plain, hash)`. Fulfilled by bcrypt, argon2, or
  anything else — engines never `require("bcrypt")` directly.
- **Repository** — `findById` / `findOne` / `create` / `update` / `delete`. Fulfilled
  by the in-house ORM, an in-memory store, or a third-party ORM.
- **ViewEngine** — `render(templatePath, locals)`. Fulfilled by EJS, Pug, or
  Handlebars — the core mounts whichever one was picked at `forja new` time behind
  this same shape.
- **Addon** — `name` + `register(app, config)`. Fulfilled by every official or
  third-party addon, so `forja add` and the core's addon loader only ever talk to
  one shape regardless of what the addon does internally.

Engines and features receive concrete implementations through injection — the route
file (or app bootstrap) acts as the composition root, choosing which implementation
to wire in. `contracts.assertImplements(name, impl, methods)` enforces this at boot:
an implementation missing a required method fails loudly immediately, instead of
silently breaking deep inside a request. See `packages/addon-auth/templates/` for a
concrete example: `auth.engine.js` only knows the Hasher and Repository contracts,
never bcrypt or a specific database.

This is the same idea behind SOLID's Dependency Inversion Principle, applied
project-wide: nothing in Forja depends on a stack — the stack fulfills the contract.

### Engines

`service/` is formalized and renamed **Engines**: the framework's central concept for
any isolated business logic (auth, chess, database, socket.io...). An Engine is the
equivalent of AdonisJS "Providers" — a unit of business logic plugged into the core,
with its own lifecycle.

## Stack choices offered by the CLI

The CLI (`forja new`) asks the user about each axis independently:

| Axis | Options |
|---|---|
| Language | JavaScript / TypeScript |
| Server views | EJS / Pug / Handlebars |
| Frontend SPA | React / Vue / Svelte |
| Styling | SCSS, + libraries of choice (Tailwind, etc.) |
| Tests | Vitest / Jest |
| Package manager | Auto-detection (npm / pnpm / yarn / bun) |
| Database | In-house Forja ORM (multi-DB) |
| Realtime | socket.io addon (optional) |
| Security | Auth + sessions/JWT addon (optional) |

A Next.js-style "coupled full-stack" mode is deliberately not offered: Forja always
stays decoupled between the server core and the frontend, whichever frontend is
chosen. Server-rendered views and a SPA frontend are two different rendering
philosophies (server builds the HTML vs. the browser builds the DOM) and are
mutually exclusive — a single "how should pages be served?" prompt picks one of SSR,
CSR, or API-only, so an invalid combination (e.g. Pug + React) can't happen.

### How scaffolding avoids a combinatorial explosion of templates

`forja new` does not ship one full template per stack combination. Instead it has
one `base` template plus a small set of independent, composable **layers** — one per
axis (`lang`, `render`, `css`, `tests`) — copied on top of each other and merged.
Each layer only adds its own files and a `package.fragment.json` with its own
dependencies/scripts, deep-merged into the final `package.json`. Total templates to
maintain scale additively (base + options per axis), never multiplicatively across
combinations. See `packages/cli/templates/` and `packages/cli/src/scaffold.ts`.

## Official addons

Addons follow the same principle as AdonisJS Providers: optional, plugged in via
`forja add <addon>`, decoupled from the core.

- **In-house ORM** — goal: multi-DB compatibility (JSON, SQL, MySQL, and others down
  the line). A major undertaking, developed separately from the core.
- **Security** — authentication, sessions/JWT, hashing, route guards. Wider scope
  planned later (roles/permissions, rate-limiting, CSRF...).
- **Realtime** — socket.io integration as an optional Engine.
- **i18n / Language** — in-house language system (inherited from `langue/` in
  NeoChess-Legacy).
- **Validator** — in-house, schema-based input validation (MVC-style request
  validation), no external dependency. Exposes `validate(data, schema)` and an
  Express `validateBody(schema)` middleware; used by the `auth` preset to validate
  `email`/`password` before they reach the engine.

## Language

Forja itself (`@forjajs/core`, `@forjajs/cli`, every official addon) is written in
**TypeScript**, compiled to JS for npm publishing — the contracts described above are
real TS interfaces, checked at compile time, not just documentation. This is a choice
about the framework's own codebase, independent of the JS/TS choice offered to
end-users for their **generated** project (see the stack table below): templates
copied into a generated project still follow whatever language that project picked.

## CLI

The CLI is built with [oclif](https://oclif.io) rather than developed from scratch.

Planned commands:

- `forja new <project>` — scaffold a new project, asks the stack questions.
- `forja add <addon>` — plugs an official addon into an existing project.
- `forja make:engine <name>` — scaffolds a new feature's minimal set of files,
  matching the architecture chosen at install time:
  - `<name>.route.js` — route skeleton, picked up by the routeRegistry
  - `<name>.engine.js` — empty business logic
  - `<name>.lang.js` — empty i18n keys (if i18n is enabled)
  - `<name>.middleware.js` — empty middleware, picked up by the middlewareRegistry
  - `<name>.test.js` — empty test file (Vitest or Jest, matching the install choice)

  Official presets (`forja add auth`, etc.) build on the same layout but ship
  pre-built logic (e.g. `auth` already wires password hashing, login/register routes
  and a route guard) instead of empty files. `forja add <preset>` copies the
  addon's `templates/` into `features/<preset>/` and merges the addon's own
  dependencies (and its peer dependencies) into the project's `package.json` —
  implemented, working today for `auth`; `orm`/`realtime`/`i18n` warn that they're
  not built yet since those packages have no `templates/` of their own.

### Configuration (`config.js` + `.env`)

Every generated project gets a `config.js`/`config.ts` at its root plus `.env` and
`.env.example` — a direct generalization of NeoChess-Legacy's `config.js`
(env-backed, fail-fast on missing required values via `@forjajs/core`'s
`createConfig`) but with **no fixed shape**: the default fields are `env`
(`NODE_ENV`), `name` (`APP_NAME`), `host` (`HOST`) and `port` (`PORT`), and the
project owns this file — add whatever your project needs (session secret, DB URL...)
without Forja imposing anything beyond those deployment basics. `index.js` reads
`config.port`/`config.host` to bind the server, so changing `.env` is the whole
deploy setup story: no code change needed to point at a different port or bind
address (`HOST=0.0.0.0` for a container, say).

### How a server-side view engine actually gets wired up

Choosing EJS/Pug/Handlebars in `forja new` does more than drop view files: each of
those render layers also contributes a `forja.view.json` at the project root
(`{ engine, isAlreadyImplement, module?, export?, options? }`), and `core/app.js`
has one generic block of logic — used for every SSR engine, never duplicated per
combination — that reads it and configures Express accordingly. This mirrors
NeoChess-Legacy's `config.js`/`configuration.js` `isAlreadyImplement` flag exactly:
EJS and Pug are understood natively by Express once named via
`app.set("view engine", ...)`; Handlebars needs its module's factory registered
explicitly first via `app.engine(...)`. Absent `forja.view.json` (API-only or a SPA
frontend), that whole block is skipped. All paths (`features/`, `shared/`,
`views/`) are resolved from `process.cwd()`, not `__dirname` — required for a TS
project, where `__dirname` points into `dist/` once compiled but those folders are
never compiled, they only ever exist at the project root.

## Project status

The name **Forja** is chosen and reserved (npm + GitHub). Working and tested
end-to-end today:

- `@forjajs/core`: contracts, `RouteRegistry`/`MiddlewareRegistry` auto-discovery,
  `createConfig`, `wrapAsync`.
- `forja new`: composes a runnable project from any lang × render × css × tests
  combination. Verified with real runs, not just file inspection: every render
  option in both JS and TS (EJS/Pug/Handlebars actually render HTML through a real
  Express server; React/Vue/Svelte's decoupled `client/` actually `npm run build`s
  through Vite; API-only serves real JSON), both `tsc`-compiled and `ts-node` dev
  mode for TS (no `__dirname`-vs-`dist/` path bugs), SCSS actually compiles, and
  both Vitest and Jest actually run and pass a real test file with identical
  `describe`/`it`/`expect` global syntax (Vitest's `globals: true` is on
  specifically so it matches Jest's ergonomics, since `forja make:engine` generates
  test files without imports).
- A freshly generated project responds on `/` out of the box — every render option
  ships its own default `features/home/home.route.js` welcome route (JSON for
  API-only, a full branded page for SSR/CSR, matching the official Forja logo and
  palette) — nothing 404s before you've written a single line of code. The app name
  shown is read live from `config.name` (`.env`'s `APP_NAME`, or `VITE_APP_NAME` on
  the client side for CSR). The welcome page also demonstrates a minimal FR/EN
  language switch: for SSR, `/`, `/fr` and `/en` are all real routes (same URL
  convention as NeoChess-Legacy's `/:language?/login`, `/` auto-detecting via
  `Accept-Language`), and CSR uses `navigator.language` client-side — self-contained,
  not wired to `@forjajs/addon-i18n` since that package is still empty; once it
  exists, real features should use it instead. Every copy of this demo carries a
  comment spelling out exactly what to delete and replace once the addon ships.
  No cleanup tooling needed: it's generated code you own, free to edit or delete
  like any other file — same as a Vite starter's placeholder `App.jsx`.
- `forja make:engine <name>`: scaffolds a feature's route/engine/lang/middleware/test
  files.
- `forja add auth`: copies `@forjajs/addon-auth`'s templates into `features/auth/` and
  merges its dependencies into the project's `package.json`.
- `@forjajs/addon-auth` and `@forjajs/addon-validator`: fully working, DIP-based (the
  engine only knows the `Hasher`/`Repository` contracts, never bcrypt or a database).

### Next steps

- [ ] `forja add orm` / `realtime` / `i18n` — those addon packages are still empty,
      `forja add` already warns instead of pretending to work.
- [ ] Design and build the in-house multi-DB ORM.
- [ ] Widen the Security addon beyond auth (roles/permissions, rate-limiting, CSRF).
