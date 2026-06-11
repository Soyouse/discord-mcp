// Setup des tests COMPOSANTS (projet "dom" uniquement) : matchers DOM + cleanup auto + MSW.
// ⚠️ Les tests purs (*.test.js, projet "pure"/node) ne passent PAS ici — endpoints.test.js installe MSW lui-même.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { installMsw } from "./mocks/msw-lifecycle.js";

// Polyfills jsdom pour cmdk (command palette) : APIs DOM absentes de jsdom.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.Element.prototype.scrollIntoView ??= () => {};

installMsw();
afterEach(() => cleanup());
