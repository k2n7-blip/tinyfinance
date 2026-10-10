begin;
-- Numeric NaN compares greater than normal values in PostgreSQL. Reject it at the DB boundary.
do $$declare r record;begin
 for r in select c.relname table_name,a.attname column_name from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and a.atttypid='numeric'::regtype and not a.attisdropped loop
 execute format('alter table %I add constraint %I check(%I is null or %I::text not in (''NaN'',''Infinity'',''-Infinity''))',r.table_name,r.table_name||'_'||r.column_name||'_finite',r.column_name,r.column_name);
 end loop;
end$$;
create function bank_accessible(org uuid, transaction_id uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select member_of(org) and exists(select 1 from bank_transactions t where t.id=transaction_id and t.organization_id=org and (t.bank_account_id is null or exists(select 1 from bank_accounts b where b.id=t.bank_account_id and b.organization_id=org and (b.account_type not in ('private','savings') or can_private(org)))))
$$;
create function document_accessible(org uuid, doc_id uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select member_of(org) and exists(select 1 from documents where id=doc_id and organization_id=org and (tax_subject_id is null or can_private(org)))
$$;
revoke all on function bank_accessible(uuid,uuid),document_accessible(uuid,uuid) from public;
-- Helpers are internal to SECURITY DEFINER operations, not an existence oracle.
create function guard_center() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.code<>old.code and exists(select 1 from posting_allocations a join postings p on p.id=a.posting_id where a.cost_center_id=old.id and p.status in ('approved','exported')) then raise exception 'Historical cost center code is locked';end if;
 return new;
end$$;
create trigger cost_center_history before update on cost_centers for each row execute function guard_center();
revoke all on function guard_center() from public;
commit;
