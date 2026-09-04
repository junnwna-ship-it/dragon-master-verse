/**
 * Integration test: dragon ownership enforcement.
 *
 * Verifies that every dragon-mutating RPC rejects a dragon the caller does
 * not own (`DRAGON_NOT_OWNED`), while the real owner is never blocked by the
 * ownership gate.
 *
 * Covered RPCs:
 *   spend_stat_point, train_stat_with_gold, purchase_shop_item,
 *   bond_with_dragon, claim_story_reward, award_battle_reward
 *
 * Usage:  bun run scripts/test-dragon-ownership.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY!;
if (!SUPABASE_URL || !SERVICE_ROLE || !ANON) {
  throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_PUBLISHABLE_KEY required");
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stamp = Date.now();
const PASSWORD = `Test!${stamp}aA`;

type Call = { name: string; args: Record<string, unknown> };

function calls(dragonUuid: string): Call[] {
  return [
    { name: "spend_stat_point", args: { _dragon_uuid: dragonUuid, _stat: "atk" } },
    { name: "train_stat_with_gold", args: { _dragon_uuid: dragonUuid, _stat_code: "atk" } },
    { name: "purchase_shop_item", args: { _item_key: "exp_potion", _dragon_uuid: dragonUuid } },
    { name: "bond_with_dragon", args: { _dragon_uuid: dragonUuid } },
    {
      name: "claim_story_reward",
      args: { _chapter_id: `ownership_test_${stamp}`, _node_key: "Node_1", _dragon_uuid: dragonUuid },
    },
    { name: "award_battle_reward", args: { _outcome: "win", _dragon_uuid: dragonUuid } },
  ];
}

async function makeUser(label: string) {
  const email = `ownership_${label}_${stamp}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  const userId = data.user!.id;

  const client = createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { userId, client };
}

async function rpcError(client: SupabaseClient, call: Call): Promise<string> {
  const { error } = await (client.rpc as any)(call.name, call.args);
  return error?.message ?? "";
}

async function main() {
  const failures: string[] = [];
  const owner = await makeUser("owner");
  const stranger = await makeUser("stranger");

  // A non-seed dragon authored by the owner. Seed dragons are usable by all,
  // so ownership can only be exercised with a user-authored dragon.
  const { data: dragon, error: dragonErr } = await admin
    .from("dragons")
    .insert({
      name: `OwnershipProbe_${stamp}`,
      element: "Fire",
      max_hp: 100,
      mp: 30,
      atk: 20,
      def: 10,
      is_seed: false,
      created_by: owner.userId,
    })
    .select("id")
    .single();
  if (dragonErr) throw dragonErr;
  const dragonUuid = (dragon as { id: string }).id;
  console.log(`▶ dragon=${dragonUuid} owner=${owner.userId} stranger=${stranger.userId}`);

  // Give the owner resources so the ownership gate is not masked by
  // "not enough gold" / "no bonding token" before it is reached.
  await admin.from("profiles").upsert({ user_id: owner.userId }, { onConflict: "user_id" });
  await (admin.rpc as any)("credit_gold_from_purchase", {
    _user_id: owner.userId,
    _txn_id: `ownership_test_${stamp}`,
    _gold: 5000,
    _env: "sandbox",
  });
  await admin
    .from("user_inventory")
    .upsert(
      { user_id: owner.userId, item_key: "bonding_token", quantity: 5 },
      { onConflict: "user_id,item_key" },
    );

  // Open the shop/training gates and seed the data these RPCs need, so a
  // "shop is closed" / "unknown stat" error cannot mask the ownership check.
  const { data: prevSettings } = await admin
    .from("app_settings")
    .select("key, value")
    .in("key", ["isShopOpen", "isTrainingOpen"]);
  await admin
    .from("app_settings")
    .upsert(
      [
        { key: "isShopOpen", value: true },
        { key: "isTrainingOpen", value: true },
      ],
      { onConflict: "key" },
    );

  const statName = `OwnershipProbeStat_${stamp}`;
  const { data: statRow } = await admin
    .from("training_stats")
    .insert({
      stat_name: statName,
      stat_code: "atk",
      base_cost: 100,
      stat_increase: 5,
      is_published: true,
    })
    .select("id")
    .single();

  const chapterId = `ownership_test_${stamp}`;
  const { data: nodeRow } = await admin
    .from("story_nodes")
    .insert({
      chapter_id: chapterId,
      node_key: "Node_1",
      stage_number: 1,
      node_type: "scene",
      title: "Ownership probe",
      is_published: true,
      rewards: { stat_points: 1 },
    })
    .select("id")
    .single();

  // Owner needs at least one stat point for spend_stat_point to reach the gate.
  await admin
    .from("owned_dragons")
    .upsert(
      { user_id: owner.userId, dragon_id: dragonUuid, stat_points: 3 },
      { onConflict: "user_id,dragon_id" },
    );

  const teardown = async () => {
    if (statRow) await admin.from("training_stats").delete().eq("id", (statRow as { id: string }).id);
    if (nodeRow) await admin.from("story_nodes").delete().eq("id", (nodeRow as { id: string }).id);
    await admin.from("story_reward_claims").delete().eq("chapter_id", chapterId);
    if (prevSettings?.length) {
      await admin.from("app_settings").upsert(prevSettings as never, { onConflict: "key" });
    }
  };


  console.log("\n── non-owner must be rejected with DRAGON_NOT_OWNED");
  for (const call of calls(dragonUuid)) {
    const msg = await rpcError(stranger.client, call);
    const ok = msg.includes("DRAGON_NOT_OWNED");
    console.log(`  ${ok ? "✅" : "❌"} ${call.name}: ${msg || "(no error)"}`);
    if (!ok) failures.push(`${call.name}: non-owner was not blocked (got: ${msg || "success"})`);
  }

  console.log("\n── owner must never hit the ownership gate");
  for (const call of calls(dragonUuid)) {
    const msg = await rpcError(owner.client, call);
    const ok = !msg.includes("DRAGON_NOT_OWNED") && !msg.includes("DRAGON_REQUIRED");
    console.log(`  ${ok ? "✅" : "❌"} ${call.name}: ${msg || "(allowed)"}`);
    if (!ok) failures.push(`${call.name}: owner was blocked (${msg})`);
  }

  console.log("\n── growth stays per-player (owned_dragons only)");
  const { data: strangerOwned } = await admin
    .from("owned_dragons")
    .select("id")
    .eq("user_id", stranger.userId)
    .eq("dragon_id", dragonUuid);
  if ((strangerOwned ?? []).length > 0) {
    failures.push("stranger got an owned_dragons row for a dragon they do not own");
    console.log("  ❌ stranger has an owned_dragons row");
  } else {
    console.log("  ✅ stranger has no owned_dragons row");
  }

  // Cleanup
  await admin.from("dragons").delete().eq("id", dragonUuid);
  await admin.auth.admin.deleteUser(owner.userId);
  await admin.auth.admin.deleteUser(stranger.userId);

  if (failures.length) {
    console.error(`\n❌ OWNERSHIP TEST FAILED (${failures.length})`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log("\n✅ Ownership verification passed for all 6 RPCs");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
