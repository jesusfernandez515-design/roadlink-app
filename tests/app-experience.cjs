const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const mod={exports:{}};
new Function('exports',ts.transpileModule(fs.readFileSync('lib/app-experience.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod.exports);
test('app entrances resolve only their own path boundaries',()=>{
 const {experienceFromPath,experienceHome}=mod.exports;
 for(const [path,expected] of [['/conductor','driver'],['/conductor/trips','driver'],['/pasajero','passenger'],['/pasajero/bookings','passenger'],['/conductores',null],['/pasajeros',null],['/profile',null],['/api/payments',null]]) assert.equal(experienceFromPath(path),expected);
 assert.equal(experienceHome('driver'),'/conductor/');assert.equal(experienceHome('passenger'),'/pasajero/');
});
test('web apps keep separate install identities and matching entry routes',()=>{
 const driver=JSON.parse(fs.readFileSync('public/manifest-driver.json','utf8'));
 const passenger=JSON.parse(fs.readFileSync('public/manifest-passenger.json','utf8'));
 assert.notEqual(driver.scope, passenger.scope);assert.ok(!driver.scope.startsWith(passenger.scope) && !passenger.scope.startsWith(driver.scope));assert.notEqual(driver.id,passenger.id);assert.notEqual(driver.name,passenger.name);
 for(const app of [driver,passenger]){assert.equal(app.id,app.start_url);assert.equal(app.display,'standalone');assert.ok(fs.existsSync(`app${app.start_url}/page.tsx`));for(const icon of app.icons)assert.ok(fs.existsSync(`public${icon.src}`));}
});

test('navigation and auth remain within each app without rewriting APIs or external links',()=>{
 const {appPath}=mod.exports;
 for(const [mode,prefix] of [['driver','/conductor/'],['passenger','/pasajero/']]){
  assert.equal(appPath('/login',mode),prefix+'login');
  assert.equal(appPath('/profile/edit',mode),prefix+'profile/edit');
  assert.equal(appPath('/chat?chatId=abc#latest',mode),prefix+'chat?chatId=abc#latest');
  assert.equal(appPath('/dashboard',mode),prefix);
  for(const path of ['/my-rides','/my-bookings','/wallet','/notifications','/messages','/find-ride','/offer-ride'])assert.ok(fs.existsSync('app'+appPath(path,mode)+'/page.tsx'));
  for(const href of ['https://checkout.stripe.com/x','//example.com/x','/api/bookings/reserve','/icons/logo.svg','#section','/admin','/conductor/','/pasajero/'])assert.equal(appPath(href,mode),href);
 }
 assert.equal(appPath('/profile',null),'/profile');
});
