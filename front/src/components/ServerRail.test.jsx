import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ServerRail } from "./ServerRail.jsx";

const guilds = [
  { guild_id: "g1", name: "WebZenon · Automations", icon: null },
  { guild_id: "g2", name: "Autre serveur", icon: "abc123" },
];

describe("ServerRail", () => {
  it("affiche une pastille par serveur — initiale si pas d'icône, image CDN sinon", () => {
    render(<ServerRail guilds={guilds} />);
    expect(screen.getByText("W")).toBeInTheDocument(); // g1 sans icône → initiale
    expect(screen.getByAltText("Autre serveur")).toHaveAttribute(
      "src",
      "https://cdn.discordapp.com/icons/g2/abc123.png?size=96"
    );
  });

  it("clic → onSelect(guild_id)", () => {
    const onSelect = vi.fn();
    render(<ServerRail guilds={guilds} onSelect={onSelect} />);
    fireEvent.click(screen.getByTitle("Autre serveur"));
    expect(onSelect).toHaveBeenCalledWith("g2");
  });

  it("serveur actif → aria-current", () => {
    render(<ServerRail guilds={guilds} activeId="g1" />);
    expect(screen.getByTitle("WebZenon · Automations")).toHaveAttribute("aria-current", "true");
  });
});
