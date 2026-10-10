-- Einmalig im Supabase SQL Editor ausführen, nachdem 001_initial.sql installiert wurde.
-- Deaktivierte Kostenstellen bleiben für historische Buchungen bestehen.
alter table public.cost_centers add column if not exists active boolean not null default true;
-- Bestehende RLS-Policies aus 001_initial.sql gelten weiterhin.
