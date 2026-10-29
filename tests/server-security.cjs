const {test}=require('node:test'); const assert=require('node:assert/strict'); const fs=require('node:fs'); const path=require('node:path'); const ts=require('typescript'); const Stripe=require('stripe');
class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
function database(seed={}){
 const rows=new Map(Object.entries(seed).map(([k,v])=>[k,structuredClone(v)])); let n=0; let transactionQueue=Promise.resolve();
 const snapshot=(ref)=>({id:ref.id,ref,exists:rows.has(ref.path),data:()=>rows.has(ref.path)?structuredClone(rows.get(ref.path)):undefined});
 const ref=(p)=>({path:p,id:p.split('/').pop(),get:async()=>snapshot(ref(p)),set:async(v,o)=>rows.set(p,o?.merge?{...rows.get(p),...v}:v)});
 function collection(p,filters=[],limit=Infinity){return {doc:(id)=>ref(`${p}/${id||`auto${++n}`}`),where:(k,op,v)=>collection(p,[...filters,[k,v]],limit),limit:(v)=>collection(p,filters,v),get:async()=>{const docs=[...rows.keys()].filter(k=>k.startsWith(p+'/')&&filters.every(([f,v])=>rows.get(k)[f]===v)).slice(0,limit).map(k=>snapshot(ref(k)));return {docs,size:docs.length};}};}
 return {rows,collection,runTransaction:cb=>{const operation=transactionQueue.then(async()=>{const writes=[];const result=await cb({get:async r=>r.path?snapshot(r):r.get(),set:(r,v,o)=>writes.push(()=>rows.set(r.path,o?.merge?{...rows.get(r.path),...v}:v)),update:(r,v)=>writes.push(()=>{assert(rows.has(r.path)); rows.set(r.path,{...rows.get(r.path),...v});})});writes.forEach(f=>f());return result;});transactionQueue=operation.catch(()=>{});return operation;}};
}
function harness(seed={},identity={uid:'p',email:'p@example.com',email_verified:true}){
 const db=database(seed), sessions=new Map(), pushMessages=[];let pushFailure=null;let seq=0;const sdk=new Stripe('sk_test_fake');
 const stripe={webhooks:sdk.webhooks,checkout:{sessions:{create:async(data,opts)=>{if(!sessions.has(opts.idempotencyKey))sessions.set(opts.idempotencyKey,{...data,id:`cs_test_${++seq}`,url:'https://checkout.stripe.com/test',status:'open',payment_status:'unpaid',livemode:false});return sessions.get(opts.idempotencyKey);},retrieve:async id=>[...sessions.values()].find(s=>s.id===id),expire:async id=>{const session=[...sessions.values()].find(s=>s.id===id);if(session.status!=='open')throw new Error('Session closed');session.status='expired';return session;}}}};
 let configError=false;
 const helper={ApiError,documentId:v=>{if(typeof v!=='string'||!/^[\w-]{1,128}$/.test(v))throw new ApiError(400,'Invalid id');return v;},requirePassenger:async req=>{if(req.headers.get('authorization')!=='Bearer valid')throw new ApiError(401,'Invalid token');return {user:identity,db};},serverFirebase:()=>({db}),apiFailure:e=>Response.json({error:e.message},{status:e.status||500})};
 const cache={};function load(relative){const file=path.resolve(relative);if(cache[file])return cache[file];const out={exports:{}};cache[file]=out.exports;const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;const req=id=>{if(id.endsWith('/connect-v2'))return {...load('lib/server/connect-v2.ts'),v2Request:async(method,p,body,key)=>{if(p==='/v2/core/accounts')return stripe.accounts.create(body,{idempotencyKey:key});if(p==='/v2/core/account_links')return stripe.accountLinks.create(body);return stripe.accounts.retrieve(p.split('/')[4].split('?')[0]);}};if(id.endsWith('/connect'))return load('lib/server/connect.ts');if(id.endsWith('firebase-admin'))return helper;if(id.endsWith('/instant-drivers'))return load('lib/server/instant-drivers.ts');if(id.endsWith('/instant-push'))return load('lib/server/instant-push.ts');if(id==='firebase-admin/messaging')return {getMessaging:()=>({sendEachForMulticast:async message=>{pushMessages.push(message);const responses=message.tokens.map(()=>pushFailure?{success:false,error:{code:pushFailure}}:{success:true});return {responses,successCount:pushFailure?0:responses.length,failureCount:pushFailure?responses.length:0};}})};if(id.endsWith('/guest'))return load('lib/server/guest.ts');if(id.endsWith('/payments'))return {...load('lib/server/payments.ts'),paymentConfig:()=>{if(configError)throw new ApiError(503,'Not configured');return {stripe,test:true,webhook:'whsec_test'};}};if(id==='./firebase-admin')return helper;return require(id);};new Function('require','module','exports',js)(req,out,out.exports);cache[file]=out.exports;return out.exports;}
 const routes={reserve:load('app/api/bookings/reserve/route.ts'),cancel:load('app/api/bookings/cancel/route.ts'),checkout:load('app/api/stripe/create-checkout-session/route.ts'),webhook:load('app/api/stripe/webhook/route.ts')};
 const call=(name,body,token='valid')=>routes[name].POST(new Request('https://preview.example/api',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)}));
 const event=async(type,object,id='evt_'+type)=>{const body=JSON.stringify({id,type,livemode:false,data:{object}});const signature=sdk.webhooks.generateTestHeaderString({payload:body,secret:'whsec_test'});return routes.webhook.POST(new Request('https://preview.example/api',{method:'POST',body,headers:{'stripe-signature':signature}}));};
 return {db,call,event,routes,stripe,sessions,pushMessages,setPushFailure:code=>pushFailure=code,setConfigError:()=>configError=true,load};
}
const ride={driverId:'d',driverEmail:'d@example.com',from:'Guayama',to:'Patillas',date:'2099-11-02',time:'11:00',seats:2,originalSeats:2,status:'active',price:10};
const booking={rideId:'r',passengerId:'p',driverId:'d',driverEmail:'d@example.com',from:'Guayama',to:'Patillas',date:'2099-11-02',time:'11:00',seatsBooked:1,price:10,status:'reserved',paymentStatus:'unpaid',reservationVersion:1};
test('guest reservation keeps account ownership, ignores forged payer and rejects missing consent',async()=>{
 const h=harness({'rides/r':ride});
 const guest={name:'Invitada de prueba',phone:'+15555550123',notes:'Entrada principal'};
 assert.equal((await h.call('reserve',{rideId:'r',travelFor:'guest',guest})).status,400);
 assert.equal(h.db.rows.get('rides/r').seats,2);
 assert.equal((await h.call('reserve',{rideId:'r',travelFor:'guest',guest,guestConsent:true,passengerId:'victim',price:0.01})).status,200);
 const b=h.db.rows.get('bookings/r_p');
 assert.equal(b.passengerId,'p');assert.equal(b.price,10);assert.equal(b.travelFor,'guest');assert.deepEqual(b.guest,guest);
 assert.equal((await h.call('cancel',{bookingId:'r_p'})).status,200);
 assert.equal((await h.call('reserve',{rideId:'r',travelFor:'self'})).status,200);
 assert.equal(h.db.rows.get('bookings/r_p').guest,null);
});
test('guest validation rejects malformed contact and strips extra fields',()=>{
 const policy=harness().load('lib/server/guest.ts');
 assert.throws(()=>policy.guestPassenger({travelFor:'guest',guestConsent:true,guest:{name:'A',phone:'123'}}),e=>e.status===400);
 assert.deepEqual(policy.guestPassenger({travelFor:'guest',guestConsent:true,guest:{name:'Invitada',phone:'555-555-0123',notes:'',uid:'victim',paymentStatus:'paid'}}),{name:'Invitada',phone:'555-555-0123',notes:''});
});
function instantHarness(){
 const identity={uid:'p',email:'p@example.com',email_verified:true},h=harness({},identity);
 const route=h.load('app/api/ride-now/route.ts');
 return {...h,identity,post:body=>route.POST(new Request('https://preview.example/api/ride-now',{method:'POST',headers:{authorization:'Bearer valid','content-type':'application/json'},body:JSON.stringify(body)})),
 get:()=>route.GET(new Request('https://preview.example/api/ride-now',{headers:{authorization:'Bearer valid'}})),
 driver:()=>Object.assign(identity,{uid:'XmpCtSTIS6cf7r8UMc2UxLFj6qH3',email:'d@example.com'}),
 passenger:()=>Object.assign(identity,{uid:'p',email:'p@example.com'})};
}
test('completing an immediate ride releases only its own driver assignment',async()=>{
 const seed={'rides/r':{...ride,status:'full',date:'2020-01-01',durationMinutes:5,rideType:'now'},
 'bookings/b':{...booking,status:'confirmed',paymentStatus:'paid',paymentId:'pay'},
 'walletTransactions/wallet-pay':{bookingId:'b',driverId:'d',status:'pending_payout',amount:8.8},
 'instantDriverLocks/d':{rideId:'r',until:'2099-01-01'}};
 const h=harness(seed,{uid:'d'});
 const call=x=>x.load('app/api/bookings/driver-action/route.ts').POST(new Request('https://preview.example',{method:'POST',headers:{authorization:'Bearer valid','content-type':'application/json'},body:JSON.stringify({bookingId:'b',action:'complete'})}));
 assert.equal((await call(h)).status,200);assert.equal(h.db.rows.get('instantDriverLocks/d').rideId,'');
 const other=harness({...seed,'instantDriverLocks/d':{rideId:'another'}},{uid:'d'});
 assert.equal((await call(other)).status,200);assert.equal(other.db.rows.get('instantDriverLocks/d').rideId,'another');
});
test('driver cancellation releases its immediate assignment and cancels its unpaid booking',async()=>{
 const h=harness({'rides/r':{...ride,status:'full',rideType:'now'},'bookings/b':booking,'instantDriverLocks/d':{rideId:'r'}},{uid:'d'});
 const response=await h.load('app/api/rides/cancel/route.ts').POST(new Request('https://preview.example',{method:'POST',headers:{authorization:'Bearer valid','content-type':'application/json'},body:JSON.stringify({rideId:'r'})}));
 assert.equal(response.status,200);assert.equal(h.db.rows.get('instantDriverLocks/d').rideId,'');assert.equal(h.db.rows.get('bookings/b').status,'cancelled');
});
test('instant ride flow validates quote, protects guest contact, reserves once and releases driver on cancellation',async()=>{
 const saved=process.env.NEXT_PUBLIC_ROADLINK_ENV;process.env.NEXT_PUBLIC_ROADLINK_ENV='test';
 try{
 const h=instantHarness();
 assert.equal((await h.post({action:'request',from:'Guayama entrada',to:'Patillas plaza',travelFor:'guest',guestConsent:true,guest:{name:'Invitada',phone:'555-555-0123',notes:'Entrada'}})).status,200);
 assert.equal((await h.post({action:'request',from:'Origen',to:'Destino'})).status,409);
 const version=h.db.rows.get('instantRequests/p').version;
 assert.equal((await h.post({action:'offer',requestId:'p',version,price:10,vehicle:'Test',pickupMinutes:10,durationMinutes:20})).status,403);
 h.driver();
 const list=await (await h.get()).json();assert.equal(list.requests[0].guest,undefined);assert.equal(JSON.stringify(list).includes('555-555'),false);
 assert.equal((await h.post({action:'offer',requestId:'p',version,price:0,vehicle:'Test',pickupMinutes:10,durationMinutes:20})).status,400);
 assert.equal((await h.post({action:'offer',requestId:'p',version,price:10,vehicle:'Test',pickupMinutes:10,durationMinutes:20})).status,200);
 h.passenger();
 assert.equal((await h.post({action:'accept',version,offerExpiresAt:'stale'})).status,409);
 const {expiresAt:offerExpiresAt,id:offerId}=Object.values(h.db.rows.get('instantRequests/p').offers)[0];
 const accepted=await h.post({action:'accept',version,offerId,offerExpiresAt,price:0.01,passengerId:'victim'});
 assert.equal(accepted.status,200);const {bookingId}=await accepted.json();
 assert.equal((await h.post({action:'accept',version,offerId,offerExpiresAt})).status,200);
 const b=h.db.rows.get('bookings/'+bookingId);
 assert.equal(b.passengerId,'p');assert.equal(b.price,10);assert.equal(b.paymentStatus,'unpaid');assert.equal(b.guest.name,'Invitada');
 assert.equal(h.db.rows.get('rides/'+b.rideId).seats,0);
 assert.equal([...h.db.rows.keys()].filter(k=>k.startsWith('bookings/')).length,1);
 assert.equal((await h.call('cancel',{bookingId})).status,200);
 assert.equal(h.db.rows.get('rides/'+b.rideId).status,'cancelled');
 assert.equal(h.db.rows.get('instantDriverLocks/XmpCtSTIS6cf7r8UMc2UxLFj6qH3').rideId,'');
 }finally{if(saved===undefined)delete process.env.NEXT_PUBLIC_ROADLINK_ENV;else process.env.NEXT_PUBLIC_ROADLINK_ENV=saved;}
});
test('instant requests fail closed outside pilot and reject expired quotes, changed versions and occupied drivers',async()=>{
 const saved=process.env.NEXT_PUBLIC_ROADLINK_ENV;
 try{
 process.env.NEXT_PUBLIC_ROADLINK_ENV='production';const h=instantHarness();
 assert.equal((await h.get()).status,503);assert.equal((await h.post({action:'request',from:'Origen',to:'Destino'})).status,503);
 process.env.NEXT_PUBLIC_ROADLINK_ENV='test';
 assert.equal((await h.post({action:'request',from:'Origen',to:'Destino'})).status,200);
 const request=h.db.rows.get('instantRequests/p');
 h.driver();
 assert.equal((await h.post({action:'offer',requestId:'p',version:'wrong',price:10,vehicle:'Test',pickupMinutes:10,durationMinutes:20})).status,409);
 h.db.rows.set('instantDriverLocks/XmpCtSTIS6cf7r8UMc2UxLFj6qH3',{rideId:'occupied',until:'2000-01-01'});
 assert.equal((await h.post({action:'offer',requestId:'p',version:request.version,price:10,vehicle:'Test',pickupMinutes:10,durationMinutes:20})).status,409);
 h.db.rows.delete('instantDriverLocks/XmpCtSTIS6cf7r8UMc2UxLFj6qH3');
 await h.post({action:'offer',requestId:'p',version:request.version,price:10,vehicle:'Test',pickupMinutes:10,durationMinutes:20});
 const row=h.db.rows.get('instantRequests/p');Object.values(row.offers)[0].expiresAt='2000-01-01';h.db.rows.set('instantRequests/p',row);h.passenger();
 assert.equal((await h.post({action:'accept',version:request.version,offerExpiresAt:'2000-01-01'})).status,409);
 assert.equal([...h.db.rows.keys()].filter(k=>k.startsWith('bookings/')).length,0);
 }finally{if(saved===undefined)delete process.env.NEXT_PUBLIC_ROADLINK_ENV;else process.env.NEXT_PUBLIC_ROADLINK_ENV=saved;}
});
test('last-minute alerts reach every authorized driver, hide guest data and clear on cancellation',async()=>{
 const saved=process.env.NEXT_PUBLIC_ROADLINK_ENV;process.env.NEXT_PUBLIC_ROADLINK_ENV='test';
 try {
 const h=instantHarness(), first='XmpCtSTIS6cf7r8UMc2UxLFj6qH3',second='DefaRi3pT2c5ZKs5gwc66lywFWN2';
 h.db.rows.set('instantDrivers/'+second,{enabled:true});
 h.db.rows.set('instantDrivers/outsider',{enabled:true});
 await h.post({action:'request',from:'Origen prueba',to:'Destino prueba',travelFor:'guest',guestConsent:true,guest:{name:'Invitada',phone:'555-555-0123',notes:'Privado'}});
 const row=h.db.rows.get('instantRequests/p'),alerts=[...h.db.rows.values()].filter(value=>value.type==='instant_request');
 assert.deepEqual(alerts.map(value=>value.userId).sort(),[first,second].sort());
 assert.equal(JSON.stringify(alerts).includes('555-555'),false);assert.equal(JSON.stringify(alerts).includes('Origen prueba'),false);
 h.driver();assert.equal((await h.post({action:'decline',requestId:'p',version:row.version})).status,200);
 assert.equal((await (await h.get()).json()).requests.length,0);
 assert.equal(h.db.rows.get('instantRequests/p').status,'open');
 Object.assign(h.identity,{uid:second});assert.equal((await (await h.get()).json()).requests.length,1);
 assert.equal((await h.post({action:'offer',requestId:'p',version:row.version,price:10,vehicle:'Auto',pickupMinutes:5,durationMinutes:15})).status,200);
 h.passenger();await h.post({action:'cancel',version:row.version});
 for(const id of [first,second])assert.equal(h.db.rows.get(`notifications/instant_${row.version}_${id}`).closed,true);
 assert.equal((await h.post({action:'accept',version:row.version})).status,409);
 } finally {if(saved===undefined)delete process.env.NEXT_PUBLIC_ROADLINK_ENV;else process.env.NEXT_PUBLIC_ROADLINK_ENV=saved;}
});
test('multiple drivers keep separate proposals and competing acceptance creates exactly one assignment',async()=>{
 const saved=process.env.NEXT_PUBLIC_ROADLINK_ENV;process.env.NEXT_PUBLIC_ROADLINK_ENV='test';
 try {
 const h=instantHarness(), first='XmpCtSTIS6cf7r8UMc2UxLFj6qH3',second='DefaRi3pT2c5ZKs5gwc66lywFWN2';
 h.db.rows.set('instantDrivers/'+second,{enabled:true});
 await h.post({action:'request',from:'Origen prueba',to:'Destino prueba'});
 const version=h.db.rows.get('instantRequests/p').version;
 h.driver();await h.post({action:'offer',requestId:'p',version,price:10,vehicle:'Auto uno',pickupMinutes:5,durationMinutes:15});
 Object.assign(h.identity,{uid:second,email:'second@example.com'});await h.post({action:'offer',requestId:'p',version,price:12,vehicle:'Auto dos',pickupMinutes:4,durationMinutes:15});
 const driverList=await (await h.get()).json();assert.equal(driverList.requests[0].offer.driverId,second);assert.equal(driverList.requests[0].offers,undefined);
 h.passenger();const passengerList=await (await h.get()).json();assert.equal(passengerList.requests[0].offers.length,2);
 const [a,b]=passengerList.requests[0].offers;
 const select=offer=>h.post({action:'accept',version,offerId:offer.id,offerExpiresAt:offer.expiresAt});
 const responses=await Promise.all([select(a),select(b)]);const results=await Promise.all(responses.map(r=>r.json()));
 assert.equal(responses[0].status,200);assert.equal(responses[1].status,409);assert(results[0].bookingId);
 const bookings=[...h.db.rows.values()].filter(value=>value.rideType==='now'&&value.passengerId==='p');
 assert.equal(bookings.length,1);assert.equal(bookings[0].driverId,a.driverId);assert.equal(bookings[0].amount,10);
 assert.equal(h.db.rows.has('instantDriverLocks/'+b.driverId),false);
 assert.equal(h.db.rows.get('instantRequests/p').assignedDriverId,a.driverId);
 for(const id of [first,second])assert.equal(h.db.rows.get(`notifications/instant_${version}_${id}`).closed,true);
 } finally {if(saved===undefined)delete process.env.NEXT_PUBLIC_ROADLINK_ENV;else process.env.NEXT_PUBLIC_ROADLINK_ENV=saved;}
});
test('rejecting a quote invalidates it without removing another driver proposal',async()=>{
 const saved=process.env.NEXT_PUBLIC_ROADLINK_ENV;process.env.NEXT_PUBLIC_ROADLINK_ENV='test';
 try {
 const h=instantHarness(),first='XmpCtSTIS6cf7r8UMc2UxLFj6qH3',second='DefaRi3pT2c5ZKs5gwc66lywFWN2';h.db.rows.set('instantDrivers/'+second,{enabled:true});
 await h.post({action:'request',from:'Origen',to:'Destino'});const version=h.db.rows.get('instantRequests/p').version;
 const offer=()=>h.post({action:'offer',requestId:'p',version,price:10,vehicle:'Auto',pickupMinutes:5,durationMinutes:15});
 h.driver();await offer();const old=h.db.rows.get('instantRequests/p').offers[first];
 Object.assign(h.identity,{uid:second});await offer();h.driver();await h.post({action:'decline',requestId:'p',version});
 assert.equal((await offer()).status,403);h.passenger();
 assert.equal((await h.post({action:'accept',version,offerId:old.id,offerExpiresAt:old.expiresAt})).status,409);
 const remaining=(await (await h.get()).json()).requests[0].offers;assert.equal(remaining.length,1);assert.equal(remaining[0].driverId,second);
 } finally {if(saved===undefined)delete process.env.NEXT_PUBLIC_ROADLINK_ENV;else process.env.NEXT_PUBLIC_ROADLINK_ENV=saved;}
});
test('push configuration is closed outside test, tokens are hashed and enrollment uses the verified driver',async()=>{
 const saved={...process.env};process.env.NEXT_PUBLIC_ROADLINK_ENV='test';process.env.NEXT_PUBLIC_FIREBASE_TEST_VAPID_KEY='B'+'a'.repeat(86);
 try {
 const h=instantHarness(),driver='XmpCtSTIS6cf7r8UMc2UxLFj6qH3',policy=h.load('lib/server/instant-push.ts'),route=h.load('app/api/push/subscription/route.ts');
 const token='test-device-token-for-push-1234567890';assert.equal(policy.pushDeviceId(token).length,64);assert.throws(()=>policy.pushDeviceId('x'),e=>e.status===400);
 const post=(body,auth='valid')=>route.POST(new Request('https://preview.example/api/push/subscription',{method:'POST',headers:{authorization:'Bearer '+auth,'content-type':'application/json'},body:JSON.stringify(body)}));
 assert.equal((await post({action:'enable',token})).status,403);h.driver();
 assert.equal((await post({action:'enable',token,userId:'victim'})).status,200);
 const id=policy.pushDeviceId(token);assert.equal(h.db.rows.get('pushDevices/'+id).userId,driver);
 assert.equal((await post({action:'enable',token},'forged')).status,401);
 h.passenger();await post({action:'disable',token});assert.equal(h.db.rows.get('pushDevices/'+id).enabled,true);
 h.driver();await post({action:'disable',token});assert.equal(h.db.rows.get('pushDevices/'+id).enabled,false);
 delete process.env.NEXT_PUBLIC_FIREBASE_TEST_VAPID_KEY;assert.equal((await post({action:'enable',token})).status,403);
 process.env.NEXT_PUBLIC_ROADLINK_ENV='production';assert.equal(policy.pushKey(),'');assert.equal((await post({action:'enable',token})).status,503);
 } finally {process.env=saved;}
});
test('push sends generic alerts only to subscribed drivers, deduplicates delivery and skips closed requests',async()=>{
 const saved={...process.env};process.env.NEXT_PUBLIC_ROADLINK_ENV='test';process.env.NEXT_PUBLIC_FIREBASE_TEST_VAPID_KEY='B'+'a'.repeat(86);
 try {
 const h=instantHarness(),driver='XmpCtSTIS6cf7r8UMc2UxLFj6qH3',policy=h.load('lib/server/instant-push.ts');
 h.db.rows.set('pushDevices/driver',{userId:driver,enabled:true,token:'test-driver-device-token-1234567890'});
 h.db.rows.set('pushDevices/other',{userId:'other',enabled:true,token:'foreign-device'});
 await h.post({action:'request',from:'Private exact pickup',to:'Private destination',travelFor:'guest',guestConsent:true,guest:{name:'Private guest',phone:'555-555-0123',notes:'Private instructions'}});
 const row=h.db.rows.get('instantRequests/p'),alert='notifications/instant_'+row.version+'_'+driver;
 assert.equal(h.pushMessages.length,1);assert.deepEqual(h.pushMessages[0].tokens,['test-driver-device-token-1234567890']);
 const payload=JSON.stringify(h.pushMessages[0]);for(const privateValue of ['Private exact pickup','Private destination','Private guest','555-555','Private instructions'])assert.equal(payload.includes(privateValue),false);
 assert.equal(h.pushMessages[0].webpush.fcmOptions.link,'https://www.getroadlink.com/conductor/ride-now');
 assert.equal(h.db.rows.get(alert).pushStatus,'sent');
 await policy.deliverInstantPush('p',row.version,[driver]);assert.equal(h.pushMessages.length,1);
 await h.post({action:'cancel',version:row.version});h.db.rows.set(alert,{...h.db.rows.get(alert),pushStatus:'failed'});
 await policy.deliverInstantPush('p',row.version,[driver]);assert.equal(h.pushMessages.length,1);
 } finally {process.env=saved;}
});
test('invalid push tokens are disabled without losing the request or in-app notification',async()=>{
 const saved={...process.env};process.env.NEXT_PUBLIC_ROADLINK_ENV='test';process.env.NEXT_PUBLIC_FIREBASE_TEST_VAPID_KEY='B'+'a'.repeat(86);
 try {
 const h=instantHarness(),driver='XmpCtSTIS6cf7r8UMc2UxLFj6qH3';h.setPushFailure('messaging/registration-token-not-registered');
 h.db.rows.set('pushDevices/driver',{userId:driver,enabled:true,token:'test-driver-device-token-1234567890'});
 assert.equal((await h.post({action:'request',from:'Origen',to:'Destino'})).status,200);
 const row=h.db.rows.get('instantRequests/p');assert.equal(row.status,'open');assert.equal(h.db.rows.get('pushDevices/driver').enabled,false);
 const alert=h.db.rows.get('notifications/instant_'+row.version+'_'+driver);assert.equal(alert.read,false);assert.equal(alert.pushStatus,'failed');assert.equal(alert.pushAccepted,0);
 } finally {process.env=saved;}
});
const paidSession={id:'cs_test_1',metadata:{bookingId:'b',passengerId:'p',reservationVersion:'1',environment:'test'},payment_status:'paid',amount_total:1000,currency:'usd',payment_intent:'pi_1'};
test('reservation/cancellation preserves seats and blocks duplicate and foreign changes',async()=>{const h=harness({'rides/r':ride});assert.equal((await h.call('reserve',{rideId:'r'})).status,200);assert.equal(h.db.rows.get('rides/r').seats,1);assert.equal((await h.call('reserve',{rideId:'r'})).status,409);assert.equal((await h.call('cancel',{bookingId:'r_p'})).status,200);assert.equal((await h.call('cancel',{bookingId:'r_p'})).status,200);assert.equal(h.db.rows.get('rides/r').seats,2);const other=harness({'bookings/b':{...booking,passengerId:'other'}});assert.equal((await other.call('cancel',{bookingId:'b'})).status,403);});
test('self-reservations and unauthenticated checkout are rejected',async()=>{const h=harness({'rides/r':{...ride,driverId:'p'}});assert.equal((await h.call('reserve',{rideId:'r'})).status,403);assert.equal((await h.call('checkout',{bookingId:'b'},'invalid')).status,401);});
test('forged checkout identity cannot pay another passenger booking',async()=>{const h=harness({'bookings/b':{...booking,passengerId:'victim'},'rides/r':ride});assert.equal((await h.call('checkout',{bookingId:'b',userId:'victim',price:0.01})).status,403);assert.equal(h.sessions.size,0);});
test('checkout derives amount and origin, reuses session and closes it before cancellation',async()=>{const h=harness({'bookings/b':booking,'rides/r':{...ride,seats:1}});assert.equal((await h.call('checkout',{bookingId:'b',userId:'victim',userEmail:'attacker@example.com',price:0.01})).status,200);const s=[...h.sessions.values()][0];assert.equal(s.line_items[0].price_data.unit_amount,1000);assert.equal(s.customer_email,'p@example.com');assert(s.success_url.startsWith('https://preview.example/'));assert.equal((await h.call('checkout',{bookingId:'b'})).status,200);assert.equal(h.sessions.size,1);assert.equal((await h.call('cancel',{bookingId:'b'})).status,200);assert.equal(s.status,'expired');assert.equal(h.db.rows.get('bookings/b').status,'cancelled');assert.equal(h.db.rows.get('payments/stripe-'+s.id).status,'cancelled');});
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

