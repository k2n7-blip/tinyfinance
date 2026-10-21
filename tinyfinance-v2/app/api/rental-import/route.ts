import {NextRequest,NextResponse} from 'next/server';
import {createHash} from 'crypto';
import {currentUser} from '@/lib/supabase';
import {readRental} from '@/lib/rental-import';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 const {client,user}=await currentUser();if(!user)return NextResponse.json({error:'Bitte anmelden.'},{status:401});
 try{
 const form=await req.formData(),file=form.get('file'),year=Number(form.get('year')),organization=String(form.get('organization_id')||'');
 if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.xlsx')||file.size>5*1024*1024||!Number.isInteger(year)||year<2000||year>2100)throw new Error('XLSX bis 5 MB und ein gültiges Jahr erforderlich.');
 const {data:membership}=await client.from('memberships').select('role').eq('user_id',user.id).eq('organization_id',organization).in('role',['owner','bookkeeper']).maybeSingle();
 if(!membership)return NextResponse.json({error:'Kein Schreibzugriff.'},{status:403});
 const bytes=Buffer.from(await file.arrayBuffer()),parsed=await readRental(bytes);const hash=createHash('sha256').update(bytes).digest('hex');
 const headingYear=parsed.heading.match(/20\d{2}/)?.[0];
 if(headingYear&&Number(headingYear)!==year)parsed.warnings.push(`Überschrift nennt ${headingYear}; ausgewähltes Importjahr ist ${year}. Bitte prüfen.`);
 const preview={...parsed,year,filename:file.name,hash};
 if(form.get('confirm')!=='yes')return NextResponse.json({preview});
 const {error}=await client.from('rental_imports').insert({organization_id:organization,year,filename:file.name,sha256:hash,payload:parsed,created_by:user.id});
 if(error){if(error.code==='23505')return NextResponse.json({error:'Diese Datei wurde für dieses Jahr bereits importiert.'},{status:409});throw new Error(error.message);}
 return NextResponse.json({saved:true});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Import fehlgeschlagen.'},{status:400});}
}
