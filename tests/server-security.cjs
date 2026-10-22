const {test}=require('node:test'); const assert=require('node:assert/strict'); const fs=require('node:fs'); const path=require('node:path'); const ts=require('typescript'); const Stripe=require('stripe');
class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
function database(seed={}){
 const rows=new Map(Object.entries(seed).map(([k,v])=>[k,structuredClone(v)])); let n=0;
 const snapshot=(ref)=>({id:ref.id,ref,exists:rows.has(ref.path),data:()=>rows.has(ref.path)?structuredClone(rows.get(ref.path)):undefined});
 const ref=(p)=>({path:p,id:p.split('/').pop(),get:async()=>snapshot(ref(p)),set:async(v,o)=>rows.set(p,o?.merge?{...rows.get(p),...v}:v)});
 function collection(p,filters=[],limit=Infinity){return {doc:(id)=>ref(`${p}/${id||`auto${++n}`}`),where:(k,op,v)=>collection(p,[...filters,[k,v]],limit),limit:(v)=>collection(p,filters,v),get:async()=>{const docs=[...rows.keys()].filter(k=>k.startsWith(p+'/')&&filters.every(([f,v])=>rows.get(k)[f]===v)).slice(0,limit).map(k=>snapshot(ref(k)));return {docs,size:docs.length};}};}
 return {rows,collection,runTransaction:async cb=>{const writes=[];const result=await cb({get:async r=>r.path?snapshot(r):r.get(),set:(r,v,o)=>writes.push(()=>rows.set(r.path,o?.merge?{...rows.get(r.path),...v}:v)),update:(r,v)=>writes.push(()=>{assert(rows.has(r.path)); rows.set(r.path,{...rows.get(r.path),...v});})});writes.forEach(f=>f());return result;}};
}
function harness(seed={},identity={uid:'p',email:'p@example.com',email_verified:true}){
 const db=database(seed), sessions=new Map();let seq=0;const sdk=new Stripe('sk_test_fake');
 const stripe={webhooks:sdk.webhooks,checkout:{sessions:{create:async(data,opts)=>{if(!sessions.has(opts.idempotencyKey))sessions.set(opts.idempotencyKey,{...data,id:`cs_test_${++seq}`,url:'https://checkout.stripe.com/test',status:'open'});return sessions.get(opts.idempotencyKey);},retrieve:async id=>[...sessions.values()].find(s=>s.id===id)}}};
 let configError=false;
 const helper={ApiError,documentId:v=>{if(typeof v!=='string'||!/^[\w-]{1,128}$/.test(v))throw new ApiError(400,'Invalid id');return v;},requirePassenger:async req=>{if(req.headers.get('authorization')!=='Bearer valid')throw new ApiError(401,'Invalid token');return {user:identity,db};},serverFirebase:()=>({db}),apiFailure:e=>Response.json({error:e.message},{status:e.status||500})};
 const cache={};function load(relative){const file=path.resolve(relative);if(cache[file])return cache[file];const out={exports:{}};cache[file]=out.exports;const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;const req=id=>{if(id.endsWith('/connect-v2'))return {...load('lib/server/connect-v2.ts'),v2Request:async(method,p,body,key)=>{if(p==='/v2/core/accounts')return stripe.accounts.create(body,{idempotencyKey:key});if(p==='/v2/core/account_links')return stripe.accountLinks.create(body);return stripe.accounts.retrieve(p.split('/')[4].split('?')[0]);}};if(id.endsWith('/connect'))return load('lib/server/connect.ts');if(id.endsWith('firebase-admin'))return helper;if(id.endsWith('/payments'))return {...load('lib/server/payments.ts'),paymentConfig:()=>{if(configError)throw new ApiError(503,'Not configured');return {stripe,test:true,webhook:'whsec_test'};}};if(id==='./firebase-admin')return helper;return require(id);};new Function('require','module','exports',js)(req,out,out.exports);cache[file]=out.exports;return out.exports;}
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
test('Connect transfers use verified server amounts and retry an ambiguous result without duplicates',async()=>{
 const uid='XmpCtSTIS6cf7r8UMc2UxLFj6qH3';
 const seed={['connectAccounts/'+uid]:{accountId:'acct_driver'},'walletTransactions/w':{driverId:uid,bookingId:'b',paymentId:'pay',status:'available',amount:8.8},'bookings/b':{driverId:uid,status:'completed',paymentStatus:'paid'},'payments/pay':{bookingId:'b',status:'paid',stripeCheckoutSessionId:'cs_test_ok',driverAmount:8.8,stripePaymentIntentId:'pi_test'}};
 const h=harness(seed,{uid});let calls=0,fail=true;const transfers=new Map();
 h.stripe.accounts={retrieve:async()=>({metadata:{roadlinkUserId:uid},configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{status:'active'},payouts:{status:'active'}}}}}})};
 h.stripe.paymentIntents={retrieve:async()=>({livemode:false,status:'succeeded',latest_charge:{id:'ch_test',amount_refunded:0,currency:'usd'}})};
 h.stripe.transfers={create:async(params,options)=>{calls++;assert.equal(params.amount,880);assert.equal(params.destination,'acct_driver');assert.equal(params.source_transaction,'ch_test');if(!transfers.has(options.idempotencyKey))transfers.set(options.idempotencyKey,{id:'tr_once'});if(fail){fail=false;throw Error('ambiguous connection failure');}return transfers.get(options.idempotencyKey);}};
 const invoke=(h,body={walletId:'w',amount:99999})=>h.load('app/api/connect/transfer/route.ts').POST(new Request('https://preview.example/api',{method:'POST',headers:{authorization:'Bearer valid','content-type':'application/json'},body:JSON.stringify(body)}));
 const previous=process.env.NEXT_PUBLIC_ROADLINK_ENV;
 try {
  process.env.NEXT_PUBLIC_ROADLINK_ENV='production';assert.equal((await invoke(h)).status,404);
  process.env.NEXT_PUBLIC_ROADLINK_ENV='test';
  assert.equal((await invoke(harness(seed))).status,403);
  assert.equal((await invoke(h)).status,500);assert.equal(h.db.rows.get('walletTransactions/w').status,'transferring');
  assert.equal((await invoke(h)).status,200);assert.equal(transfers.size,1);assert.equal(h.db.rows.get('walletTransactions/w').status,'transferred');
  assert.equal(h.db.rows.get('payoutRequests/connect-w').status,'transferred');
  assert.equal((await invoke(h)).status,200);assert.equal(calls,2);
 } finally {if(previous===undefined)delete process.env.NEXT_PUBLIC_ROADLINK_ENV;else process.env.NEXT_PUBLIC_ROADLINK_ENV=previous;}
});
test('Connect refuses unpaid, unfinished and refunded earnings before calling Stripe transfers',async()=>{
 const uid='XmpCtSTIS6cf7r8UMc2UxLFj6qH3';const previous=process.env.NEXT_PUBLIC_ROADLINK_ENV;process.env.NEXT_PUBLIC_ROADLINK_ENV='test';
 try {for (const booking of [{status:'confirmed',paymentStatus:'paid'},{status:'completed',paymentStatus:'unpaid'},{status:'completed',paymentStatus:'refunded'}]) {
  const h=harness({['connectAccounts/'+uid]:{accountId:'acct_d'},'walletTransactions/w':{driverId:uid,bookingId:'b',paymentId:'pay',status:'available',amount:8.8},'bookings/b':{...booking,driverId:uid},'payments/pay':{status:'paid',bookingId:'b',driverAmount:8.8,stripeCheckoutSessionId:'cs_test_ok'}},{uid});
  h.stripe.accounts={retrieve:async()=>({metadata:{roadlinkUserId:uid},configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{status:'active'},payouts:{status:'active'}}}}}})};
  const result=await h.load('app/api/connect/transfer/route.ts').POST(new Request('https://preview.example',{method:'POST',headers:{authorization:'Bearer valid'},body:JSON.stringify({walletId:'w'})}));assert.equal(result.status,409);assert.equal(h.db.rows.get('walletTransactions/w').status,'available');
 }}finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_ROADLINK_ENV;else process.env.NEXT_PUBLIC_ROADLINK_ENV=previous;}
});
test('Connect onboarding retries reuse the same account and never accept bank details',async()=>{
 const uid='XmpCtSTIS6cf7r8UMc2UxLFj6qH3',h=harness({}, {uid,email:'driver@example.com'});const accounts=new Map();
 h.stripe.accounts={create:async(params,options)=>{assert.equal(params.dashboard,'express');assert.equal(params.defaults.responsibilities.losses_collector,'application');assert.equal(params.external_account,undefined);assert.deepEqual(params.configuration.recipient.capabilities,{stripe_balance:{stripe_transfers:{requested:true}}});if(!accounts.has(options.idempotencyKey))accounts.set(options.idempotencyKey,{id:'acct_once'});return accounts.get(options.idempotencyKey);},retrieve:async(id)=>id?({metadata:{roadlinkUserId:uid}}):({id:'acct_1TlLBoCmDRfm6qaa'})};
 h.stripe.accountLinks={create:async(params)=>{assert.equal(params.account,'acct_once');assert.deepEqual(Object.keys(params.use_case.account_onboarding).sort(),['refresh_url','return_url']);assert.equal(params.use_case.account_onboarding.return_url,'https://preview.example/wallet?connect=return');return {url:'https://connect.stripe.com/setup/test'};}};
 const previous=process.env.NEXT_PUBLIC_ROADLINK_ENV;process.env.NEXT_PUBLIC_ROADLINK_ENV='test';
 try{for(let i=0;i<3;i++){const r=await h.load('app/api/connect/onboarding/route.ts').POST(new Request('https://preview.example/api',{method:'POST',headers:{authorization:'Bearer valid'},body:JSON.stringify({mode:i===2?'dashboard':'onboard',accountId:'acct_attacker',return_url:'https://attacker.example'})}));assert.equal(r.status,200);}assert.equal(accounts.size,1);assert.equal(h.db.rows.get('connectAccounts/'+uid).accountId,'acct_once');}
 finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_ROADLINK_ENV;else process.env.NEXT_PUBLIC_ROADLINK_ENV=previous;}
});
test('refunds after a Connect transfer freeze reconciliation instead of creating spendable funds',async()=>{
 const h=harness({'payments/pay':{bookingId:'b',stripePaymentIntentId:'pi_ref',amount:10,cents:1000,driverAmount:8.8,status:'paid'},'bookings/b':{status:'completed',paymentStatus:'paid'},'walletTransactions/wallet-pay':{amount:8.8,status:'transferred',transferId:'tr_done'}});
 assert.equal((await h.event('charge.refunded',{payment_intent:'pi_ref',amount:1000,amount_refunded:500,currency:'usd'},'evt_transfer_refund')).status,200);
 const row=h.db.rows.get('walletTransactions/wallet-pay');assert.equal(row.status,'transfer_review');assert.equal(row.amount,4.4);assert.equal(row.transferId,'tr_done');
});
test('wallet server reads only the assigned driver and rejects truncated histories',async()=>{
 const uid='XmpCtSTIS6cf7r8UMc2UxLFj6qH3';const previous=process.env.NEXT_PUBLIC_ROADLINK_ENV;process.env.NEXT_PUBLIC_ROADLINK_ENV='test';
 const invoke=h=>h.load('app/api/connect/wallet/route.ts').GET(new Request('https://preview.example/api',{headers:{authorization:'Bearer valid'}}));
 try {
  const seed={'bookings/own':{driverId:uid,status:'completed'},'bookings/foreign':{driverId:'other'},'walletTransactions/own':{driverId:uid,amount:8.8,status:'available'},'walletTransactions/foreign':{driverId:'other',amount:999},'payoutRequests/own':{userId:uid},'payoutRequests/foreign':{userId:'other'}};
  const result=await invoke(harness(seed,{uid}));assert.equal(result.status,200);const data=await result.json();assert.equal(data.bookings.length,1);assert.equal(data.walletTransactions.length,1);assert.equal(data.walletTransactions[0].amount,8.8);assert.equal(data.payouts.length,1);
  assert.equal((await invoke(harness(seed))).status,403);
  for(let i=0;i<201;i++)seed['bookings/row'+i]={driverId:uid};
  assert.equal((await invoke(harness(seed,{uid}))).status,409);
 } finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_ROADLINK_ENV;else process.env.NEXT_PUBLIC_ROADLINK_ENV=previous;}
});
test('Connect reports the rejected stage and safe Stripe detail without exposing credentials',async()=>{
 const uid='XmpCtSTIS6cf7r8UMc2UxLFj6qH3', h=harness({}, {uid});
 h.stripe.accounts={retrieve:async()=>({id:'acct_1TlLBoCmDRfm6qaa'}),create:async()=>{throw {type:'StripeInvalidRequestError',message:'Connect setup required sk_test_fakeSECRET https://stripe.com/private?token=secret',code:'invalid_request',param:'controller',requestId:'req_safe123'};}};
 const previous=process.env.NEXT_PUBLIC_ROADLINK_ENV;process.env.NEXT_PUBLIC_ROADLINK_ENV='test';
 try{const r=await h.load('app/api/connect/onboarding/route.ts').POST(new Request('https://preview.example',{method:'POST',headers:{authorization:'Bearer valid'},body:JSON.stringify({mode:'onboard'})}));assert.equal(r.status,409);const result=await r.json();assert.match(result.error,/crear la cuenta/);assert.match(result.error,/Connect setup required/);assert.match(result.error,/req_safe123/);assert(!result.error.includes('fakeSECRET'));assert(!result.error.includes('token=secret'));}
 finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_ROADLINK_ENV;else process.env.NEXT_PUBLIC_ROADLINK_ENV=previous;}
});
test('Connect onboarding rejects a different platform before creating any account',async()=>{
 const h=harness({}, {uid:'XmpCtSTIS6cf7r8UMc2UxLFj6qH3'});let created=false;
 h.stripe.accounts={retrieve:async()=>({id:'acct_wrong'}),create:async()=>{created=true;}};
 const previous=process.env.NEXT_PUBLIC_ROADLINK_ENV;process.env.NEXT_PUBLIC_ROADLINK_ENV='test';
 try{const r=await h.load('app/api/connect/onboarding/route.ts').POST(new Request('https://preview.example',{method:'POST',headers:{authorization:'Bearer valid'},body:JSON.stringify({mode:'onboard'})}));assert.equal(r.status,409);assert.match((await r.json()).error,/acct_wrong/);assert.equal(created,false);}
 finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_ROADLINK_ENV;else process.env.NEXT_PUBLIC_ROADLINK_ENV=previous;}
});
test('Accounts v2 pins its API version, sends JSON and blocks live responses and foreign endpoints',async()=>{
 const h=harness(),v2=h.load('lib/server/connect-v2.ts');const savedFetch=global.fetch,savedEnv=process.env.NEXT_PUBLIC_ROADLINK_ENV,savedKey=process.env.STRIPE_TEST_SECRET_KEY;
 process.env.NEXT_PUBLIC_ROADLINK_ENV='test';process.env.STRIPE_TEST_SECRET_KEY='sk_test_transport';
 try {
  let calls=0;global.fetch=async(url,options)=>{calls++;assert.equal(url,'https://api.stripe.com/v2/core/accounts');assert.equal(options.headers['Stripe-Version'],'2026-09-30.preview');assert.equal(options.headers['Content-Type'],'application/json');assert.equal(options.headers['Idempotency-Key'],'once');assert.deepEqual(JSON.parse(options.body),{dashboard:'express'});return Response.json({id:'acct_mock',livemode:false});};
  assert.equal((await v2.v2Request('POST','/v2/core/accounts',{dashboard:'express'},'once')).id,'acct_mock');assert.equal(calls,1);
  await assert.rejects(v2.v2Request('POST','https://attacker.example',{}),e=>e.status===400);
  global.fetch=async()=>Response.json({id:'acct_live',livemode:true});await assert.rejects(v2.v2Request('GET','/v2/core/accounts'),e=>e.status===409);
  process.env.NEXT_PUBLIC_ROADLINK_ENV='production';await assert.rejects(v2.v2Request('GET','/v2/core/accounts'),e=>e.status===503);
 }finally{global.fetch=savedFetch;if(savedEnv===undefined)delete process.env.NEXT_PUBLIC_ROADLINK_ENV;else process.env.NEXT_PUBLIC_ROADLINK_ENV=savedEnv;if(savedKey===undefined)delete process.env.STRIPE_TEST_SECRET_KEY;else process.env.STRIPE_TEST_SECRET_KEY=savedKey;}
});
test('full-refund recovery verifies ownership and Stripe source, and retries without a second reversal',async()=>{
 const uid='XmpCtSTIS6cf7r8UMc2UxLFj6qH3';
 const seed={'walletTransactions/w':{driverId:uid,paymentId:'p',bookingId:'b',transferId:'tr_1',status:'transfer_review',amount:0},'payoutRequests/connect-w':{userId:uid,transferId:'tr_1',paymentIntent:'pi_1',destination:'acct_1',cents:880},['connectAccounts/'+uid]:{accountId:'acct_1'},'payments/p':{status:'refunded',refundedCents:1000,cents:1000,driverAmount:8.8,bookingId:'b',stripePaymentIntentId:'pi_1',stripeCheckoutSessionId:'cs_test_1'}};
 const h=harness(seed,{uid});let reversed=0,calls=0,fail=true;
 h.stripe.transfers={retrieve:async()=>({id:'tr_1',livemode:false,currency:'usd',destination:'acct_1',metadata:{walletId:'w'},amount:880,amount_reversed:reversed,source_transaction:'ch_1'}),createReversal:async(p,b)=>{calls++;assert.equal(b.amount,880);reversed=880;if(fail){fail=false;throw Error('timeout after Stripe succeeded');}return {id:'trr_1'};},listReversals:async()=>({data:[{id:'trr_1',amount:880}]})};
 h.stripe.paymentIntents={retrieve:async()=>({livemode:false,latest_charge:{id:'ch_1',currency:'usd',amount:1000,amount_refunded:1000}})};
 const invoke=x=>x.load('app/api/connect/reconcile/route.ts').POST(new Request('https://preview.example',{method:'POST',headers:{authorization:'Bearer valid'},body:JSON.stringify({walletId:'w',amount:999,destination:'acct_attacker'})}));
 const previous=process.env.NEXT_PUBLIC_ROADLINK_ENV;process.env.NEXT_PUBLIC_ROADLINK_ENV='test';
 try{assert.equal((await invoke(h)).status,500);assert.equal((await invoke(h)).status,200);assert.equal((await invoke(h)).status,200);assert.equal(calls,1);assert.equal(h.db.rows.get('walletTransactions/w').status,'refunded');assert.equal(h.db.rows.get('payoutRequests/connect-w').recoveredCents,880);
 const foreign=harness({...seed,'walletTransactions/w':{...seed['walletTransactions/w'],driverId:'other'}},{uid});assert.equal((await invoke(foreign)).status,403);
 const partial=harness({...seed,'payments/p':{...seed['payments/p'],refundedCents:500}},{uid});assert.equal((await invoke(partial)).status,409);
 process.env.NEXT_PUBLIC_ROADLINK_ENV='production';assert.equal((await invoke(h)).status,404);
 }finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_ROADLINK_ENV;else process.env.NEXT_PUBLIC_ROADLINK_ENV=previous;}
});
test('driver cancels own ride and unpaid reservations once; paid, foreign and completed rides stay protected',async()=>{
 const seed={'rides/r':ride,'bookings/b':booking};
 const invoke=h=>h.load('app/api/rides/cancel/route.ts').POST(new Request('https://preview.example',{method:'POST',headers:{authorization:'Bearer valid'},body:JSON.stringify({rideId:'r',driverId:'d'})}));
 const h=harness(seed,{uid:'d'});assert.equal((await invoke(h)).status,200);assert.equal(h.db.rows.get('rides/r').status,'cancelled');assert.equal(h.db.rows.get('bookings/b').status,'cancelled');assert.equal([...h.db.rows.keys()].filter(k=>k.startsWith('notifications/')).length,1);assert.equal((await invoke(h)).status,200);assert.equal([...h.db.rows.keys()].filter(k=>k.startsWith('notifications/')).length,1);assert.equal((await harness(Object.fromEntries(h.db.rows)).call('reserve',{rideId:'r'})).status,409);
 assert.equal((await invoke(harness(seed,{uid:'other'}))).status,403);
 for(const patch of [{status:'paid',paymentStatus:'paid'},{status:'reserved',paymentStatus:'unpaid',stripeCheckoutSessionId:'cs_test_open'}]){const x=harness({...seed,'bookings/b':{...booking,...patch}},{uid:'d'});assert.equal((await invoke(x)).status,409);assert.equal(x.db.rows.get('rides/r').status,'active');}
 assert.equal((await invoke(harness({'rides/r':{...ride,status:'completed'}},{uid:'d'}))).status,409);
});
test('ride cancellation accepts fully reconciled refunds but rejects partial refunds and unrecovered transfers',async()=>{
 const seed={'rides/r':ride,'bookings/b':{...booking,status:'paid',paymentStatus:'refunded',paymentId:'p',stripeCheckoutSessionId:'cs_test_old'},'payments/p':{bookingId:'b',status:'refunded',cents:1000,refundedCents:1000,driverAmount:8.8},'walletTransactions/wallet-p':{bookingId:'b',driverId:'d',status:'refunded',amount:0}};
 const invoke=h=>h.load('app/api/rides/cancel/route.ts').POST(new Request('https://preview.example',{method:'POST',headers:{authorization:'Bearer valid'},body:JSON.stringify({rideId:'r'})}));
 const h=harness(seed,{uid:'d'});assert.equal((await invoke(h)).status,200);assert.equal(h.db.rows.get('bookings/b').paymentStatus,'refunded');assert.equal(h.db.rows.get('rides/r').status,'cancelled');
 const recovered=harness({...seed,'walletTransactions/wallet-p':{...seed['walletTransactions/wallet-p'],transferId:'tr_1',reversalId:'trr_1',recoveredCents:880}},{uid:'d'});assert.equal((await invoke(recovered)).status,200);
 for(const patch of [{status:'transfer_review',transferId:'tr_1'},{transferId:'tr_1'},{transferId:'tr_1',reversalId:'trr_1',recoveredCents:440}]){const x=harness({...seed,'walletTransactions/wallet-p':{...seed['walletTransactions/wallet-p'],...patch}},{uid:'d'});assert.equal((await invoke(x)).status,409);assert.equal(x.db.rows.get('rides/r').status,'active');}
 const partial=harness({...seed,'payments/p':{...seed['payments/p'],refundedCents:500}},{uid:'d'});assert.equal((await invoke(partial)).status,409);
});

 test('reservation uses Puerto Rico time independently of server timezone', async()=>{
 const savedNow=Date.now;
 Date.now=()=>Date.parse('2026-10-22T06:57:00Z');
 try {
  for(const time of ['04:05','03:00']) {
   const h=harness({'rides/r':{...ride,date:'2026-10-22',time}});
   const response=await h.load('app/api/bookings/reserve/route.ts').POST(new Request('https://preview.example/api',{method:'POST',headers:{authorization:'Bearer valid','content-type':'application/json'},body:JSON.stringify({rideId:'r'})}));
   assert.equal(response.status,200);
  }
  const h=harness({'rides/r':{...ride,date:'2026-10-22',time:'02:40'}});
  const response=await h.load('app/api/bookings/reserve/route.ts').POST(new Request('https://preview.example/api',{method:'POST',headers:{authorization:'Bearer valid','content-type':'application/json'},body:JSON.stringify({rideId:'r'})}));
  assert.equal(response.status,409);
 } finally {Date.now=savedNow;}
 });

test('checkout accepts future Puerto Rico departure and rejects past local departure',async()=>{
 const savedNow=Date.now;Date.now=()=>Date.parse('2026-10-22T21:05:00Z');
 try {
  for(const [time,expected] of [['18:00',200],['17:00',409]]) {
   const h=harness({'rides/r':{...ride,date:'2026-10-22',time},'bookings/b':{...booking,date:'2026-10-22',time}});
   const response=await h.load('app/api/stripe/create-checkout-session/route.ts').POST(new Request('https://preview.example/api',{method:'POST',headers:{authorization:'Bearer valid','content-type':'application/json'},body:JSON.stringify({bookingId:'b'})}));
   assert.equal(response.status,expected);
   assert.equal(h.sessions.size,expected===200?1:0);
  }
 } finally {Date.now=savedNow;}
});
