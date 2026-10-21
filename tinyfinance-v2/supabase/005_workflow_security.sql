-- Apply only after 001, 003 and 004, first in a separate Supabase test project.
-- Transactional: invalid existing cross-tenant data or duplicate hashes abort migration.
begin;
alter table memberships drop constraint memberships_role_check;
alter table memberships add constraint memberships_role_check check(role in ('owner','bookkeeper','advisor_read','advisor_review','viewer'));
alter table memberships add column private_access boolean not null default false;
alter table memberships add column payroll_access boolean not null default false;
create or replace function member_of(org uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from memberships m where m.organization_id=org and m.user_id=auth.uid()
 and (m.role<>'owner' or auth.jwt()->>'aal'='aal2'))
$$;
create or replace function can_edit(org uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from memberships m where m.organization_id=org and m.user_id=auth.uid()
 and m.role in ('owner','bookkeeper') and (m.role<>'owner' or auth.jwt()->>'aal'='aal2'))
$$;
create function is_admin(org uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from memberships where organization_id=org and user_id=auth.uid() and role='owner' and auth.jwt()->>'aal'='aal2')
$$;
create function can_review(org uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from memberships where organization_id=org and user_id=auth.uid() and role in ('owner','bookkeeper','advisor_review') and (role<>'owner' or auth.jwt()->>'aal'='aal2'))
$$;
create function can_private(org uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from memberships where organization_id=org and user_id=auth.uid()
 and ((role='owner' and auth.jwt()->>'aal'='aal2') or (role='bookkeeper' and private_access)))
$$;
create function can_payroll(org uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from memberships where organization_id=org and user_id=auth.uid()
 and ((role='owner' and auth.jwt()->>'aal'='aal2') or (role='bookkeeper' and payroll_access)))
$$;
revoke all on function is_admin(uuid),can_review(uuid),can_private(uuid),can_payroll(uuid) from public;
grant execute on function is_admin(uuid),can_review(uuid),can_private(uuid),can_payroll(uuid) to authenticated;
drop policy member_select on memberships;
create policy member_select on memberships for select to authenticated using(user_id=auth.uid() or is_admin(organization_id));
drop policy org_select on organizations;
create policy org_select on organizations for select to authenticated using(exists(select 1 from memberships where organization_id=organizations.id and user_id=auth.uid()));

alter table documents add column service_date date;
alter table documents add column net_amount numeric(14,2);
alter table documents add column vat_amount numeric(14,2);
alter table documents add column currency text not null default 'EUR' check(currency ~ '^[A-Z]{3}$');
alter table documents add column extraction_status text not null default 'idle' check(extraction_status in ('idle','pending','complete','failed'));
alter table documents add column extraction_suggestion jsonb;
alter table documents add column extraction_error text;
alter table documents add column updated_at timestamptz not null default now();
alter table documents add column version integer not null default 1;
alter table documents add constraint documents_hash_unique unique(organization_id,sha256);
alter table documents add constraint documents_amounts check(
 (net_amount is null or net_amount>=0) and (vat_amount is null or vat_amount>=0) and (gross_amount is null or gross_amount>0)
 and (net_amount is null or vat_amount is null or gross_amount is null or net_amount+vat_amount=gross_amount));
