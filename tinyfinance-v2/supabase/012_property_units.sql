begin;
alter table properties add column active boolean not null default true;
create table property_units (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id), property_id uuid not null,
 name text not null check(length(trim(name)) between 1 and 120), usage_type text not null check(usage_type in ('owner_occupied','long_term_rental','holiday_rental','workers_rental')),
 area_sqm numeric(10,2) check(area_sqm>0), active boolean not null default true, notes text, record_version integer not null default 1,
 unique(organization_id,id),unique(organization_id,property_id,id),unique(organization_id,property_id,name),
 foreign key(organization_id,property_id) references properties(organization_id,id)
);
alter table property_units enable row level security;
create policy units_read on property_units for select to authenticated using(can_private(organization_id));
create policy units_insert on property_units for insert to authenticated with check(can_private(organization_id));
create policy units_update on property_units for update to authenticated using(can_private(organization_id)) with check(can_private(organization_id));
create policy units_delete on property_units for delete to authenticated using(can_private(organization_id));
create policy properties_delete on properties for delete to authenticated using(can_private(organization_id));
create trigger record_guard before update on property_units for each row execute function guard_record();
create trigger audit_changes after insert or update on property_units for each row execute function append_audit();
alter table rental_entries add column unit_id uuid;
alter table rental_entries add constraint rental_unit_property foreign key(organization_id,property_id,unit_id) references property_units(organization_id,property_id,id);
create function audit_private_delete() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin
 insert into audit_events(organization_id,actor_id,entity_type,entity_id,action,details) values(old.organization_id,auth.uid(),tg_table_name,old.id,'DELETE',jsonb_build_object('before',to_jsonb(old),'after',null));return old;
end$$;
create trigger units_delete_audit after delete on property_units for each row execute function audit_private_delete();
create trigger properties_delete_audit after delete on properties for each row execute function audit_private_delete();
revoke all on function audit_private_delete() from public;
-- Unit audit shares the same private-access boundary as property audit.
create policy units_audit_read on audit_events for select to authenticated using(entity_type='property_units' and can_private(organization_id));
grant select,insert,update,delete on property_units to authenticated;
grant delete on properties to authenticated;
commit;
