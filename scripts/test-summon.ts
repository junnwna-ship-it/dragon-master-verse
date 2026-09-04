/**
 * Integration test: dragon summoning + battle item economy.
 *
 * Verifies:
 *   - summon_dragon rejects a caller without gold / tickets
 *   - a single gold summon deducts the cost and grants an owned dragon
 *   - a ten-pull guarantees at least one rare-or-better result
 *   - duplicates convert into dragon shards
 *   - ticket payment path works and consumes tickets
 *   - buy_combat_item / consume_battle_item move inventory correctly
 *
 * Usage:  bun run scripts/test-summon.ts
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
const failures: string[] = [];

function check(ok: boolean, label: string, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
}

async function makeUser(label: string) {
  const email = `summon_${label}_${stamp}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  const client = createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { userId: data.user!.id, client };
}

const rpc = (c: SupabaseClient, name: string, args: Record<string, unknown>) =>
  (c.rpc as any)(name, args) as Promise<{ data: any; error: { message: string } | null }>;

async function gold(userId: string) {
  const { data } = await admin.from("profiles").select("gold").eq("user_id", userId).maybeSingle();
  return (data as { gold: number } | null)?.gold ?? 0;
}

async function invQty(userId: string, key: string) {
  const { data } = await admin
    .from("user_inventory")
    .select("quantity")
    .eq("user_id", userId)
    .eq("item_key", key)
    .maybeSingle();
  return (data as { quantity: number } | null)?.quantity ?? 0;
}

async function grantGold(userId: string, amount: number) {
  await admin.from("profiles").upsert({ user_id: userId }, { onConflict: "user_id" });
  await rpc(admin as unknown as SupabaseClient, "credit_gold_from_purchase", {
    _user_id: userId,
    _txn_id: `summon_test_${stamp}_${Math.random()}`,
    _gold: amount,
    _env: "sandbox",
  });
}

async function main() {
  const { count } = await admin
    .from("dragon_pool")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);
  check((count ?? 0) > 0, "summon pool has active entries", `count=${count}`);

  const user = await makeUser("player");

  // 1. No gold, no tickets → rejected.
  {
    const { error } = await rpc(user.client, "summon_dragon", { _count: 1, _pay: "gold" });
    check(!!error && /NOT_ENOUGH_GOLD/i.test(error.message), "summon without gold is rejected", error?.message);
  }
  {
    const { error } = await rpc(user.client, "summon_dragon", { _count: 1, _pay: "ticket" });
    check(!!error && /NOT_ENOUGH_TICKET/i.test(error.message), "summon without tickets is rejected", error?.message);
  }

  // 2. Single gold summon.
  await grantGold(user.userId, 600);
  const goldBefore = await gold(user.userId);
  {
    const { data, error } = await rpc(user.client, "summon_dragon", { _count: 1, _pay: "gold" });
    check(!error, "single gold summon succeeds", error?.message);
    const results = data?.results ?? [];
    check(results.length === 1, "single summon returns one result", `len=${results.length}`);
    const after = await gold(user.userId);
    check(after === goldBefore - 500, "single summon costs 500 gold", `${goldBefore} → ${after}`);
    const { count: owned } = await admin
      .from("owned_dragons")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.userId);
    check((owned ?? 0) >= 1, "summoned dragon is owned", `owned=${owned}`);
  }

  // 3. Ten pull with gold: rare-or-better guarantee + duplicate shards.
  await grantGold(user.userId, 5000);
  {
    const shardsBefore = await invQty(user.userId, "dragon_shard");
    const { data, error } = await rpc(user.client, "summon_dragon", { _count: 10, _pay: "gold" });
    check(!error, "ten-pull with gold succeeds", error?.message);
    const results: { rarity: string; duplicate: boolean; shards?: number }[] = data?.results ?? [];
    check(results.length === 10, "ten-pull returns ten results", `len=${results.length}`);
    const rareOrBetter = results.filter((r) => ["rare", "epic", "legendary"].includes(r.rarity));
    check(rareOrBetter.length >= 1, "ten-pull guarantees rare or better", `count=${rareOrBetter.length}`);
    const dupes = results.filter((r) => r.duplicate);
    const shardsAfter = await invQty(user.userId, "dragon_shard");
    if (dupes.length > 0) {
      check(shardsAfter > shardsBefore, "duplicates grant dragon shards", `${shardsBefore} → ${shardsAfter}`);
    } else {
      console.log("ℹ️ no duplicates in this ten-pull; shard conversion not exercised");
    }
  }

  // 4. Ticket payment path.
  {
    await admin
      .from("user_inventory")
      .upsert({ user_id: user.userId, item_key: "summon_ticket", quantity: 3 }, { onConflict: "user_id,item_key" });
    const { error } = await rpc(user.client, "summon_dragon", { _count: 1, _pay: "ticket" });
    check(!error, "ticket summon succeeds", error?.message);
    const left = await invQty(user.userId, "summon_ticket");
    check(left === 2, "ticket summon consumes one ticket", `left=${left}`);
  }

  // 5. Combat item purchase + battle consumption.
  {
    const { data: item } = await admin
      .from("combat_items")
      .select("item_key, name, price_gold, effect_type")
      .eq("is_published", true)
      .gt("price_gold", 0)
      .neq("effect_type", "summon_ticket")
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    const row = item as { item_key: string; price_gold: number } | null;
    if (!row) {
      check(false, "a purchasable combat item exists");
    } else {
      await grantGold(user.userId, row.price_gold * 2);
      const before = await invQty(user.userId, row.item_key);
      const { error: buyErr } = await rpc(user.client, "buy_combat_item", {
        _item_key: row.item_key,
        _quantity: 1,
      });
      check(!buyErr, `buy_combat_item(${row.item_key}) succeeds`, buyErr?.message);
      const afterBuy = await invQty(user.userId, row.item_key);
      check(afterBuy === before + 1, "purchase adds one to inventory", `${before} → ${afterBuy}`);

      const { data: eff, error: useErr } = await rpc(user.client, "consume_battle_item", {
        _item_key: row.item_key,
      });
      check(!useErr, "consume_battle_item succeeds", useErr?.message);
      check(!!eff?.effect_type, "consume returns a resolved effect", JSON.stringify(eff));
      const afterUse = await invQty(user.userId, row.item_key);
      check(afterUse === afterBuy - 1, "consuming removes one from inventory", `${afterBuy} → ${afterUse}`);

      // Consuming with an empty stack must fail.
      await admin
        .from("user_inventory")
        .update({ quantity: 0 })
        .eq("user_id", user.userId)
        .eq("item_key", row.item_key);
      const { error: emptyErr } = await rpc(user.client, "consume_battle_item", { _item_key: row.item_key });
      check(!!emptyErr && /OUT_OF_STOCK/i.test(emptyErr.message), "consuming an empty stack is rejected", emptyErr?.message);
    }
  }

  // Cleanup
  await admin.from("owned_dragons").delete().eq("user_id", user.userId);
  await admin.from("summon_history").delete().eq("user_id", user.userId);
  await admin.from("user_inventory").delete().eq("user_id", user.userId);
  await admin.from("processed_payments").delete().eq("user_id", user.userId);
  await admin.from("profiles").delete().eq("user_id", user.userId);
  await admin.auth.admin.deleteUser(user.userId);

  console.log("");
  if (failures.length) {
    console.error(`❌ ${failures.length} check(s) failed:\n - ${failures.join("\n - ")}`);
    process.exit(1);
  }
  console.log("✅ all summon / battle item checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
