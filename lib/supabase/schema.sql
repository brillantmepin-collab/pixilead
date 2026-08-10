-- PixiLead Supabase Database Schema
--
-- Base neuve : exécuter CE fichier, puis migrations/001_credits_moneroo.sql
-- (qui ajoute le système de crédits + les paiements Moneroo, et qui est
--  idempotent — rejouable sans risque).

-- 1. Profiles Table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company_name text,
  offer_description text,          -- "ce que je vends" -> nourrit le prompt IA
  value_proposition text,
  country text not null default 'CM',  -- pilote la devise de paiement (XAF / XOF)
  credits int not null default 5,      -- solde unifié : recherche = 3, message IA = 1
  created_at timestamptz default now()
);

-- 2. Searches Table
create table if not exists public.searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sector text not null,
  city text not null,
  country text not null default 'Cameroun',
  max_results int not null default 50,
  status text not null default 'running',   -- running | succeeded | failed
  apify_run_id text,
  apify_dataset_id text,
  results_count int not null default 0,
  error_message text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- 3. Leads Table
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.searches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text,
  name text not null,
  category text,
  address text,
  city text,
  phone text,
  website text,
  email text,
  rating numeric(3,1),
  reviews_count int,
  maps_url text,
  lat numeric,
  lng numeric,
  raw jsonb,
  created_at timestamptz default now(),
  unique (search_id, place_id)      -- rend l'ingestion idempotente
);

-- 4. Messages Table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null default 'whatsapp',
  content text not null,
  angle text,
  model text,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_leads_search_id on public.leads (search_id);
create index if not exists idx_searches_user_created on public.searches (user_id, created_at desc);

-- Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.searches enable row level security;
alter table public.leads    enable row level security;
alter table public.messages enable row level security;

-- RLS Policies
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own searches" on public.searches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own leads" on public.leads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own messages" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Les RPC de crédits (consume_credits_for / refund_credits_to /
-- grant_credits_for_payment) vivent dans migrations/001_credits_moneroo.sql.
-- Elles prennent un user_id explicite car l'application interroge Supabase avec
-- la clé service role, où auth.uid() vaut toujours NULL.

-- Auto Create Profile Trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, credits)
  values (new.id, new.raw_user_meta_data->>'full_name', 5)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
