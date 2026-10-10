begin;
create function save_posting(org uuid, payload jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare p_id uuid; doc documents%rowtype; s finance_settings%rowtype; split jsonb; total numeric:=0; amount_value numeric; existing postings%rowtype;begin
 if not can_edit(org) then raise exception 'Write denied' using errcode='42501';end if;
 amount_value:=(payload->>'amount')::numeric;
 if amount_value<=0 or amount_value<>round(amount_value,2) or amount_value>1000000000 then raise exception 'Invalid amount';end if;
 if payload->>'id' is not null then
 select * into existing from postings where id=(payload->>'id')::uuid and organization_id=org for update;
 if not found or existing.status not in ('draft','reviewed') or existing.version is distinct from (payload->>'version')::integer then raise exception 'Posting changed or locked' using errcode='40001';end if;
 p_id:=existing.id;
 end if;
 select * into doc from documents where id=(payload->>'document_id')::uuid and organization_id=org for update;
 if not found or (doc.tax_subject_id is not null and not can_private(org)) or doc.upload_status<>'ready' or doc.review_status<>'reviewed' or doc.currency<>'EUR' or doc.gross_amount<>amount_value then raise exception 'Document not reviewed or amount differs';end if;
 if (payload->>'debit_account_id')::uuid=(payload->>'credit_account_id')::uuid then raise exception 'Accounts must differ';end if;
 select * into s from finance_settings where organization_id=org;
 if not exists(select 1 from chart_accounts where id=(payload->>'debit_account_id')::uuid and organization_id=org and framework=s.framework)
 or not exists(select 1 from chart_accounts where id=(payload->>'credit_account_id')::uuid and organization_id=org and framework=s.framework) then raise exception 'Invalid chart accounts';end if;
 if jsonb_typeof(payload->'allocations')<>'array' or jsonb_array_length(payload->'allocations') not between 1 and 20 then raise exception 'Allocation required';end if;
 for split in select * from jsonb_array_elements(payload->'allocations') loop
 if (split->>'amount')::numeric<=0 or (split->>'amount')::numeric<>round((split->>'amount')::numeric,2)
 or not exists(select 1 from cost_centers where id=(split->>'cost_center_id')::uuid and organization_id=org and active) then raise exception 'Invalid allocation';end if;
 total:=total+(split->>'amount')::numeric;
 end loop;
 if total<>amount_value then raise exception 'Allocations must equal amount';end if;
 if p_id is null then
 insert into postings(organization_id,document_id,posting_date,amount,debit_account_id,credit_account_id,description,vat_code)
 values(org,doc.id,(payload->>'posting_date')::date,amount_value,(payload->>'debit_account_id')::uuid,(payload->>'credit_account_id')::uuid,left(payload->>'description',60),coalesce(payload->>'vat_code','')) returning id into p_id;
 else
 update postings set document_id=doc.id,posting_date=(payload->>'posting_date')::date,amount=amount_value,
 debit_account_id=(payload->>'debit_account_id')::uuid,credit_account_id=(payload->>'credit_account_id')::uuid,
 description=left(payload->>'description',60),vat_code=coalesce(payload->>'vat_code',''),status='draft',version=version+1 where id=p_id;
 delete from posting_allocations where posting_id=p_id;
 end if;
 for split in select * from jsonb_array_elements(payload->'allocations') loop
 insert into posting_allocations(organization_id,posting_id,cost_center_id,amount) values(org,p_id,(split->>'cost_center_id')::uuid,(split->>'amount')::numeric);
 end loop;
 return p_id;
end$$;
create function approve_posting(org uuid, posting uuid, expected_version integer) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare p postings%rowtype; s finance_settings%rowtype;begin
 if not can_review(org) then raise exception 'Review denied' using errcode='42501';end if;
 select * into p from postings where id=posting and organization_id=org for update;
 if not found or p.status not in ('draft','reviewed') or p.version is distinct from expected_version then raise exception 'Posting changed or locked' using errcode='40001';end if;
 select * into s from finance_settings where organization_id=org;
 if p.posting_date<s.fiscal_year_start or p.posting_date>=s.fiscal_year_start+interval '1 year' then raise exception 'Posting outside fiscal year';end if;
 if not exists(select 1 from documents where id=p.document_id and organization_id=org and review_status='reviewed' and gross_amount=p.amount and currency='EUR' and upload_status='ready' and (tax_subject_id is null or can_private(org))) then raise exception 'Document not reviewed';end if;
 if not exists(select 1 from chart_accounts where id=p.debit_account_id and organization_id=org and approved_by_advisor and framework=s.framework and length(account_number)=s.account_length)
 or not exists(select 1 from chart_accounts where id=p.credit_account_id and organization_id=org and approved_by_advisor and framework=s.framework and length(account_number)=s.account_length) then raise exception 'Unconfirmed accounts';end if;
 if (select sum(amount) from posting_allocations where posting_id=p.id) is distinct from p.amount then raise exception 'Allocation mismatch';end if;
 update postings set status='approved',approved_at=now(),approved_by=auth.uid(),version=version+1 where id=p.id;
end$$;
create function reverse_posting(org uuid, posting uuid, reversal_date date, reason text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare p postings%rowtype; new_id uuid;begin
 if not can_review(org) then raise exception 'Review denied' using errcode='42501';end if;
 if length(trim(reason)) not between 1 and 60 then raise exception 'Reason required';end if;
 select * into p from postings where id=posting and organization_id=org for update;
 if not found or not exists(select 1 from documents where id=p.document_id and (tax_subject_id is null or can_private(org))) or p.status not in ('approved','exported') or p.reversal_of is not null then raise exception 'Only original approved postings can be reversed';end if;
 if reversal_date<p.posting_date then raise exception 'Reversal before original';end if;
 if not exists(select 1 from finance_settings where organization_id=org and reversal_date>=fiscal_year_start and reversal_date<fiscal_year_start+interval '1 year') then raise exception 'Reversal outside fiscal year';end if;
 insert into postings(organization_id,document_id,posting_date,amount,debit_account_id,credit_account_id,description,vat_code,status,approved_at,approved_by,reversal_of)
 values(org,p.document_id,reversal_date,p.amount,p.credit_account_id,p.debit_account_id,trim(reason),p.vat_code,'approved',now(),auth.uid(),p.id) returning id into new_id;
 insert into posting_allocations(organization_id,posting_id,cost_center_id,amount) select org,new_id,cost_center_id,amount from posting_allocations where posting_id=p.id;
 return new_id;
end$$;
create function import_bank(org uuid, account uuid, filename text, file_hash text, rows jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r jsonb; batch uuid; added integer:=0; affected integer; account_currency text;begin
 if not can_edit(org) then raise exception 'Write denied' using errcode='42501';end if;
 select currency into account_currency from bank_accounts where id=account and organization_id=org and active and (account_type not in ('private','savings') or can_private(org)) for update;
 if not found then raise exception 'Account not accessible' using errcode='42501';end if;
 if jsonb_typeof(rows)<>'array' or jsonb_array_length(rows) not between 1 and 2000 then raise exception 'Invalid rows';end if;
 insert into import_batches(organization_id,bank_account_id,kind,filename,sha256,actor_id) values(org,account,'bank',left(filename,200),file_hash,auth.uid()) returning id into batch;
 for r in select * from jsonb_array_elements(rows) loop
 if (r->>'amount')::numeric=0 or (r->>'amount')::numeric<>round((r->>'amount')::numeric,2) or abs((r->>'amount')::numeric)>1000000000 or r->>'currency'<>account_currency or length(r->>'source_reference') not between 1 and 200 then raise exception 'Invalid bank row';end if;
 insert into bank_transactions(organization_id,bank_account_id,import_batch_id,booked_on,amount,currency,counterparty,purpose,source_reference)
 values(org,account,batch,(r->>'booked_on')::date,(r->>'amount')::numeric,account_currency,left(r->>'counterparty',200),left(r->>'purpose',1000),r->>'source_reference')
 on conflict(organization_id,bank_account_id,source_reference) do nothing;
 get diagnostics affected=row_count;
 if affected=0 and not exists(select 1 from bank_transactions where organization_id=org and bank_account_id=account and source_reference=r->>'source_reference' and booked_on=(r->>'booked_on')::date and amount=(r->>'amount')::numeric and currency=account_currency) then raise exception 'Bank reference exists with different data' using errcode='23505';end if;
 added:=added+affected;
 end loop;
 update import_batches set row_count=added where id=batch;
 return jsonb_build_object('imported',added,'duplicates',jsonb_array_length(rows)-added,'batch_id',batch);
end$$;
create function confirm_bank_match(org uuid, transaction_id uuid, doc_id uuid, matched_amount numeric) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare txn bank_transactions%rowtype; d documents%rowtype; match_id uuid;begin
 if not can_edit(org) then raise exception 'Write denied' using errcode='42501';end if;
 select * into txn from bank_transactions where id=transaction_id and organization_id=org for update;
 if not found or (txn.bank_account_id is not null and not exists(select 1 from bank_accounts where id=txn.bank_account_id and organization_id=org and (account_type not in ('private','savings') or can_private(org)))) then raise exception 'Transaction not found';end if;
 select * into d from documents where id=doc_id and organization_id=org for update;
 if not found or (d.tax_subject_id is not null and not can_private(org)) or d.upload_status<>'ready' or d.review_status<>'reviewed' or d.currency<>txn.currency or d.gross_amount is null then raise exception 'Document not eligible';end if;
 if matched_amount<=0 or matched_amount<>round(matched_amount,2) then raise exception 'Invalid matched amount';end if;
 if (d.direction='expense' and txn.amount>=0) or (d.direction='income' and txn.amount<=0) then raise exception 'Payment direction does not match document';end if;
 if matched_amount>bank_remaining(txn.id)
 or matched_amount+coalesce((select sum(amount) from bank_matches where document_id=d.id and status='confirmed'),0)>d.gross_amount then raise exception 'Matching exceeds outstanding amount';end if;
 insert into bank_matches(organization_id,bank_transaction_id,document_id,amount,status) values(org,txn.id,d.id,matched_amount,'confirmed') returning id into match_id;
 return match_id;
end$$;
create function reject_bank_match(org uuid, match_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not can_edit(org) then raise exception 'Write denied' using errcode='42501';end if;
 if not exists(select 1 from bank_matches m where m.id=match_id and m.organization_id=org and bank_accessible(org,m.bank_transaction_id) and document_accessible(org,m.document_id)) then raise exception 'Access denied' using errcode='42501';end if;
 update bank_matches set status='rejected' where id=match_id and organization_id=org and status='confirmed';
 if not found then raise exception 'Match not found';end if;
end$$;
create function finalize_export(org uuid, posting_ids uuid[], starts date, ends date, artifact text, artifact_hash text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare p postings%rowtype; count_found integer:=0; batch uuid;begin
 if not can_review(org) then raise exception 'Export denied' using errcode='42501';end if;
 if not exists(select 1 from finance_settings where organization_id=org and datev_test_import_confirmed and advisor_number is not null and client_number is not null) then raise exception 'DATEV test import not confirmed';end if;
 if length(artifact)>14000000 or encode(digest(decode(artifact,'base64'),'sha256'),'hex')<>artifact_hash then raise exception 'Invalid export artifact';end if;
 if cardinality(posting_ids) not between 1 and 10000 or starts>ends then raise exception 'Invalid export selection';end if;
 for p in select * from postings where id=any(posting_ids) and organization_id=org order by id for update loop
 if not exists(select 1 from documents where id=p.document_id and (tax_subject_id is null or can_private(org))) or p.status<>'approved' or p.posting_date not between starts and ends then raise exception 'Posting already exported or outside range';end if;
 count_found:=count_found+1;
 end loop;
 if count_found<>cardinality(posting_ids) then raise exception 'Invalid posting selection';end if;
 insert into export_batches(organization_id,kind,starts_on,ends_on,posting_ids,data_base64,file_sha256,actor_id) values(org,'datev',starts,ends,posting_ids,artifact,artifact_hash,auth.uid()) returning id into batch;
 update postings set status='exported',exported_at=now() where id=any(posting_ids);
 return batch;
end$$;
create function dashboard_totals(org uuid) returns jsonb language plpgsql stable security invoker set search_path=public,pg_temp as $$
begin
 if not member_of(org) then raise exception 'Read denied' using errcode='42501';end if;
 return jsonb_build_object(
 'documents',(select count(*) from documents where organization_id=org),
 'pending',(select count(*) from documents where organization_id=org and review_status='pending'),
 'postings',(select count(*) from postings where organization_id=org and status in ('approved','exported')),
 'bank',(select count(*) from bank_transactions where organization_id=org),
 'unmatched',(select count(*) from bank_transactions t where organization_id=org and abs(amount)>coalesce((select sum(amount) from bank_matches m where m.bank_transaction_id=t.id and m.status='confirmed'),0)+coalesce((select sum(amount) from settlement_matches m where m.bank_transaction_id=t.id and m.status='confirmed'),0)+case when exists(select 1 from bank_transfers f where f.status='confirmed' and t.id in (f.debit_transaction_id,f.credit_transaction_id)) then abs(t.amount) else 0 end),
 'platform_gross',coalesce((select sum(gross_amount) from platform_settlements where organization_id=org),0),
 'platform_fees',coalesce((select sum(commission) from platform_settlements where organization_id=org),0));
end$$;
do $$declare r record;begin
 for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('save_posting','approve_posting','reverse_posting','import_bank','confirm_bank_match','reject_bank_match','finalize_export','dashboard_totals') loop
 execute format('revoke all on function %s from public',r.signature);
 execute format('grant execute on function %s to authenticated',r.signature);
 end loop;
end$$;
commit;
