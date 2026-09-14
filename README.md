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
folders at startup and automatically registers what it finds:

- `routeRegistry` detects route files and registers them via `routerHandler`.
- `middlewareRegistry` detects middlewares and registers them via `middlewareHandler`.

Adding a route or middleware means dropping a file in the right place — the core
handles the rest. No manual wiring boilerplate.

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
that any implementation can fulfill. `@forja/core` exposes a `contracts/` module:

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
chosen.

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

Forja itself (`@forja/core`, `@forja/cli`, every official addon) is written in
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

  Official presets (`forja add engine auth`, etc.) build on the same layout but ship
  pre-built logic (e.g. `auth` already wires password hashing, login/register routes
  and a route guard) instead of empty files.

## Project status

The name **Forja** is chosen and reserved (npm + GitHub). The project is currently in
the architecture definition phase — the core has not yet been extracted from
NeoChess-Legacy, and the CLI has not yet been initialized.

### Next steps

- [ ] Initialize the oclif CLI (`forja new`, `forja add`)
- [ ] Extract the core (registries + handlers) from NeoChess-Legacy into a reusable
      package
- [ ] Define the structure of the in-house multi-DB ORM
- [ ] Define the structure of the Security addon (Auth + JWT)
