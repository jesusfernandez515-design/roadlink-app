const { readFileSync } = require('node:fs');
const { test, before, after } = require('node:test');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, getDoc, collection, query, where, getDocs } = require('firebase/firestore');
let env;
const driver = 'XmpCtSTIS6cf7r8UMc2UxLFj6qH3', passenger = 'DefaRi3pT2c5ZKs5gwc66lywFWN2';
const user = (uid, email) => env.authenticatedContext(uid, { email, email_verified:true }).firestore();
before(async () => {
 env = await initializeTestEnvironment({ projectId:'demo-roadlink-security', firestore:{rules:readFileSync('firestore.test.rules','utf8')} });
 await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();
 await setDoc(doc(db,'bookings','b'),{passengerId:passenger,driverId:driver,status:'reserved',price:10});
 await setDoc(doc(db,'users',passenger),{email:'p@example.com',role:'passenger',name:'P'});
 await setDoc(doc(db,'users',driver),{email:'d@example.com',role:'driver'});
 await setDoc(doc(db,'rides','r'),{driverId:driver,seats:2,originalSeats:2,status:'active'});
 await setDoc(doc(db,'payments','p'),{driverId:driver,passengerId:passenger,status:'pending'});
 await setDoc(doc(db,'payoutRequests','request'),{userId:driver,amount:8.8,status:'pending'});
 });
});
after(async()=>env?.cleanup());
test('anonymous, unverified and non-pilot cannot read rides',async()=>{
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'rides','r')));
 await assertFails(getDoc(doc(env.authenticatedContext('stranger',{email_verified:true}).firestore(),'rides','r')));
 await assertFails(getDoc(doc(env.authenticatedContext(passenger,{email_verified:false}).firestore(),'rides','r')));
});
test('pilot reads own bookings but cannot forge or change booking/payment/seat state',async()=>{
 const db=user(passenger,'p@example.com'); await assertSucceeds(getDoc(doc(db,'bookings','b')));
 await assertSucceeds(getDocs(query(collection(db,'bookings'),where('passengerId','==',passenger))));
 await assertFails(updateDoc(doc(db,'bookings','b'),{status:'paid'}));
 await assertFails(setDoc(doc(db,'bookings','forged'),{passengerId:passenger}));
 await assertFails(updateDoc(doc(db,'rides','r'),{seats:100}));
 await assertFails(updateDoc(doc(db,'payments','p'),{status:'paid'}));
 await assertFails(setDoc(doc(db,'walletTransactions','forged'),{driverId:passenger,amount:10000}));
});
test('profile updates cannot escalate roles or read other private profiles',async()=>{
 const db=user(passenger,'p@example.com'); await assertSucceeds(updateDoc(doc(db,'users',passenger),{name:'New'}));
 await assertFails(updateDoc(doc(db,'users',passenger),{role:'admin'}));
 await assertFails(getDoc(doc(db,'users',driver)));
 await assertFails(setDoc(doc(db,'stripeEvents','fake'),{processed:true}));
});
test('driver can read own payout history but cannot forge payouts or read another account history',async()=>{
 const db=user(driver,'d@example.com');
 await assertSucceeds(getDocs(query(collection(db,'payoutRequests'),where('userId','==',driver))));
 await assertFails(getDoc(doc(user(passenger,'p@example.com'),'payoutRequests','request')));
 await assertFails(setDoc(doc(db,'payoutRequests','forged'),{userId:driver,amount:10000}));
 await assertFails(updateDoc(doc(db,'payoutRequests','request'),{status:'paid'}));
});
