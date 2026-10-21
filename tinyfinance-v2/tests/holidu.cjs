const ts=require('typescript'),fs=require('node:fs'),Module=require('node:module'),assert=require('node:assert/strict'),path=require('node:path');
const filename=path.resolve('lib/holidu.ts');const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,filename);
const valid={guest_cents:10700,commission_net_cents:1000,commission_vat_cents:190,payout_cents:9510,all_seven:true,commission_nineteen:true};
assert.deepEqual(m.exports.holiduSplit(valid),{revenue:10000,vat:700,expense:1000,inputVat:190,fees:1190,payout:9510});
for(const change of [{payout_cents:9511},{all_seven:false},{commission_nineteen:false},{guest_cents:NaN},{guest_cents:1.01},{commission_vat_cents:180,payout_cents:9520}])assert.throws(()=>m.exports.holiduSplit({...valid,...change}));
// Individual tax rounding can differ by one cent; retain the documented VAT.
assert.equal(m.exports.holiduSplit({...valid,commission_vat_cents:189,payout_cents:9511}).inputVat,189);
console.log('PASS Holidu split, balancing, consent, invalid inputs and document VAT rounding');
