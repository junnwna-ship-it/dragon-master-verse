/**
 * Idempotency test for credit_gold_from_purchase.
 *
 * Simulates Paddle webhook retries by calling the RPC 3 times with the same
 * paddle_transaction_id and verifies gold is credited exactly once.
 *
 * Usage:  bun run scripts/test-gold-idempotency.ts [userId]
 * Defaults to the first profile if no userId is passed.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required");
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function getGold(userId: string): Promise<number> {
  const { data, error } = await admin
    .from("profiles")
    .select("gold")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return (data as { gold: number }).gold;
}

async function main() {
  let userId = process.argv[2];
  if (!userId) {
    const { data, error } = await admin
      .from("profiles")
      .select("user_id")
      .limit(1)
      .single();
    if (error) throw error;
    userId = (data as { user_id: string }).user_id;
  }

  const txnId = `test_txn_${Date.now()}`;
  const credit = 1000;
  const env = "sandbox";

  const before = await getGold(userId);
  console.log(`▶ user=${userId}  txn=${txnId}  before=${before}`);

  const results: any[] = [];
  for (let i = 1; i <= 3; i++) {
    const { data, error } = await (admin.rpc as any)(
      "credit_gold_from_purchase",
      { _user_id: userId, _txn_id: txnId, _gold: credit, _env: env },
    );
    if (error) throw error;
    results.push(data);
    console.log(`  call #${i}:`, data);
  }

  const after = await getGold(userId);
  const delta = after - before;

  const { data: rows, error: rowErr } = await admin
    .from("processed_payments")
    .select("paddle_transaction_id, gold_credited")
    .eq("paddle_transaction_id", txnId);
  if (rowErr) throw rowErr;

  console.log(`◀ after=${after}  delta=${delta}  rows=${rows?.length}`);

  const ok =
    delta === credit &&
    rows?.length === 1 &&
    results[0].duplicate === false &&
    results[1].duplicate === true &&
    results[2].duplicate === true;

  if (!ok) {
    console.error("❌ IDEMPOTENCY FAILED");
    process.exit(1);
  }
  console.log("✅ Idempotency verified: 3 calls → +1000 gold, 1 row");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});