import { describe, expect, it } from "vitest";
import { validateTarget } from "./verify-storage.mjs";

const env = {
  SUPABASE_URL: "https://testproject.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "public-fixture",
};
describe("storage verification safety gates", () => {
  it("defaults to read-only without administrative credentials", () => {
    expect(validateTarget(env, []).write).toBe(false);
  });
  it("requires an exact project confirmation for writes", () => {
    expect(() => validateTarget(env, ["--write", "--project=other"])).toThrow("confirmation");
  });
  it("fails before writes when cleanup credentials are unavailable", () => {
    expect(() => validateTarget(env, ["--write", "--project=testproject"])).toThrow(
      "No writes performed",
    );
  });
  it("allows the explicit target only with cleanup credentials", () => {
    expect(
      validateTarget({ ...env, SUPABASE_SERVICE_ROLE_KEY: "secret-fixture" }, [
        "--write",
        "--project=testproject",
      ]).write,
    ).toBe(true);
  });
  it("rejects untrusted targets and plaintext transport", () => {
    expect(() =>
      validateTarget(
        { ...env, SUPABASE_URL: "https://testproject.supabase.co.attacker.invalid" },
        [],
      ),
    ).toThrow("HTTPS project URL");
    expect(() =>
      validateTarget({ ...env, SUPABASE_URL: "http://testproject.supabase.co" }, []),
    ).toThrow("HTTPS project URL");
  });
});
