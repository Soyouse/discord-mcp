import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageRow } from "./MessageRow.jsx";

const base = {
  message_id: "m1",
  channel_id: "c1",
  author_id: "u1",
  author: "soyouse",
  content: "hello",
  created_at: "2026-06-06T09:05:00.000Z",
  edited_at: null,
};

describe("MessageRow", () => {
  it("affiche auteur et contenu", () => {
    render(<MessageRow message={base} />);
    expect(screen.getByText("soyouse")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
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
});
