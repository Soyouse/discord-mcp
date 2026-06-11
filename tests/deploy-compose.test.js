/**
 * Cohérence docker-compose ↔ besoins runtime des services.
 * ⚠️ Scelle une régression VÉCUE : les vars OAuth de discord-web avaient été hot-fixées sur le VPS
 * sans être commitées → un recreate les a perdues → /api/auth/login = 500 en prod (2026-06-11).
 * Le compose du repo est LA source : tout besoin env/volume d'un service DOIT y être déclaré.
 */
import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const here = dirname(fileURLToPath(import.meta.url));
const composePath = join(here, "..", "docker-compose.yml");
const compose = parse(await readFile(composePath, "utf8"));

describe("docker-compose.yml — service discord-web", () => {
  const web = compose.services["discord-web"];

  it("déclare les 4 vars OAuth (sinon /api/auth/login = 500)", () => {
    for (const key of [
      "DISCORD_CLIENT_ID",
      "DISCORD_CLIENT_SECRET",
      "DISCORD_OAUTH_REDIRECT_URI",
      "OAUTH_ALLOWED_USER_IDS",
    ]) {
      expect(web.environment, `env ${key} manquante`).toHaveProperty(key);
      // Référence ${VAR} vers .env — jamais de valeur en dur (secret) dans le compose commité.
      expect(web.environment[key]).toBe(`\${${key}}`);
    }
  });

  it("monte les secrets bots (sinon discordCall → tout POST échoue)", () => {
    expect(web.environment.DISCORD_SECRETS_PATH).toBe("/run/secrets/discord.json");
    expect(web.volumes).toContain("/etc/discord-mcp/secrets.json:/run/secrets/discord.json:ro");
  });

  it("vars de base présentes (JWT, base relais)", () => {
    expect(web.environment.WEB_JWT_SECRET).toBe("${WEB_JWT_SECRET}");
    expect(web.environment.RELAY_DATABASE_URL).toBe("${RELAY_DATABASE_URL}");
  });
});

describe("docker-compose.yml — aucun secret en dur", () => {
  it("toutes les valeurs sensibles sont des références ${VAR}", () => {
    const SENSITIVE = /(TOKEN|SECRET|DATABASE_URL|CLIENT_ID)$/;
    for (const [name, svc] of Object.entries(compose.services)) {
      for (const [key, value] of Object.entries(svc.environment ?? {})) {
        if (SENSITIVE.test(key) && !key.endsWith("_PATH")) {
          expect(value, `${name}.${key} doit référencer \${...}, pas une valeur en dur`).toMatch(
            /^\$\{[A-Z_]+\}$/,
          );
        }
      }
    }
  });
});
