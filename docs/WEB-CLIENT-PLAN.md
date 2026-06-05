# PLAN — Client Discord alternatif (façade web)

> ⭐ **BUT NORD** : un **client Discord alternatif qui tourne sur un bot**. Interface web où l'on fait à la main, comme sur Discord, tout ce que l'API permet — chatter avec les users, **DM bidirectionnel**, liste des users DMables, envoyer à qui on veut, messages salons, à terme broadcasts/actions de masse. Piloté **humain ET IA** sur le **même cœur `lib/core`**.
>
> Tout le backend déjà bâti (MCP + relais + gateway + Postgres) = la **plomberie** de ce client. Ce plan = la façade web (le client lui-même).
>
> **Lire EN PREMIER** à chaque session web : ce fichier. Mémoire = [[project_discord_mcp]].

---

## 1. Doctrine (non négociable)

- **Cœur partagé → N façades.** `lib/core` (agir) + `relay` (lire) sont la vérité. Façades = MCP (agent, existe), **API web (nouveau)**, front. Une lib, comportement identique humain/IA.
- **Le front ne parle JAMAIS à Discord en direct.** Il tape l'**API web**, qui tape le cœur. Token Discord jamais exposé au navigateur.
- **La façade web est SŒUR du MCP, pas un consommateur du MCP.** Le MCP est du JSON-RPC pour agents ; un chat temps réel = REST + WebSocket. Les deux réutilisent `lib/core` + `relay/query.js` → zéro duplication.
- **Pensée SaaS/hyperscale dès le départ, ZÉRO infra prématurée.** On ne construit pas Kafka/Redis/vault maintenant ; on pose les **coutures** pour que mono→multi-tenant et 1→N instances soit un *swap*, pas une réécriture. (Cf. [[feedback_programmatic_first]], doctrine relais `SCALING.md`.)
- **Isolation conteneurs.** Le front (statique) et l'API web (stateful) = conteneurs séparés, couplés au reste par **Postgres + lib/core** uniquement, jamais d'IPC.
- **Mêmes gates** que le reste du repo : vitest + Stryker (break=80 cliquet), husky, repository pattern testable sans vraie base.

---

## 2. Architecture cible

```
┌──────────────┐   WebSocket + REST   ┌───────────────────┐
│  FRONT (SPA) │ ───────────────────► │   API WEB         │
│ React+Vite   │ ◄─── push live ───── │   (Fastify)       │
│ nginx statique│                     │  réutilise:       │
└──────────────┘                      │  • lib/core (agir)│
                                      │  • relay/query (lire)
                                      └────────┬──────────┘
                                               │ LISTEN / SELECT
                              ┌────────────────▼─────────────────┐
                              │        Postgres (discord_relay)   │
                              │   messages · guilds · channels ·  │
                              │   members · backfill_cursor       │
                              └────────────────▲─────────────────┘
                                               │ écrit (NOTIFY)
                              ┌────────────────┴─────────────────┐
                              │   RELAY (gateway @discordjs/ws)   │
                              │   1 process, N bots, SEUL writer  │
                              └───────────────────────────────────┘
```

**Invariant d'écriture conservé :** le relais reste le **seul writer** de l'historique. L'API web **n'ouvre PAS de gateway** (sinon double connexion, plafond intents, concurrence). Elle LIT la base et AGIT via REST.

---

## 3. Couches & choix techniques

| Couche | Choix | Pourquoi |
|---|---|---|
| **Front** | React + **Vite** SPA, servi **statique par nginx** | App interne authentifiée → pas de SSR/SEO. Pattern « maquettes » (statique = ~0 RAM). |
| **API web** | **Fastify** (REST + `@fastify/websocket`) | Validation schéma native, perf, WS first-class. Conteneur séparé, Node ESM, importe `lib/core`. |
| **Temps réel** | PG **`LISTEN`/`NOTIFY`** : relais NOTIFY à l'insert → API LISTEN → push WS | Zéro infra neuve. Chaque instance API LISTEN + fan-out vers SES clients WS → **scale horizontal natif**. |
| **Lecture** | `relay/query.js` (`runHistory`/`runSearch`) + nouvelles requêtes (channels/users) | Déjà testable contre repo mémoire. On étend le repository, pas de nouveau chemin. |
| **Action** | `lib/core` `discordCall` (send message, open DM, etc.) | Passe-plat 100 % API, multi-bot, rate-limit battle-tested. |
| **Auth** | **Login with Discord (OAuth2)** → session JWT stateless | Naturel pour un outil Discord, zéro mot de passe, **mappe direct au SaaS**. JWT = API sans état = scale horizontal. + derrière Tailscale pour l'instant. |
| **Conteneur** | 3e service compose `discord-web` (API) + bloc nginx (front) | Isolation. Couplage = PG + lib/core only. |

