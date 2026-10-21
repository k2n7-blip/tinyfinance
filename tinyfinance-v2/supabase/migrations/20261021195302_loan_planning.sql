begin;
create table public.loan_plans (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 source_key text not null check(length(source_key) between 1 and 500),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<100000),
 updated_at timestamptz not null default now(),
 unique(organization_id,source_key)
);
alter table public.loan_plans enable row level security;
create policy loan_plans_read on public.loan_plans for select to authenticated using(public.can_private(organization_id));
create policy loan_plans_insert on public.loan_plans for insert to authenticated with check(public.can_private(organization_id));
create policy loan_plans_update on public.loan_plans for update to authenticated using(public.can_private(organization_id)) with check(public.can_private(organization_id));
grant select,insert,update on public.loan_plans to authenticated;
create trigger audit_changes after insert or update on public.loan_plans for each row execute function public.append_audit();
create policy loan_plans_audit on public.audit_events for select to authenticated using(entity_type='loan_plans' and public.can_private(organization_id));
commit;
