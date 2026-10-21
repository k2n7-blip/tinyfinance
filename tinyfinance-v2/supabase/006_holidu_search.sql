-- Run after 001–005. Internal journal, not a DATEV export or external booking.
create table public.holidu_settlements(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 document_id uuid not null references public.documents(id),bank_transaction_id uuid not null references public.bank_transactions(id),cost_center_id uuid not null references public.cost_centers(id),
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
create policy holidu_read on public.holidu_settlements for select to authenticated using(public.member_of(organization_id));
create policy holidu_journal_read on public.holidu_journals for select to authenticated using(public.member_of(organization_id));
create policy holidu_add on public.holidu_settlements for insert to authenticated with check(public.can_edit(organization_id) and created_by=auth.uid()
 and exists(select 1 from public.documents d where d.id=document_id and d.organization_id=holidu_settlements.organization_id)
 and exists(select 1 from public.bank_transactions b where b.id=bank_transaction_id and b.organization_id=holidu_settlements.organization_id)
 and exists(select 1 from public.cost_centers c where c.id=cost_center_id and c.organization_id=holidu_settlements.organization_id));
-- No direct journal writes: this function validates and commits the whole batch atomically.
create function public.book_holidu_batch(org uuid,selected uuid[]) returns integer language plpgsql security definer set search_path=public as $$
declare s public.holidu_settlements; n integer:=0; net bigint; cnt integer;
begin
 if not public.can_edit(org) then raise exception 'Kein Schreibzugriff';end if;
 if cardinality(selected) is null or cardinality(selected)<1 or cardinality(selected)>100 then raise exception '1 bis 100 Belege auswählen';end if;
 select count(distinct x) into cnt from unnest(selected) x;
 if cnt<>cardinality(selected) then raise exception 'Doppelte Auswahl';end if;
 if (select count(*) from public.holidu_settlements where organization_id=org and id=any(selected))<>cnt then raise exception 'Auswahl nicht vollständig zugänglich';end if;
 for s in select * from public.holidu_settlements where organization_id=org and id=any(selected) order by id for update loop
 if exists(select 1 from public.holidu_journals where settlement_id=s.id) then raise exception 'Bereits gebucht: %',s.reference;end if;
 perform 1 from public.documents where id=s.document_id and organization_id=org and review_status='reviewed' for update;
 if not found then raise exception 'Originalbeleg nicht geprüft: %',s.reference;end if;
 perform 1 from public.bank_transactions where id=s.bank_transaction_id and organization_id=org and round(amount*100)=s.payout_cents for update;
 if not found then raise exception 'Bankauszahlung stimmt nicht: %',s.reference;end if;
 if exists(select 1 from public.bank_matches where bank_transaction_id=s.bank_transaction_id and status='confirmed') then raise exception 'Bankumsatz bereits zugeordnet: %',s.reference;end if;
 if exists(select 1 from public.postings where organization_id=org and document_id=s.document_id) then raise exception 'Beleg hat bereits Buchungen: %',s.reference;end if;
 net:=round(s.guest_cents::numeric*100/107);
 insert into public.holidu_journals(organization_id,settlement_id,booked_by,lines) values(org,s.id,auth.uid(),jsonb_build_array(
 jsonb_build_object('account',s.bank_account,'debit_cents',s.guest_cents,'credit_cents',0),
 jsonb_build_object('account','4300','debit_cents',0,'credit_cents',net),
 jsonb_build_object('account','USt 7 %','debit_cents',0,'credit_cents',s.guest_cents-net),
 jsonb_build_object('account','6600','debit_cents',s.commission_net_cents,'credit_cents',0),
 jsonb_build_object('account','Vorsteuer 19 %','debit_cents',s.commission_vat_cents,'credit_cents',0),
 jsonb_build_object('account',s.bank_account,'debit_cents',0,'credit_cents',s.commission_net_cents+s.commission_vat_cents)));
 insert into public.bank_matches(organization_id,bank_transaction_id,document_id,amount,status) values(org,s.bank_transaction_id,s.document_id,s.payout_cents::numeric/100,'confirmed');
 n:=n+1;
 end loop;return n;
end $$;
revoke all on function public.book_holidu_batch(uuid,uuid[]) from public;
grant execute on function public.book_holidu_batch(uuid,uuid[]) to authenticated;
-- SECURITY INVOKER retains RLS; literal substring matching avoids wildcard surprises.
create function public.search_finance(term text,skip integer default 0) returns table(source text,id uuid,details jsonb) language sql stable security invoker set search_path=public as $$
 select * from (
 select 'Beleg'::text,d.id,to_jsonb(d)-'storage_path'-'sha256' from public.documents d
 union all select 'Bank',b.id,to_jsonb(b) from public.bank_transactions b
 union all select 'Kostenstelle',c.id,to_jsonb(c) from public.cost_centers c
 union all select 'Jahresimport',r.id,to_jsonb(r)-'sha256' from public.rental_imports r
 union all select 'Versorgung',u.id,to_jsonb(u) from public.utility_records u
 union all select 'Immobilie',p.id,to_jsonb(p) from public.properties p
 union all select 'Kredit',l.id,to_jsonb(l) from public.loans l
 union all select 'Holidu',h.id,to_jsonb(h) from public.holidu_settlements h
 union all select 'Holidu-Buchung',j.id,to_jsonb(j) from public.holidu_journals j
 ) q(source,id,details) where length(term) between 2 and 120 and strpos(lower(source||' '||details::text),lower(term))>0
 order by source,id limit 51 offset greatest(0,least(skip,100000));
$$;
revoke all on function public.search_finance(text,integer) from public;
grant execute on function public.search_finance(text,integer) to authenticated;
