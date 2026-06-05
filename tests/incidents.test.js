import { describe, it, expect } from "vitest";
import { createIncidentContext } from "../incidents.js";

describe("incidents — contexte scopé", () => {
  it("add stocke level + message + meta + ts", () => {
    const c = createIncidentContext();
    c.add("error", "boom", { status: 403 });
    const [i] = c.list();
    expect(i.level).toBe("error");
    expect(i.message).toBe("boom");
    expect(i.meta).toEqual({ status: 403 });
    expect(typeof i.ts).toBe("string");
  });

  it("meta absent → null (pas undefined)", () => {
    const c = createIncidentContext();
    c.add("warn", "x");
    expect(c.list()[0].meta).toBe(null);
  });

  it("count reflète le nombre d'incidents", () => {
    const c = createIncidentContext();
    expect(c.count).toBe(0);
    c.add("error", "a");
    c.add("error", "b");
    expect(c.count).toBe(2);
  });

  it("list() renvoie une COPIE (mutation externe sans effet)", () => {
    const c = createIncidentContext();
    c.add("error", "a");
    const l = c.list();
    l.push("intrus");
    expect(c.count).toBe(1);
  });

  it("format() vide = '✅ Aucun incident.'", () => {
    expect(createIncidentContext().format()).toBe("✅ Aucun incident.");
  });

  it("format() liste chaque incident avec son level", () => {
    const c = createIncidentContext();
    c.add("error", "boom");
    c.add("warn", "soft");
    const out = c.format();
    expect(out).toMatch(/Incidents \(2\)/);
    expect(out).toMatch(/\[error\] boom/);
    expect(out).toMatch(/\[warn\] soft/);
  });
});
