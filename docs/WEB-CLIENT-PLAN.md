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
| **API web** | **Fastify** (REST/auth/logique) | Validation schéma native, perf, `pino`. Conteneur séparé, Node ESM, importe `lib/core`. |
| **Temps réel** | **Socket.IO** (le standard : ~5,75M dl/sem, MS Office/Zendesk). Bridge interne relais→API = PG `NOTIFY`/`LISTEN`, puis `io.to(channel).emit` aux clients | Reconnexion/rooms/fallback **intégrés** = on n'écrit PAS la plomberie. Scale multi-nœuds = **adaptateur Redis officiel** (seam, le jour venu). PG NOTIFY reste un simple signal interne, pas la couche client. |
| **Lecture** | `relay/query.js` (`runHistory`/`runSearch`) + nouvelles requêtes (channels/users) | Déjà testable contre repo mémoire. On étend le repository, pas de nouveau chemin. |
| **Action** | `lib/core` `discordCall` (send message, open DM, etc.) | Passe-plat 100 % API, multi-bot, rate-limit battle-tested. |
| **Auth** | **Login with Discord (OAuth2)** → **access JWT court + refresh token (stocké PG)** | Stateless = scale horizontal (toute instance authentifie). ⚠️ JWT seul = révocation impossible → pattern Big Tech = access court + refresh server-side révocable. Naturel pour un outil Discord, mappe direct au SaaS. + Tailscale pour l'instant. |
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
3. **Temps réel = Socket.IO** (standard mondial, battle-tested). 1 nœud aujourd'hui → multi-nœuds = **adaptateur Redis officiel `@socket.io/redis-adapter`** (étape documentée, MÊME code). On ne change JAMAIS de plomberie — on ajoute l'adaptateur. Bridge relais→API interne = PG NOTIFY.
4. **API sans état** (JWT) → horizontale derrière un LB sans sticky sessions.
5. **Lecture = repository** (déjà le cas) → cache/réplicas lecture insérables sans réécrire les requêtes.

> Règle : on **n'implémente** que la branche mono-tenant. On **n'écrit jamais** de code qui *empêche* la branche multi. Toute valeur tenant/secret passe par sa couture, jamais en dur dispersé.

---

## 6. Phases

