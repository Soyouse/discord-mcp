/**
 * Backfill REST — rapatrie l'historique PASSÉ d'un salon (le gateway ne donne que le futur).
 * ⚠️ Cœur PUR : `fetchPage` est injecté → testable sans réseau. L'adaptateur REST (discordCall)
 *    vit dans backfill-cli.js (I/O, exclu mutation). Le rate-limit/429 = géré par @discordjs/rest.
 * ⚠️ REPRENABLE : le curseur backfill_cursor persiste où on s'est arrêté → rerun = continue,
 *    ne recommence jamais de zéro. upsert idempotent → un recouvrement avec le live est sans danger.
 *
 * Discord renvoie les messages du plus RÉCENT au plus ANCIEN ; avec `before=<id>` on remonte le temps.
 */
import { normalizeMessage } from "./normalize.js";

/**
 * @param {object} p
 * @param {string} p.channelId
 * @param {object} p.repo
 * @param {string} p.botId
 * @param {(q:{channelId:string,before?:string,limit:number})=>Promise<object[]>} p.fetchPage  page newest→oldest
 * @param {number} [p.pageLimit=100]  taille de page (max Discord = 100)
 * @param {number} [p.maxPages=Infinity]  garde-fou (tests + sécurité)
 * @returns {Promise<{channelId:string, fetched:number, complete:boolean}>}
 */
export async function backfillChannel({ channelId, repo, botId, fetchPage, pageLimit = 100, maxPages = Infinity }) {
  const cursor = await repo.getBackfillCursor(channelId);
  if (cursor?.complete) return { channelId, fetched: 0, complete: true };

  let before = cursor?.oldest_seen_id ?? undefined; // reprend sous le plus vieux déjà vu
  let fetched = 0;
  let pages = 0;

  while (pages < maxPages) {
    const batch = await fetchPage({ channelId, before, limit: pageLimit });
    if (!batch.length) {
      // Plus rien au-dessus → début du salon atteint.
      await repo.setBackfillCursor({ channelId, oldestSeenId: before ?? null, complete: true });
      return { channelId, fetched, complete: true };
    }

    for (const m of batch) {
      await repo.upsertMessage(normalizeMessage(m, botId));
    }
    fetched += batch.length;
    pages++;
    before = batch[batch.length - 1].id; // le plus ancien du lot = prochain curseur

    // Page incomplète = on a touché le fond du salon.
    const complete = batch.length < pageLimit;
    await repo.setBackfillCursor({ channelId, oldestSeenId: before, complete });
    if (complete) return { channelId, fetched, complete: true };
  }

  // maxPages atteint sans finir : reprenable au prochain run (curseur à jour).
  return { channelId, fetched, complete: false };
}
