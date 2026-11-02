begin;
create table public.house_costs (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 cost_center_id uuid not null,
 name text not null check(length(trim(name)) between 1 and 160),
 kind text not null check(kind in ('fixed','variable')),
 amount numeric(12,2) not null check(amount>=0 and amount<100000000 and amount<>'NaN'::numeric),
 starts_month text not null check(starts_month ~ '^(20[0-9]{2}|2100)-(0[1-9]|1[0-2])$'),
 ends_month text check(ends_month ~ '^(20[0-9]{2}|2100)-(0[1-9]|1[0-2])$' and ends_month>=starts_month),
 recurrence text not null check(recurrence in ('monthly','once')),
 basis text not null check(basis in ('recorded','planned')),
 active boolean not null default true,
 record_version integer not null default 1,
 foreign key(organization_id,cost_center_id) references public.cost_centers(organization_id,id)
);
create index house_costs_org_center on public.house_costs(organization_id,cost_center_id);
alter table public.house_costs enable row level security;
revoke all on public.house_costs from anon,authenticated;
grant select,insert,update on public.house_costs to authenticated;
create policy house_costs_read on public.house_costs for select to authenticated using(public.member_of(organization_id));
create policy house_costs_insert on public.house_costs for insert to authenticated with check(public.can_edit(organization_id));
create policy house_costs_update on public.house_costs for update to authenticated using(public.can_edit(organization_id)) with check(public.can_edit(organization_id));
create trigger record_guard before update on public.house_costs for each row execute function public.guard_record();
create trigger audit_changes after insert or update on public.house_costs for each row execute function public.append_audit();
create policy house_costs_audit on public.audit_events for select to authenticated using(entity_type='house_costs' and public.member_of(organization_id));
commit;
