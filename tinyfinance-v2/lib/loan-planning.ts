import {z} from 'zod';
import {validDate} from './money';
import {addMonths,subtractMonths,forecastLoan} from './forecasts';
const date=z.string().refine(validDate,'Gültiges Datum erforderlich');
export const loanPlanSchema=z.object({key:z.string().min(1).max(500),name:z.string().min(1).max(500),balance:z.number().finite().min(0).max(1e10),as_of:date,rate:z.number().finite().min(0).max(100),payment:z.number().finite().min(0).max(1e8),fixed_until:date,notice_months:z.number().int().min(1).max(66),changes:z.array(z.object({date,rate:z.number().finite().min(0).max(100),payment:z.number().finite().min(0).max(1e8)}).strict()).max(30).default([]),specials:z.array(z.object({date,amount:z.number().finite().min(0).max(1e10)}).strict()).max(100).default([])}).strict().refine(p=>p.fixed_until>p.as_of,'Zinsbindungsende muss nach dem Stichtag liegen').refine(p=>p.changes.every(c=>c.date>p.as_of&&c.date<=p.fixed_until)&&p.specials.every(c=>c.date>p.as_of&&c.date<=p.fixed_until),'Änderungen müssen innerhalb des Planungszeitraums liegen');
export type LoanPlan=z.infer<typeof loanPlanSchema>;
export function projectLoan(input:LoanPlan,target:string){
 const plan=loanPlanSchema.parse(input);if(!validDate(target)||target<plan.as_of)throw Error('Ziel liegt vor dem bestätigten Saldo.');
 const end=target<plan.fixed_until?target:plan.fixed_until;let balance=Math.round(plan.balance*100),rate=plan.rate,payment=plan.payment;
 const changes=[...plan.changes].sort((a,b)=>a.date.localeCompare(b.date)),specials=[...plan.specials].sort((a,b)=>a.date.localeCompare(b.date));let ci=0,si=0;
 const rows:{date:string;balance:number;interest:number;principal:number;payment:number;special:number}[]=[];
 for(let month=1;month<=600&&balance>0;month++){
 const on=addMonths(plan.as_of,month);if(on>end)break;
 while(ci<changes.length&&changes[ci].date<=on){rate=changes[ci].rate;payment=changes[ci].payment;ci++;}
 const r=forecastLoan((balance/100).toFixed(2),rate,payment.toFixed(2),1)[0];balance=r.balance;let special=0;
 while(si<specials.length&&specials[si].date<=on){const paid=Math.min(balance,Math.round(specials[si].amount*100));balance-=paid;special+=paid;si++;}
 rows.push({date:on,balance,interest:r.interest,principal:r.principal,payment:r.payment,special});
 }
 if(balance>0&&specials.slice(si).some(s=>s.date<=end))throw Error('Eine Sondertilgung liegt nach der letzten Modellrate. Datum auf einen monatlichen Zahlungstermin legen.');
 if(addMonths(plan.as_of,601)<=end&&balance>0)throw Error('Planungszeitraum maximal 50 Jahre.');
 return {balance,rows,stoppedAtFixedEnd:target>plan.fixed_until,requestOn:subtractMonths(plan.fixed_until,plan.notice_months),negativeAmortization:rows.some(r=>r.principal<0)};
}