test('integrated release rejects live payments even when a live key is present',()=>{
 const h=harness(), policy=h.load('lib/server/payments.ts'), saved={...process.env};
 try {
  process.env.NEXT_PUBLIC_ROADLINK_ENV='production';
  process.env.STRIPE_SECRET_KEY='sk_live_fake';
  assert.throws(()=>policy.paymentConfig(),e=>e.status===503);
 } finally {process.env=saved;}
});

test('integrated sandbox lifecycle reserves, pays, completes, transfers and recovers one refunded payment',async()=>{
 const savedNow=Date.now, savedEnv=process.env.NEXT_PUBLIC_ROADLINK_ENV;
 const driver='XmpCtSTIS6cf7r8UMc2UxLFj6qH3', passenger='DefaRi3pT2c5ZKs5gwc66lywFWN2';
 const identity={uid:passenger,email:'passenger@example.com',email_verified:true};
 const bookingId=`r_${passenger}`;
 const h=harness({'rides/r':{...ride,driverId:driver,date:'2026-10-22',time:'18:00',durationMinutes:65},['connectAccounts/'+driver]:{accountId:'acct_driver'}},identity);
 const post=(path,body)=>h.load(path).POST(new Request('https://preview.example/api',{method:'POST',headers:{authorization:'Bearer valid','content-type':'application/json'},body:JSON.stringify(body)}));
 let transfer, reversed=0, transferCalls=0, reversalCalls=0, chargeRefunded=0;
 h.stripe.accounts={retrieve:async()=>({metadata:{roadlinkUserId:driver},configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{status:'active'},payouts:{status:'active'}}}}}})};
 h.stripe.paymentIntents={retrieve:async()=>({livemode:false,status:'succeeded',latest_charge:{id:'ch_lifecycle',currency:'usd',amount:1000,amount_refunded:chargeRefunded}})};
 h.stripe.transfers={
  create:async(data)=>{transferCalls++;transfer={...data,id:'tr_lifecycle',livemode:false,amount_reversed:0};return transfer;},
  retrieve:async()=>({...transfer,amount_reversed:reversed}),
  createReversal:async(id,data)=>{reversalCalls++;reversed=data.amount;return {id:'trr_lifecycle',amount:reversed};},
  listReversals:async()=>({data:[{id:'trr_lifecycle',amount:reversed}]}),
 };
 try {
  process.env.NEXT_PUBLIC_ROADLINK_ENV='test';Date.now=()=>Date.parse('2026-10-22T21:05:00Z');
  assert.equal((await h.call('reserve',{rideId:'r'})).status,200);
  assert.equal(h.db.rows.get('rides/r').seats,1);
  assert.equal((await h.call('checkout',{bookingId})).status,200);
  const session=[...h.sessions.values()][0];
  const paid={...paidSession,id:session.id,metadata:session.metadata,payment_intent:'pi_lifecycle'};
  assert.equal((await h.event('checkout.session.completed',paid,'evt_lifecycle_paid')).status,200);
  assert.equal((await h.event('checkout.session.completed',paid,'evt_lifecycle_paid')).status,200);
  const walletId=`wallet-stripe-${session.id}`;
  assert.equal(h.db.rows.get('walletTransactions/'+walletId).amount,8.8);
  Object.assign(identity,{uid:driver,email:'driver@example.com'});
  assert.equal((await post('app/api/bookings/driver-action/route.ts',{bookingId,action:'confirm'})).status,200);
  assert.equal((await post('app/api/bookings/driver-action/route.ts',{bookingId,action:'complete'})).status,409);
  Date.now=()=>Date.parse('2026-10-22T23:06:00Z');
  assert.equal((await post('app/api/bookings/driver-action/route.ts',{bookingId,action:'complete'})).status,200);
  assert.equal(h.db.rows.get('rides/r').status,'completed');
  assert.equal(h.db.rows.get('walletTransactions/'+walletId).status,'available');
  assert.equal((await post('app/api/connect/transfer/route.ts',{walletId})).status,200);
  assert.equal((await post('app/api/connect/transfer/route.ts',{walletId})).status,200);
  assert.equal(transferCalls,1);assert.equal(transfer.amount,880);
  chargeRefunded=1000;
  assert.equal((await h.event('charge.refunded',{id:'ch_lifecycle',payment_intent:'pi_lifecycle',amount:1000,amount_refunded:1000,currency:'usd'},'evt_lifecycle_refund')).status,200);
  assert.equal(h.db.rows.get('walletTransactions/'+walletId).status,'transfer_review');
  assert.equal((await post('app/api/connect/reconcile/route.ts',{walletId})).status,200);
  assert.equal((await post('app/api/connect/reconcile/route.ts',{walletId})).status,200);
  assert.equal(reversalCalls,1);assert.equal(reversed,880);
  assert.equal(h.db.rows.get('walletTransactions/'+walletId).amount,0);
  assert.equal(h.db.rows.get('payoutRequests/connect-'+walletId).status,'reversed');
 } finally {Date.now=savedNow;if(savedEnv===undefined)delete process.env.NEXT_PUBLIC_ROADLINK_ENV;else process.env.NEXT_PUBLIC_ROADLINK_ENV=savedEnv;}
});

