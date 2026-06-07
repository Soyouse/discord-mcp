/**
 * Store des refresh tokens (révocation/rotation) — mémoire (tests) + PG (prod), MÊME contrat.
 * ⚠️ On ne stocke JAMAIS le refresh token en clair : seulement son SHA-256 (comme un mot de passe).
 *    Une fuite de la base ne donne aucun token utilisable. Le secret reste UNIQUEMENT dans le cookie client.
 * ⚠️ Rotation : à chaque /refresh on révoque l'ancien et on en crée un neuf (détection de rejeu).
 * Contrat commun : create({tokenHash,userId,tenantId,expiresAt}) · find(tokenHash) · revoke(tokenHash) · revokeAllForUser(userId).
 */
import crypto from "node:crypto";

/** SHA-256 hex d'un token brut. PUR/déterministe. Le brut ne touche jamais le stockage. */
export function hashToken(raw) {
  if (typeof raw !== "string" || !raw) throw new Error("hashToken: token brut requis");
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Un enregistrement est-il utilisable MAINTENANT ? PUR (now injecté). */
export function isUsable(record, now) {
  if (!record || record.revoked) return false;
  return new Date(record.expiresAt).getTime() > now;
}

/** Store mémoire (tests, 1 process) — Map tokenHash→record. */
export function createMemoryRefreshStore() {
  const byHash = new Map();
  return {
    async create({ tokenHash, userId, username, tenantId, expiresAt }) {
      byHash.set(tokenHash, { tokenHash, userId, username: username ?? null, tenantId, expiresAt, revoked: false });
    },
    async find(tokenHash) {
      return byHash.get(tokenHash) ?? null;
    },
    async revoke(tokenHash) {
      const r = byHash.get(tokenHash);
      if (r) r.revoked = true;
    },
    async revokeAllForUser(userId) {
      for (const r of byHash.values()) if (r.userId === userId) r.revoked = true;
    },
  };
}

// ⚠️ Le store PG (I/O) vit dans refresh-store-pg.js (exclu mutation, comme relay/pg-repository.js).
