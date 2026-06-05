import { describe, it, expect } from "vitest";
import { handleTool, listTools } from "../dispatch.js";
import { createIncidentContext } from "../incidents.js";

describe("auto-registration", () => {
  it("découvre discord_call et discord_discover sans mapping manuel", async () => {
    const tools = await listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toContain("discord_call");
    expect(names).toContain("discord_discover");
  });

  it("chaque outil expose un inputSchema objet", async () => {
    const tools = await listTools();
    for (const t of tools) {
      expect(t.inputSchema.type).toBe("object");
      expect(typeof t.description).toBe("string");
    }
  });
});

describe("dispatch", () => {
  it("throw sur outil inconnu", async () => {
    await expect(handleTool("nope", {})).rejects.toThrow(/inconnu/i);
  });

  it("append la section incidents à l'output (discover sans erreur)", async () => {
    const out = await handleTool("discord_discover", {});
    expect(out).toMatch(/categories/);
    expect(out).toMatch(/Aucun incident/);
  });
});

describe("incidents scopé par appel (multi-user safe)", () => {
  it("deux contextes ne partagent JAMAIS leur état", () => {
    const a = createIncidentContext();
    const b = createIncidentContext();
    a.add("error", "boom A");
    expect(a.count).toBe(1);
    expect(b.count).toBe(0); // ⚠️ régression multi-user si ça casse
  });
});
