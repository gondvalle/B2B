create table if not exists public.b2b_settings (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.b2b_clubs (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.b2b_sessions (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.b2b_invoices (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.b2b_settings enable row level security;
alter table public.b2b_clubs enable row level security;
alter table public.b2b_sessions enable row level security;
alter table public.b2b_invoices enable row level security;

drop policy if exists "public read settings" on public.b2b_settings;
drop policy if exists "public write settings" on public.b2b_settings;
create policy "public read settings" on public.b2b_settings for select using (true);
create policy "public write settings" on public.b2b_settings for all using (true) with check (true);

drop policy if exists "public read clubs" on public.b2b_clubs;
drop policy if exists "public write clubs" on public.b2b_clubs;
create policy "public read clubs" on public.b2b_clubs for select using (true);
create policy "public write clubs" on public.b2b_clubs for all using (true) with check (true);

drop policy if exists "public read sessions" on public.b2b_sessions;
drop policy if exists "public write sessions" on public.b2b_sessions;
create policy "public read sessions" on public.b2b_sessions for select using (true);
create policy "public write sessions" on public.b2b_sessions for all using (true) with check (true);

drop policy if exists "public read invoices" on public.b2b_invoices;
drop policy if exists "public write invoices" on public.b2b_invoices;
create policy "public read invoices" on public.b2b_invoices for select using (true);
create policy "public write invoices" on public.b2b_invoices for all using (true) with check (true);
