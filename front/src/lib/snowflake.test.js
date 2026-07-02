import { describe, it, expect } from "vitest";
import { snowflakeToDate } from "./snowflake.js";

// Snowflake CONSTRUIT depuis un instant connu (déterministe) : ms depuis l'epoch Discord << 22.
const DISCORD_EPOCH_MS = 1420070400000n;
const fromIso = (iso) => ((BigInt(new Date(iso).getTime()) - DISCORD_EPOCH_MS) << 22n).toString();

describe("snowflakeToDate", () => {
  it("décode le timestamp encodé (bits 22+, epoch Discord 2015-01-01)", () => {
    expect(snowflakeToDate(fromIso("2020-01-01T00:00:00.000Z")).toISOString()).toBe("2020-01-01T00:00:00.000Z");
    expect(snowflakeToDate(fromIso("2026-06-11T12:34:56.000Z")).toISOString()).toBe("2026-06-11T12:34:56.000Z");
  });

  it("ID fixture du bot Echidna → date plausible (création 2026)", () => {
    expect(snowflakeToDate("1461147874099200000").getUTCFullYear()).toBe(2026);
  });

  it("entrée invalide → null, JAMAIS de throw (IDs mock 'c1'/'u1' traversent l'UI)", () => {
    expect(snowflakeToDate(null)).toBeNull();
    expect(snowflakeToDate(undefined)).toBeNull();
    expect(snowflakeToDate("c1")).toBeNull();
    expect(snowflakeToDate("123")).toBeNull(); // trop court pour un snowflake
    expect(snowflakeToDate("12345678901234567x")).toBeNull();
  });
});
