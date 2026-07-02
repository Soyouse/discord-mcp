import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConversationList } from "./ConversationList.jsx";

const items = [
  { id: "c1", name: "général", kind: "channel" },
  { id: "dm1", name: "alice", kind: "dm" },
];

describe("ConversationList", () => {
  it("liste vide → message d'état vide", () => {
    render(<ConversationList items={[]} />);
    expect(screen.getByText("Aucune conversation")).toBeInTheDocument();
  });

  it("affiche les entrées et appelle onSelect au clic", () => {
    const onSelect = vi.fn();
    render(<ConversationList items={items} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("général"));
    expect(onSelect).toHaveBeenCalledWith(items[0]);
  });

  it("surligne l'entrée active (aria-current)", () => {
    render(<ConversationList items={items} activeId="dm1" />);
    const active = screen.getByText("alice").closest("button");
    expect(active).toHaveAttribute("aria-current", "true");
  });
});