test('profile photos require authentication and a ride or booking relationship, and never leak private fields',async()=>{
 const photo='data:image/jpeg;base64,AAAA';
 const h=harness({'users/d':{name:'Driver',photoURL:photo,email:'private@example.com',stripeAccountId:'secret',bio:'private'},'rides/r':ride,'users/stranger':{name:'Stranger',photoURL:photo},'users/p':{name:'Me',photoURL:'javascript:alert(1)'}});
 const route=h.load('app/api/profiles/route.ts');
 const read=(uid,token='valid')=>route.GET(new Request('https://preview.example/api/profiles?uid='+encodeURIComponent(uid),{headers:{authorization:'Bearer '+token}}));
 assert.equal((await read('d','bad')).status,401);
 assert.equal((await read('stranger')).status,403);
 assert.equal((await read('../d')).status,400);
 const response=await read('d');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.deepEqual(await response.json(),{name:'Driver',photoURL:photo});
 assert.deepEqual(await (await read('p')).json(),{name:'Me',photoURL:''});
 const related=harness({'users/p':{name:'Passenger',photoURL:photo},'bookings/b':booking},{uid:'d'});
 assert.equal((await related.load('app/api/profiles/route.ts').GET(new Request('https://preview.example/api/profiles?uid=p',{headers:{authorization:'Bearer valid'}}))).status,200);
});

