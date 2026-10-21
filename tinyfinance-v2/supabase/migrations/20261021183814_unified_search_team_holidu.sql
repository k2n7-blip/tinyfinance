-- Additive extension to existing workflow schema 001–013.
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
 execute format('create policy %I on public.%I for select to authenticated using(public.can_private(organization_id))',t||'_read',t);
 execute format('create policy %I on public.%I for insert to authenticated with check(public.can_private(organization_id))',t||'_insert',t);
 end loop; end $$;
-- Run after 001–005. Internal journal, not a DATEV export or external booking.
create table public.holidu_settlements(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 platform_settlement_id uuid not null unique references public.platform_settlements(id),document_id uuid not null references public.documents(id),bank_transaction_id uuid not null references public.bank_transactions(id),cost_center_id uuid not null references public.cost_centers(id),
 reference text not null,date date not null check(extract(year from date)=2026),
 guest_cents bigint not null check(guest_cents between 1 and 100000000),commission_net_cents bigint not null check(commission_net_cents between 0 and 100000000),commission_vat_cents bigint not null check(commission_vat_cents between 0 and 100000000),payout_cents bigint not null check(payout_cents between 1 and 100000000),
 all_seven boolean not null check(all_seven),commission_nineteen boolean not null check(commission_nineteen),bank_account text not null check(bank_account ~ '^\d{4}$'),
 created_by uuid references auth.users(id),created_at timestamptz not null default now(),
 unique(organization_id,reference),unique(organization_id,document_id),unique(organization_id,bank_transaction_id),
 check(guest_cents-commission_net_cents-commission_vat_cents=payout_cents),
 check(abs(round(commission_net_cents*0.19)-commission_vat_cents)<=1)
);
create table public.holidu_journals(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),settlement_id uuid not null unique references public.holidu_settlements(id),
 template_version text not null default 'annette-holidu-2026-v1',lines jsonb not null,booked_by uuid references auth.users(id),booked_at timestamptz not null default now()
);
alter table public.holidu_settlements enable row level security;
alter table public.holidu_journals enable row level security;
create policy holidu_read on public.holidu_settlements for select to authenticated using(public.member_of(organization_id) and exists(select 1 from public.documents d where d.id=holidu_settlements.document_id) and exists(select 1 from public.bank_transactions b where b.id=holidu_settlements.bank_transaction_id));
create policy holidu_journal_read on public.holidu_journals for select to authenticated using(public.member_of(organization_id) and exists(select 1 from public.holidu_settlements s where s.id=holidu_journals.settlement_id));
create policy holidu_add on public.holidu_settlements for insert to authenticated with check(public.can_edit(organization_id) and created_by=auth.uid()
 and exists(select 1 from public.platform_settlements p where p.id=platform_settlement_id and p.organization_id=holidu_settlements.organization_id and p.platform='Holidu' and p.reference=holidu_settlements.reference and p.status<>'cancelled' and p.refunds=0 and round(p.gross_amount*100)=holidu_settlements.guest_cents and round(p.commission*100)=holidu_settlements.commission_net_cents+holidu_settlements.commission_vat_cents and round(p.payout*100)=holidu_settlements.payout_cents and p.cost_center_id=holidu_settlements.cost_center_id)
 and exists(select 1 from public.documents d where d.id=document_id and d.organization_id=holidu_settlements.organization_id)
 and exists(select 1 from public.bank_transactions b where b.id=bank_transaction_id and b.organization_id=holidu_settlements.organization_id)
 and exists(select 1 from public.cost_centers c where c.id=cost_center_id and c.organization_id=holidu_settlements.organization_id));
