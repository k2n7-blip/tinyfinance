begin;
alter table tax_subjects add column saver_allowance numeric(14,2) not null default 1000 check(saver_allowance>=0);
create unique index employee_team_reference on employees(organization_id,external_team_id) where external_team_id is not null;
create function import_records(org uuid, kind text, rows jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r jsonb;new_id uuid;expected_platform platform_settlements%rowtype;actual_platform platform_settlements%rowtype;expected_time time_entries%rowtype;actual_time time_entries%rowtype;key text;added integer:=0;begin
 if kind='platforms' and not can_edit(org) or kind='time-entries' and not can_payroll(org) then raise exception 'Write denied' using errcode='42501';end if;
 if kind not in ('platforms','time-entries') or jsonb_typeof(rows)<>'array' or jsonb_array_length(rows) not between 1 and 2000 then raise exception 'Invalid import';end if;
 for r in select * from jsonb_array_elements(rows) loop
 new_id:=null;
 if kind='platforms' then
 expected_platform:=jsonb_populate_record(null::platform_settlements,r);
 if expected_platform.status<>'draft' then raise exception 'Imported settlements must be draft';end if;
 insert into platform_settlements(organization_id,platform,reference,booking_reference,cost_center_id,period_start,period_end,gross_amount,commission,refunds,payout,payout_reference,guest_nights,occupancy_nights,status)
 values(org,expected_platform.platform,expected_platform.reference,expected_platform.booking_reference,expected_platform.cost_center_id,expected_platform.period_start,expected_platform.period_end,expected_platform.gross_amount,expected_platform.commission,expected_platform.refunds,expected_platform.payout,expected_platform.payout_reference,expected_platform.guest_nights,expected_platform.occupancy_nights,'draft')
 on conflict(organization_id,platform,reference) where reference is not null do nothing returning id into new_id;
 if new_id is null then
 select * into actual_platform from platform_settlements where organization_id=org and platform=expected_platform.platform and reference=expected_platform.reference for update;
 for key in select jsonb_object_keys(r) loop
 if key<>'status' and to_jsonb(actual_platform)->key is distinct from to_jsonb(expected_platform)->key then raise exception 'Reference exists with different data' using errcode='23505';end if;
 end loop;
 end if;
 else
 expected_time:=jsonb_populate_record(null::time_entries,r);
 if expected_time.approval_status<>'approved' then raise exception 'Only approved time entries may be imported';end if;
 insert into time_entries(organization_id,employee_id,cost_center_id,worked_on,minutes,source_id,approval_status)
 values(org,expected_time.employee_id,expected_time.cost_center_id,expected_time.worked_on,expected_time.minutes,expected_time.source_id,'approved')
 on conflict(organization_id,source_id) do nothing returning id into new_id;
 if new_id is null then
 select * into actual_time from time_entries where organization_id=org and source_id=expected_time.source_id for update;
 for key in select jsonb_object_keys(r) loop
 if key<>'approval_status' and to_jsonb(actual_time)->key is distinct from to_jsonb(expected_time)->key then raise exception 'Reference exists with different data' using errcode='23505';end if;
 end loop;
 end if;
 end if;
 if new_id is not null then added:=added+1;end if;
 end loop;
 return jsonb_build_object('imported',added,'duplicates',jsonb_array_length(rows)-added);
end$$;
revoke all on function import_records(uuid,text,jsonb) from public;
grant execute on function import_records(uuid,text,jsonb) to authenticated;
-- Rematching after a recorded rejection is allowed; a confirmed pair remains unique.
alter table bank_matches drop constraint matches_pair_unique;
create unique index bank_matches_confirmed_pair on bank_matches(organization_id,bank_transaction_id,document_id) where status='confirmed';
commit;
