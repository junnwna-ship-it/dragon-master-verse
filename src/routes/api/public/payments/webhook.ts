import { createFileRoute } from '@tanstack/react-router';
import { createClient } from '@supabase/supabase-js';
import { verifyWebhook, EventName, type PaddleEnv } from '@/lib/paddle.server';

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

async function handleTransactionCompleted(data: any, env: PaddleEnv) {
  const txnId: string = data.id;
  const userId: string | undefined = data.customData?.userId;
  if (!userId) {
    console.warn('[paddle-webhook] transaction missing customData.userId', txnId);
    return;
  }

  // Collect human-readable price IDs across all line items.
  const items: any[] = data.items ?? [];
  const priceExternalIds = items
    .map((it) => it?.price?.importMeta?.externalId as string | undefined)
    .filter((v): v is string => Boolean(v));

  if (priceExternalIds.length === 0) {
    console.warn('[paddle-webhook] no externalId on items, skipping', { txnId });
    return;
  }

  const supabase = getSupabase();

  // Look up gold amount per price.
  const { data: pkgs, error: pkgErr } = await supabase
    .from('gold_packages')
    .select('price_external_id, gold_amount')
    .in('price_external_id', priceExternalIds);

  if (pkgErr) {
    console.error('[paddle-webhook] gold_packages lookup failed', pkgErr);
    throw pkgErr;
  }

  const goldByPrice = new Map<string, number>(
    (pkgs ?? []).map((p: any) => [p.price_external_id as string, p.gold_amount as number]),
  );

  let totalGold = 0;
  for (const it of items) {
    const ext = it?.price?.importMeta?.externalId as string | undefined;
    if (!ext) continue;
    const per = goldByPrice.get(ext);
    if (!per) {
      console.warn('[paddle-webhook] price not in gold_packages, skipping', ext);
      continue;
    }
    const qty: number = Number(it.quantity ?? 1);
    totalGold += per * qty;
  }

  if (totalGold <= 0) {
    console.warn('[paddle-webhook] no gold to credit for txn', txnId);
    return;
  }

  const { data: result, error: rpcErr } = await supabase.rpc(
    'credit_gold_from_purchase',
    { _user_id: userId, _txn_id: txnId, _gold: totalGold, _env: env },
  );

  if (rpcErr) {
    console.error('[paddle-webhook] credit_gold_from_purchase failed', rpcErr);
    throw rpcErr;
  }

  console.log('[paddle-webhook] credited gold', { txnId, userId, totalGold, result });
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.eventType) {
    case EventName.TransactionCompleted:
      await handleTransactionCompleted(event.data as any, env);
      break;
    default:
      console.log('[paddle-webhook] unhandled event:', event.eventType);
  }
}

export const Route = createFileRoute('/api/public/payments/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get('env') || 'sandbox') as PaddleEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error('[paddle-webhook] error:', e);
          return new Response('Webhook error', { status: 400 });
        }
      },
    },
  },
});