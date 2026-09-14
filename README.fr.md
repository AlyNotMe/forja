🇬🇧 [English version](README.md)

# Forja

> Un framework Node.js/Express non-figé, à la philosophie "libre par défaut, équipé par choix".

Forja est un socle backend inspiré d'Express (non-opinionated, pas de stack imposée),
livré avec un CLI de scaffolding façon Vite (choix de la stack à l'installation) et
un écosystème d'addons maison façon AdonisJS (ORM, sécurité, i18n, temps réel...).

Le projet est né de l'extraction et de la généralisation du noyau applicatif de
[NeoChess-Legacy](https://github.com/AlyNotMe/NeoChess-Legacy), où un pattern de registries auto-chargés
(routes/middlewares) et une architecture feature-based avaient déjà émergé de manière
organique.

## Philosophie

- **Non-opinionated comme Express** : Forja ne force aucun moteur de vue, aucun ORM,
  aucun framework frontend. Il fournit un noyau minimal et des points d'extension.
  Contrairement à Next.js ou Nuxt.js, il n'y a pas de stack figée par défaut.
- **Scaffolding façon Vite** : le CLI (`forja new`) pose des questions à l'installation
  (langage, moteur de vue, frontend, styling, tests, addons...) et génère uniquement
  le code correspondant aux choix faits. Rien d'inutile n'est installé.
- **Écosystème d'addons façon AdonisJS** : au-delà du noyau, Forja propose des addons
  officiels greffables (`forja add <addon>`) : ORM maison, sécurité/auth, i18n, temps
  réel via socket.io, etc. Chaque addon est optionnel et découplé du noyau.

## Architecture du noyau

### Registry-driven (auto-discovery)

Le noyau ne maintient pas de fichier de routes centralisé à la main. Il scanne des
dossiers conventionnels au démarrage et enregistre automatiquement ce qu'il y trouve :

- `routeRegistry` détecte les fichiers de route et les enregistre via `routerHandler`.
- `middlewareRegistry` détecte les middlewares et les enregistre via `middlewareHandler`.

Ajouter une route ou un middleware consiste à déposer un fichier au bon endroit — le
noyau se charge du reste. Pas de boilerplate de câblage manuel.

### Feature-based (rangement par domaine, pas par type technique)

Contrairement à un MVC classique (`controllers/`, `models/`, `views/` séparés à la
racine, qui devient vite un fourre-tout sur un gros projet), Forja range le code par
**domaine métier**. Tout ce qui concerne une feature vit au même endroit :

```
features/
  chess/
    chess.route.js     → détecté par le routeRegistry
    chess.engine.js     → logique métier de la feature
  auth/
    auth.route.js
    auth.engine.js
```

Le mécanisme d'auto-discovery (registry) et la convention de rangement (feature-based)
sont deux préoccupations indépendantes : le premier gère le *comment ça se charge*, le
second le *où ça vit*. MVC a été écarté comme convention par défaut car, bien que
simple au départ, il disperse rapidement le code d'une même feature dans plusieurs
dossiers techniques éloignés.

### Contrats (Inversion de dépendance)

Le noyau ne dépend jamais d'un choix de stack concret — seulement de contrats
(interfaces) que n'importe quelle implémentation peut remplir. `@forja/core` expose
un module `contracts/` :

- **Hasher** — `hash(plain)` / `verify(plain, hash)`. Rempli par bcrypt, argon2, ou
  autre — les engines ne font jamais `require("bcrypt")` directement.
- **Repository** — `findById` / `findOne` / `create` / `update` / `delete`. Rempli
  par l'ORM maison, un store en mémoire, ou un ORM tiers.
- **ViewEngine** — `render(templatePath, locals)`. Rempli par EJS, Pug ou
  Handlebars — le noyau monte celui choisi à l'installation (`forja new`) derrière
  cette même forme.
- **Addon** — `name` + `register(app, config)`. Rempli par chaque addon officiel ou
  tiers, si bien que `forja add` et le loader d'addons du noyau ne parlent qu'à une
  seule forme, quel que soit ce que fait l'addon en interne.

Les engines et features reçoivent des implémentations concrètes par injection — le
fichier de route (ou le bootstrap de l'app) sert de point de composition, c'est lui
qui choisit quelle implémentation brancher. `contracts.assertImplements(name, impl,
methods)` fait respecter ça au démarrage : une implémentation à qui il manque une
méthode requise échoue immédiatement et clairement, plutôt que de casser
silencieusement au milieu d'une requête. Voir `packages/addon-auth/templates/` pour
un exemple concret : `auth.engine.js` ne connaît que les contrats Hasher et
Repository, jamais bcrypt ni une base de données précise.

C'est la même idée que le principe d'inversion de dépendance de SOLID, appliquée à
tout le projet : rien dans Forja ne dépend d'une stack — c'est la stack qui remplit
le contrat.

### Engines

`service/` est formalisé et renommé **Engines** : le concept central du framework pour
toute logique métier isolée (auth, chess, database, socket.io...). Une Engine est
l'équivalent des "Providers" chez AdonisJS — une unité de logique métier greffée sur
le noyau, avec son propre cycle de vie.

## Choix de stack proposés par le CLI

Le CLI (`forja new`) interroge l'utilisateur sur chaque axe indépendamment :

| Axe | Options |
|---|---|
| Langage | JavaScript / TypeScript |
| Vues serveur | EJS / Pug / Handlebars |
| Frontend SPA | React / Vue / Svelte |
| Styling | SCSS, + librairies au choix (Tailwind, etc.) |
| Tests | Vitest / Jest |
| Package manager | Détection automatique (npm / pnpm / yarn / bun) |
| Base de données | ORM maison Forja (multi-DB) |
| Temps réel | Addon socket.io (optionnel) |
| Sécurité | Addon Auth + sessions/JWT (optionnel) |

Le mode "full-stack couplé" façon Next.js n'est volontairement pas proposé : Forja
reste toujours découplé entre noyau serveur et frontend, quel que soit le frontend
choisi.

## Addons officiels

Les addons suivent le même principe que les Providers AdonisJS : optionnels, greffés
via `forja add <addon>`, découplés du noyau.

- **ORM maison** — objectif : compatibilité multi-DB (JSON, SQL, MySQL, et autres à
  terme). Chantier majeur, développé séparément du noyau.
- **Sécurité** — authentification, sessions/JWT, hashing, guards de routes. Portée
  élargie prévue plus tard (rôles/permissions, rate-limiting, CSRF...).
- **Temps réel** — intégration socket.io en tant qu'Engine optionnelle.
- **i18n / Langue** — système de langue maison (hérité de `langue/` dans
  NeoChess-Legacy).
- **Validator** — validation d'input maison, basée sur des schémas (façon validation
  de requête MVC), sans dépendance externe. Expose `validate(data, schema)` et un
  middleware Express `validateBody(schema)` ; utilisé par le preset `auth` pour
  valider `email`/`password` avant qu'ils n'atteignent l'engine.

## Langage

Forja lui-même (`@forja/core`, `@forja/cli`, tous les addons officiels) est écrit en
**TypeScript**, compilé en JS pour la publication npm — les contrats décrits
ci-dessus sont de vraies interfaces TS, vérifiées à la compilation, pas juste de la
documentation. C'est un choix propre au code du framework, indépendant du choix
JS/TS proposé à l'utilisateur final pour son projet **généré** (voir le tableau de
stack ci-dessous) : les templates copiés dans un projet généré suivent toujours le
langage choisi par ce projet.

## CLI

Le CLI est construit avec [oclif](https://oclif.io) plutôt que développé from scratch.

Commandes prévues :

- `forja new <projet>` — scaffold un nouveau projet, pose les questions de stack.
- `forja add <addon>` — greffe un addon officiel sur un projet existant.
- `forja make:engine <name>` — génère le set minimal de fichiers d'une nouvelle
  feature, selon l'architecture choisie à l'installation :
  - `<name>.route.js` — squelette de route, détecté par le routeRegistry
  - `<name>.engine.js` — logique métier vide
  - `<name>.lang.js` — clés de langue vides (si i18n activé)
  - `<name>.middleware.js` — middleware vide, détecté par le middlewareRegistry
  - `<name>.test.js` — fichier de test vide (Vitest ou Jest, selon le choix fait à
    l'installation)

  Les presets officiels (`forja add engine auth`, etc.) reprennent la même
  arborescence mais avec une logique déjà écrite (ex : `auth` câble déjà le hashing
  de mot de passe, les routes login/register et un guard de route) au lieu de
  fichiers vides.

## État du projet

Le nom **Forja** est retenu et réservé (npm + GitHub). Le projet en est à la phase de
définition d'architecture — le code du noyau n'est pas encore extrait de
NeoChess-Legacy, et le CLI n'est pas encore initialisé.

### Prochaines étapes

- [ ] Initialiser le CLI oclif (`forja new`, `forja add`)
- [ ] Extraire le noyau (registries + handlers) de NeoChess-Legacy vers un package
      réutilisable
- [ ] Définir la structure de l'ORM maison multi-DB
- [ ] Définir la structure de l'addon Sécurité (Auth + JWT)
