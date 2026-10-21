-- Run after 001–004. Annual source snapshots remain separate from postings.
create table public.rental_imports (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 year integer not null check(year between 2000 and 2100),filename text not null,sha256 text not null,
 payload jsonb not null,created_by uuid references auth.users(id),created_at timestamptz not null default now(),
 unique(organization_id,year,sha256)
);
create table public.utility_records (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 kind text not null check(kind in ('reading','contract')),property_name text not null,
 payload jsonb not null,created_at timestamptz not null default now()
);
do $$ declare t text; begin foreach t in array array['rental_imports','utility_records'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy %I on public.%I for select to authenticated using(public.member_of(organization_id))',t||'_read',t);
 execute format('create policy %I on public.%I for insert to authenticated with check(public.can_edit(organization_id))',t||'_insert',t);
 end loop; end $$;
