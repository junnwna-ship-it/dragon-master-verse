import { randomUUID, randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnv } from "vite";
import { createClient } from "@supabase/supabase-js";

export function validateTarget(env, args) {
  const url = new URL(env.SUPABASE_URL || env.VITE_SUPABASE_URL || "https://missing.invalid");
  const ref = url.hostname.replace(/\.supabase\.co$/, "");
  if (url.protocol !== "https:" || !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname)) {
    throw new Error("A hosted Supabase HTTPS project URL is required.");
  }
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error("Supabase publishable key is missing.");
  const write = args.includes("--write");
  if (write && !args.includes(`--project=${ref}`)) {
    throw new Error("Write test requires --project=<exact project reference> confirmation.");
  }
  if (write && !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Write test blocked: server-only SUPABASE_SERVICE_ROLE_KEY is required for test-user creation and cleanup. No writes performed.",
    );
  }
  return { url: url.origin, ref, key, write };
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const fixture = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYZkAAAAASUVORK5CYII=",
  "base64",
);

function requireSuccess(result, operation) {
  if (result.error)
    throw new Error(
      `${operation} failed (${result.error.code || result.error.status || "unknown"}).`,
    );
  return result.data;
}

async function readOnlyProbe(target) {
  // No table rows or secret values are printed, and no RPC is invoked.
  const response = await fetch(`${target.url}/rest/v1/`, {
    headers: {
      apikey: target.key,
      Accept: "application/openapi+json",
      // Legacy anon JWTs need the same bearer header the Supabase SDK adds.
      ...(target.key.startsWith("eyJ") ? { Authorization: `Bearer ${target.key}` } : {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  console.log(`REST schema connection: HTTP ${response.status}`);
  if (!response.ok) throw new Error("Read-only connection check failed.");
  const schema = await response.json();
  const visible = !!schema.paths?.["/rpc/create_personal_dragon"];
  console.log(
    `Personal-dragon RPC in anonymous schema: ${visible ? "visible" : "not visible (not proof of absence for authenticated users)"}`,
  );
  console.log(
    "NOT TESTED: upload, authenticated creation, relogin persistence, RLS, deployed migration history.",
  );
}

async function writeProbe(target, env) {
  const admin = createClient(target.url, env.SUPABASE_SERVICE_ROLE_KEY, options);
  // Preflight before creating any test data. Do not modify bucket configuration.
  const bucket = requireSuccess(await admin.storage.getBucket("dragon-images"), "bucket lookup");
  console.log(
    `Existing dragon-images bucket: ${bucket.public ? "PUBLIC (not suitable for private originals)" : "PRIVATE"}`,
  );
  const run = `dm00-${randomUUID()}`;
  const users = [];
  let ownerId;
  let imagePath;
  let storyId;
  let dragonId;
  let failure;
  let unconfirmedAccount;
  const cleanupFailures = [];
  const client = () => createClient(target.url, target.key, options);
  const clean = async (label, action) => {
    try {
      requireSuccess(await action(), label);
    } catch {
      cleanupFailures.push(label);
    }
  };
  try {
    for (const label of ["owner", "stranger"]) {
      const email = `${run}-${label}@example.com`;
      const password = randomBytes(32).toString("base64url");
      unconfirmedAccount = email;
      const created = requireSuccess(
        await admin.auth.admin.createUser({ email, password, email_confirm: true }),
        "test account creation",
      );
      users.push({ id: created.user.id, email, password });
      unconfirmedAccount = undefined;
      if (label === "owner") ownerId = created.user.id;
    }
    const owner = users[0];
    ownerId = owner.id;
    const actor = client();
    const stranger = client();
    requireSuccess(await actor.auth.signInWithPassword(owner), "owner login");
    requireSuccess(await stranger.auth.signInWithPassword(users[1]), "stranger login");

    imagePath = `${ownerId}/${run}.png`;
    requireSuccess(
      await actor.storage
        .from("dragon-images")
        .upload(imagePath, fixture, { contentType: "image/png", upsert: false }),
      "test image upload",
    );
    const imageUrl = actor.storage.from("dragon-images").getPublicUrl(imagePath).data.publicUrl;
    // Same RPC and fields as the current app; no direct administrative insert.
    dragonId = requireSuccess(
      await actor.rpc("create_personal_dragon", {
        _name: run.slice(0, 24),
        _element: "Earth",
        _image_url: imageUrl,
        _lore: run,
        _max_hp: 1750,
        _mp: 900,
        _atk: 1200,
        _def: 1550,
      }),
      "create_personal_dragon",
    );
    const owned = requireSuccess(
      await actor
        .from("owned_dragons")
        .select("id")
        .eq("user_id", ownerId)
        .eq("dragon_id", dragonId),
      "ownership read",
    );
    if (owned.length !== 1) throw new Error("Created dragon must have exactly one ownership row.");

    const story = requireSuccess(
      await actor
        .from("user_stories")
        .insert({
          user_id: ownerId,
          title: run,
          body: "Storage verification fixture",
          is_published: false,
        })
        .select("id")
        .single(),
      "private test story creation",
    );
    storyId = story.id;
    requireSuccess(
      await actor.from("ugc_story_progress").upsert(
        {
          user_id: ownerId,
          story_id: storyId,
          node_key: "Node_1",
          finished: false,
          stats: { courage: 1 },
          picked: null,
          quiz_result: null,
        },
        { onConflict: "user_id,story_id" },
      ),
      "story progress save",
    );

    requireSuccess(await actor.auth.signOut({ scope: "local" }), "test-account logout");
    const fresh = client();
    requireSuccess(await fresh.auth.signInWithPassword(owner), "fresh-client relogin");
    const saved = requireSuccess(
      await fresh.from("dragons").select("id,name,image_url,lore").eq("id", dragonId).single(),
      "dragon after relogin",
    );
    if (saved.image_url !== imageUrl || saved.lore !== run)
      throw new Error("Dragon data did not survive relogin.");
    const image = requireSuccess(
      await fresh.storage.from("dragon-images").download(imagePath),
      "image after relogin",
    );
    if (!Buffer.from(await image.arrayBuffer()).equals(fixture))
      throw new Error("Stored image bytes changed.");
    const progress = requireSuccess(
      await fresh
        .from("ugc_story_progress")
        .select("node_key,stats")
        .eq("user_id", ownerId)
        .eq("story_id", storyId)
        .single(),
      "progress after relogin",
    );
    if (progress.node_key !== "Node_1" || progress.stats?.courage !== 1)
      throw new Error("Story progress did not survive relogin.");

    for (const [table, column, value] of [
      ["owned_dragons", "dragon_id", dragonId],
      ["ugc_story_progress", "story_id", storyId],
    ]) {
      const other = requireSuccess(
        await stranger.from(table).select("user_id").eq("user_id", ownerId).eq(column, value),
        "non-owner read check",
      );
      if (other.length !== 0) throw new Error(`RLS failure: non-owner can read ${table}.`);
    }
    // Attempt to change only the synthetic test object; verify the original bytes.
    const overwrite = await stranger.storage
      .from("dragon-images")
      .update(imagePath, fixture, { contentType: "image/png" });
    if (!overwrite.error) throw new Error("RLS failure: non-owner can update the test image.");
    console.log(
      "PASS: upload, RPC creation, ownership, private story progress, fresh-client relogin, byte integrity, cross-user read isolation and image write denial.",
    );
    console.log(
      "NOT TESTED: camera, UI flow, reward replay, private-original storage, dragon/version-specific UGC progress, AI.",
    );
  } catch (error) {
    failure = error;
  } finally {
    // A lost account-creation response cannot safely establish the new account ID.
    // Retain the run marker for manual reconciliation; never scan/delete existing users.
    if (unconfirmedAccount)
      cleanupFailures.push(`unconfirmed test account creation: ${unconfirmedAccount}`);
    // Recover story IDs too, in case insertion succeeded but its response was lost.
    if (ownerId) {
      try {
        const stories = requireSuccess(
          await admin.from("user_stories").select("id").eq("user_id", ownerId).eq("title", run),
          "test story discovery",
        );
        for (const story of stories) {
          await clean("test story progress cleanup", () =>
            admin
              .from("ugc_story_progress")
              .delete()
              .eq("user_id", ownerId)
              .eq("story_id", story.id),
          );
          await clean("test story cleanup", () =>
            admin
              .from("user_stories")
              .delete()
              .eq("id", story.id)
              .eq("user_id", ownerId)
              .eq("title", run),
          );
        }
      } catch {
        cleanupFailures.push("test story discovery");
      }
    }
    // Recover the RPC result when its response was lost; filter by this new owner AND nonce.
    if (ownerId) {
      try {
        const rows = requireSuccess(
          await admin.from("dragons").select("id").eq("created_by", ownerId).eq("lore", run),
          "test dragon discovery",
        );
        for (const row of rows) {
          await clean("test ownership cleanup", () =>
            admin.from("owned_dragons").delete().eq("user_id", ownerId).eq("dragon_id", row.id),
          );
          await clean("test dragon cleanup", () =>
            admin.from("dragons").delete().eq("id", row.id).eq("created_by", ownerId),
          );
        }
      } catch {
        cleanupFailures.push("test dragon discovery");
      }
    }
    if (imagePath)
      await clean("test image cleanup", () =>
        admin.storage.from("dragon-images").remove([imagePath]),
      );
    // Retain test users if their data needs manual cleanup; never lose ownership references.
    if (!cleanupFailures.length) {
      for (const user of users)
        await clean("test account cleanup", () => admin.auth.admin.deleteUser(user.id));
    }
    if (cleanupFailures.length) {
      console.error(
        `CLEANUP INCOMPLETE: ${cleanupFailures.join(", ")}. Run marker: ${run}. Test user IDs: ${users.map((user) => user.id).join(", ")}`,
      );
    } else console.log("Cleanup completed for the test objects/accounts created by this run.");
  }
  if (failure) throw failure;
  if (cleanupFailures.length)
    throw new Error("Storage test is not complete until cleanup succeeds.");
}

export async function main(
  args = process.argv.slice(2),
  env = { ...loadEnv("development", process.cwd(), ""), ...process.env },
) {
  const target = validateTarget(env, args);
  console.log(
    `Target project: ${target.ref}; mode: ${target.write ? "scoped write + cleanup" : "read-only"}`,
  );
  if (target.write) await writeProbe(target, env);
  else await readOnlyProbe(target);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    // SDK error objects may include request details; print only our safe messages.
    console.error(error instanceof Error ? error.message : "Storage verification failed.");
    process.exitCode = 1;
  });
}
