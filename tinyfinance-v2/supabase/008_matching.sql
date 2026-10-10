begin;
alter table chart_accounts add column kind text not null default 'asset' check(kind in ('asset','liability','income','expense','bank'));
alter table documents add column direction text not null default 'expense' check(direction in ('expense','income'));
alter table platform_settlements add constraint settlement_payout_equal check(gross_amount-commission-refunds=payout);
alter table platform_settlements add constraint settlement_status check(status in ('draft','reconciled','cancelled'));
alter table platform_settlements add constraint settlement_tenant_id unique(organization_id,id);
create table settlement_matches(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),bank_transaction_id uuid not null,settlement_id uuid not null,amount numeric(14,2) not null check(amount>0),status text not null default 'confirmed' check(status in ('confirmed','rejected')),
 foreign key(organization_id,bank_transaction_id) references bank_transactions(organization_id,id),foreign key(organization_id,settlement_id) references platform_settlements(organization_id,id));
create table bank_transfers(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations(id),debit_transaction_id uuid not null,credit_transaction_id uuid not null,status text not null default 'confirmed' check(status in ('confirmed','rejected')),
 foreign key(organization_id,debit_transaction_id) references bank_transactions(organization_id,id),foreign key(organization_id,credit_transaction_id) references bank_transactions(organization_id,id));
alter table settlement_matches enable row level security;
alter table bank_transfers enable row level security;
create policy settlement_matches_read on settlement_matches for select to authenticated using(member_of(organization_id) and exists(select 1 from bank_transactions t where t.id=bank_transaction_id));
create policy bank_transfers_read on bank_transfers for select to authenticated using(member_of(organization_id) and exists(select 1 from bank_transactions t where t.id=debit_transaction_id) and exists(select 1 from bank_transactions t where t.id=credit_transaction_id));
create trigger settlement_audit after insert or update on settlement_matches for each row execute function append_audit();
create trigger transfer_audit after insert or update on bank_transfers for each row execute function append_audit();
create function bank_remaining(transaction_id uuid) returns numeric language sql stable security definer set search_path=public,pg_temp as $$
 select abs(t.amount)-coalesce((select sum(amount) from bank_matches where bank_transaction_id=t.id and status='confirmed'),0)
 -coalesce((select sum(amount) from settlement_matches where bank_transaction_id=t.id and status='confirmed'),0)
 -case when exists(select 1 from bank_transfers where status='confirmed' and t.id in (debit_transaction_id,credit_transaction_id)) then abs(t.amount) else 0 end
 from bank_transactions t where t.id=transaction_id
$$;
revoke all on function bank_remaining(uuid) from public;
create function confirm_settlement_match(org uuid, transaction_id uuid, settlement uuid, matched_amount numeric) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare txn bank_transactions%rowtype;s platform_settlements%rowtype;match_id uuid;total numeric;begin
 if not can_edit(org) then raise exception 'Write denied' using errcode='42501';end if;
 select * into txn from bank_transactions where id=transaction_id and organization_id=org for update;
 if not found or txn.amount<=0 or txn.currency<>'EUR' or not exists(select 1 from bank_accounts where id=txn.bank_account_id and organization_id=org and (account_type not in ('private','savings') or can_private(org))) then raise exception 'Transaction not eligible';end if;
 select * into s from platform_settlements where id=settlement and organization_id=org for update;
 if not found or s.status='cancelled' then raise exception 'Settlement not eligible';end if;
 if matched_amount<=0 or matched_amount<>round(matched_amount,2) or matched_amount>bank_remaining(txn.id) then raise exception 'Invalid matched amount';end if;
 total:=coalesce((select sum(amount) from settlement_matches where settlement_id=s.id and status='confirmed'),0)+matched_amount;
 if total>s.payout then raise exception 'Matching exceeds payout';end if;
 insert into settlement_matches(organization_id,bank_transaction_id,settlement_id,amount) values(org,txn.id,s.id,matched_amount) returning id into match_id;
 update platform_settlements set status=case when total=payout then 'reconciled' else 'draft' end where id=s.id;
 return match_id;
