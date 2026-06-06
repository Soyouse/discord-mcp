/**
 * Service d'ACTIONS de l'API web — logique PURE, AGIT via la dépendance injectée `discordCall`
 * (= lib/core, passe-plat REST multi-bot, rate-limit battle-tested). Testable sans réseau (fake discordCall).
 * ⚠️ Façade SŒUR : on AGIT via lib/core, JAMAIS via une 2e gateway. Le relais reste SEUL writer de
 *    l'historique — l'écho du message envoyé revient par le gateway → NOTIFY → socket (réconciliation
 *    optimiste côté front). On n'écrit donc JAMAIS dans la base ici.
 * ⚠️ Validation AVANT tout appel réseau (entrée invalide = 400, jamais un 500 Discord opaque).
 * ⚠️ Projection PUBLIQUE en retour — jamais le payload brut Discord en entier.
 */

function badRequest(message) {
  const e = new Error(message);
  e.statusCode = 400;
  return e;
}

const isNonEmpty = (v) => typeof v === "string" && v.trim().length > 0;

// Projection publique d'un message (POST /channels/{id}/messages renvoie l'objet message Discord).
const formatMessage = (m) => ({
  message_id: m.id,
  channel_id: m.channel_id,
  author_id: m.author?.id ?? null,
  content: m.content ?? "",
});

/** Envoie un message dans un salon (ou un DM déjà ouvert : un DM EST un channel). */
export async function sendMessage(deps, { channelId, content, bot } = {}) {
  if (!isNonEmpty(channelId)) throw badRequest("channelId requis");
  if (!isNonEmpty(content)) throw badRequest("content requis");
  const msg = await deps.discordCall("POST", `/channels/${channelId}/messages`, { content }, { bot });
  return formatMessage(msg);
}

/** Ouvre (ou récupère) le canal DM avec un utilisateur. Discord est idempotent : re-POST = même channel. */
export async function openDM(deps, { recipientId, bot } = {}) {
  if (!isNonEmpty(recipientId)) throw badRequest("recipientId requis");
  const ch = await deps.discordCall("POST", "/users/@me/channels", { recipient_id: recipientId }, { bot });
  return { channel_id: ch.id };
}

/**
 * Envoie un DM à un utilisateur (ouvre le canal puis poste).
 * ⚠️ Appels DÉPENDANTS SÉQUENTIELS : ouvrir le DM → LIRE le channel_id RÉEL → envoyer.
 *    JAMAIS deviner/batcher l'id (cf. anti-hallucination d'ID). 2 appels distincts, pas une rafale.
 */
export async function sendDM(deps, { recipientId, content, bot } = {}) {
  if (!isNonEmpty(content)) throw badRequest("content requis");
  const { channel_id } = await openDM(deps, { recipientId, bot });
  return sendMessage(deps, { channelId: channel_id, content, bot });
}
