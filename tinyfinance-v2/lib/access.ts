import {currentUser} from './supabase';
export async function context(edit=false){const {client,user}=await currentUser();if(!user)return null;const {data:m}=await client.from('memberships').select('organization_id,role').eq('user_id',user.id).limit(1).maybeSingle();if(!m||edit&&!['owner','bookkeeper'].includes(m.role))return null;return {client,user,org:m.organization_id,role:m.role};}
