/*
 * Réconciliation du fil PAGINÉ (PURE) — adapte reconcile.js à la forme InfiniteData de react-query
 * ({ pages: [[msg]], pageParams }) utilisée par useHistory (useInfiniteQuery).
 * ⚠️ INVARIANTS hérités de reconcile.js : un message_id JAMAIS deux fois (le flatten dédupe) ;
 *    les NOUVEAUX messages (optimiste, écho socket) vont dans pages[0] = la page la PLUS RÉCENTE
 *    (1er fetch sans `before`) ; l'ordre affiché vient de flattenPages, jamais de l'ordre des pages.
 * ⚠️ Cache absent (salon jamais chargé) → EMPTY : l'optimiste/l'écho marchent avant le 1er GET.
 */
import { addOptimistic, rollbackOptimistic, removeById, sortByTime } from "./reconcile.js";

const EMPTY = { pages: [[]], pageParams: [null] };

const mapPages = (data, fn) => ({ ...data, pages: data.pages.map(fn) });
const mapFirstPage = (data, fn) => ({
  ...data,
  pages: data.pages.map((p, i) => (i === 0 ? fn(p) : p)),
});

/** Aplati toutes les pages → liste UNIQUE dédupliquée par message_id, triée chrono ASC (affichage). */
export function flattenPages(data) {
  const seen = new Map();
  for (const page of data?.pages ?? []) for (const m of page) seen.set(m.message_id, m);
  return sortByTime([...seen.values()]);
}

/** Insère (pages[0]) OU remplace IN PLACE par message_id, où qu'il soit (idempotent — écho socket). */
export function upsertPages(data = EMPTY, msg) {
  const exists = data.pages.some((p) => p.some((m) => m.message_id === msg.message_id));
  if (exists) {
    return mapPages(data, (p) => p.map((m) => (m.message_id === msg.message_id ? msg : m)));
  }
  return mapFirstPage(data, (p) => [...p, msg]);
}

/** Ajoute un message OPTIMISTE (pending) dans la page la plus récente. */
export function addOptimisticPages(data = EMPTY, draft) {
  return mapFirstPage(data, (p) => addOptimistic(p, draft));
}

/** Confirme l'optimiste : retire le temp (nonce) de TOUTES les pages puis upsert le message réel. */
export function confirmOptimisticPages(data = EMPTY, nonce, realMsg) {
  return upsertPages(mapPages(data, (p) => rollbackOptimistic(p, nonce)), realMsg);
}

/** Rollback d'un optimiste en échec (retire le temp de toutes les pages). */
export function rollbackOptimisticPages(data = EMPTY, nonce) {
  return mapPages(data, (p) => rollbackOptimistic(p, nonce));
}

/** Suppression (event message.deleted) dans toutes les pages. */
export function removeByIdPages(data = EMPTY, messageId) {
  return mapPages(data, (p) => removeById(p, messageId));
}
