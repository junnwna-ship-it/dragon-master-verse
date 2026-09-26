import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadEnv } from "vite";
import { createClient } from "@supabase/supabase-js";

const env = { ...loadEnv("development", process.cwd(), ""), ...process.env };
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const ref = url && new URL(url).hostname.replace(/\.supabase\.co$/, "");
if (!url || !key || !process.argv.includes("--write") || !process.argv.includes(`--project=${ref}`))
  throw new Error("--write, exact --project=<ref>, and Supabase public connection are required.");
for (const field of ["DM01_OWNER_EMAIL", "DM01_OWNER_PASSWORD", "DM01_OTHER_EMAIL", "DM01_OTHER_PASSWORD"])
  if (!env[field]) throw new Error(`${field} is required. Never commit test credentials.`);
if (!/^dm01d-owner-[a-z0-9]+@/i.test(env.DM01_OWNER_EMAIL)
  || !/^dm01d-other-[a-z0-9]+@/i.test(env.DM01_OTHER_EMAIL))
  throw new Error("Only dedicated DM-01-D test accounts are accepted.");

const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const owner = client();
const other = client();
const fresh = client();
const draftId = randomUUID();
let privatePath;
let cardPath;
let dragonId;
const check = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.code || result.error.message}`);
  return result.data;
};
const assert = (condition, label) => {
  if (!condition) throw new Error(label);
};

console.log(JSON.stringify({ project: ref, draftId, phase: "starting" }));
try {
  const ownerUser = check(
    await owner.auth.signInWithPassword({ email: env.DM01_OWNER_EMAIL, password: env.DM01_OWNER_PASSWORD }),
    "owner sign-in",
  ).user;
  const otherUser = check(
    await other.auth.signInWithPassword({ email: env.DM01_OTHER_EMAIL, password: env.DM01_OTHER_PASSWORD }),
    "other sign-in",
  ).user;
  assert(ownerUser.id !== otherUser.id, "Test users must differ.");

  const metadata = {
    step: 3,
    name: "DM01D Test Dragon",
    element: "Fire",
    personality: "curious",
    goal: "grow together",
    origin: "DM-01-D automated storage test",
    appearanceId: "pearl",
    distinctiveFeatures: "test-only drawing",
    selectedImage: "original",
    originalPath: null,
    preparedPath: null,
    cleanedPath: null,
    creationBackend: null,
    creationAttemptedAt: null,
  };
  const save = (expected, value) => owner.rpc("save_dragon_draft", {
    _draft_id: draftId, _expected_revision: expected, _metadata: value,
  });
  let revision = check(await save(0, metadata), "initial draft");
  assert(revision === 1, "Initial revision was not 1.");

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYZkAAAAASUVORK5CYII=",
    "base64",
  );
  privatePath = `${ownerUser.id}/${draftId}/original/${createHash("sha256").update(png).digest("hex")}.png`;
  check(await owner.storage.from("dragon-originals").upload(privatePath, png, {
    contentType: "image/png", upsert: false,
  }), "private drawing upload");
  check(await owner.rpc("register_dragon_asset", {
    _draft_id: draftId, _path: privatePath, _kind: "original",
    _mime_type: "image/png", _byte_size: png.length,
  }), "asset registration");
  metadata.originalPath = privatePath;
  revision = check(await save(revision, metadata), "draft with drawing");

  const secondDevice = check(
    await fresh.auth.signInWithPassword({ email: env.DM01_OWNER_EMAIL, password: env.DM01_OWNER_PASSWORD }),
    "fresh-client sign-in",
  );
  assert(secondDevice.user.id === ownerUser.id, "Fresh client returned a different owner.");
  const restored = check(await fresh.from("dragon_drafts").select("metadata,revision")
    .eq("draft_id", draftId).single(), "fresh-client draft");
  assert(restored.revision === revision && restored.metadata.originalPath === privatePath,
    "Fresh client did not restore the drawing reference.");
  const downloaded = check(await fresh.storage.from("dragon-originals").download(privatePath),
    "fresh-client drawing download");
  assert(Buffer.from(await downloaded.arrayBuffer()).equals(png), "Drawing bytes changed.");
  const otherRows = check(await other.from("dragon_drafts").select("draft_id")
    .eq("draft_id", draftId), "cross-owner draft query");
  assert(otherRows.length === 0, "Another account read the draft.");
  const forbidden = await other.storage.from("dragon-originals").download(privatePath);
  assert(!!forbidden.error, "Another account downloaded the private drawing.");
  const stale = await save(1, metadata);
  assert(stale.error?.message.includes("DRAFT_CONFLICT"), "Stale revision was accepted.");

  const card = await readFile("public/og/story-default.jpg");
  cardPath = `${ownerUser.id}/personal-${draftId}.jpg`;
  check(await owner.storage.from("dragon-images").upload(cardPath, card, {
    contentType: "image/jpeg", upsert: false,
  }), "public card upload");
  const imageUrl = owner.storage.from("dragon-images").getPublicUrl(cardPath).data.publicUrl;
  metadata.creationBackend = "cloud";
  metadata.creationAttemptedAt = Date.now();
  revision = check(await save(revision, metadata), "creation checkpoint");
  const create = () => owner.rpc("create_personal_dragon_v2", {
    _draft_id: draftId, _card_path: cardPath, _image_url: imageUrl,
  });
  dragonId = check(await create(), "dragon creation");
  assert(check(await create(), "idempotent creation") === dragonId,
    "Retry produced another dragon UUID.");
  const [profile, owned, completed] = await Promise.all([
    fresh.from("personal_dragon_profiles").select("dragon_id,draft_id").eq("dragon_id", dragonId).single(),
    fresh.from("owned_dragons").select("dragon_id").eq("dragon_id", dragonId).single(),
    fresh.from("dragon_drafts").select("status,dragon_id").eq("draft_id", draftId).single(),
  ]);
  assert(check(profile, "profile").draft_id === draftId, "Profile lost its draft link.");
  assert(check(owned, "ownership").dragon_id === dragonId, "Dragon ownership missing.");
  assert(check(completed, "completed draft").status === "completed", "Draft not completed.");
  assert(check(await other.from("personal_dragon_profiles").select("dragon_id")
    .eq("dragon_id", dragonId), "cross-owner profile query").length === 0,
  "Another account read the private profile.");
  console.log(JSON.stringify({ phase: "passed", draftId, dragonId, ownerId: ownerUser.id,
    otherId: otherUser.id, privatePath, cardPath,
    checks: ["login", "private upload", "registration", "fresh login and byte restore",
      "cross-owner isolation", "revision conflict", "creation", "idempotent retry"] }));
} catch (error) {
  console.error(JSON.stringify({ phase: "failed", draftId, dragonId, privatePath, cardPath,
    error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
}
