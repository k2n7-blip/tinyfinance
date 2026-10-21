begin;
alter table assets add column value numeric(14,2) check(value>=0);
alter table assets add column notes text;
alter table documents add column tax_subject_id uuid;
alter table documents add constraint document_subject_tenant foreign key(organization_id,tax_subject_id) references tax_subjects(organization_id,id);
alter table documents add column upload_status text not null default 'ready' check(upload_status in ('uploading','ready','failed'));
alter table finance_settings add column ai_enabled boolean not null default false;
alter table bank_accounts add column balance numeric(14,2);
-- Existing documents remain business documents; assigning private scope requires private permission.
drop policy documents_read on documents;
drop policy documents_insert on documents;
drop policy documents_update on documents;
create policy documents_read on documents for select to authenticated using(member_of(organization_id) and (tax_subject_id is null or can_private(organization_id)));
create policy documents_insert on documents for insert to authenticated with check(can_edit(organization_id) and (tax_subject_id is null or can_private(organization_id)));
create policy documents_update on documents for update to authenticated using(can_edit(organization_id) and (tax_subject_id is null or can_private(organization_id))) with check(can_edit(organization_id) and (tax_subject_id is null or can_private(organization_id)));
-- Storage access follows document classification and requires a matching reserved document.
drop policy docs_storage_read on storage.objects;
drop policy docs_storage_insert on storage.objects;
create policy docs_storage_read on storage.objects for select to authenticated using(bucket_id='documents' and exists(select 1 from documents d where d.storage_path=name));
create policy docs_storage_insert on storage.objects for insert to authenticated with check(bucket_id='documents' and exists(select 1 from documents d where d.storage_path=name and d.upload_status in ('uploading','failed') and can_edit(d.organization_id)));
-- Sensitive bank data must not leak via matches, batches, or audit details.
drop policy bank_matches_read on bank_matches;
create policy bank_matches_read on bank_matches for select to authenticated using(member_of(organization_id) and exists(select 1 from bank_transactions t where t.id=bank_transaction_id) and exists(select 1 from documents d where d.id=document_id));
drop policy import_batches_read on import_batches;
create policy import_batches_read on import_batches for select to authenticated using(member_of(organization_id) and (bank_account_id is null or exists(select 1 from bank_accounts b where b.id=bank_account_id)));
drop policy postings_read on postings;
create policy postings_read on postings for select to authenticated using(member_of(organization_id) and exists(select 1 from documents d where d.id=document_id));
drop policy posting_allocations_read on posting_allocations;
create policy posting_allocations_read on posting_allocations for select to authenticated using(member_of(organization_id) and exists(select 1 from postings p where p.id=posting_id));
drop policy audit_events_read on audit_events;
create policy audit_events_read on audit_events for select to authenticated using(
 is_admin(organization_id) or (member_of(organization_id)
 and entity_type=any(array['cost_centers','chart_accounts','platform_settlements','postings','documents','bank_transactions','bank_matches'])
 and (entity_type<>'documents' or exists(select 1 from documents d where d.id=entity_id))
 and (entity_type<>'postings' or exists(select 1 from postings p where p.id=entity_id))
 and (entity_type<>'bank_transactions' or exists(select 1 from bank_transactions t where t.id=entity_id))
 and (entity_type<>'bank_matches' or exists(select 1 from bank_matches m where m.id=entity_id)))
 or (can_private(organization_id) and entity_type=any(array['tax_subjects','tax_deadlines','assets','interest_accounts','insurance_contracts','interest_entries','insurance_payments','properties','loans','pension_records','interest_rate_history','rental_entries']))
 or (can_payroll(organization_id) and entity_type=any(array['employees','time_entries','payroll_periods','absences','payroll_items']))
);
create function guard_record() returns trigger language plpgsql as $$
begin
 if new.organization_id<>old.organization_id then raise exception 'Tenant cannot be changed' using errcode='42501';end if;
 new.record_version:=old.record_version+1;
 return new;
end$$;
do $$declare t text;begin
 foreach t in array array['cost_centers','chart_accounts','tax_subjects','employees','time_entries','tax_deadlines','assets','interest_accounts','insurance_contracts','bank_accounts','interest_entries','insurance_payments','properties','loans','platform_settlements','pension_records','interest_rate_history','absences','payroll_items','rental_entries','finance_settings'] loop
 execute format('alter table %I add column record_version integer not null default 1',t);
 execute format('create trigger record_guard before update on %I for each row execute function guard_record()',t);
 end loop;
