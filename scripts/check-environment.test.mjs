import { describe, expect, it } from "vitest";
import { findLockMismatches, inspectEnvironment } from "./check-environment.mjs";

const client = {
  VITE_SUPABASE_URL: "https://example.invalid",
  VITE_SUPABASE_PUBLISHABLE_KEY: "public-test",
};
const server = { SUPABASE_URL: "https://example.invalid", SUPABASE_PUBLISHABLE_KEY: "public-test" };

describe("redacted local environment inventory", () => {
  it("allows the original drawing path without an optional AI key", () => {
    expect(inspectEnvironment(client, server).ready).toBe(true);
  });
  it("does not mistake VITE_ variables for server authentication configuration", () => {
    expect(inspectEnvironment(client, client).ready).toBe(false);
  });
  it("treats blank values as missing", () => {
    expect(inspectEnvironment(client, { ...server, SUPABASE_URL: "  " }).ready).toBe(false);
  });
  it("flags browser-exposed secrets without returning their values", () => {
    const result = inspectEnvironment(
      { ...client, VITE_OPENAI_API_KEY: "private-test-value" },
      server,
    );
    expect(result.ready).toBe(false);
    expect(JSON.stringify(result)).not.toContain("private-test-value");
  });
  it("finds missing, changed, and stale lock entries", () => {
    expect(
      findLockMismatches(
        { dependencies: { a: "1", b: "2" } },
        {
          packages: { "": { dependencies: { a: "2", c: "3" } } },
        },
      ),
    ).toEqual(["dependencies/a", "dependencies/b", "dependencies/c"]);
  });
  it("accepts matching entries independent of key ordering", () => {
    expect(
      findLockMismatches(
        { dependencies: { a: "1", b: "2" } },
        {
          packages: { "": { dependencies: { b: "2", a: "1" } } },
        },
      ),
    ).toEqual([]);
  });
});
