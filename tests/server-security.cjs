const {test}=require('node:test'); const assert=require('node:assert/strict'); const fs=require('node:fs'); const path=require('node:path'); const ts=require('typescript'); const Stripe=require('stripe');
class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
function database(seed={}){
 const rows=new Map(Object.entries(seed).map(([k,v])=>[k,structuredClone(v)])); let n=0;
 const snapshot=(ref)=>({id:ref.id,ref,exists:rows.has(ref.path),data:()=>rows.has(ref.path)?structuredClone(rows.get(ref.path)):undefined});
 const ref=(p)=>({path:p,id:p.split('/').pop()});
 function collection(p,filters=[],limit=Infinity){return {doc:(id)=>ref(`${p}/${id||`auto${++n}`}`),where:(k,op,v)=>collection(p,[...filters,[k,v]],limit),limit:(v)=>collection(p,filters,v),get:async()=>{const docs=[...rows.keys()].filter(k=>k.startsWith(p+'/')&&filters.every(([f,v])=>rows.get(k)[f]===v)).slice(0,limit).map(k=>snapshot(ref(k)));return {docs,size:docs.length};}};}
 return {rows,collection,runTransaction:async cb=>{const writes=[];const result=await cb({get:async r=>r.path?snapshot(r):r.get(),set:(r,v,o)=>writes.push(()=>rows.set(r.path,o?.merge?{...rows.get(r.path),...v}:v)),update:(r,v)=>writes.push(()=>{assert(rows.has(r.path)); rows.set(r.path,{...rows.get(r.path),...v});})});writes.forEach(f=>f());return result;}};
}
function harness(seed={},identity={uid:'p',email:'p@example.com',email_verified:true}){
 const db=database(seed), sessions=new Map();let seq=0;const sdk=new Stripe('sk_test_fake');
 const stripe={webhooks:sdk.webhooks,checkout:{sessions:{create:async(data,opts)=>{if(!sessions.has(opts.idempotencyKey))sessions.set(opts.idempotencyKey,{...data,id:`cs_test_${++seq}`,url:'https://checkout.stripe.com/test',status:'open'});return sessions.get(opts.idempotencyKey);},retrieve:async id=>[...sessions.values()].find(s=>s.id===id)}}};
 let configError=false;
 const helper={ApiError,documentId:v=>{if(typeof v!=='string'||!/^[\w-]{1,128}$/.test(v))throw new ApiError(400,'Invalid id');return v;},requirePassenger:async req=>{if(req.headers.get('authorization')!=='Bearer valid')throw new ApiError(401,'Invalid token');return {user:identity,db};},serverFirebase:()=>({db}),apiFailure:e=>Response.json({error:e.message},{status:e.status||500})};
 const cache={};function load(relative){const file=path.resolve(relative);if(cache[file])return cache[file];const out={exports:{}};cache[file]=out.exports;const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;const req=id=>{if(id.endsWith('firebase-admin'))return helper;if(id.endsWith('/payments'))return {...load('lib/server/payments.ts'),paymentConfig:()=>{if(configError)throw new ApiError(503,'Not configured');return {stripe,test:true,webhook:'whsec_test'};}};if(id==='./firebase-admin')return helper;return require(id);};new Function('require','module','exports',js)(req,out,out.exports);cache[file]=out.exports;return out.exports;}
 const routes={reserve:load('app/api/bookings/reserve/route.ts'),cancel:load('app/api/bookings/cancel/route.ts'),checkout:load('app/api/stripe/create-checkout-session/route.ts'),webhook:load('app/api/stripe/webhook/route.ts')};
 const call=(name,body,token='valid')=>routes[name].POST(new Request('https://preview.example/api',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)}));
 const event=async(type,object,id='evt_'+type)=>{const body=JSON.stringify({id,type,livemode:false,data:{object}});const signature=sdk.webhooks.generateTestHeaderString({payload:body,secret:'whsec_test'});return routes.webhook.POST(new Request('https://preview.example/api',{method:'POST',body,headers:{'stripe-signature':signature}}));};
 return {db,call,event,routes,stripe,sessions,setConfigError:()=>configError=true,load};
}
const ride={driverId:'d',driverEmail:'d@example.com',from:'Guayama',to:'Patillas',date:'2099-11-02',time:'11:00',seats:2,originalSeats:2,status:'active',price:10};
const booking={rideId:'r',passengerId:'p',driverId:'d',driverEmail:'d@example.com',from:'Guayama',to:'Patillas',date:'2099-11-02',time:'11:00',seatsBooked:1,price:10,status:'reserved',paymentStatus:'unpaid',reservationVersion:1};
const paidSession={id:'cs_test_1',metadata:{bookingId:'b',passengerId:'p',reservationVersion:'1',environment:'test'},payment_status:'paid',amount_total:1000,currency:'usd',payment_intent:'pi_1'};
test('reservation/cancellation preserves seats and blocks duplicate and foreign changes',async()=>{const h=harness({'rides/r':ride});assert.equal((await h.call('reserve',{rideId:'r'})).status,200);assert.equal(h.db.rows.get('rides/r').seats,1);assert.equal((await h.call('reserve',{rideId:'r'})).status,409);assert.equal((await h.call('cancel',{bookingId:'r_p'})).status,200);assert.equal((await h.call('cancel',{bookingId:'r_p'})).status,200);assert.equal(h.db.rows.get('rides/r').seats,2);const other=harness({'bookings/b':{...booking,passengerId:'other'}});assert.equal((await other.call('cancel',{bookingId:'b'})).status,403);});
test('self-reservations and unauthenticated checkout are rejected',async()=>{const h=harness({'rides/r':{...ride,driverId:'p'}});assert.equal((await h.call('reserve',{rideId:'r'})).status,403);assert.equal((await h.call('checkout',{bookingId:'b'},'invalid')).status,401);});
test('forged checkout identity cannot pay another passenger booking',async()=>{const h=harness({'bookings/b':{...booking,passengerId:'victim'},'rides/r':ride});assert.equal((await h.call('checkout',{bookingId:'b',userId:'victim',price:0.01})).status,403);assert.equal(h.sessions.size,0);});
test('checkout derives amount and origin, reuses session, locks cancellation',async()=>{const h=harness({'bookings/b':booking,'rides/r':ride});assert.equal((await h.call('checkout',{bookingId:'b',userId:'victim',userEmail:'attacker@example.com',price:0.01})).status,200);const s=[...h.sessions.values()][0];assert.equal(s.line_items[0].price_data.unit_amount,1000);assert.equal(s.customer_email,'p@example.com');assert(s.success_url.startsWith('https://preview.example/'));assert.equal((await h.call('checkout',{bookingId:'b'})).status,200);assert.equal(h.sessions.size,1);assert.equal((await h.call('cancel',{bookingId:'b'})).status,409);});
test('signed payment is applied once and partial/full refunds reconcile the same wallet',async()=>{const h=harness({'bookings/b':{...booking,status:'payment_pending',paymentStatus:'pending'},'rides/r':ride});assert.equal((await h.event('checkout.session.completed',paidSession,'evt_paid')).status,200);assert.equal((await h.event('checkout.session.completed',paidSession,'evt_paid')).status,200);assert.equal((await h.event('checkout.session.async_payment_succeeded',paidSession,'evt_paid_again')).status,200);assert.equal(h.db.rows.get('walletTransactions/wallet-stripe-cs_test_1').amount,8.8);assert.equal((await h.event('charge.refunded',{id:'ch_1',payment_intent:'pi_1',amount:1000,amount_refunded:500,currency:'usd'},'evt_refund1')).status,200);assert.equal(h.db.rows.get('walletTransactions/wallet-stripe-cs_test_1').amount,4.4);assert.equal((await h.event('charge.refunded',{id:'ch_1',payment_intent:'pi_1',amount:1000,amount_refunded:1000,currency:'usd'},'evt_refund2')).status,200);assert.equal(h.db.rows.get('walletTransactions/wallet-stripe-cs_test_1').amount,0);assert.equal(h.db.rows.get('bookings/b').paymentStatus,'refunded');});
test('unsigned, unpaid and wrong-amount events never credit earnings',async()=>{const h=harness({'bookings/b':{...booking,status:'payment_pending'}});assert.equal((await h.routes.webhook.POST(new Request('https://preview.example/api',{method:'POST',body:'{}'}))).status,400);assert.equal((await h.event('checkout.session.completed',{...paidSession,payment_status:'unpaid'},'evt_unpaid')).status,200);assert.equal((await h.event('checkout.session.completed',{...paidSession,amount_total:1},'evt_wrong')).status,409);assert(!h.db.rows.has('walletTransactions/wallet-stripe-cs_test_1'));});
test('expired checkout unlocks cancellation, stale version cannot credit a new reservation',async()=>{const h=harness({'bookings/b':{...booking,status:'payment_pending',paymentStatus:'pending',stripeCheckoutSessionId:'cs_test_1'},'rides/r':{...ride,seats:1}});assert.equal((await h.event('checkout.session.expired',paidSession,'evt_expired')).status,200);assert.equal(h.db.rows.get('bookings/b').checkoutAttempt,1);assert.equal((await h.call('cancel',{bookingId:'b'})).status,200);const stale=harness({'bookings/b':{...booking,status:'payment_pending',reservationVersion:2}});assert.equal((await stale.event('checkout.session.completed',paidSession)).status,409);});
test('test payment configuration never falls back to a production secret',()=>{const h=harness();const policy=h.load('lib/server/payments.ts');const saved={...process.env};try{process.env.NEXT_PUBLIC_ROADLINK_ENV='test';process.env.STRIPE_SECRET_KEY='sk_live_fake';delete process.env.STRIPE_TEST_SECRET_KEY;assert.throws(()=>policy.paymentConfig(),e=>e.status===503);process.env.STRIPE_TEST_SECRET_KEY='sk_live_fake';assert.throws(()=>policy.paymentConfig(),e=>e.status===503);}finally{process.env=saved;}});
test('server authentication verifies the bearer token, revocation, email and private pilot membership',async()=>{
 const source=ts.transpileModule(fs.readFileSync('lib/server/firebase-admin.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 let claims={uid:'DefaRi3pT2c5ZKs5gwc66lywFWN2',email:'p@example.com',email_verified:true}, calls=[];
 const out={exports:{}};const saved=process.env.NEXT_PUBLIC_ROADLINK_ENV;process.env.NEXT_PUBLIC_ROADLINK_ENV='test';
 const mocks={
 'firebase-admin/app':{getApps:()=>[{name:'roadlink-server-roadlink-pruebas'}]},
 'firebase-admin/auth':{getAuth:()=>({verifyIdToken:async(token,revocation)=>{calls.push([token,revocation]);if(token!=='signed-token')throw Error('invalid');return claims;}})},
 'firebase-admin/firestore':{getFirestore:()=>({})},
 };
 try{new Function('require','module','exports',source)(id=>mocks[id],out,out.exports);
 const req=token=>new Request('https://preview.example',{headers:token?{authorization:`Bearer ${token}`}:{}});
 await assert.rejects(out.exports.requirePassenger(req()),e=>e.status===401);
 await assert.rejects(out.exports.requirePassenger(req('forged')),e=>e.status===401);
 assert.equal((await out.exports.requirePassenger(req('signed-token'))).user.uid,claims.uid);assert.equal(calls.at(-1)[1],true);
 claims={...claims,email_verified:false};await assert.rejects(out.exports.requirePassenger(req('signed-token')),e=>e.status===403);
 claims={...claims,email_verified:true,uid:'outsider'};await assert.rejects(out.exports.requirePassenger(req('signed-token')),e=>e.status===403);
 }finally{if(saved===undefined)delete process.env.NEXT_PUBLIC_ROADLINK_ENV;else process.env.NEXT_PUBLIC_ROADLINK_ENV=saved;}
});
test('driver confirms and completes paid trips once; foreign and premature completion fail',async()=>{
 const seed={'rides/r':{...ride,date:'2020-01-01',durationMinutes:18},'bookings/b':{...booking,status:'paid',paymentStatus:'paid',paymentId:'pay'},'walletTransactions/wallet-pay':{bookingId:'b',driverId:'d',status:'pending_payout',amount:8.8}};
 const driver=harness(seed,{uid:'d',email:'d@example.com',email_verified:true});
 const invoke=async(h,action)=>h.load('app/api/bookings/driver-action/route.ts').POST(new Request('https://preview.example/api',{method:'POST',headers:{authorization:'Bearer valid','content-type':'application/json'},body:JSON.stringify({bookingId:'b',action})}));
 assert.equal((await invoke(harness(seed),'confirm')).status,403);
 assert.equal((await invoke(driver,'complete')).status,409);
 assert.equal((await invoke(driver,'confirm')).status,200);
 assert.equal((await invoke(driver,'confirm')).status,200);
 assert.equal((await invoke(driver,'complete')).status,200);
 assert.equal(driver.db.rows.get('walletTransactions/wallet-pay').status,'available');
 assert.equal(driver.db.rows.get('rides/r').status,'completed');
 const notifications=[...driver.db.rows.keys()].filter(k=>k.startsWith('notifications/')).length;
 assert.equal((await invoke(driver,'complete')).status,200);
 assert.equal([...driver.db.rows.keys()].filter(k=>k.startsWith('notifications/')).length,notifications);
 const future=harness({...seed,'rides/r':{...ride,durationMinutes:18},'bookings/b':{...seed['bookings/b'],status:'confirmed'}},{uid:'d'});
 assert.equal((await invoke(future,'complete')).status,409);
 const refunded=harness({...seed,'bookings/b':{...seed['bookings/b'],paymentStatus:'refunded'}},{uid:'d'});
 assert.equal((await invoke(refunded,'confirm')).status,409);
});
test('test schedule adjustment is scoped, idempotent and unavailable in production',async()=>{
 const id='UWfkcqsR5lRSwIxqghk5_DefaRi3pT2c5ZKs5gwc66lywFWN2', uid='XmpCtSTIS6cf7r8UMc2UxLFj6qH3';
 const seed={'rides/r':{...ride,driverId:uid,durationMinutes:18},['bookings/'+id]:{...booking,driverId:uid,status:'confirmed',paymentStatus:'paid',stripeCheckoutSessionId:'cs_test_scoped'}};
 const h=harness(seed,{uid});
 const invoke=(h,bookingId=id)=>h.load('app/api/bookings/test-arrival/route.ts').POST(new Request('https://preview.example/api',{method:'POST',headers:{authorization:'Bearer valid','content-type':'application/json'},body:JSON.stringify({bookingId})}));
 const previous=process.env.NEXT_PUBLIC_ROADLINK_ENV;
 try {
  process.env.NEXT_PUBLIC_ROADLINK_ENV='production';assert.equal((await invoke(h)).status,404);
  process.env.NEXT_PUBLIC_ROADLINK_ENV='test';
  assert.equal((await invoke(harness(seed))).status,403);
  assert.equal((await invoke(h,'other')).status,403);
  assert.equal((await invoke(h)).status,200);
  const adjusted=h.db.rows.get('rides/r');assert(Date.parse(adjusted.date+'T00:00:00-04:00')<Date.now());assert.equal(adjusted.originalTestSchedule.date,ride.date);
  assert.equal(h.db.rows.get('bookings/'+id).status,'confirmed');
  assert.equal([...h.db.rows.keys()].filter(k=>k.startsWith('walletTransactions/')).length,0);
  assert.equal((await invoke(h)).status,200);assert.deepEqual(h.db.rows.get('rides/r'),adjusted);
 } finally { if(previous===undefined)delete process.env.NEXT_PUBLIC_ROADLINK_ENV;else process.env.NEXT_PUBLIC_ROADLINK_ENV=previous; }
});
