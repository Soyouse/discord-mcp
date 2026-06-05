/**
 * Incidents — contexte SCOPÉ PAR APPEL (jamais un buffer global).
 *
 * ⚠️ DIFFÉRENCE CLÉ vs prospection-mcp : prospection utilise un buffer module-global
 * (startReport/finishReport) qui FUIT entre appels concurrents en multi-user.
 * Ici, chaque appel reçoit SON contexte → deux appels ne se mélangent JAMAIS.
 * NE PAS réintroduire d'état au niveau module (casse le multi-user).
 */

export function createIncidentContext() {
  const incidents = [];
  return {
    add(level, message, meta) {
      incidents.push({ level, message, meta: meta ?? null, ts: new Date().toISOString() });
    },
    list() {
      return incidents.slice();
    },
    get count() {
      return incidents.length;
    },
    format() {
      if (incidents.length === 0) return "✅ Aucun incident.";
      const lines = incidents.map((i) => `- [${i.level}] ${i.message}`);
      return `⚠️ Incidents (${incidents.length}) :\n${lines.join("\n")}`;
    },
  };
}
