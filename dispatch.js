/**
 * Dispatch central — registry auto + contexte SCOPÉ + chaîne middleware composable.
 *
 * ⚠️ server.js délègue ici (logique testable sans démarrer le transport stdio).
 * Trois améliorations vs prospection-mcp :
 *   1. Registry auto-découvert (pas de HANDLER_MAP manuel)
 *   2. Contexte incidents scopé par appel (multi-user safe)
 *   3. Couture middleware : auth / rate-log / metrics se branchent ici SANS toucher les handlers
 */
import { loadRegistry } from "./lib/registry.js";
import { createIncidentContext } from "./incidents.js";

// Chaîne middleware composable. Chaque middleware : (next) => async (args, ctx) => result.
// Vide pour l'instant — la COUTURE existe (prêt à scaler sans réécriture).
const MIDDLEWARE = [];

function compose(handle) {
  return MIDDLEWARE.reduceRight((next, mw) => mw(next), handle);
}

export async function handleTool(name, args) {
  const registry = await loadRegistry();
  const tool = registry.get(name);
  if (!tool) throw new Error(`Outil inconnu : ${name}`);

  const ctx = { incidents: createIncidentContext() }; // ⚠️ scopé par appel — JAMAIS global
  const run = compose(tool.handle);
  try {
    const result = await run(args ?? {}, ctx);
    return `${result}\n\n${ctx.incidents.format()}`;
  } catch (e) {
    // incidents collectés avant le throw restent visibles
    e.message = `${e.message}\n\n${ctx.incidents.format()}`;
    throw e;
  }
}

export async function listTools() {
  const registry = await loadRegistry();
  return [...registry.values()].map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}
