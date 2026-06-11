/*
 * Tests jsdom du DÉCLENCHEUR « charger plus ancien » (handleScroll) — la seule logique de MessageList
 * assertable en jsdom (le rendu virtualisé mesure 0 → prouvé par E2E, cf doctrine web-front.md).
 * ⚠️ Edge cases scellés : pas de fetch si hasMore=false, si déjà en cours, ou si le scroll n'est pas
 *    proche du haut — sinon cascade de fetchs / fetch infini en fin d'historique.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MessageList } from "./MessageList.jsx";

const m = (id) => ({
  message_id: id,
  channel_id: "c1",
  author_id: "u1",
  author: "Echidna",
  content: id,
  created_at: "2026-06-06T09:00:00.000Z",
  edited_at: null,
});

const scrollAt = (top) => {
  const el = screen.getByTestId("message-scroll");
  Object.defineProperty(el, "scrollTop", { value: top, configurable: true });
  fireEvent.scroll(el);
};

describe("MessageList — déclencheur charger-plus-ancien", () => {
  it("scroll proche du haut + hasMore → onLoadOlder appelé", () => {
    const onLoadOlder = vi.fn();
    render(<MessageList messages={[m("a")]} onLoadOlder={onLoadOlder} hasMore />);
    scrollAt(0);
    expect(onLoadOlder).toHaveBeenCalledTimes(1);
  });

  it("hasMore=false (fin d'historique) → JAMAIS de fetch", () => {
    const onLoadOlder = vi.fn();
    render(<MessageList messages={[m("a")]} onLoadOlder={onLoadOlder} hasMore={false} />);
    scrollAt(0);
    expect(onLoadOlder).not.toHaveBeenCalled();
  });

  it("chargement déjà en cours → pas de fetch doublé + indicateur visible", () => {
    const onLoadOlder = vi.fn();
    render(<MessageList messages={[m("a")]} onLoadOlder={onLoadOlder} hasMore isLoadingOlder />);
    scrollAt(0);
    expect(onLoadOlder).not.toHaveBeenCalled();
    expect(screen.getByText("Chargement des messages précédents…")).toBeInTheDocument();
  });

  it("scroll LOIN du haut → pas de fetch (seuil)", () => {
    const onLoadOlder = vi.fn();
    render(<MessageList messages={[m("a")]} onLoadOlder={onLoadOlder} hasMore />);
    scrollAt(500);
    expect(onLoadOlder).not.toHaveBeenCalled();
  });

  it("onLoadOlder absent (tests/usage dégradé) → scroll sans crash", () => {
    render(<MessageList messages={[m("a")]} hasMore />);
    expect(() => scrollAt(0)).not.toThrow();
  });
});
