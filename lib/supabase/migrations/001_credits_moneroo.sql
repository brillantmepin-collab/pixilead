-- ============================================================================
-- PixiLead — Migration 001 : système de crédits unifié + paiements Moneroo
-- ----------------------------------------------------------------------------
-- Idempotente : peut être rejouée sans risque sur une base existante.
-- À exécuter dans Supabase → SQL Editor.
--
-- Règles métier :
--   • 5 crédits offerts à l'inscription (et aux comptes déjà existants)
--   • 1 recherche de leads      = 3 crédits
--   • 1 message IA généré       = 1 crédit
--   • Rechargement via Moneroo (Mobile Money + carte, XAF/XOF)
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Profils : solde unifié + pays (qui pilote la devise de paiement)
-- ─────────────────────────────────────────────────────────────────────────────

-- `default 5` rétro-remplit automatiquement tous les comptes déjà existants,
-- ce qui leur offre les 5 crédits gratuits demandés.
alter table public.profiles
  add column if not exists credits int not null default 5;

alter table public.profiles
  add column if not exists country text not null default 'CM';

-- Les anciens compteurs credits_search / credits_ai sont remplacés par `credits`.
-- On ne les supprime pas (données historiques), ils ne sont simplement plus lus.
comment on column public.profiles.credits is
  'Solde unifié. Recherche = 3 crédits, message IA = 1 crédit.';
comment on column public.profiles.credits_search is
  'DÉPRÉCIÉ — remplacé par profiles.credits (migration 001).';
comment on column public.profiles.credits_ai is
  'DÉPRÉCIÉ — remplacé par profiles.credits (migration 001).';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Journal des mouvements de crédits (append-only, auditable)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.credit_transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  -- delta > 0 = crédit accordé, delta < 0 = crédit consommé
  delta         int  not null,
  balance_after int  not null,
  reason        text not null,   -- signup_bonus | purchase | search | ai_message | refund_search
  reference_type text,           -- search | lead | payment
  reference_id  text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_credit_tx_user_created
  on public.credit_transactions (user_id, created_at desc);

