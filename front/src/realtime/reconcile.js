/*
 * Réconciliation du fil (PURE) — optimiste + dédupe.
 * ⚠️ INVARIANT : un `message_id` n'apparaît JAMAIS deux fois. L'écho socket d'un message déjà présent
 *    (déjà ajouté par la réponse POST) est donc idempotent → zéro doublon, quelle que soit la course
 *    (écho avant/après la réponse POST).
 * Tri chronologique ascendant (plus ancien en haut), comme l'historique API.
 */
export function sortByTime(list) {
  return [...list].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

/** Insère OU remplace par message_id (idempotent). Re-trie. */
export function upsert(list, msg) {
  const exists = list.some((m) => m.message_id === msg.message_id);
  const next = exists ? list.map((m) => (m.message_id === msg.message_id ? msg : m)) : [...list, msg];
  return sortByTime(next);
}

/** Ajoute un message OPTIMISTE (pending) avec un id temporaire dérivé du nonce. `createdAt` injecté (pur). */
export function addOptimistic(list, { nonce, content, author, authorId, channelId, createdAt }) {
  return [
    ...list,
    {
      message_id: `tmp-${nonce}`,
      channel_id: channelId,
      author_id: authorId,
      author,
      content,
      created_at: createdAt,
      edited_at: null,
      pending: true,
    },
  ];
}

/** Confirme l'optimiste : retire le temp (par nonce) PUIS upsert le message réel (dédupe par id). */
export function confirmOptimistic(list, nonce, realMsg) {
  return upsert(
    list.filter((m) => m.message_id !== `tmp-${nonce}`),
    realMsg
  );
}

/** Rollback d'un optimiste en échec (retire le temp). */
export function rollbackOptimistic(list, nonce) {
  return list.filter((m) => m.message_id !== `tmp-${nonce}`);
}

/** Suppression (event message.deleted) par message_id. */
export function removeById(list, messageId) {
  return list.filter((m) => m.message_id !== messageId);
}
