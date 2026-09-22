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

// ⚠️ Scelle une panne VÉCUE (22/09/2026) : l'IP de bind et les hôtes autorisés étaient écrits EN DUR avec
//    des valeurs de FAÇADE (`100.64.0.1`, `your-node.tailxxxxx.ts.net`, dépôt anonymisé). Le déploiement du
//    16/09 les a portées sur le VPS : MCP + front-door à l'écoute d'une adresse qui n'existe sur aucune
//    interface ⇒ `unhealthy`, MCP en 502, pendant que le `.env` du VPS portait déjà les VRAIES valeurs.
//    ⇒ Toute valeur PROPRE À LA MACHINE vient de `.env`, en forme FAIL-CLOSED `${VAR:?…}` (compose refuse
//    de démarrer si elle manque — jamais une valeur par défaut qui ressemble à une vraie).
const MACHINE = /^\$\{[A-Z_]+:\?[^}]+\}$/;
const front = await readFile(join(here, "..", "front", "nginx.conf"), "utf8");
const frontDockerfile = await readFile(join(here, "..", "front", "Dockerfile"), "utf8");

describe("docker-compose.yml — aucune valeur PROPRE À LA MACHINE en dur", () => {
  it("discord-mcp : IP de bind et hôtes autorisés lus dans .env, fail-closed", () => {
    const mcp = compose.services["discord-mcp"];
    expect(mcp.environment.DISCORD_MCP_HTTP_HOST).toMatch(MACHINE);
    expect(mcp.environment.DISCORD_MCP_ALLOWED_HOSTS).toMatch(MACHINE);
  });

  it("le healthcheck vise l'IP RÉELLE du conteneur, jamais un littéral", () => {
    const test = compose.services["discord-mcp"].healthcheck.test.join(" ");
    expect(test).toContain("process.env.DISCORD_MCP_HTTP_HOST");
    expect(test).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  });

  it("discord-web-front : l'IP de bind nginx vient de .env (gabarit nginx), jamais écrite dans nginx.conf", () => {
    expect(compose.services["discord-web-front"].environment.BIND_IP).toMatch(MACHINE);
    expect(front).toMatch(/listen \$\{BIND_IP\}:8790;/);
    expect(front).not.toMatch(/listen \d+\.\d+\.\d+\.\d+/);
    // Le gabarit n'est substitué au démarrage QUE s'il vit dans /etc/nginx/templates (image nginx officielle).
    expect(frontDockerfile).toMatch(/COPY nginx\.conf \/etc\/nginx\/templates\/[\w.-]+\.conf\.template/);
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
