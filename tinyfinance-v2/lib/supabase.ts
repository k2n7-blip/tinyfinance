import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export async function db() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{
    cookies:{getAll(){return jar.getAll()},setAll(items){try{items.forEach(({name,value,options})=>jar.set(name,value,options))}catch{}}}
  });
}
export async function currentUser(){const client=await db();const {data:{user}}=await client.auth.getUser();return {client,user};}
