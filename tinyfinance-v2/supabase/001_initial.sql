create extension if not exists pgcrypto;
create table organizations(id uuid primary key default gen_random_uuid(),name text not null,created_at timestamptz default now());
create table memberships(organization_id uuid not null references organizations(id),user_id uuid not null references auth.users(id),role text not null check(role in ('owner','bookkeeper','advisor_read','advisor_review')),primary key(organization_id,user_id));
create table cost_centers(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),code text not null,name text not null,unique(organization_id,code));
create table chart_accounts(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),account_number text not null,description text,approved_by_advisor boolean default false,unique(organization_id,account_number));
create table documents(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),cost_center_id uuid references cost_centers(id),original_filename text not null,storage_path text not null,sha256 text not null,mime_type text not null,invoice_number text,vendor text,invoice_date date,gross_amount numeric(14,2),review_status text not null default 'pending' check(review_status in ('pending','reviewed','rejected')),created_at timestamptz not null default now(),unique(organization_id,storage_path));
create index documents_sha_idx on documents(organization_id,sha256);
create table bank_transactions(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),booked_on date not null,amount numeric(14,2) not null,counterparty text,purpose text,source_reference text not null,created_at timestamptz default now(),unique(organization_id,source_reference));
create table postings(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),document_id uuid references documents(id),posting_date date not null,amount numeric(14,2) not null check(amount>0),debit_account_id uuid references chart_accounts(id),credit_account_id uuid references chart_accounts(id),status text default 'draft' check(status in ('draft','reviewed','approved','exported')),created_at timestamptz default now());
create table posting_allocations(posting_id uuid references postings(id),cost_center_id uuid references cost_centers(id),amount numeric(14,2) not null,primary key(posting_id,cost_center_id));
create table bank_matches(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),bank_transaction_id uuid not null references bank_transactions(id),document_id uuid not null references documents(id),amount numeric(14,2) not null,status text default 'suggested' check(status in ('suggested','confirmed','rejected')));
create table audit_events(id bigint generated always as identity primary key,organization_id uuid not null references organizations(id),actor_id uuid references auth.users(id),entity_type text not null,entity_id uuid not null,action text not null,at timestamptz default now(),details jsonb);
-- Future modules: separated business and private tax subjects, payroll and asset data.
create table tax_subjects(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),name text not null,subject_type text not null check(subject_type in ('business','private','rental')));
create table employees(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),external_team_id text,personnel_number text,employment_type text,active boolean default true);
create table time_entries(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),employee_id uuid references employees(id),cost_center_id uuid references cost_centers(id),worked_on date not null,minutes integer not null check(minutes>=0),source_id text,approval_status text default 'pending',unique(organization_id,source_id));
create table payroll_periods(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),period_month date not null,status text default 'open',unique(organization_id,period_month));
create table tax_deadlines(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),tax_subject_id uuid references tax_subjects(id),due_on date not null,kind text not null,status text default 'open');
create table assets(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),tax_subject_id uuid references tax_subjects(id),kind text not null,name text not null,metadata jsonb default '{}'::jsonb);
create table interest_accounts(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),tax_subject_id uuid references tax_subjects(id),bank_name text not null,rate_annual numeric(7,4),allowance_allocated numeric(14,2) default 0);
create table insurance_contracts(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),tax_subject_id uuid references tax_subjects(id),provider text not null,policy_reference text,renewal_on date);
create table integration_jobs(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),integration text not null,external_reference text,status text default 'pending',payload jsonb,created_at timestamptz default now());
-- RLS: membership check is SECURITY DEFINER to avoid self-referential policy recursion.
create function member_of(org uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from memberships where organization_id=org and user_id=auth.uid())$$;
create function can_edit(org uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from memberships where organization_id=org and user_id=auth.uid() and role in ('owner','bookkeeper'))$$;
revoke all on function member_of(uuid) from public;revoke all on function can_edit(uuid) from public;
grant execute on function member_of(uuid),can_edit(uuid) to authenticated;
alter table organizations enable row level security;
create policy org_select on organizations for select to authenticated using(member_of(id));
alter table memberships enable row level security;
create policy member_select on memberships for select to authenticated using(member_of(organization_id));
-- Each organization-owned table gets read membership + write role protection.
do $$declare t text;begin foreach t in array array['cost_centers','chart_accounts','documents','bank_transactions','postings','bank_matches','audit_events','tax_subjects','employees','time_entries','payroll_periods','tax_deadlines','assets','interest_accounts','insurance_contracts','integration_jobs'] loop
 execute format('alter table %I enable row level security',t);
 execute format('create policy %I on %I for select to authenticated using(member_of(organization_id))',t||'_read',t);
 execute format('create policy %I on %I for insert to authenticated with check(can_edit(organization_id))',t||'_insert',t);
 execute format('create policy %I on %I for update to authenticated using(can_edit(organization_id)) with check(can_edit(organization_id))',t||'_update',t);
end loop;end$$;
alter table posting_allocations enable row level security;
create policy alloc_read on posting_allocations for select to authenticated using(exists(select 1 from postings p where p.id=posting_id and member_of(p.organization_id)));
create policy alloc_insert on posting_allocations for insert to authenticated with check(exists(select 1 from postings p where p.id=posting_id and can_edit(p.organization_id)));
-- Private storage, path convention <organization_id>/<document_id>/<filename>.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('documents','documents',false,10485760,array['application/pdf','image/png','image/jpeg']) on conflict(id) do nothing;
create policy docs_storage_read on storage.objects for select to authenticated using(bucket_id='documents' and member_of((split_part(name,'/',1))::uuid));
create policy docs_storage_insert on storage.objects for insert to authenticated with check(bucket_id='documents' and can_edit((split_part(name,'/',1))::uuid));
-- NOTE: Security review still required: cross-org FK consistency, retention and immutable audit.
