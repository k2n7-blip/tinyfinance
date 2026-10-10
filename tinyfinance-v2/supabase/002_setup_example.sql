-- Run ONLY after you created your own Supabase Auth user.
-- Replace the placeholder UUID with auth.users.id from Supabase dashboard.
-- DO NOT commit real personal identifiers to GitHub.
DO $$ DECLARE org uuid; BEGIN
 INSERT INTO organizations(name) VALUES('TinyHäuser Brekendorf') RETURNING id INTO org;
 INSERT INTO memberships(organization_id,user_id,role) VALUES(org,'00000000-0000-0000-0000-000000000000'::uuid,'owner');
 INSERT INTO cost_centers(organization_id,code,name) VALUES
 (org,'100','Dänisches Tinyhaus 27b'),(org,'110','Tinyhaus 27c'),(org,'120','Western Lodge 58'),(org,'130','Neubau 29c'),(org,'200','Gemeinschaft');
END $$;