alter table chart_accounts add column framework text not null default 'SKR03' check(framework in ('SKR03','SKR04'));
alter table chart_accounts add constraint account_number_format check(account_number ~ '^[0-9]{4,8}$');
alter table postings add column description text;
alter table postings add column vat_code text not null default '' check(vat_code ~ '^[0-9]{0,4}$');
alter table postings add column approved_at timestamptz;
alter table postings add column approved_by uuid references auth.users(id);
alter table postings add column exported_at timestamptz;
alter table postings add column reversal_of uuid;
alter table postings add column currency text not null default 'EUR' check(currency='EUR');
alter table postings add column version integer not null default 1;
alter table postings add constraint postings_distinct_accounts check(debit_account_id is null or credit_account_id is null or debit_account_id<>credit_account_id);
create unique index postings_one_original on postings(organization_id,document_id) where reversal_of is null and status in ('draft','reviewed','approved','exported');
create unique index postings_one_reversal on postings(reversal_of) where reversal_of is not null;
alter table posting_allocations add column organization_id uuid;
update posting_allocations a set organization_id=p.organization_id from postings p where a.posting_id=p.id;
alter table posting_allocations alter column organization_id set not null;
alter table posting_allocations add constraint allocation_positive check(amount>0);
alter table bank_transactions add column bank_account_id uuid;
alter table bank_transactions add column currency text not null default 'EUR' check(currency ~ '^[A-Z]{3}$');
alter table bank_transactions add column import_batch_id uuid;
alter table bank_matches add constraint matches_positive check(amount>0);
alter table bank_matches add constraint matches_pair_unique unique(organization_id,bank_transaction_id,document_id);
-- Legacy references remain unique; new imports are scoped to bank accounts.
alter table bank_transactions drop constraint bank_transactions_organization_id_source_reference_key;
create unique index bank_transactions_account_reference on bank_transactions(organization_id,bank_account_id,source_reference) nulls not distinct;

alter table bank_accounts add column tax_subject_id uuid;
alter table bank_accounts add column active boolean not null default true;
alter table bank_accounts add constraint bank_account_kind check(account_type in ('checking','savings','private','business'));
alter table bank_accounts add constraint bank_currency check(currency ~ '^[A-Z]{3}$');
alter table interest_accounts add column name text not null default 'Zinskonto';
alter table interest_accounts add column balance numeric(14,2) not null default 0 check(balance>=0);
alter table interest_accounts add column maturity_on date;
alter table interest_accounts add column account_type text not null default 'savings' check(account_type in ('savings','fixed'));
alter table interest_accounts add constraint interest_rate_range check(rate_annual between 0 and 100);
alter table interest_accounts add constraint allowance_positive check(allowance_allocated>=0);
alter table interest_entries add column solidarity_withheld numeric(14,2) not null default 0 check(solidarity_withheld>=0);
alter table interest_entries add constraint interest_entry_amounts check(gross_interest>=0 and tax_withheld>=0 and gross_interest>=tax_withheld+solidarity_withheld);
create table interest_rate_history(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),interest_account_id uuid not null,effective_on date not null,rate_annual numeric(7,4) not null check(rate_annual between 0 and 100),unique(organization_id,interest_account_id,effective_on));
alter table properties add column estimated_value numeric(14,2) check(estimated_value>=0);
alter table properties add column ownership_percent numeric(7,4) not null default 100 check(ownership_percent>0 and ownership_percent<=100);
alter table properties add column acquired_on date;
alter table properties add column depreciable_basis numeric(14,2) check(depreciable_basis>=0);
alter table properties add column depreciation_rate numeric(7,4) check(depreciation_rate between 0 and 100);
alter table loans add column monthly_payment numeric(14,2) check(monthly_payment>=0);
alter table loans add constraint loan_numbers check(balance>=0 and interest_rate between 0 and 100);
alter table insurance_contracts add column name text not null default 'Versicherung';
alter table insurance_contracts add column annual_premium numeric(14,2) check(annual_premium>=0);
alter table insurance_contracts add column cancellation_notice_months integer not null default 3 check(cancellation_notice_months between 0 and 36);
alter table pension_records add column contract_name text;
alter table pension_records add column capital_value numeric(14,2) check(capital_value>=0);
alter table employees add column name text not null default 'Mitarbeiter';
alter table employees add column hourly_cost numeric(14,2) check(hourly_cost>=0);
alter table time_entries add constraint time_approval check(approval_status in ('pending','approved','rejected'));
alter table time_entries add constraint time_minutes check(minutes between 1 and 1440);
create table absences(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),employee_id uuid not null,starts_on date not null,ends_on date not null,kind text not null check(kind in ('vacation','sick','other')),status text not null default 'pending' check(status in ('pending','approved','rejected')),check(ends_on>=starts_on));
create table payroll_items(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),employee_id uuid not null,period_month date not null,wage_type text not null,amount numeric(14,2) not null,notes text,check(extract(day from period_month)=1));
create table rental_entries(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),property_id uuid not null,booked_on date not null,kind text not null check(kind in ('rent','expense','interest','investment')),amount numeric(14,2) not null check(amount>0),description text not null,document_id uuid);
alter table platform_settlements add column booking_reference text;
alter table platform_settlements add column guest_nights integer check(guest_nights>=0);
alter table platform_settlements add column refunds numeric(14,2) not null default 0 check(refunds>=0);
alter table platform_settlements add column occupancy_nights integer check(occupancy_nights>=0);
alter table platform_settlements add column payout_reference text;
alter table platform_settlements add constraint platform_name check(platform in ('Holidu','Booking.com','Airbnb'));
alter table platform_settlements add constraint settlement_amounts check(gross_amount>=0 and commission>=0 and payout>=0);
alter table platform_settlements add constraint settlement_period check(period_end>=period_start);
create unique index settlements_reference on platform_settlements(organization_id,platform,reference) where reference is not null;
alter table tax_deadlines add constraint deadline_status check(status in ('open','done'));
create table finance_settings(
 organization_id uuid primary key references organizations(id), framework text not null default 'SKR03' check(framework in ('SKR03','SKR04')),
 advisor_number text check(advisor_number ~ '^[0-9]{4,7}$'), client_number text check(client_number ~ '^[0-9]{1,5}$'),
 fiscal_year_start date not null default make_date(extract(year from current_date)::integer,1,1),
 account_length integer not null default 4 check(account_length between 4 and 8),
 datev_test_import_confirmed boolean not null default false
);
create table import_batches(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),bank_account_id uuid,kind text not null,filename text not null,sha256 text not null,row_count integer not null default 0,created_at timestamptz not null default now(),actor_id uuid references auth.users(id));
create table export_batches(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),kind text not null,starts_on date not null,ends_on date not null,posting_ids uuid[] not null,data_base64 text not null,file_sha256 text not null,created_at timestamptz not null default now(),actor_id uuid references auth.users(id));

