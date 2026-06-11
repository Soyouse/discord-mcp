/**
 * Enrichissement PROFIL utilisateur (banner / public_flags / tag serveur) — REST GET /users/{id}.
 * ⚠️ Le gateway member-chunk NE donne PAS ces champs → REST côté RELAIS (writer), JAMAIS côté web
 *    à l'ouverture UI (invariant : annuaire persisté, plafond invalid-request par-IP).
 * ⚠️ Cœur PUR : `fetchUser` injecté → testable sans réseau (pattern backfill.js).
 * ⚠️ EN SÉRIE, jamais Promise.all : writer série + rate-limit @discordjs/rest par-token.
 * Garde maxAgeMs (24h défaut) : re-sync seulement les profils périmés — re-chunk gateway ≠ re-REST.
 */
import { normalizeUserProfile } from "./normalize-directory.js";

export async function enrichProfiles({
  repo,
  fetchUser,
  maxAgeMs = 24 * 3600 * 1000,
  now = () => new Date(),
  log = () => {},
}) {
  const before = new Date(now().getTime() - maxAgeMs).toISOString();
  const ids = await repo.listUserIdsNeedingProfileSync({ before });
  let synced = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      const profile = normalizeUserProfile(await fetchUser(id));
      await repo.updateUserProfile(id, { ...profile, profile_synced_at: now().toISOString() });
      synced++;
    } catch (e) {
      // Un user en échec (compte supprimé, 403…) ne bloque JAMAIS les autres ; il restera "needing sync".
      failed++;
      log(`enrich-profiles: ${id} KO (${e?.message ?? e})`);
    }
  }
  return { total: ids.length, synced, failed };
}
