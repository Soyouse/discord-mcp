import { describe, it, expect } from "vitest";
import { extractBearer, checkBearer } from "../lib/http-auth.js";

describe("extractBearer", () => {
  it("extrait le token après 'Bearer '", () => {
    expect(extractBearer("Bearer abc123")).toBe("abc123");
  });
  it("'' si pas de préfixe Bearer", () => {
    expect(extractBearer("abc123")).toBe("");
    expect(extractBearer("Basic xyz")).toBe("");
  });
  it("'' si header absent", () => {
    expect(extractBearer(undefined)).toBe("");
    expect(extractBearer(null)).toBe("");
  });
});

describe("checkBearer (constant-time)", () => {
  it("true si le token correspond exactement", () => {
    expect(checkBearer("Bearer s3cr3t", "s3cr3t")).toBe(true);
  });
  it("false si le token diffère", () => {
    expect(checkBearer("Bearer wrong", "s3cr3t")).toBe(false);
  });
  it("false si longueurs différentes (pas de throw timingSafeEqual)", () => {
    expect(checkBearer("Bearer s3", "s3cr3t")).toBe(false);
  });
  it("false si expected vide (serveur sans token = fermé)", () => {
    expect(checkBearer("Bearer x", "")).toBe(false);
    expect(checkBearer("Bearer x", undefined)).toBe(false);
  });
  it("false si header sans Bearer", () => {
    expect(checkBearer("s3cr3t", "s3cr3t")).toBe(false);
  });
});
