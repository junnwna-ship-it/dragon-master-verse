import { describe, expect, it, vi } from "vitest";
import { inspectConnection, validateTarget } from "./verify-storage.mjs";

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

describe("read-only connection checks", () => {
  const target = { url: env.SUPABASE_URL, key: "eyJ.legacy-fixture.signature" };
  function healthyFetch() {
    return vi.fn(async (url) => {
      if (url.endsWith("/auth/v1/settings")) return Response.json({ external: {} });
      if (url.endsWith("/rest/v1/dragons?select=id&limit=0")) return Response.json([]);
      return Response.json({ message: "Invalid API key" }, { status: 401 });
    });
  }

  it("passes real endpoints without requesting the restricted OpenAPI root", async () => {
    const fetcher = healthyFetch();
    expect((await inspectConnection(target, fetcher)).ok).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [url, options] of fetcher.mock.calls) {
      expect(url).not.toBe(`${target.url}/rest/v1/`);
      expect(options.method).toBeUndefined(); // default GET, no mutation
      expect(options.body).toBeUndefined();
      expect(options.headers.apikey).toBe(target.key);
      expect(options.headers.Authorization).toBe(`Bearer ${target.key}`);
    }
  });

  it("does not send a publishable key as a bearer JWT", async () => {
    const fetcher = healthyFetch();
    expect(
      (await inspectConnection({ ...target, key: "sb_publishable_fixture" }, fetcher)).ok,
    ).toBe(true);
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("still fails when both endpoints reject the key", async () => {
    const result = await inspectConnection(target, async () =>
      Response.json({ message: "Invalid API key" }, { status: 401 }),
    );
    expect(result).toEqual({
      auth: { status: 401, ok: false },
      database: { status: 401, ok: false },
      ok: false,
    });
  });

  it("distinguishes database permission failures from Auth success", async () => {
    const result = await inspectConnection(target, async (url) =>
      url.endsWith("/settings")
        ? Response.json({ external: {} })
        : Response.json({ code: "42501" }, { status: 403 }),
    );
    expect(result.auth.ok).toBe(true);
    expect(result.database).toEqual({ status: 403, ok: false });
    expect(result.ok).toBe(false);
  });

  it("rejects HTTP 200 responses that are not expected API data", async () => {
    expect(
      (await inspectConnection(target, async () => new Response("<html>proxy</html>"))).ok,
    ).toBe(false);
    expect((await inspectConnection(target, async () => Response.json({}))).ok).toBe(false);
  });

  it("does not include response bodies or accidentally returned rows in diagnostics", async () => {
    const result = await inspectConnection(target, async () =>
      Response.json([{ id: "private-fixture" }]),
    );
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("private-fixture");
  });

  it("sanitizes network errors and does not mark them as success", async () => {
    const result = await inspectConnection(target, async () => {
      throw new Error("sensitive-request-details");
    });
    expect(result.auth).toEqual({ status: null, ok: false });
    expect(result.database).toEqual({ status: null, ok: false });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("sensitive-request-details");
  });
});
