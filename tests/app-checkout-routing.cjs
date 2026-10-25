const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');

test('checkout stays within the selected app and rejects arbitrary return destinations',async()=>{
 for(const [appExperience,prefix] of [['passenger','/pasajero'],['driver','/conductor'],['https://foreign.example','']]){
  const rows=new Map([
   ['bookings/fixture-booking',{rideId:'fixture-ride',passengerId:'fixture-passenger',driverId:'fixture-driver',from:'Origin',to:'Destination',date:'2099-01-01',time:'12:00',status:'reserved',paymentStatus:'unpaid',reservationVersion:1}],
   ['rides/fixture-ride',{status:'active'}],
  ]);
  const ref=path=>({path,id:path.split('/').pop()});
  const db={collection:name=>({doc:id=>ref(name+'/'+id)}),runTransaction:async callback=>callback({
   get:async target=>({exists:rows.has(target.path),data:()=>rows.get(target.path)}),
   update:(target,patch)=>rows.set(target.path,{...rows.get(target.path),...patch}),
   set:(target,patch)=>rows.set(target.path,patch),
  })};
  let created;
  const stripe={checkout:{sessions:{create:async input=>{created=input;return {id:'cs_test_fixture',url:'https://checkout.stripe.com/fixture'};}}}};
  class ApiError extends Error {constructor(status,message){super(message);this.status=status;}}
  const dependencies={
   admin:{ApiError,documentId:value=>value,requirePassenger:async()=>({user:{uid:'fixture-passenger',email:'passenger@example.com'},db}),apiFailure:error=>Response.json({error:error.message},{status:error.status||500})},
   payments:{paymentConfig:()=>({stripe,test:true}),bookingAmount:()=>({amount:10,cents:1000,driverAmount:8.8,platformFee:1.2})},
  };
  const output={exports:{}};
  const code=ts.transpileModule(fs.readFileSync('app/api/stripe/create-checkout-session/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('require','module','exports',code)(name=>name.endsWith('/payments')?dependencies.payments:dependencies.admin,output,output.exports);
  const response=await output.exports.POST(new Request('https://roadlink.example/api/stripe/create-checkout-session',{method:'POST',body:JSON.stringify({bookingId:'fixture-booking',appExperience,success_url:'https://foreign.example'})}));
  assert.equal(response.status,200);
  assert.equal(created.success_url,`https://roadlink.example${prefix}/my-bookings?payment=success`);
  assert.equal(created.cancel_url,`https://roadlink.example${prefix}/my-bookings?payment=cancelled`);
 }
});