- **P0 — Fondation lecture annuaire.** Tables guilds/channels/members + repository (mémoire + PG, contrat), requêtes `listGuilds/listChannels/listDMables`. Tests contrat. Aucun réseau.
- **P1 — Ingestion annuaire. ✅** `handleDispatch` étendu (GUILD_CREATE hydrate serveur+salons+membres ; GUILD_UPDATE ; CHANNEL_CREATE/UPDATE/DELETE ; GUILD_MEMBER_ADD/UPDATE/REMOVE), intent **GuildMembers** ajouté, `removeChannel`/`removeMember` au contrat. **PAS de backfill REST annuaire** : GUILD_CREATE livre le snapshot complet à chaque connexion (≠ historique messages). Seam gros serveurs = member chunking. Pur (ingest) + listener I/O.
- **P2 — API web squelette. 🔶 (cœur fait)** `web/` : `config.js` (env-schema, refuse de booter si invalide) · `read-service.js` (pur, réutilise query.js, projection publique) · `auth.js` (guard JWT + `claimsToPrincipal`) · `tenant.js` (couture) · `build-app.js` (Fastify : helmet/cors/rate-limit/jwt + routes, testé via `inject`) · `routes-read.js` (GET guilds/channels/history/search/dmables) · `server.js` (entrypoint). 207 tests, mutation 88.27%. **RESTE P2b (besoin creds Théo) : flow OAuth Discord qui ÉMET les JWT (table `refresh_tokens` PG) + conteneur `discord-web` + compose. Pour l'instant les JWT ne sont que vérifiés (émission = P2b).**
- **P3 — Temps réel. 🔶 (P3a fait : bus + mapping purs)** `relay/events.js` (`toEvent` pur, 100% mutation, EVENT_CHANNEL partagé) · `relay/publish-pg.js` (PG NOTIFY, I/O seam → Redis/NATS) · `listener.js` publie après écriture (publish injecté, défaut noop) · `web/realtime.js` (`parseNotification`+`eventToEmit` purs, room `channel:<id>`). Test de contrat de bridge (même canal des 2 côtés). **P3b FAIT ✅** : `web/socket.js` (Socket.IO attaché à `app.server`, **auth JWT OBLIGATOIRE à la poignée de main** — rejet sinon, abonnement par room `channel:<id>`) · `web/realtime-bridge.js` (PG `LISTEN` → `parseNotification`→`eventToEmit`→`io.to(room).emit`) · wiring `server.js` (client PG dédié pour LISTEN). Test d'intégration port éphémère (rejet sans/mauvais JWT, accept, livraison par room, isolation). Multi-nœuds = `@socket.io/redis-adapter` (seam). I/O exclu mutation, logique pure (realtime.js/events.js) couverte.
- **P4 — Actions. ✅** `web/action-service.js` (PUR, `discordCall` injecté → testable sans réseau : `sendMessage`/`openDM`/`sendDM`, validation→400 AVANT réseau, projection publique) · `web/routes-action.js` (POST `/api/channels/:id/messages`, `/api/dms`, `/api/dms/:id/messages` — guard JWT, 201) · câblage `build-app.js` (`discordCall` injectable, défaut = lib/core réel). ⚠️ `sendDM` = chaîne DÉPENDANTE (openDM → channel_id RÉEL → sendMessage), jamais batchée (anti-hallucination d'ID). Façade SŒUR : agit via lib/core, **jamais** de 2e gateway ; l'écho du message revient par le relais→NOTIFY→socket (réconciliation optimiste = côté front P5). `bot` optionnel (rail multi-bot) ; seam `tenant→bot` = SaaS futur. **PAS de table `dm_channels`** (différée : le gateway ingère déjà les messages DM ; à ajouter si on veut lister les DM ouverts hors annuaire membres). 13 tests, mutation action-service 91.67% / repo 88.81%.
- **P5 — Front.** SPA React+Vite : **page de login (OAuth Discord)** + garde de route (JWT), sidebar serveurs/DM, liste users DMables, fil + composer, live WS. nginx statique + bloc compose. **Découpé en sous-phases prouvables :**
  - **P5a — Squelette + chaîne de build. ✅** Package `front/` STANDALONE (toolchain isolée du backend : React 19 + Vite 7 + **Tailwind v4** `@tailwindcss/vite` CSS-first + react-router-dom 7 + @tanstack/react-query 5). `theme.css` = tokens Discord (§8 : blurple `#5865F2`, gris étagés base-900→500, statuts) en `@theme`. Pages placeholder `LoginPage` (bouton OAuth disabled) + `CockpitPage` (coquille 4 colonnes : rail bots/convs/fil+composer/détails, états vides). Smoke tests `@testing-library/react`+jsdom (3, routing). Job CI `front` (build+vitest, isolé). **Validation visuelle AUTONOME** = `scripts/shot.mjs` (Playwright headless → PNG `D:/Screenshots`, réutilisé chaque sous-phase). ⚠️ vite bind IPv6 (`localhost`=::1 sur Windows, pas 127.0.0.1) → screenshot via `localhost`. Deps lourdes (radix/cmdk/react-markdown/date-fns/react-hook-form/lucide/virtual/socket.io-client) installées JUSTE-À-TEMPS par sous-phase (anti-sprawl).
  - **P5b — Layout réel + composants. ✅** `components/` présentationnels pilotés par props : `BotRail` (switch multi-bot), `ConversationList` (channels+DM, actif/onSelect), `MessageRow` (auteur/contenu/heure, fallbacks), `MessageList` (virtualisé `@tanstack/react-virtual`), `Composer` (contrôlé : Entrée=envoi, Shift+Entrée=saut, garde anti-vide, disabled), `DetailsPanel`. `CockpitPage` les assemble + sélection locale + `fixtures.js` (TEMPORAIRE, remplacé P5c). Envoi P5b = append local (démo) ; vrai POST+réconciliation = P5d. 18 tests composants (21 total front). ⚠️ Virtualisation NON testée en jsdom (mesures DOM nulles) → validée par screenshot (`front-cockpit-active.png` : fil peuplé, avatars, heures mono, Détails). Deux captures prouvées.
  - **P5c — Données. ✅** `api/http.js` (client PUR, fetch+token injectables, ApiError{status}, seam `setTokenProvider` pour OAuth P2b) · `api/endpoints.js` (1 fn/route, GET lecture + POST action) · `api/hooks.js` (react-query : useGuilds/useChannels/useDMables/useHistory + useSendMessage→invalidate). **MSW** (`mocks/{data,handlers,browser,server}.js`) = mock réseau RÉALISTE (POST append → GET reflète), MÊME source dev (worker, DEV only dans main.jsx) ET tests (server dans test-setup, onUnhandledRequest:error). `CockpitPage` consomme les hooks (fixtures.js SUPPRIMÉ). DM = listés, ouverture/envoi (dépend openDM) = P5d. 36 tests front. ⚠️ Fil virtualisé NON assertable en jsdom → boucle données+envoi prouvée par `endpoints.test.js` (round-trip MSW) + screenshot (`front-cockpit-active.png` : historique réel chargé via API). ⚠️ Quand API+OAuth réels (P2b) : couper MSW, hooks/endpoints INCHANGÉS.
  - **P5d — Temps réel + DM + optimiste. ✅** `realtime/reconcile.js` (PUR : upsert dédupe par message_id, addOptimistic/confirm/rollback, removeById — invariant : un message_id jamais 2× quelle que soit la course écho/POST) · `realtime/socket-client.js` (socket.io-client, token JWT dans handshake `auth`) · `realtime/useChannelRealtime.js` (subscribe room salon → applique created/updated/deleted au cache react-query via reconcile). `useSendMessage` = OPTIMISTE (onMutate addOptimistic pending → onSuccess confirmOptimistic avec le message réel → onError rollback) ; `useOpenDM` (clic DMable → openDM → channelId réel → salon-like : historique+envoi+temps réel unifiés). `socket` injecté main.jsx→App→CockpitPage (tests = non fourni → pas de réseau). 49 tests front (reconcile exhaustif + hook temps réel avec faux socket : created/updated/deleted/dédupe/désabonnement). Screenshot `front-cockpit-sent.png` = envoi optimiste visible. ⚠️ Socket absent (pas d'API en dev/tests) → no-op, l'optimiste marche quand même.
  - **P5e — ⌘K + polish** : command palette `cmdk`, rendu markdown messages (`react-markdown`/discord-markdown), temps relatif `date-fns`, formulaires `react-hook-form`, icônes `lucide-react`.

> **« Au cas où » pris au sérieux — ce qui s'emboîte SANS refonte (déjà seamé) :**
> - **Page de login** = route front au-dessus de l'auth déjà prévue (Discord OAuth→JWT, §3). L'API ne bouge pas.
> - **Multi-tenant SaaS** = `tenant_id` + `SecretStore` partout (§5) → peupler, pas réécrire.
> - **Billing / onboarding** = nouveau module sur la MÊME API Fastify (Stripe déjà maîtrisé ailleurs).
> - **Nouvelles surfaces** (admin, portail client, landing) = nouvelles **façades** sur le même `lib/core` (§1), jamais une refonte.
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
- **`socket.io`** — temps réel. **LE standard** (~5,75M dl/sem, 11,5k projets, MS Office/Zendesk ; maintenu v4.8.x). Reconnexion/rooms/fallback intégrés. S'attache au serveur HTTP (Fastify reste pour REST/auth).
- **`@socket.io/redis-adapter`** — scale multi-nœuds. **Seam : installé seulement quand >1 instance** (jamais avant). Limite Redis = 100k+ connexions → hors de portée pour nous.
- **`@fastify/oauth2`** — flow Login with Discord (provider configurable, officiel).
- **`@fastify/jwt`** — **access token court** (stateless → scale horizontal sans sticky). ⚠️ Révocation = **refresh token stocké en PG** (table `refresh_tokens`), pas un seul JWT longue durée.
- **`@fastify/cors`** · **`@fastify/helmet`** · **`@fastify/rate-limit`** — origine front, headers sécurité, protection abus. ⚠️ **rate-limit : store mémoire NE SCALE PAS multi-instances** → seam **store Redis (`ioredis`, atomique)** dès >1 pod. En mémoire OK à 1 instance.

### Front (SPA) — NEW
- **`react`** + **`react-dom`** — base.
- **`vite`** + **`@vitejs/plugin-react`** — build/dev. SPA statique (nginx).
- **`react-router-dom`** — routing.
- **`@tanstack/react-query`** — server-state (cache/revalidation/pagination). Standard scale, supprime le state-management maison.
- **`@tanstack/react-virtual`** — virtualisation du fil de messages (Discord-like = listes infinies → obligatoire à l'échelle).
- **`tailwindcss`** — styles utilitaires, **zéro runtime**, pas de kit opiniâtre à combattre pour cloner Discord.
- **`@radix-ui/react-*`** (dialog/dropdown/popover) — primitives **accessibles** non-stylées (composent avec Tailwind). À la carte, pas un design-system entier.
- **`socket.io-client`** — client temps réel (pendant de `socket.io`, reconnexion gérée). Pas de helper WS maison.
- *État UI local* = React natif ; **`zustand`** seulement si un état transverse léger émerge (optionnel, pas par défaut).

### Observabilité (P6, hyperscale)
- **`prom-client`** — métriques Prometheus (lag ingestion, WS connectés, latence API). Standard, optionnel jusqu'à P6.

### REJETÉS (anti-sprawl — justifier le NON)
- ❌ Redis **maintenant** — utile seulement comme adaptateur Socket.IO à >1 instance. Seam, pas day-1.
- ❌ WebSocket natif fait-main / Centrifugo — rejetés au profit de **Socket.IO** : le standard le plus connu/maintenu, pas du hand-made ni un choix de niche (critère = réputation + maintenance + zéro plomberie maison).
- ❌ `zod` + type-provider — on est en **JS ESM** (pas TS) ; la validation JSON-Schema native de Fastify couvre déjà.
- ❌ ORM (Prisma/TypeORM) — on a le **repository pattern** + SQL maîtrisé ; un ORM masque les perfs et casse la testabilité mémoire actuelle.
- ❌ Kit UI complet (MUI/Chakra) — trop opiniâtre pour un clone Discord ; Tailwind + Radix = contrôle total, plus léger.
- ❌ `passport` — `@fastify/oauth2` + `@fastify/jwt` font le job sans la lourdeur Express-centrée.

### À PRÉVOIR par phase — dép STANDARD, NE PAS hand-roller (anti-réinvention)
> Règle : problème déjà résolu = dépendance battle-tested. On ne code à la main que l'irréductible métier (`normalize`/`repository`/`handlers`). Glue triviale exceptée.
- **P2** — `@fastify/cookie` (state/PKCE OAuth). Validation config = **ajv direct** (env-schema écarté : il fusionne `process.env` → validation non déterministe/tests non isolés, prouvé en CI).
- **P4** — **`bullmq`** (Redis) pour broadcasts / envois de masse / programmés. JAMAIS une boucle `setTimeout` maison. (Active la 1re fois qu'on fait du mass/scheduled.)
- **P5** — ⚠️ **rendu messages = `react-markdown` / lib discord-markdown** (gras/code/mentions/liens/emoji) — LE piège n°1 à ne jamais parser soi-même · **`date-fns`** (temps relatif « il y a 3 min ») · **`react-hook-form`** (formulaires) · `lucide-react` (icônes, déjà la convention agence).
- **P6** — **`@sentry/node` + `@sentry/react`** (suivi d'erreurs — jamais hand-roll) · OpenTelemetry (tracing, seam à l'échelle).
