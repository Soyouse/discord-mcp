/**
 * Store PG des refresh tokens — I/O pur Postgres. EXCLU de la mutation (comme relay/pg-repository.js) :
 * prouvé par les tests de contrat contre un vrai PG, pas par mutation. MÊME contrat que createMemoryRefreshStore.
 */

/** DDL idempotent (appelé au boot du serveur web). */
export async function ensureRefreshSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      username   TEXT,
      tenant_id  TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked    BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens (user_id);
  `);
}

/** Store PG (prod). Même contrat que la version mémoire. */
export function createPgRefreshStore(pool) {
  return {
    async create({ tokenHash, userId, username, tenantId, expiresAt }) {
      await pool.query(
        `INSERT INTO refresh_tokens (token_hash, user_id, username, tenant_id, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (token_hash) DO NOTHING`,
        [tokenHash, userId, username ?? null, tenantId, expiresAt],
      );
    },
    async find(tokenHash) {
      const { rows } = await pool.query(
        `SELECT token_hash AS "tokenHash", user_id AS "userId", username,
                tenant_id AS "tenantId", expires_at AS "expiresAt", revoked
         FROM refresh_tokens WHERE token_hash = $1`,
        [tokenHash],
      );
      return rows[0] ?? null;
    },
    async revoke(tokenHash) {
      await pool.query(`UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`, [tokenHash]);
    },
    async revokeAllForUser(userId) {
      await pool.query(`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1`, [userId]);
    },
  };
}