---

## 4. Modèle de données — extensions relais

Le schéma actuel ne stocke **que `messages`**. Le client a besoin de l'annuaire. **On persiste, on ne fait pas de REST live** (hyperscale : du REST live à chaque ouverture UI × N tenants = plafond invalid-request **par-IP** + latence).

Nouvelles tables (`relay/schema.sql`, idempotent) :
- **`guilds`** (guild_id PK, name, icon, bot_id provenance, tenant_id, updated_at)
- **`channels`** (channel_id PK, guild_id NULL=DM, type, name, position, tenant_id, updated_at)
- **`members`** (guild_id + user_id PK, username, global_name, avatar, is_bot, tenant_id, updated_at) → **« qui je peux DM » = union des members des serveurs communs, hors bots**
- **`dm_channels`** (channel_id PK, recipient_id, bot_id, tenant_id) → mapping DM ouverts

**Hydratation :** event gateway **`GUILD_CREATE`** (livré au READY) contient channels + members → upsert. Edits via `GUILD_UPDATE`/`CHANNEL_*`/`GUILD_MEMBER_*`. Backfill REST one-shot pour l'existant.

⚠️ **Intent à ajouter : `GUILD_MEMBERS`** (privilégié, activable seul <100 serveurs) — sans lui, pas de liste de membres. Intents actuels (`Guilds|GuildMessages|DM|MessageContent`) → + `GuildMembers`.

⚠️ **DM passés = minces** : un bot ne reliste pas facilement ses anciens DM. Live OK (intent DM). Backfill DM = REST par `dm_channel` à l'ouverture. Accepté.

---

## 5. Coutures SaaS / hyperscale (coût ~0 maintenant)

Posées dès le départ, **valeur mono-tenant constante** aujourd'hui :

1. **`tenant_id` partout** (tables + auth + requêtes), constante `DEFAULT_TENANT` pour l'instant. Multi-tenant = peupler + scoper, **pas réécrire**.
2. **Isolation des tokens** : aujourd'hui `.secrets.json` ; SaaS = backend secrets par-tenant chiffré (vault). Interface `SecretStore` posée, impl fichier maintenant. La couture `bot_id`→tenant existe déjà (`bot_id` en base).
3. **Pub/sub abstrait** : interface `EventBus.publish/subscribe`, impl **PG NOTIFY** maintenant → **NATS** plus tard (déjà dans `SCALING.md`), sans toucher relais ni API.
4. **API sans état** (JWT) → horizontale derrière un LB sans sticky sessions.
5. **Lecture = repository** (déjà le cas) → cache/réplicas lecture insérables sans réécrire les requêtes.

> Règle : on **n'implémente** que la branche mono-tenant. On **n'écrit jamais** de code qui *empêche* la branche multi. Toute valeur tenant/secret passe par sa couture, jamais en dur dispersé.

---

## 6. Phases

- **P0 — Fondation lecture annuaire.** Tables guilds/channels/members + repository (mémoire + PG, contrat), requêtes `listGuilds/listChannels/listDMables`. Tests contrat. Aucun réseau.
- **P1 — Ingestion annuaire.** `handleDispatch` étendu (GUILD_CREATE/UPDATE/MEMBER_*), intent GuildMembers, backfill REST annuaire. Pur + listener I/O.
- **P2 — API web squelette.** Conteneur Fastify, auth Discord OAuth→JWT, endpoints REST lecture (guilds/channels/history/search/DMables) réutilisant query.js. Bearer/CORS/tenant scoping. Gates.
- **P3 — Temps réel.** EventBus (NOTIFY/LISTEN), WebSocket push (nouveau message → clients du salon). Fan-out par instance.
- **P4 — Actions.** Endpoints envoi message / ouvrir DM / envoyer DM via lib/core. Optimistic UI + echo gateway.
- **P5 — Front.** SPA React+Vite : sidebar serveurs/DM, liste users DMables, fil + composer, live WS. nginx statique + bloc compose.
- **P6 — Durcissement.** Permissions fines, rate-limit UI, observabilité, doc skill + docs injectables, déploiement VPS.

