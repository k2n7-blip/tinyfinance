begin;
alter table documents add column discarded_at timestamptz;
alter table documents add column discarded_by uuid references auth.users(id);
create function guard_document_trash() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' and new.discarded_at is not null then raise exception 'New document cannot be discarded';end if;
 if tg_op='UPDATE' and old.discarded_at is not null and new.discarded_at is not null then raise exception 'Restore discarded document before editing';end if;
 if tg_op='UPDATE' and new.discarded_at is distinct from old.discarded_at then
  if not can_edit(old.organization_id) or not document_accessible(old.organization_id,old.id) then raise exception 'Write denied' using errcode='42501';end if;
  if exists(select 1 from postings where document_id=old.id) or exists(select 1 from bank_matches where document_id=old.id and status='confirmed') or exists(select 1 from rental_entries where document_id=old.id) then raise exception 'Linked document cannot be discarded or restored' using errcode='23503';end if;
  if new.discarded_at is not null then new.discarded_at:=now();new.discarded_by:=auth.uid();else new.discarded_by:=null;end if;
 end if;
 if new.discarded_at is null then new.discarded_by:=null;end if;
 return new;
end$$;
create trigger document_discard_guard before insert or update on documents for each row execute function guard_document_trash();
create function set_document_trash(org uuid, doc_id uuid, expected_version integer, trash boolean) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d documents%rowtype;begin
 if not can_edit(org) or not document_accessible(org,doc_id) then raise exception 'Write denied' using errcode='42501';end if;
 select * into d from documents where id=doc_id and organization_id=org for update;
 if not found then raise exception 'Document not found' using errcode='P0002';end if;
 if d.version is distinct from expected_version then raise exception 'Document version changed' using errcode='40001';end if;
 if (d.discarded_at is not null)=trash then raise exception 'Document state changed' using errcode='40001';end if;
 update documents set discarded_at=case when trash then now() else null end where id=doc_id returning * into d;
 return to_jsonb(d);
end$$;
create function guard_document_live_link() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare d documents%rowtype;begin
 if new.document_id is not null then
  select * into d from documents where id=new.document_id for update;
  if found and d.discarded_at is not null then raise exception 'Restore discarded document before linking' using errcode='23503';end if;
 end if;
 return new;
end$$;
create trigger posting_document_live before insert or update on postings for each row execute function guard_document_live_link();
create trigger bank_match_document_live before insert or update on bank_matches for each row execute function guard_document_live_link();
create trigger rental_document_live before insert or update on rental_entries for each row execute function guard_document_live_link();
revoke all on function guard_document_live_link() from public;
revoke all on function guard_document_trash(),set_document_trash(uuid,uuid,integer,boolean) from public;
grant execute on function set_document_trash(uuid,uuid,integer,boolean) to authenticated;
commit;