-- Composite foreign keys prevent cross-tenant links even for authorized writers.
do $$declare t text; r record;begin
 foreach t in array array['cost_centers','chart_accounts','documents','postings','bank_transactions','tax_subjects','employees','assets','interest_accounts','insurance_contracts','bank_accounts','properties','loans','payroll_periods','import_batches'] loop
 execute format('alter table %I add constraint %I unique(organization_id,id)',t,t||'_tenant_id');
 end loop;
 for r in select * from (values
 ('documents','cost_center_id','cost_centers'),('postings','document_id','documents'),('postings','debit_account_id','chart_accounts'),('postings','credit_account_id','chart_accounts'),('postings','reversal_of','postings'),
 ('posting_allocations','posting_id','postings'),('posting_allocations','cost_center_id','cost_centers'),('bank_matches','bank_transaction_id','bank_transactions'),('bank_matches','document_id','documents'),
 ('bank_transactions','bank_account_id','bank_accounts'),('bank_transactions','import_batch_id','import_batches'),('import_batches','bank_account_id','bank_accounts'),
 ('time_entries','employee_id','employees'),('time_entries','cost_center_id','cost_centers'),('tax_deadlines','tax_subject_id','tax_subjects'),('assets','tax_subject_id','tax_subjects'),
 ('interest_accounts','tax_subject_id','tax_subjects'),('insurance_contracts','tax_subject_id','tax_subjects'),('interest_entries','interest_account_id','interest_accounts'),
 ('insurance_payments','insurance_contract_id','insurance_contracts'),('properties','tax_subject_id','tax_subjects'),('loans','property_id','properties'),('pension_records','tax_subject_id','tax_subjects'),
 ('platform_settlements','cost_center_id','cost_centers'),('bank_accounts','tax_subject_id','tax_subjects'),('interest_rate_history','interest_account_id','interest_accounts'),
 ('absences','employee_id','employees'),('payroll_items','employee_id','employees'),('rental_entries','property_id','properties'),('rental_entries','document_id','documents')
 ) as x(child,col,parent) loop
 execute format('alter table %I add constraint %I foreign key(organization_id,%I) references %I(organization_id,id)',r.child,r.child||'_'||r.col||'_tenant_fk',r.col,r.parent);
 end loop;
