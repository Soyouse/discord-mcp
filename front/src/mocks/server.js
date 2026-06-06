// Server MSW pour les TESTS (node) — intercepte fetch côté vitest.
import { setupServer } from "msw/node";
import { handlers } from "./handlers.js";

export const server = setupServer(...handlers);