end$$;
create function confirm_bank_transfer(org uuid, debit_transaction uuid, credit_transaction uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare debit bank_transactions%rowtype;credit bank_transactions%rowtype;new_id uuid;begin
 if not can_edit(org) then raise exception 'Write denied' using errcode='42501';end if;
 perform 1 from bank_transactions where id in (debit_transaction,credit_transaction) and organization_id=org order by id for update;
 select * into debit from bank_transactions where id=debit_transaction and organization_id=org;
 select * into credit from bank_transactions where id=credit_transaction and organization_id=org;
 if debit.id is null or credit.id is null or debit.amount>=0 or credit.amount<=0 or debit.amount+credit.amount<>0 or debit.currency<>credit.currency or debit.bank_account_id=credit.bank_account_id then raise exception 'Invalid transfer';end if;
 if not exists(select 1 from bank_accounts where id=debit.bank_account_id and organization_id=org and (account_type not in ('private','savings') or can_private(org)))
 or not exists(select 1 from bank_accounts where id=credit.bank_account_id and organization_id=org and (account_type not in ('private','savings') or can_private(org))) then raise exception 'Account access denied' using errcode='42501';end if;
 if bank_remaining(debit.id)<>abs(debit.amount) or bank_remaining(credit.id)<>credit.amount then raise exception 'Transaction already matched';end if;
 insert into bank_transfers(organization_id,debit_transaction_id,credit_transaction_id) values(org,debit.id,credit.id) returning id into new_id;
 return new_id;
end$$;
create function reject_finance_match(org uuid, match_id uuid, kind text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s_id uuid;begin
 if not can_edit(org) then raise exception 'Write denied' using errcode='42501';end if;
 if kind='platform' then
 select settlement_id into s_id from settlement_matches where id=match_id and organization_id=org and status='confirmed' for update;
 if not found then raise exception 'Match not found';end if;
 if not exists(select 1 from settlement_matches m where m.id=match_id and bank_accessible(org,m.bank_transaction_id)) then raise exception 'Access denied' using errcode='42501';end if;
 perform 1 from platform_settlements where id=s_id for update;
 update settlement_matches set status='rejected' where id=match_id;
 update platform_settlements set status='draft' where id=s_id;
 elsif kind='transfer' then
 if not exists(select 1 from bank_transfers f where f.id=match_id and f.organization_id=org and bank_accessible(org,f.debit_transaction_id) and bank_accessible(org,f.credit_transaction_id)) then raise exception 'Access denied' using errcode='42501';end if;
 update bank_transfers set status='rejected' where id=match_id and organization_id=org and status='confirmed';
 if not found then raise exception 'Transfer not found';end if;
 else raise exception 'Invalid match kind';end if;
end$$;
create function guard_settlement() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' and new.status='reconciled' then raise exception 'Reconciliation requires bank matching';end if;
 if tg_op='UPDATE' then
 if exists(select 1 from settlement_matches where settlement_id=old.id and status='confirmed') and (new.gross_amount is distinct from old.gross_amount or new.commission is distinct from old.commission or new.refunds<>old.refunds or new.payout is distinct from old.payout or new.cost_center_id is distinct from old.cost_center_id or new.status='cancelled') then raise exception 'Matched settlement is locked';end if;
 if new.status='reconciled' and coalesce((select sum(amount) from settlement_matches where settlement_id=new.id and status='confirmed'),0)<>new.payout then raise exception 'Unmatched settlement';end if;
 end if;return new;
end$$;
create trigger settlement_guard before insert or update on platform_settlements for each row execute function guard_settlement();
do $$declare r record;begin
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('confirm_settlement_match','confirm_bank_transfer','reject_finance_match') loop
 execute format('revoke all on function %s from public',r.signature);execute format('grant execute on function %s to authenticated',r.signature);
 end loop;
end$$;
revoke all on function guard_settlement() from public;
commit;
