import {pageContext} from '@/lib/access';import FinanceShell from '../components/finance-shell';import GlobalSearch from '../components/global-search';
export const dynamic='force-dynamic';
export default async function Search(){const a=await pageContext();return <FinanceShell title="Globale Suche" subtitle="Durchsucht gespeicherte Felder deiner zugänglichen Bereiche. PDF-Volltexte sind nicht enthalten." role={a.role} privateAccess={a.privateAccess} payrollAccess={a.payrollAccess}><GlobalSearch/></FinanceShell>}
