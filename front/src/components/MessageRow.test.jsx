import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageRow } from "./MessageRow.jsx";

const base = {
  message_id: "m1",
  channel_id: "c1",
  author_id: "u1",
  author: "alice",
  content: "hello",
  created_at: "2026-06-06T09:05:00.000Z",
  edited_at: null,
};

describe("MessageRow", () => {
  it("affiche auteur et contenu", () => {
    render(<MessageRow message={base} />);
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("tag serveur → chip avec badge à côté du pseudo ; sans tag → rien", () => {
    const { rerender } = render(
      <MessageRow message={base} tag={{ tag: "2077", badgeUrl: "https://cdn.discordapp.com/clan-badges/g/tb.png" }} />
    );
    expect(screen.getByText("2077")).toBeInTheDocument();
    expect(document.querySelector('img[src*="/clan-badges/"]')).toBeTruthy();
    rerender(<MessageRow message={base} tag={null} />);
    expect(screen.queryByText("2077")).not.toBeInTheDocument();
  });

  it("auteur null → fallback sur author_id", () => {
    render(<MessageRow message={{ ...base, author: null }} />);
    expect(screen.getByText("u1")).toBeInTheDocument();
  });

  it("contenu vide → placeholder '(sans contenu)'", () => {
    render(<MessageRow message={{ ...base, content: null }} />);
    expect(screen.getByText("(sans contenu)")).toBeInTheDocument();
  });

  it("edited_at présent → marqueur (modifié)", () => {
    render(<MessageRow message={{ ...base, edited_at: "2026-06-06T09:10:00.000Z" }} />);
    expect(screen.getByText("(modifié)")).toBeInTheDocument();
  });

  // ⚠️ Markdown = LAZY (MarkdownContent) → rendu ASYNC : findByText, jamais getByText.
  it("rend le markdown (gras en <strong>)", async () => {
    render(<MessageRow message={{ ...base, content: "voici du **gras**" }} />);
    const strong = await screen.findByText("gras");
    expect(strong.tagName).toBe("STRONG");
  });

  it("rend le code inline en <code>", async () => {
    render(<MessageRow message={{ ...base, content: "appelle `discordCall`" }} />);
    expect((await screen.findByText("discordCall")).tagName).toBe("CODE");
  });

  it("fallback Suspense = texte BRUT visible immédiatement (jamais de trou pendant le lazy-load)", () => {
    render(<MessageRow message={{ ...base, content: "texte immédiat" }} />);
    // rendu SYNCHRONE du fallback : le contenu est là avant que le chunk markdown n'arrive.
    expect(screen.getByText("texte immédiat")).toBeInTheDocument();
  });

  it("message optimiste (pending) → marqueur 'envoi…'", () => {
    render(<MessageRow message={{ ...base, pending: true }} />);
    expect(screen.getByText("envoi…")).toBeInTheDocument();
  });
});