end$$;

-- Replace broad policies. Advisors never receive private/personnel data by default.
do $$declare t text; p record; read_rule text; write_rule text;begin
 foreach t in array array['cost_centers','chart_accounts','documents','bank_transactions','postings','posting_allocations','bank_matches','audit_events','tax_subjects','employees','time_entries','payroll_periods','tax_deadlines','assets','interest_accounts','insurance_contracts','integration_jobs','bank_accounts','interest_entries','insurance_payments','properties','loans','platform_settlements','pension_records','interest_rate_history','absences','payroll_items','rental_entries','finance_settings','import_batches','export_batches'] loop
 execute format('alter table %I enable row level security',t);
 for p in select policyname from pg_policies where schemaname='public' and tablename=t loop execute format('drop policy %I on %I',p.policyname,t);end loop;
 read_rule:='member_of(organization_id)';write_rule:='can_edit(organization_id)';
 if t=any(array['tax_subjects','tax_deadlines','assets','interest_accounts','insurance_contracts','interest_entries','insurance_payments','properties','loans','pension_records','interest_rate_history','rental_entries']) then read_rule:='can_private(organization_id)';write_rule:=read_rule;end if;
 if t=any(array['employees','time_entries','payroll_periods','absences','payroll_items']) then read_rule:='can_payroll(organization_id)';write_rule:=read_rule;end if;
 if t=any(array['cost_centers','chart_accounts','finance_settings','integration_jobs']) then write_rule:='is_admin(organization_id)';end if;
 if t='bank_accounts' then read_rule:='member_of(organization_id) and (account_type not in (''private'',''savings'') or can_private(organization_id))';write_rule:='can_edit(organization_id) and (account_type not in (''private'',''savings'') or can_private(organization_id))';end if;
 if t='bank_transactions' then read_rule:='member_of(organization_id) and (bank_account_id is null or exists(select 1 from bank_accounts b where b.id=bank_account_id and b.organization_id=organization_id))';write_rule:='can_edit(organization_id) and exists(select 1 from bank_accounts b where b.id=bank_account_id and b.organization_id=organization_id)';end if;
 if t='audit_events' then read_rule:='member_of(organization_id) and (entity_type not in (''tax_subjects'',''tax_deadlines'',''assets'',''interest_accounts'',''insurance_contracts'',''interest_entries'',''insurance_payments'',''properties'',''loans'',''pension_records'',''interest_rate_history'',''rental_entries'') or can_private(organization_id)) and (entity_type not in (''employees'',''time_entries'',''payroll_periods'',''absences'',''payroll_items'') or can_payroll(organization_id))';end if;
 execute format('create policy %I on %I for select to authenticated using(%s)',t||'_read',t,read_rule);
 if t<>all(array['audit_events','import_batches','export_batches','postings','posting_allocations','bank_matches']) then
 execute format('create policy %I on %I for insert to authenticated with check(%s)',t||'_insert',t,write_rule);
 execute format('create policy %I on %I for update to authenticated using(%s) with check(%s)',t||'_update',t,write_rule,write_rule);
 end if;
 end loop;
end$$;
-- Audit insert/update are trigger-only. Historical events are never mutable.
create function append_audit() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare row_data jsonb;begin
 row_data:=to_jsonb(new);if tg_table_name='export_batches' then row_data:=row_data-'data_base64';end if;
 insert into audit_events(organization_id,actor_id,entity_type,entity_id,action,details)
 values((row_data->>'organization_id')::uuid,auth.uid(),tg_table_name,(row_data->>'id')::uuid,tg_op,
 jsonb_build_object('before',case when tg_op='UPDATE' then to_jsonb(old) else null end,'after',row_data));
 return new;