-- No direct journal writes: this function validates and commits the whole batch atomically.
create function public.book_holidu_batch(org uuid,selected uuid[]) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.holidu_settlements; n integer:=0; net bigint; cnt integer;
begin
 if auth.uid() is null or not public.can_edit(org) or not public.can_review(org) then raise exception 'Kein Schreibzugriff';end if;
 if cardinality(selected) is null or cardinality(selected)<1 or cardinality(selected)>100 then raise exception '1 bis 100 Belege auswählen';end if;
 select count(distinct x) into cnt from unnest(selected) x;
 if cnt<>cardinality(selected) then raise exception 'Doppelte Auswahl';end if;
 if (select count(*) from public.holidu_settlements where organization_id=org and id=any(selected))<>cnt then raise exception 'Auswahl nicht vollständig zugänglich';end if;
 for s in select * from public.holidu_settlements where organization_id=org and id=any(selected) order by id for update loop
 if exists(select 1 from public.holidu_journals where settlement_id=s.id) then raise exception 'Bereits gebucht: %',s.reference;end if;
 perform 1 from public.platform_settlements p where p.id=s.platform_settlement_id and p.organization_id=org and p.platform='Holidu' and p.reference=s.reference and p.status<>'cancelled' and p.refunds=0 and round(p.gross_amount*100)=s.guest_cents and round(p.commission*100)=s.commission_net_cents+s.commission_vat_cents and round(p.payout*100)=s.payout_cents and p.cost_center_id=s.cost_center_id for update;
 if not found then raise exception 'Plattformabrechnung geändert: %',s.reference;end if;
 if not document_accessible(org,s.document_id) or not bank_accessible(org,s.bank_transaction_id) then raise exception 'Beleg oder Bank nicht zugänglich';end if;
 perform 1 from public.documents where id=s.document_id and organization_id=org and review_status='reviewed' and upload_status='ready' and discarded_at is null and currency='EUR' for update;
 if not found then raise exception 'Originalbeleg nicht geprüft: %',s.reference;end if;
 perform 1 from public.bank_transactions where id=s.bank_transaction_id and organization_id=org and round(amount*100)=s.payout_cents for update;
 if not found then raise exception 'Bankauszahlung stimmt nicht: %',s.reference;end if;
 if public.bank_remaining(s.bank_transaction_id)<>s.payout_cents::numeric/100 then raise exception 'Bankumsatz bereits zugeordnet: %',s.reference;end if;
 if exists(select 1 from public.postings where organization_id=org and document_id=s.document_id) then raise exception 'Beleg hat bereits Buchungen: %',s.reference;end if;
 net:=round(s.guest_cents::numeric*100/107);
 insert into public.holidu_journals(organization_id,settlement_id,booked_by,lines) values(org,s.id,auth.uid(),jsonb_build_array(
 jsonb_build_object('account',s.bank_account,'debit_cents',s.guest_cents,'credit_cents',0),
 jsonb_build_object('account','4300','debit_cents',0,'credit_cents',net),
 jsonb_build_object('account','USt 7 %','debit_cents',0,'credit_cents',s.guest_cents-net),
 jsonb_build_object('account','6600','debit_cents',s.commission_net_cents,'credit_cents',0),
 jsonb_build_object('account','Vorsteuer 19 %','debit_cents',s.commission_vat_cents,'credit_cents',0),
 jsonb_build_object('account',s.bank_account,'debit_cents',0,'credit_cents',s.commission_net_cents+s.commission_vat_cents)));
 perform public.confirm_settlement_match(org,s.bank_transaction_id,s.platform_settlement_id,s.payout_cents::numeric/100);
 n:=n+1;
 end loop;return n;
end $$;
revoke all on function public.book_holidu_batch(uuid,uuid[]) from public;
grant execute on function public.book_holidu_batch(uuid,uuid[]) to authenticated;
-- TinyFinance only. No TinyTeam schema or data is modified.

