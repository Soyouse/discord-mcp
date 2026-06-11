/*
 * Cycle de vie MSW partagé (setup DOM global + tests node qui font du réseau, ex. endpoints.test.js).
 * ⚠️ onUnhandledRequest:"error" → un appel /api/* non mocké FAIT ÉCHOUER le test (pas de trou silencieux).
 * ⚠️ reset() entre tests = isolation du jeu de données mock. NE PAS retirer.
 */
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server.js";
import { reset } from "./data.js";

export function installMsw() {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    reset();
  });
  afterAll(() => server.close());
}