Chaque phase : repository/pur d'abord (testable sans réseau), I/O ensuite, preuve live à la fin. Zéro régression, mutation-vérifié.

---

## 7. Invariants scellés

- Front → API web → cœur. **Jamais** front → Discord. Token jamais côté navigateur.
- Relais = **seul writer**. L'API web ne fait que LIRE + AGIR (REST). Pas de 2e gateway.
- Annuaire **persisté** (DB), pas de REST live par ouverture d'UI (plafond par-IP).
- `tenant_id` + `SecretStore` + `EventBus` = coutures **toujours traversées**, jamais court-circuitées.
- Mono-tenant only **implémenté** ; multi-tenant **jamais empêché**.
- Mêmes gates que le repo (vitest + Stryker break=80, repository testable sans base).

---

## 8. Vision UX / design (validée recherche 2026)

**Positionnement honnête :** on ne fait PAS un « MEE6 en plus joli ». MEE6 / Carl-bot / Dyno sont des **dashboards de config serveur** (modération, rôles, level-up) — *jugés datés en 2026*. Nous = un **vrai client de messagerie + cockpit d'opérateur** (chat/DM temps réel piloté humain **et** IA). Autre catégorie : on ne les bat pas, on n'est pas sur le même axe. Notre edge = **profondeur opérateur (façon Carl-bot) + polish Linear + temps réel + co-pilot IA**.

**On bat l'expérience par le PURPOSE-BUILT, pas par la déco.** Le luxe 2026 = vitesse, densité maîtrisée, clavier. Pas les animations.

**Filiation Discord (c'est une extension de Discord — l'utilisateur doit se sentir chez lui) :**
- **Accent = blurple Discord `#5865F2`** (notre couleur primaire). Couleurs de **statut Discord** réutilisées : online `#23A55A`, idle `#F0B232`, dnd `#F23F43`.
- **Échelle de gris sombres façon Discord** (surfaces étagées : fond ~`#313338`, rails `#2B2D31`/`#1E1F22`) → repères visuels familiers.
- **MAIS pas un clone pixel** : l'ADN couleur est Discord ; la **structure** (densité, type mono data, ⌘K, motion sobre) est **Linear-grade**. Familier + élevé, jamais « Discord en moins bien ».

**Langage visuel (confirmé par la recherche 2026) :**
- **Dark-first** par défaut (light dispo). ADN couleur Discord + **structure Linear / Vercel / Stripe** = la barre 2026.
- **Un seul accent** (le blurple), typo forte + whitespace, contraste élevé.
- **Type monospace pour les DONNÉES** (IDs, snowflakes, timestamps, payloads) — « function-forward », aligne le rythme visuel sur la logique data. UI sans-serif, data mono.
- **Anti-décoration** : ZÉRO glassmorphism / « Liquid Glass » (2026 le démonte = bruit). Pas d'ombres molles inutiles, pas de gradients gadget.
- **Temps réel non négociable** : un dashboard qui exige un refresh manuel = perçu obsolète.

**Signatures opérateur (ce que le client de Discord ne fait PAS pour un bot) :**
- **⌘K command palette** partout (`cmdk`) — *standard 2026, plus une option* ; Linear = la référence. Toute action accessible au clavier.
- **Co-pilot IA visible** : les actions de l'agent apparaissent dans le fil, bouton « je reprends la main » (handoff humain↔IA fluide). LA signature : humain + IA, même surface.
- **Switch multi-bot** en un geste (rail gauche = nos bots).
- **Broadcast / DM de masse** : templates + **preview avant envoi**.
- **Recherche full-text globale instantanée** (FTS `tsvector` déjà en base → quasi gratuit).

**Layout :** 3 colonnes — rail bots (gauche) → liste convs/DM → fil + composer — MAIS la zone droite = **panneau contextuel d'opérateur** (fiche user, son historique, actions IA suggérées), pas une déco.