end$$;
revoke all on function append_audit() from public;
create function immutable_audit() returns trigger language plpgsql as $$begin raise exception 'Audit events cannot be changed' using errcode='42501';end$$;
create trigger audit_immutable before update or delete on audit_events for each row execute function immutable_audit();
do $$declare t text;begin
 foreach t in array array['cost_centers','chart_accounts','documents','bank_transactions','postings','bank_matches','tax_subjects','employees','time_entries','tax_deadlines','assets','interest_accounts','insurance_contracts','bank_accounts','interest_entries','insurance_payments','properties','loans','platform_settlements','pension_records','interest_rate_history','absences','payroll_items','rental_entries','import_batches','export_batches'] loop
 execute format('create trigger audit_changes after insert or update on %I for each row execute function append_audit()',t);
 end loop;
end$$;
create function guard_document() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' and new.review_status<>'pending' then raise exception 'New documents must be pending';end if;
 if tg_op='UPDATE' then
 if new.organization_id<>old.organization_id or new.storage_path<>old.storage_path or new.sha256<>old.sha256 or new.original_filename<>old.original_filename or new.mime_type<>old.mime_type or new.tax_subject_id is distinct from old.tax_subject_id then raise exception 'Original document is immutable';end if;
 if exists(select 1 from postings where document_id=old.id and status in ('approved','exported')) then raise exception 'Approved document is locked';end if;
 new.version:=old.version+1;new.updated_at:=now();
 end if;
 if new.review_status='reviewed' and (new.upload_status<>'ready' or new.vendor is null or trim(new.vendor)='' or new.invoice_number is null or trim(new.invoice_number)='' or new.invoice_date is null or new.service_date is null or new.net_amount is null or new.vat_amount is null or new.gross_amount is null) then raise exception 'Required invoice fields are missing';end if;
 return new;
end$$;
create trigger document_guard before insert or update on documents for each row execute function guard_document();
create function guard_posting() returns trigger language plpgsql as $$
begin
 if tg_op='DELETE' and old.status in ('approved','exported') then raise exception 'Approved postings are immutable';end if;
 if tg_op='UPDATE' and old.status in ('approved','exported') then
 if to_jsonb(new)-'status'-'exported_at'<>to_jsonb(old)-'status'-'exported_at' or not(old.status='approved' and new.status='exported') then raise exception 'Approved postings are immutable';end if;
 end if;
 return new;
end$$;
create trigger posting_guard before update or delete on postings for each row execute function guard_posting();
-- Originals are append-only: no authenticated update/delete policies for Storage.
create function create_organization(org_name text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid;begin
 if auth.uid() is null or auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'MFA required' using errcode='42501';end if;
 if length(trim(org_name)) not between 1 and 120 then raise exception 'Invalid name';end if;
 insert into organizations(name) values(trim(org_name)) returning id into org;
 insert into memberships(organization_id,user_id,role) values(org,auth.uid(),'owner');
 insert into finance_settings(organization_id) values(org);
 insert into cost_centers(organization_id,code,name) values
 (org,'100','Kammberg 27b, Dänisches Ferienhaus'),(org,'110','Kammberg 27c, Tinyhaus'),
 (org,'120','Kammberg 58, Western Lodge'),(org,'130','Kammberg 29c, Neubau'),(org,'200','Allgemeine Betriebskosten');
 return org;
end$$;
revoke all on function create_organization(text) from public;
grant execute on function create_organization(text) to authenticated;
insert into finance_settings(organization_id) select id from organizations on conflict do nothing;
create index documents_search on documents(organization_id,invoice_date,review_status);
create index postings_journal on postings(organization_id,posting_date,status);
create index bank_transactions_dates on bank_transactions(organization_id,booked_on);
create index audit_entity on audit_events(organization_id,entity_type,entity_id,at desc);
commit;
