import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseEnv } from "node:util";
import { loadEnv } from "vite";

// Only statuses and fixed key names leave this checker; never print values.
export function inspectEnvironment(clientEnv, serverEnv) {
  const present = (env, name) => typeof env[name] === "string" && env[name].trim().length > 0;
  const checks = [
    { name: "client Supabase URL", ok: present(clientEnv, "VITE_SUPABASE_URL") },
    {
      name: "client Supabase publishable key",
      ok: present(clientEnv, "VITE_SUPABASE_PUBLISHABLE_KEY"),
    },
    { name: "server Supabase URL", ok: present(serverEnv, "SUPABASE_URL") },
    { name: "server Supabase publishable key", ok: present(serverEnv, "SUPABASE_PUBLISHABLE_KEY") },
    { name: "optional AI key", ok: present(serverEnv, "OPENAI_API_KEY"), optional: true },
  ];
  const exposed = Object.keys(clientEnv).filter(
    (name) =>
      name.startsWith("VITE_") &&
      /(?:OPENAI_API_KEY|SERVICE_ROLE|SECRET)/i.test(name) &&
      present(clientEnv, name),
  );
  return {
    checks,
    exposed,
    ready: checks.every((check) => check.optional || check.ok) && exposed.length === 0,
  };
}

export function findLockMismatches(manifest, lock) {
  const mismatches = [];
  for (const group of ["dependencies", "devDependencies"]) {
    const expected = manifest[group] ?? {};
    const actual = lock.packages?.[""]?.[group] ?? {};
    for (const name of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
      if (expected[name] !== actual[name]) mismatches.push(`${group}/${name}`);
    }
  }
  return mismatches;
}

export function main(args = process.argv.slice(2)) {
  const mode = args[0] ?? "development";
  if (!["development", "production"].includes(mode)) {
    console.error("Usage: npm run check:environment -- [development|production]");
    return 1;
  }
  const root = process.cwd();
  const env = { ...loadEnv(mode, root, ""), ...process.env };
  // Wrangler reads .dev.vars separately; presence here is not proof that Vite's
  // dev server or a deployed Worker received these variables.
  let workerEnv = {};
  try {
    workerEnv = parseEnv(readFileSync(resolve(root, ".dev.vars"), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const result = inspectEnvironment(env, env);
  console.log(`Local environment inventory (${mode}); values redacted; no network or writes.`);
  for (const check of result.checks) {
    console.log(
      `${check.ok ? "PRESENT" : check.optional ? "OPTIONAL MISSING" : "MISSING"}: ${check.name}`,
    );
  }
  if (Object.keys(workerEnv).length) {
    const worker = inspectEnvironment(env, workerEnv);
    console.log("Separate .dev.vars inventory (Worker only; runtime loading unverified):");
    for (const check of worker.checks.filter((item) => !item.name.startsWith("client"))) {
      console.log(`${check.ok ? "PRESENT" : "MISSING"}: ${check.name}`);
    }
  }
  if (result.exposed.length)
    console.error("UNSAFE: server-only secret variable found with VITE_ prefix.");
  const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
  const mismatches = findLockMismatches(manifest, lock);
  console.log(
    mismatches.length
      ? `LOCK MISMATCH: ${mismatches.join(", ")}`
      : "LOCK: manifest entries match (run npm ci to validate full resolution).",
  );
  console.log(
    "UNVERIFIED: deployed secrets, account model access, DB migrations, RLS, upload/relogin persistence.",
  );
  return result.ready && mismatches.length === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.exitCode = main();
  } catch {
    console.error(
      "Environment check failed; check local files and permissions. No secret values printed.",
    );
    process.exitCode = 1;
  }
}
