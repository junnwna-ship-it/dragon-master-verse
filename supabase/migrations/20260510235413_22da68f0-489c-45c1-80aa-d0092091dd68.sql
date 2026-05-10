
create table if not exists public.gold_packages (
  price_external_id text primary key,
  gold_amount int not null check (gold_amount > 0),
  created_at timestamptz not null default now()
);

alter table public.gold_packages enable row level security;
-- No policies => only service_role can access.

insert into public.gold_packages (price_external_id, gold_amount) values
  ('gold_pack_small', 1000),
  ('gold_pack_medium', 5500),
  ('gold_pack_large', 12000)
on conflict (price_external_id) do update set gold_amount = excluded.gold_amount;

create table if not exists public.processed_payments (
  paddle_transaction_id text primary key,
  user_id uuid not null,
  gold_credited int not null,
  environment text not null,
  created_at timestamptz not null default now()
);

alter table public.processed_payments enable row level security;
create policy "Users can view own payments"
  on public.processed_payments for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.credit_gold_from_purchase(
  _user_id uuid,
  _txn_id text,
  _gold int,
  _env text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_gold int;
begin
  if _gold <= 0 then
    raise exception 'invalid gold amount: %', _gold;
  end if;

  -- Idempotency: skip if this transaction already credited.
  insert into public.processed_payments (paddle_transaction_id, user_id, gold_credited, environment)
  values (_txn_id, _user_id, _gold, _env)
  on conflict (paddle_transaction_id) do nothing;

  if not found then
    select gold into new_gold from public.profiles where user_id = _user_id;
    return jsonb_build_object('ok', true, 'duplicate', true, 'gold', new_gold);
  end if;

  insert into public.profiles (user_id, gold) values (_user_id, 0)
  on conflict (user_id) do nothing;

  update public.profiles
     set gold = gold + _gold
   where user_id = _user_id
  returning gold into new_gold;

  return jsonb_build_object('ok', true, 'duplicate', false, 'gold', new_gold, 'credited', _gold);
end;
$$;
