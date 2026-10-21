const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const mod = {exports:{}};
new Function('exports', ts.transpileModule(fs.readFileSync('lib/wallet-totals.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod.exports);
const {isPendingBooking, retainedPayment} = mod.exports;
test('cancelled and refunded reservations do not inflate pending trips', () => {
  const bookings = [
    {status:'reserved',paymentStatus:'unpaid'},
    {status:'cancelled',paymentStatus:'unpaid'},
    {status:'reserved',paymentStatus:'refunded'},
    {status:'paid',paymentStatus:'refunded'},
    {status:'confirmed',paymentStatus:'paid'},
  ];
  assert.equal(bookings.filter(isPendingBooking).length,1);
});
test('recorded payments reconcile full refunds and partial refunds in cents', () => {
  const payment = {type:'ride_payment',status:'pending_payout',grossAmount:10,amount:8.8,platformFee:1.2};
  assert.deepEqual(retainedPayment(payment),{gross:10,fee:1.2,net:8.8});
  assert.deepEqual(retainedPayment({...payment,status:'refunded',amount:0,refundedCents:1000}),{gross:0,fee:0,net:0});
  assert.deepEqual(retainedPayment({...payment,amount:4.4,refundedCents:500}),{gross:5,fee:0.6,net:4.4});
});