-- Un paiement ne peut créditer qu'une seule fois, quel que soit le nombre de
-- rejeux du webhook. C'est le garde-fou ultime contre le double-crédit.
create unique index if not exists uniq_credit_tx_purchase
  on public.credit_transactions (reference_id)
  where reason = 'purchase';


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Paiements Moneroo
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.payments (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  provider                text not null default 'moneroo',
  pack_id                 text not null,
  credits_purchased       int  not null,
  -- XAF / XOF sont des devises sans décimales : montant en francs entiers.
  amount_total            int  not null,
  currency                text not null,
  status                  text not null default 'pending',  -- pending | completed | failed | expired
  provider_transaction_id text,
  checkout_url            text,
  failure_reason          text,
  customer_email          text,
  webhook_received_at     timestamptz,
  credited_at             timestamptz,
  metadata                jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_payments_user_created
  on public.payments (user_id, created_at desc);
create index if not exists idx_payments_provider_tx
  on public.payments (provider_transaction_id);
create index if not exists idx_payments_status
  on public.payments (status);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Déduplication des webhooks (TTL 24 h)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.processed_events (
  provider     text not null,
  event_id     text not null,
  processed_at timestamptz not null default now(),
  primary key (provider, event_id)
);

create index if not exists idx_processed_events_at
  on public.processed_events (processed_at);

-- Nettoyage à planifier (pg_cron ou job externe) :
--   delete from public.processed_events where processed_at < now() - interval '24 hours';


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS — lecture seule pour l'utilisateur, écriture réservée au service role
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.credit_transactions enable row level security;
alter table public.payments            enable row level security;
alter table public.processed_events    enable row level security;

drop policy if exists "read own credit transactions" on public.credit_transactions;
create policy "read own credit transactions" on public.credit_transactions
  for select using (auth.uid() = user_id);

drop policy if exists "read own payments" on public.payments;
create policy "read own payments" on public.payments
  for select using (auth.uid() = user_id);

-- Aucune policy sur processed_events : table purement interne (service role only).


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RPC atomiques
--
--    ATTENTION : ces fonctions prennent un p_user_id explicite parce que
--    l'application les appelle avec la clé service role (auth.uid() y est NULL).
--    Elles sont donc RÉVOQUÉES pour anon/authenticated — sinon n'importe quel
--    client pourrait créditer le compte de son choix.
-- ─────────────────────────────────────────────────────────────────────────────

-- Garantit l'existence de la ligne profil (comptes créés avant le trigger).
create or replace function public.ensure_profile(p_user_id uuid, p_full_name text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, credits)
  values (p_user_id, p_full_name, 5)
  on conflict (id) do nothing;
end $$;


-- Débit conditionnel : ne passe que si le solde est suffisant.
-- Retourne le nouveau solde, ou NULL si le débit a été refusé.
create or replace function public.consume_credits_for(
  p_user_id        uuid,
  p_amount         int,
  p_reason         text,
  p_reference_type text default null,
  p_reference_id   text default null
)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_balance int;
begin
  if p_amount <= 0 then
    raise exception 'p_amount doit être strictement positif';
  end if;

  -- Le `and credits >= p_amount` rend l'opération atomique : deux requêtes
  -- concurrentes ne peuvent pas faire passer le solde en négatif.
  update public.profiles
     set credits = credits - p_amount
   where id = p_user_id
     and credits >= p_amount
  returning credits into v_balance;

  if v_balance is null then
    return null;   -- solde insuffisant ou profil inexistant
  end if;

  insert into public.credit_transactions
    (user_id, delta, balance_after, reason, reference_type, reference_id)
  values
    (p_user_id, -p_amount, v_balance, p_reason, p_reference_type, p_reference_id);

  return v_balance;
end $$;


-- Remboursement (scrape échoué). Toujours accordé.
create or replace function public.refund_credits_to(
  p_user_id        uuid,
  p_amount         int,
  p_reason         text,
  p_reference_type text default null,
  p_reference_id   text default null
)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_balance int;
begin
  update public.profiles
     set credits = credits + p_amount
   where id = p_user_id
  returning credits into v_balance;

  if v_balance is null then
    return null;
  end if;

  insert into public.credit_transactions
    (user_id, delta, balance_after, reason, reference_type, reference_id)
  values
    (p_user_id, p_amount, v_balance, p_reason, p_reference_type, p_reference_id);

  return v_balance;
end $$;


-- Fulfillment d'un paiement : bascule pending → completed ET crédite le solde
-- dans UNE SEULE transaction. Rejouable sans risque (webhook livré 2 à 5 fois).
--
-- Retourne :
--   { granted: true,  credits: <n>, balance: <n> }  → crédité maintenant
--   { granted: false, reason: 'already_processed' } → déjà traité, no-op
--   { granted: false, reason: 'not_found' }
create or replace function public.grant_credits_for_payment(p_payment_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payments%rowtype;
  v_balance int;
begin
  -- Le `and status = 'pending'` est le verrou d'idempotence : le second
  -- webhook ne matche plus aucune ligne et ressort en no-op.
  update public.payments
     set status              = 'completed',
         credited_at         = now(),
         webhook_received_at = coalesce(webhook_received_at, now()),
         updated_at          = now()
   where id = p_payment_id
     and status = 'pending'
  returning * into v_payment;

  if v_payment.id is null then
    if exists (select 1 from public.payments where id = p_payment_id) then
      return jsonb_build_object('granted', false, 'reason', 'already_processed');
    end if;
    return jsonb_build_object('granted', false, 'reason', 'not_found');
  end if;

  update public.profiles
     set credits = credits + v_payment.credits_purchased
   where id = v_payment.user_id
  returning credits into v_balance;

  if v_balance is null then
    -- Profil manquant : on le crée puis on recrédite.
    insert into public.profiles (id, credits) values (v_payment.user_id, 5)
      on conflict (id) do nothing;
    update public.profiles
       set credits = credits + v_payment.credits_purchased
     where id = v_payment.user_id
    returning credits into v_balance;
  end if;

  insert into public.credit_transactions
    (user_id, delta, balance_after, reason, reference_type, reference_id)
  values
    (v_payment.user_id, v_payment.credits_purchased, v_balance,
     'purchase', 'payment', v_payment.id::text);

  return jsonb_build_object(
    'granted', true,
    'credits', v_payment.credits_purchased,
    'balance', v_balance
  );
end $$;


revoke execute on function public.ensure_profile(uuid, text)                        from public, anon, authenticated;
revoke execute on function public.consume_credits_for(uuid, int, text, text, text)  from public, anon, authenticated;
revoke execute on function public.refund_credits_to(uuid, int, text, text, text)    from public, anon, authenticated;
revoke execute on function public.grant_credits_for_payment(uuid)                   from public, anon, authenticated;

grant execute on function public.ensure_profile(uuid, text)                         to service_role;
grant execute on function public.consume_credits_for(uuid, int, text, text, text)   to service_role;
grant execute on function public.refund_credits_to(uuid, int, text, text, text)     to service_role;
grant execute on function public.grant_credits_for_payment(uuid)                    to service_role;

-- Les anciennes RPC basées sur auth.uid() ne fonctionnaient jamais côté serveur
-- (l'app utilise la clé service role, où auth.uid() vaut NULL).
drop function if exists public.consume_credits(text, int);
drop function if exists public.refund_credits(text, int);


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Trigger d'inscription : 5 crédits offerts
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, credits)
  values (new.id, new.raw_user_meta_data->>'full_name', 5)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Journalisation du bonus offert aux comptes déjà existants
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.credit_transactions (user_id, delta, balance_after, reason)
select p.id, 5, p.credits, 'signup_bonus'
  from public.profiles p
 where not exists (
   select 1 from public.credit_transactions t
    where t.user_id = p.id and t.reason = 'signup_bonus'
 );
