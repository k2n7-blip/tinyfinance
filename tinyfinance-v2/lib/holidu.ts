export type HoliduInput={guest_cents:number;commission_net_cents:number;commission_vat_cents:number;payout_cents:number;all_seven:boolean;commission_nineteen:boolean};
export function holiduSplit(x:HoliduInput){
 for(const v of [x.guest_cents,x.commission_net_cents,x.commission_vat_cents,x.payout_cents])if(!Number.isSafeInteger(v)||v<0||v>100000000)throw new Error('Ungültiger Centbetrag.');
 if(!x.all_seven||!x.commission_nineteen)throw new Error('Steuerliche Zuordnung am Original prüfen.');
 if(x.guest_cents===0||x.payout_cents<=0)throw new Error('Storno/Nullauszahlung separat prüfen.');
 if(x.guest_cents-x.commission_net_cents-x.commission_vat_cents!==x.payout_cents)throw new Error('Auszahlung stimmt nicht mit Erlös minus Gebühren überein.');
 if(Math.abs(Math.round(x.commission_net_cents*19/100)-x.commission_vat_cents)>1)throw new Error('Vorsteuer weicht von 19 % ab.');
 const revenue=Math.round(x.guest_cents*100/107);return {revenue,vat:x.guest_cents-revenue,expense:x.commission_net_cents,inputVat:x.commission_vat_cents,fees:x.commission_net_cents+x.commission_vat_cents,payout:x.payout_cents};
}
