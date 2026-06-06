import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BotRail } from "./BotRail.jsx";

const bots = [{ id: "echidna", name: "Echidna" }, { id: "second", name: "Worker" }];

describe("BotRail", () => {
  it("rend une pastille par bot (initiale du nom)", () => {
    render(<BotRail bots={bots} activeId="echidna" />);
    expect(screen.getByTitle("Echidna")).toHaveTextContent("E");
    expect(screen.getByTitle("Worker")).toHaveTextContent("W");
  });

  it("clic → onSelect(id)", () => {
    const onSelect = vi.fn();
    render(<BotRail bots={bots} activeId="echidna" onSelect={onSelect} />);
    fireEvent.click(screen.getByTitle("Worker"));
    expect(onSelect).toHaveBeenCalledWith("second");
  });

  it("le bot actif porte aria-current", () => {
    render(<BotRail bots={bots} activeId="echidna" />);
    expect(screen.getByTitle("Echidna")).toHaveAttribute("aria-current", "true");
    expect(screen.getByTitle("Worker")).not.toHaveAttribute("aria-current");
  });
});
