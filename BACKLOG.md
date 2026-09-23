# BACKLOG — discord-mcp

---

## 🟠 CE QUI RESTE APRÈS LA PANNE D'ADRESSE (réparée le 23/09/2026, commit `6778570`)

Le service tourne et répond (`healthy`, `initialize` 200 via `:8449`). Ce qui n'est PAS parfait :
1. **Le correctif vit sur la branche `feat/lien-discord-message`, pas sur `master`** (2 commits d'écart).
   `master` porte encore l'IP de façade en dur : un déploiement fait depuis `master` REFAIT la panne.
   ⇒ fusionner la branche (ou y reporter le correctif).
2. **Personne n'a vu la panne pendant 6 jours** (déploiement du 16/09, trouvée le 22/09 par hasard).
   La sentinelle `docker-health` de dev est censée alerter sur un conteneur `unhealthy` : **non mesuré**
   si elle a crié et que rien n'a suivi, ou si elle s'est tue. À mesurer dans son journal.
3. **Le déploiement se fait à la main** (archive envoyée, build, recreate) : c'est ce geste manuel qui
   a porté la version anonymisée sur le serveur. Pas de contrôle « le service répond » après déploiement.
4. **Deux docs recopient encore l'IP de façade** : `docs/WEB-CLIENT-PLAN.md` et `deploy/README.md`
   (`your-node.tailxxxxx.ts.net`) — sans effet sur le service, mais trompeur pour qui les lit.
5. **Aucun juge n'interdit une IP écrite en dur ailleurs** que dans le compose et le gabarit nginx
   (volets posés sur ces 2 fichiers seulement).

---

## 🔵 PRIORITE BASSE — filets structurels du parc absents de ce depot (inventorie le 29/08/2026)

**Rien n'est casse. C'est une absence de FILET, pas un defaut.** Point sorti du backlog de
`zenon-infra/infra-mcp` le 29/08/2026 (decision operateur) : un backlog de projet n'est pas un
backlog melange — un point qui ne casse pas CE depot n'y vit pas.

**LE FAIT MESURE (inventaire des 12 depots du parc, 29/08/2026)** : les garde-fous statiques
construits dans `infra-mcp` n'ont jamais ete propages. Etat du parc ce jour-la :
- `npm run ci` (la CI est UNE commande locale, le workflow ne porte AUCUNE logique) : **0 depot sur 12**
- cliquet du nombre de tests declares (un test ne peut plus disparaitre en silence) : **1 sur 12**
- fins de ligne CRLF · octet NUL brut · cross-OS · dette totale · hermeticite des tests : **0 sur 12**

**CE QUI VAUT LE COUP ICI, dans cet ordre, quand ce depot sera touche de toute facon :**
1. **`npm run ci`** — expose le MEME nom que tout le parc, et le workflow ne fait que l'APPELER.
   Sans ca, la CI locale et la CI distante divergent EN SILENCE, et un quota GitHub epuise rend
   ce depot invérifiable. Reference vivante : `zenon-infra/infra-mcp/tools/ci.mjs` +
   `helpers/ci-locale-pure.js` (source unique des etapes) + `tests/ci-locale-gate.test.js`
   (le gate qui assert LES DEUX cotes : le workflow n'appelle rien d'autre, et chaque groupe
   est bien invoque).
2. **Cliquet du nombre de tests** — perimetre DERIVE de git, donc portable tel quel. Reference :
   `zenon-infra/infra-mcp/helpers/tests-cliquet-pure.js` + `tests/tests-cliquet-gate.test.js`.
3. **Fins de ligne + octet NUL** — deux petits juges contre la corruption silencieuse d'un
   fichier destine a une machine. Reference : `fins-de-ligne-gate` / `nul-brut-gate` (memes dossiers).

⚠️ **NE PAS recopier un CHIFFRE d'un autre depot** (budget, cliquet, plancher) : toute ligne de
base se GENERE par la mesure de CE depot. Un cliquet importe est un cliquet invente, et il ne
protege de rien.
🛑 **NE PAS faire de ce point un chantier a part entiere** : il se traite quand ce depot est ouvert
pour une AUTRE raison. Priorite basse assumee — le vrai filtre reste les utilisateurs.