test('chat requires a real booking, rejects forged participants and creates one conversation',async()=>{
 const h=harness({'bookings/b':booking,'rides/r':ride});
 const post=(body,token='valid')=>h.load('app/api/chat/route.ts').POST(new Request('https://preview.example/api/chat',{method:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify(body)}));
 assert.equal((await post({action:'open',bookingId:'b'},'bad')).status,401);
 assert.equal((await post({action:'open',rideId:'r',passengerId:'victim'})).status,200);
 assert.equal((await post({action:'open',bookingId:'b'})).status,200);
 assert.equal([...h.db.rows.keys()].filter(k=>k.startsWith('chats/')).length,1);
 const stranger=harness({'bookings/b':booking},{uid:'stranger'});
 assert.equal((await stranger.load('app/api/chat/route.ts').POST(new Request('https://preview.example',{method:'POST',headers:{authorization:'Bearer valid'},body:JSON.stringify({action:'open',bookingId:'b'})}))).status,403);
 const noBooking=harness({'rides/r':ride});
 assert.equal((await noBooking.load('app/api/chat/route.ts').POST(new Request('https://preview.example',{method:'POST',headers:{authorization:'Bearer valid'},body:JSON.stringify({action:'open',rideId:'r'})}))).status,403);
});
test('chat sending derives identity, deduplicates notifications and protects private history',async()=>{
 const seed={'bookings/b':booking,'chats/r_d_p':{rideId:'r',bookingId:'b',driverId:'d',passengerId:'p',unread:{p:0,d:0}}};
 const h=harness(seed);
 const route=h.load('app/api/chat/route.ts');
 const post=(body)=>route.POST(new Request('https://preview.example/api/chat',{method:'POST',headers:{authorization:'Bearer valid'},body:JSON.stringify(body)}));
 const body={action:'send',chatId:'r_d_p',messageId:'test-message-1',text:'Hola, prueba de coordinación.',senderId:'victim',receiverId:'victim'};
 assert.equal((await post(body)).status,200);assert.equal((await post(body)).status,200);
 const messages=[...h.db.rows.entries()].filter(([k])=>k.startsWith('messages/'));assert.equal(messages.length,1);assert.equal(messages[0][1].senderId,'p');assert.equal(messages[0][1].receiverId,'d');
 assert.equal([...h.db.rows.keys()].filter(k=>k.startsWith('notifications/')).length,1);
 assert.equal(h.db.rows.get('chats/r_d_p').unread.d,1);assert.equal(h.db.rows.get('chats/r_d_p').unread.p,0);
 assert.equal((await post({...body,text:'Changed'})).status,409);
 assert.equal((await post({...body,messageId:'another',text:' '.repeat(8)})).status,400);
 assert.equal((await post({...body,messageId:'another',text:'x'.repeat(2001)})).status,400);
 const get=await route.GET(new Request('https://preview.example/api/chat?chatId=r_d_p',{headers:{authorization:'Bearer valid'}}));assert.equal(get.status,200);const data=await get.json();assert.equal(data.messages.length,1);assert.equal(data.messages[0].senderEmail,undefined);
 const stranger=harness(Object.fromEntries(h.db.rows),{uid:'stranger'});
 assert.equal((await stranger.load('app/api/chat/route.ts').GET(new Request('https://preview.example/api/chat?chatId=r_d_p',{headers:{authorization:'Bearer valid'}}))).status,403);
 const driver=harness(Object.fromEntries(h.db.rows),{uid:'d'});driver.db.rows.get('chats/r_d_p').unread.p=5;assert.equal((await driver.load('app/api/chat/route.ts').POST(new Request('https://preview.example',{method:'POST',headers:{authorization:'Bearer valid'},body:JSON.stringify({action:'read',chatId:'r_d_p',userId:'p'})}))).status,200);assert.equal(driver.db.rows.get('chats/r_d_p').unread.d,0);assert.equal(driver.db.rows.get('chats/r_d_p').unread.p,5);
 h.db.rows.set('bookings/b',{...booking,status:'cancelled'});assert.equal((await post({...body,messageId:'closed'})).status,409);
});
test('chat rejects mismatched booking documents and an oversized history',async()=>{
 const h=harness({'bookings/b':booking,'chats/chat':{bookingId:'b',rideId:'foreign',driverId:'d',passengerId:'p'}});
 assert.equal((await h.load('app/api/chat/route.ts').GET(new Request('https://preview.example/api/chat?chatId=chat',{headers:{authorization:'Bearer valid'}}))).status,403);
 const seed={'bookings/b':booking,'chats/chat':{bookingId:'b',rideId:'r',driverId:'d',passengerId:'p'}};for(let n=0;n<101;n++)seed['messages/m'+n]={chatId:'chat',text:'test',senderId:'p'};
 const long=harness(seed);assert.equal((await long.load('app/api/chat/route.ts').GET(new Request('https://preview.example/api/chat?chatId=chat',{headers:{authorization:'Bearer valid'}}))).status,409);
});


