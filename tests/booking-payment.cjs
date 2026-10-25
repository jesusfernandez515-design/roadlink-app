const {test}=require('node:test'); const assert=require('node:assert/strict'); const fs=require('node:fs'); const ts=require('typescript');
const output=ts.transpileModule(fs.readFileSync('lib/booking-payment.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const mod={exports:{}};new Function('module','exports',output)(mod,mod.exports);const {canPayBooking}=mod.exports;
const now=Date.parse('2026-10-22T20:00:00Z');
const future={status:'reserved',paymentStatus:'unpaid',date:'2026-10-22',time:'18:00'};
test('only future unpaid or pending reservations can offer checkout',()=>{
 assert(canPayBooking(future,now));assert(canPayBooking({...future,status:'payment_pending',paymentStatus:'pending'},now));
 for(const status of ['completed','cancelled','rejected','confirmed','paid',undefined])assert.equal(canPayBooking({...future,status},now),false);
 for(const paymentStatus of ['paid','refunded','partially_refunded','failed',undefined])assert.equal(canPayBooking({...future,paymentStatus},now),false);
});
test('payment eligibility uses Puerto Rico departure and rejects past, exact and unknown dates',()=>{
 assert.equal(canPayBooking(future,Date.parse('2026-10-22T22:00:00Z')),false);
 assert.equal(canPayBooking(future,Date.parse('2026-10-22T22:01:00Z')),false);
 assert.equal(canPayBooking({...future,date:undefined},now),false);
 assert.equal(canPayBooking({...future,time:'invalid'},now),false);
});