**Motion :** CSS d'abord ; **`framer-motion`** seulement quand un geste le mérite (anti-sprawl). Jamais d'animation gratuite.

**Sources :** Linear command palette (gold standard 2026) · SaaSUI.Design trends 2026 · think.design « Dashboard 2026 do's/don'ts » · peakbot.pro « MEE6 vs Dyno vs Carl-bot 2026 ».

---

## 9. Dépendances (hyperscale, propres, anti-sprawl)

**Règle :** réutiliser l'existant > natif > battle-tested. Chaque dépendance justifiée ou rejetée. Pas de kitchen-sink.

### Déjà là — RÉUTILISÉS (zéro ajout)
- `@discordjs/rest` · `@discordjs/core` · `@discordjs/ws` — action REST + gateway ingestion. Le cœur. Ne JAMAIS réinventer.
- `pg` — Postgres. **Gère `LISTEN`/`NOTIFY` nativement** (zéro lib pub/sub à ajouter pour le temps réel).
- `express` (transport MCP) — laissé tel quel, conteneur/concern distinct.
- `vitest` + Stryker + husky — gates, étendus au front (+ `@testing-library/react`).

### API web (backend) — NEW
- **`fastify`** — framework HTTP. Perf, validation JSON-Schema **native (ajv intégré)** → zéro lib de validation. Logger **`pino` intégré** → zéro lib de logs.
- **`@fastify/websocket`** — push temps réel (WS first-class).
- **`@fastify/oauth2`** — flow Login with Discord (provider configurable, officiel).
- **`@fastify/jwt`** — session **stateless** → API sans état → scale horizontal sans sticky.
- **`@fastify/cors`** · **`@fastify/helmet`** · **`@fastify/rate-limit`** — origine front, headers sécurité, protection abus (hyperscale = exposé).
- *Temps réel* = `pg` LISTEN/NOTIFY + WebSocket natif. **AUCUNE** lib bus maintenant (NATS = seam P-future, cf. SCALING.md).

### Front (SPA) — NEW
- **`react`** + **`react-dom`** — base.
- **`vite`** + **`@vitejs/plugin-react`** — build/dev. SPA statique (nginx).
- **`react-router-dom`** — routing.
- **`@tanstack/react-query`** — server-state (cache/revalidation/pagination). Standard scale, supprime le state-management maison.
- **`@tanstack/react-virtual`** — virtualisation du fil de messages (Discord-like = listes infinies → obligatoire à l'échelle).
- **`tailwindcss`** — styles utilitaires, **zéro runtime**, pas de kit opiniâtre à combattre pour cloner Discord.
- **`@radix-ui/react-*`** (dialog/dropdown/popover) — primitives **accessibles** non-stylées (composent avec Tailwind). À la carte, pas un design-system entier.
- *WebSocket client* = API **native** `WebSocket` + petit helper reconnect maison (testable). Pas de lib si évitable.
- *État UI local* = React natif ; **`zustand`** seulement si un état transverse léger émerge (optionnel, pas par défaut).

### Observabilité (P6, hyperscale)
- **`prom-client`** — métriques Prometheus (lag ingestion, WS connectés, latence API). Standard, optionnel jusqu'à P6.

### REJETÉS (anti-sprawl — justifier le NON)
- ❌ Redis/NATS/Kafka **maintenant** — infra prématurée = dette. Le bus est une *couture* (`EventBus`), pas une dépendance day-1.
- ❌ `socket.io` — surcouche lourde ; WS natif + react-query suffisent, et `@fastify/websocket` est plus propre.
- ❌ `zod` + type-provider — on est en **JS ESM** (pas TS) ; la validation JSON-Schema native de Fastify couvre déjà.
- ❌ ORM (Prisma/TypeORM) — on a le **repository pattern** + SQL maîtrisé ; un ORM masque les perfs et casse la testabilité mémoire actuelle.
- ❌ Kit UI complet (MUI/Chakra) — trop opiniâtre pour un clone Discord ; Tailwind + Radix = contrôle total, plus léger.
- ❌ `passport` — `@fastify/oauth2` + `@fastify/jwt` font le job sans la lourdeur Express-centrée.
