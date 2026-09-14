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
dossiers conventionnels au démarrage et enregistre automatiquement ce qu'il y
trouve — implémenté dans le module `registry/` de `@forja/core` :

- **`RouteRegistry`** scanne récursivement `features/**/*.route.js`, require chaque
  fichier, et monte ce qu'il exporte (un Router Express) sur l'app. Déposer un
  fichier `<feature>.route.js` sous `features/` suffit — rien à enregistrer à la
  main.
- **`MiddlewareRegistry`** scanne un dossier séparé (`shared/middlewares/` par
  convention) pour les middlewares **globaux** uniquement — ce qui doit tourner sur
  chaque requête (un logger, l'attache de config...). Les fichiers se chargent par
  ordre alphabétique. Les middlewares de feature (un guard d'auth, par exemple) ne
  sont volontairement **pas** auto-montés ici : ils s'appliqueraient à 100% des
  requêtes, ce qui n'est presque jamais ce qu'un guard doit faire. Ils restent un
  simple `require()` dans le fichier de route qui en a besoin — voir
  `auth.route.js` dans `@forja/addon-auth`. Un middleware réutilisé par plusieurs
  features reste un simple import, qu'il vive dans son dossier de feature d'origine
  ou soit remonté dans `shared/middlewares/` pour plus de clarté — la promotion vers
  le registry ne concerne que les middlewares qui appartiennent vraiment à chaque
  requête.
- **`wrapAsync`** — Express 4 ne transmet pas automatiquement une promesse rejetée
  d'un handler async à `next()` ; ça enveloppe un handler pour que ce soit le cas.

C'est une généralisation directe du pattern `routeRegistry`/`middlewareRegistry`
trouvé dans le projet NeoChess-Legacy dont ce framework est issu — avec une vraie
correction faite en chemin : le vrai registry de NeoChess impose de lister chaque
route à la main dans un fichier central (une API d'enregistrement explicite, pas du
vrai auto-discovery). Les registries de Forja scannent réellement le système de
fichiers, conforme à ce que ce document a toujours décrit comme le comportement
visé.

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
choisi. Les vues serveur et un frontend SPA sont deux philosophies de rendu
différentes (le serveur construit le HTML vs. le navigateur construit le DOM) et
sont mutuellement exclusives — une seule question "comment servir les pages ?"
choisit entre SSR, CSR ou API only, donc une combinaison invalide (ex : Pug + React)
ne peut pas se produire.

### Comment le scaffolding évite l'explosion combinatoire de templates

`forja new` n'embarque pas un template complet par combinaison de stack. Il n'y a
qu'un template `base`, plus un petit ensemble de **couches** indépendantes et
composables — une par axe (`lang`, `render`, `css`, `tests`) — copiées les unes
par-dessus les autres et fusionnées. Chaque couche n'ajoute que ses propres fichiers
et un `package.fragment.json` avec ses propres dépendances/scripts, fusionné dans le
`package.json` final. Le nombre de templates à maintenir croît de façon additive
(base + options par axe), jamais multiplicative selon les combinaisons. Voir
`packages/cli/templates/` et `packages/cli/src/scaffold.ts`.

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

  Les presets officiels (`forja add auth`, etc.) reprennent la même
  arborescence mais avec une logique déjà écrite (ex : `auth` câble déjà le hashing
  de mot de passe, les routes login/register et un guard de route) au lieu de
  fichiers vides. `forja add <preset>` copie le `templates/` de l'addon dans
  `features/<preset>/` et fusionne les dépendances de l'addon (et ses peer
  dependencies) dans le `package.json` du projet — implémenté et fonctionnel
  aujourd'hui pour `auth` ; `orm`/`realtime`/`i18n` avertissent qu'ils ne sont pas
  encore prêts puisque ces packages n'ont pas de `templates/` propre.

### Configuration (`config.js` + `.env`)

Chaque projet généré reçoit un `config.js`/`config.ts` à sa racine plus `.env` et
`.env.example` — une généralisation directe du `config.js` de NeoChess-Legacy
(basé sur l'env, fail-fast sur les valeurs requises manquantes via
`createConfig` de `@forja/core`) mais **sans forme fixe** : les champs par défaut
sont `env` (`NODE_ENV`), `name` (`APP_NAME`), `host` (`HOST`) et `port` (`PORT`),
et le projet possède ce fichier — ajoute ce dont ton projet a besoin (secret de
session, URL de DB...) sans que Forja n'impose quoi que ce soit au-delà de ces
bases de déploiement. `index.js` lit `config.port`/`config.host` pour lier le
serveur, donc modifier `.env` est toute l'histoire du setup de déploiement : aucun
changement de code nécessaire pour pointer vers un autre port ou une autre adresse
de bind (`HOST=0.0.0.0` pour un conteneur, par exemple).

### Comment un moteur de vue serveur est réellement câblé

Choisir EJS/Pug/Handlebars dans `forja new` fait plus que déposer des fichiers de
vue : chacune de ces couches de rendu ajoute aussi un `forja.view.json` à la racine
du projet (`{ engine, isAlreadyImplement, module?, export?, options? }`), et
`core/app.js` a un seul bloc de logique générique — utilisé pour chaque moteur SSR,
jamais dupliqué par combinaison — qui le lit et configure Express en conséquence.
Ça reprend exactement le flag `isAlreadyImplement` de `config.js`/`configuration.js`
dans NeoChess-Legacy : EJS et Pug sont compris nativement par Express une fois
nommés via `app.set("view engine", ...)` ; Handlebars a besoin que la factory de son
module soit enregistrée explicitement via `app.engine(...)` au préalable. En
l'absence de `forja.view.json` (API only ou frontend SPA), tout ce bloc est
sauté. Tous les chemins (`features/`, `shared/`, `views/`) sont résolus depuis
`process.cwd()`, pas `__dirname` — nécessaire pour un projet TS, où `__dirname`
pointe dans `dist/` une fois compilé, alors que ces dossiers ne sont jamais
compilés, ils n'existent qu'à la racine du projet.

## État du projet

Le nom **Forja** est retenu et réservé (npm + GitHub). Fonctionnel et testé de bout
en bout aujourd'hui :

- `@forja/core` : contrats, auto-discovery `RouteRegistry`/`MiddlewareRegistry`,
  `createConfig`, `wrapAsync`.
- `forja new` : compose un projet réellement lançable pour n'importe quelle
  combinaison langage × rendu × css × tests. Vérifié par des exécutions réelles,
  pas juste une inspection de fichiers : chaque option de rendu en JS et en TS
  (EJS/Pug/Handlebars rendent vraiment du HTML via un vrai serveur Express ;
  React/Vue/Svelte se build vraiment via Vite dans leur `client/` découplé ;
  API-only sert du vrai JSON), build `tsc` compilé et mode dev `ts-node` pour TS
  (aucun bug de chemin `__dirname` vs `dist/`), SCSS compile réellement, et Vitest
  comme Jest exécutent et passent réellement un vrai fichier de test avec la même
  syntaxe globale `describe`/`it`/`expect` (le `globals: true` de Vitest est
  volontaire pour matcher l'ergonomie de Jest, puisque `forja make:engine` génère
  des fichiers de test sans imports).
- Un projet fraîchement généré répond sur `/` dès le départ — chaque option de
  rendu fournit sa propre route d'accueil `features/home/home.route.js` (JSON pour
  API-only, une page complète aux couleurs officielles Forja pour SSR/CSR) — rien
  ne renvoie 404 avant d'avoir écrit la moindre ligne de code. Le nom d'app affiché
  est lu en direct depuis `config.name` (`APP_NAME` dans `.env`, ou
  `VITE_APP_NAME` côté client pour le CSR). La welcome page démontre aussi un
  changement de langue FR/EN minimal : en SSR, `/`, `/fr` et `/en` sont de vraies
  routes (même convention d'URL que le `/:language?/login` de NeoChess-Legacy, `/`
  détectant automatiquement via `Accept-Language`), et le CSR utilise
  `navigator.language` côté client — autonome, pas branché sur
  `@forja/addon-i18n` puisque ce package est encore vide ; une fois qu'il existera,
  les vraies features devront l'utiliser à la place. Chaque copie de cette démo
  porte un commentaire qui explique précisément quoi supprimer et remplacer une
  fois l'addon disponible. Aucun outil de nettoyage nécessaire : c'est du code
  généré que tu possèdes, libre à toi de l'éditer ou de le supprimer comme
  n'importe quel autre fichier — pareil que le `App.jsx` placeholder d'un starter
  Vite.
- `forja make:engine <name>` : génère les fichiers route/engine/lang/middleware/test
  d'une feature.
- `forja add auth` : copie les templates de `@forja/addon-auth` dans
  `features/auth/` et fusionne ses dépendances dans le `package.json` du projet.
- `@forja/addon-auth` et `@forja/addon-validator` : entièrement fonctionnels, basés
  DIP (l'engine ne connaît que les contrats `Hasher`/`Repository`, jamais bcrypt ni
  une base de données).

### Prochaines étapes

- [ ] `forja add orm` / `realtime` / `i18n` — ces packages d'addon sont encore
      vides, `forja add` avertit déjà au lieu de faire semblant de fonctionner.
- [ ] Concevoir et construire l'ORM maison multi-DB.
- [ ] Élargir l'addon Sécurité au-delà de l'auth (rôles/permissions,
      rate-limiting, CSRF).