end$$;
create function guard_account() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_table_name='bank_accounts' then
 if new.account_type<>old.account_type or new.tax_subject_id is distinct from old.tax_subject_id then raise exception 'Account classification is immutable';end if;
 else
 if (new.account_number<>old.account_number or new.framework<>old.framework or new.approved_by_advisor<>old.approved_by_advisor or new.kind<>old.kind)
 and exists(select 1 from postings where (debit_account_id=old.id or credit_account_id=old.id) and status in ('approved','exported')) then raise exception 'Approved posting account is locked';end if;
 end if;
 return new;
end$$;
create trigger bank_account_guard before update on bank_accounts for each row execute function guard_account();
create trigger chart_account_guard before update on chart_accounts for each row execute function guard_account();
drop policy bank_transactions_update on bank_transactions;
drop policy export_batches_read on export_batches;
create policy export_batches_read on export_batches for select to authenticated using(member_of(organization_id) and not exists(select 1 from unnest(posting_ids) pid where not exists(select 1 from postings p where p.id=pid)));
-- Membership administration requires an authenticated AAL2 owner, with last-admin protection.
create function set_membership(org uuid, member_id uuid, member_role text, allow_private boolean, allow_payroll boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not is_admin(org) then raise exception 'Admin required' using errcode='42501';end if;
 perform 1 from organizations where id=org for update;
 if member_role not in ('owner','bookkeeper','advisor_read','advisor_review','viewer') then raise exception 'Invalid role';end if;
 if member_role<>'owner' and exists(select 1 from memberships where organization_id=org and user_id=member_id and role='owner')
 and (select count(*) from memberships where organization_id=org and role='owner')=1 then raise exception 'Last administrator cannot be demoted';end if;
 if member_role<>'bookkeeper' and (allow_private or allow_payroll) then raise exception 'Scopes are for bookkeepers only';end if;
 insert into memberships(organization_id,user_id,role,private_access,payroll_access) values(org,member_id,member_role,allow_private,allow_payroll)
 on conflict(organization_id,user_id) do update set role=excluded.role,private_access=excluded.private_access,payroll_access=excluded.payroll_access;
 insert into audit_events(organization_id,actor_id,entity_type,entity_id,action,details) values(org,auth.uid(),'memberships',member_id,'SET_ROLE',jsonb_build_object('role',member_role,'private',allow_private,'payroll',allow_payroll));
end$$;
revoke all on function set_membership(uuid,uuid,text,boolean,boolean) from public;
grant execute on function set_membership(uuid,uuid,text,boolean,boolean) to authenticated;
create function revoke_membership(org uuid, member_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not is_admin(org) then raise exception 'Admin required' using errcode='42501';end if;
 perform 1 from organizations where id=org for update;
 if exists(select 1 from memberships where organization_id=org and user_id=member_id and role='owner') and (select count(*) from memberships where organization_id=org and role='owner')=1 then raise exception 'Last administrator cannot be removed';end if;
 delete from memberships where organization_id=org and user_id=member_id;
 insert into audit_events(organization_id,actor_id,entity_type,entity_id,action) values(org,auth.uid(),'memberships',member_id,'REVOKE');
end$$;
revoke all on function revoke_membership(uuid,uuid) from public;
grant execute on function revoke_membership(uuid,uuid) to authenticated;
create function audit_settings() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='UPDATE' and (new.framework<>old.framework or new.account_length<>old.account_length)
 and exists(select 1 from postings where organization_id=old.organization_id and status in ('approved','exported')) then raise exception 'Fiscal chart is locked';end if;
 insert into audit_events(organization_id,actor_id,entity_type,entity_id,action,details)
 values(new.organization_id,auth.uid(),'finance_settings',new.organization_id,tg_op,jsonb_build_object('after',to_jsonb(new)));
 return new;
end$$;
create trigger settings_audit before insert or update on finance_settings for each row execute function audit_settings();
create function audit_allocation() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare r posting_allocations%rowtype;begin
 if tg_op='DELETE' then r:=old;else r:=new;end if;
 insert into audit_events(organization_id,actor_id,entity_type,entity_id,action,details) values(r.organization_id,auth.uid(),'posting_allocations',r.posting_id,tg_op,to_jsonb(r));
 return null;
end$$;
create trigger allocation_audit after insert or delete on posting_allocations for each row execute function audit_allocation();
revoke all on function audit_settings(),audit_allocation(),guard_record(),guard_account(),guard_document(),guard_posting(),immutable_audit() from public;
commit;