test('pending checkout cancellation refuses paid, mismatched, unavailable and racing sessions',async()=>{
 const prepare=async()=>{const h=harness({'bookings/b':booking,'rides/r':{...ride,seats:1}});assert.equal((await h.call('checkout',{bookingId:'b'})).status,200);return h;};
 for(const change of [s=>{s.status='complete';s.payment_status='paid';},s=>{s.metadata.passengerId='other';},s=>{s.livemode=true;},s=>{s.metadata.reservationVersion='2';}]) {
  const h=await prepare();change([...h.sessions.values()][0]);assert.equal((await h.call('cancel',{bookingId:'b'})).status,409);assert.equal(h.db.rows.get('bookings/b').status,'payment_pending');assert.equal(h.db.rows.get('rides/r').seats,1);
 }
 const unavailable=await prepare();unavailable.stripe.checkout.sessions.expire=async()=>{throw new Error('unavailable');};assert.equal((await unavailable.call('cancel',{bookingId:'b'})).status,409);assert.equal(unavailable.db.rows.get('rides/r').seats,1);
 const racing=await prepare();racing.stripe.checkout.sessions.expire=async()=>{const s=[...racing.sessions.values()][0];s.status='complete';s.payment_status='paid';throw new Error('paid in parallel');};assert.equal((await racing.call('cancel',{bookingId:'b'})).status,409);
 const inFlight=harness({'bookings/b':{...booking,status:'payment_pending',paymentStatus:'pending'},'rides/r':{...ride,seats:1}});assert.equal((await inFlight.call('cancel',{bookingId:'b'})).status,409);
});

test('pending checkout cancellation remains idempotent and releases the immediate driver',async()=>{
 const h=harness({'bookings/b':booking,'rides/r':{...ride,seats:1,rideType:'now'},'instantDriverLocks/d':{rideId:'r'}});await h.call('checkout',{bookingId:'b'});
 assert.equal((await h.call('cancel',{bookingId:'b'})).status,200);assert.equal((await h.call('cancel',{bookingId:'b'})).status,200);assert.equal(h.db.rows.get('rides/r').seats,2);assert.equal(h.db.rows.get('rides/r').status,'cancelled');assert.equal(h.db.rows.get('instantDriverLocks/d').rideId,'');
 const session=[...h.sessions.values()][0];assert.equal((await h.event('checkout.session.expired',session,'expiry_after_cancel')).status,200);assert.equal(h.db.rows.get('bookings/b').status,'cancelled');
 assert.equal((await h.event('checkout.session.completed',{...session,payment_status:'paid',amount_total:1000,currency:'usd'},'late_payment')).status,409);
 assert(!h.db.rows.has('walletTransactions/wallet-stripe-'+session.id));
});
