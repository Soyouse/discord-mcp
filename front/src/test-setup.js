// Setup global des tests composants : matchers DOM + cleanup auto + MSW (mock réseau /api/*).
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, afterAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./mocks/server.js";
import { reset } from "./mocks/data.js";

// Polyfills jsdom pour cmdk (command palette) : APIs DOM absentes de jsdom.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.Element.prototype.scrollIntoView ??= () => {};

// ⚠️ error → un appel /api/* non mocké FAIT ÉCHOUER le test (pas de trou silencieux).
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  reset(); // état mock réinitialisé entre tests → isolation
});
afterAll(() => server.close());