create function public.import_tinyteam_times(org uuid,items jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r jsonb; emp uuid; old public.time_entries; added integer:=0; skipped integer:=0; matches integer; src text;
begin
 if auth.uid() is null or not public.can_payroll(org) then raise exception 'Kein Schreibzugriff';end if;
 if jsonb_typeof(items)<>'array' or jsonb_array_length(items)<1 or jsonb_array_length(items)>2000 then raise exception 'Ungültiger Importumfang';end if;
 -- Serialize all imports for the organization, including employee creation.
 perform 1 from public.organizations where id=org for update;
 for r in select value from jsonb_array_elements(items) loop
 if coalesce(r->>'personnel','') !~ '^[a-zA-Z0-9_-]{1,40}$' or coalesce(r->>'source_id','') !~ '^tinyteam-v13:[a-zA-Z0-9_-]{1,100}$' then raise exception 'Personalnummer/Zeit-ID ungültig';end if;
 if (r->>'minutes') is null or (r->>'minutes') !~ '^[0-9]+$' or (r->>'minutes')::integer not between 1 and 1440 then raise exception 'Minuten ungültig';end if;
 if (r->>'date') is null or (r->>'date') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' then raise exception 'Datum ungültig';end if;
 if not exists(select 1 from public.cost_centers where id=(r->>'cost_center_id')::uuid and organization_id=org) then raise exception 'Kostenstelle nicht zugänglich';end if;
 select count(*),min(id::text)::uuid into matches,emp from public.employees where organization_id=org and personnel_number=r->>'personnel';
 if matches>1 then raise exception 'Personalnummer mehrfach vorhanden: %',r->>'personnel';end if;
 if matches=0 then insert into public.employees(organization_id,personnel_number,name,active) values(org,r->>'personnel',left(r->>'name',120),true) returning id into emp;end if;
 src:=r->>'source_id';
 select * into old from public.time_entries where organization_id=org and source_id=src for update;
 if found then
 if old.employee_id is distinct from emp or old.worked_on is distinct from (r->>'date')::date or old.minutes is distinct from (r->>'minutes')::integer or old.cost_center_id is distinct from (r->>'cost_center_id')::uuid then raise exception 'Geänderte bereits importierte Zeit: %. Bitte separat prüfen.',src;end if;
 skipped:=skipped+1;
 else
 insert into public.time_entries(organization_id,employee_id,cost_center_id,worked_on,minutes,source_id,approval_status) values(org,emp,(r->>'cost_center_id')::uuid,(r->>'date')::date,(r->>'minutes')::integer,src,'pending');added:=added+1;
 end if;
 end loop;
 return jsonb_build_object('imported',added,'skipped',skipped);
end $$;
revoke all on function public.import_tinyteam_times(uuid,jsonb) from public;
grant execute on function public.import_tinyteam_times(uuid,jsonb) to authenticated;

create function public.search_finance(org uuid,term text,skip integer default 0) returns table(source text,id uuid,label text,url text) language sql stable security invoker set search_path=public,pg_temp as $$
 select source,id,label,url from (
 select 'Beleg'::text source,d.id,concat_ws(' · ',d.original_filename,d.invoice_number,d.vendor) label,'/documents?document='||d.id url,to_jsonb(d)-'extraction_suggestion'-'storage_path'-'sha256'-'extraction_error' details from public.documents d where d.organization_id=org and d.discarded_at is null
 union all select 'Bank',b.id,concat_ws(' · ',b.booked_on,b.counterparty,b.amount),'/bank',to_jsonb(b) from public.bank_transactions b where b.organization_id=org
 union all select 'Plattform',p.id,concat_ws(' · ',p.platform,p.reference,p.gross_amount),'/finance/platforms',to_jsonb(p) from public.platform_settlements p where p.organization_id=org
 union all select 'Kostenstelle',c.id,concat_ws(' · ',c.code,c.name),'/finance/cost-centers',to_jsonb(c) from public.cost_centers c where c.organization_id=org
 union all select 'Immobilie',p.id,p.name,'/finance/properties',to_jsonb(p) from public.properties p where p.organization_id=org
 union all select 'Kredit',l.id,l.lender,'/finance/loans',to_jsonb(l) from public.loans l where l.organization_id=org
 union all select 'Personal',e.id,concat_ws(' · ',e.name,e.personnel_number),'/finance/employees',to_jsonb(e) from public.employees e where e.organization_id=org
 union all select 'Zähler',m.id,concat_ws(' · ',m.name,m.serial_number),'/finance/property-meters',to_jsonb(m) from public.property_meters m where m.organization_id=org
 union all select 'Jahresübersicht',r.id,concat_ws(' · ',r.year,r.filename),'/rental',to_jsonb(r)-'sha256' from public.rental_imports r where r.organization_id=org
 union all select 'Versorger',u.id,u.property_name,'/rental',to_jsonb(u) from public.utility_records u where u.organization_id=org
 union all select 'Holidu-Buchung',h.id,h.reference,'/holidu',to_jsonb(h) from public.holidu_settlements h where h.organization_id=org
 ) q where public.member_of(org) and length(term) between 2 and 120 and strpos(lower(source||' '||details::text),lower(term))>0 order by source,id limit 51 offset greatest(0,least(skip,100000));
$$;
revoke all on function public.search_finance(uuid,text,integer) from public,anon;
grant execute on function public.search_finance(uuid,text,integer) to authenticated;

revoke all on public.rental_imports,public.utility_records,public.holidu_settlements,public.holidu_journals from anon,authenticated;
grant select,insert on public.rental_imports,public.utility_records,public.holidu_settlements to authenticated;
grant select on public.holidu_journals to authenticated;
revoke all on function public.book_holidu_batch(uuid,uuid[]),public.import_tinyteam_times(uuid,jsonb) from anon;
create index on public.rental_imports(organization_id,year);
create index on public.utility_records(organization_id);
create index on public.holidu_settlements(organization_id,date);
create index on public.holidu_journals(organization_id);

-- Protect booked originals from parallel accounting and trashing.
create function public.guard_holidu_original() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_table_name='documents' then
  if new.discarded_at is not null and exists(select 1 from public.holidu_settlements s join public.holidu_journals j on j.settlement_id=s.id where s.document_id=new.id) then raise exception 'Gebuchter Holidu-Originalbeleg ist gesperrt' using errcode='23503';end if;
 else
  if exists(select 1 from public.holidu_settlements s join public.holidu_journals j on j.settlement_id=s.id where s.document_id=new.document_id) then raise exception 'Beleg bereits über Holidu-Vorlage gebucht' using errcode='23503';end if;
 end if;return new;
end $$;
revoke all on function public.guard_holidu_original() from public,anon,authenticated;
create trigger holidu_document_lock before update on public.documents for each row execute function public.guard_holidu_original();
create trigger holidu_posting_lock before insert or update on public.postings for each row execute function public.guard_holidu_original();
-- Existing explicit authenticated grants remain; remove anonymous default grants.
do $$declare f record;begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef loop
  execute format('revoke execute on function %s from anon',f.signature);
 end loop;
end $$;
alter function public.immutable_audit() set search_path=public,pg_temp;
alter function public.guard_posting() set search_path=public,pg_temp;
alter function public.guard_record() set search_path=public,pg_temp;
