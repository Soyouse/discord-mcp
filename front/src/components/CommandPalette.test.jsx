/*
 * Tests de la command palette (composant contrôlé) + du raccourci ⌘K (hook).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react";
import { CommandPalette } from "./CommandPalette.jsx";
import { useCommandPalette } from "./useCommandPalette.js";

const conversations = [
  { id: "c1", name: "général", kind: "channel" },
  { id: "c2", name: "automations", kind: "channel" },
  { id: "dm1", name: "waikoz", kind: "dm" },
];

describe("CommandPalette", () => {
  it("ouverte → liste les conversations", () => {
    render(<CommandPalette open onOpenChange={() => {}} conversations={conversations} />);
    expect(screen.getByText("général")).toBeInTheDocument();
    expect(screen.getByText("automations")).toBeInTheDocument();
  });

  it("filtre selon la saisie", () => {
    render(<CommandPalette open onOpenChange={() => {}} conversations={conversations} />);
    fireEvent.change(screen.getByPlaceholderText(/aller à une conversation/i), { target: { value: "auto" } });
    expect(screen.getByText("automations")).toBeInTheDocument();
    expect(screen.queryByText("général")).not.toBeInTheDocument();
  });

  it("sélection → onSelectConversation + fermeture", () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(<CommandPalette open onOpenChange={onOpenChange} conversations={conversations} onSelectConversation={onSelect} />);
    fireEvent.click(screen.getByText("automations"));
    expect(onSelect).toHaveBeenCalledWith(conversations[1]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("fermée → rien affiché", () => {
    render(<CommandPalette open={false} onOpenChange={() => {}} conversations={conversations} />);
    expect(screen.queryByText("général")).not.toBeInTheDocument();
  });
});

describe("useCommandPalette (⌘K / Ctrl+K)", () => {
  it("Ctrl+K bascule open", () => {
    const { result } = renderHook(() => useCommandPalette());
    expect(result.current.open).toBe(false);
    act(() => fireEvent.keyDown(window, { key: "k", ctrlKey: true }));
    expect(result.current.open).toBe(true);
    act(() => fireEvent.keyDown(window, { key: "k", ctrlKey: true }));
    expect(result.current.open).toBe(false);
  });

  it("⌘K (metaKey) bascule aussi", () => {
    const { result } = renderHook(() => useCommandPalette());
    act(() => fireEvent.keyDown(window, { key: "k", metaKey: true }));
    expect(result.current.open).toBe(true);
  });
});
