import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
import chrome from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {initialState,STORAGE_KEY,catalog,makeBooking} from '../src/data.js';
const port=5189;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port)],{stdio:'pipe'});
let browser;
const results=[];
try {
await mkdir('artifacts',{recursive:true});
await delay(1000);
browser=await chromium.launch({executablePath:await chrome.executablePath(),headless:true,args:chrome.args,env:{...process.env,HOME:'/tmp'}});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page=await context.newPage();page.setDefaultTimeout(5000);
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.goto(`http://127.0.0.1:${port}`,{waitUntil:'networkidle'});
const store=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),STORAGE_KEY);
const reset=async(state={...initialState(),language:'en'})=>{state={...state,onboardingStatus:'skipped'};await page.evaluate(({k,state})=>localStorage.setItem(k,JSON.stringify(state)),{k:STORAGE_KEY,state});await page.reload({waitUntil:'networkidle'})};
const close=()=>page.getByRole('button',{name:'Close / 关闭',exact:true}).click();
const run=async(name,fn)=>{if(process.env.AUDIT_FILTER&&!new RegExp(process.env.AUDIT_FILTER,'i').test(name))return;try {await fn();results.push({name,pass:true});console.log('PASS',name)}catch(e){results.push({name,pass:false,error:e.message});console.log('FAIL',name,e.message);await page.screenshot({path:`artifacts/audit-failure-${results.length}.png`,fullPage:true}).catch(()=>{});await page.keyboard.press('Escape').catch(()=>{})}};
await reset();
await page.screenshot({path:'artifacts/audit-01-desktop.png',fullPage:false});
await run('profile draft cancel does not save',async()=>{
await page.getByRole('button',{name:'Edit your profile',exact:true}).click();
await page.getByLabel('What should we call you?',{exact:true}).fill('QA Draft');
await close();assert.equal((await store()).profile.name,'Alex');
});
await run('profile save and reload persistence',async()=>{
await page.getByRole('button',{name:'Edit your profile',exact:true}).click();
await page.getByLabel('What should we call you?',{exact:true}).fill('QA Saved');
await page.locator('.form-row select').selectOption('L');
await page.getByRole('button',{name:'Save & refine my edit',exact:true}).click();
assert.equal((await store()).profile.name,'QA Saved');
await page.reload({waitUntil:'networkidle'});assert.equal((await store()).profile.size,'L');
});
await run('optional height can be cleared and saved',async()=>{
await page.getByRole('button',{name:'Edit your profile',exact:true}).click();
await page.getByLabel('Height (optional · cm)',{exact:true}).fill('');
await page.getByRole('button',{name:'Save & refine my edit',exact:true}).click();
assert.equal(await page.getByRole('dialog').count(),0,'optional height clearing should save, but dialog remains');
});
await reset();
await run('search category budget and empty reset',async()=>{
await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Home & living',exact:true}).click();
await page.getByLabel('Maximum per-item budget',{exact:true}).selectOption('1000');
const feed=page.locator('.product-card');
assert.ok(await feed.count()>0);
const prices=await feed.locator('.price').allTextContents();assert.ok(prices.every(x=>Number(x.replace(/[^0-9]/g,''))<=1000));
await page.getByLabel('Search products or styles',{exact:true}).fill('no-actual-match');
await page.getByRole('heading',{name:'No discoveries on this page, yet.',exact:true}).waitFor();
await page.getByRole('button',{name:'Reset filters',exact:true}).click();await page.locator('.feed-card').first().waitFor();assert.ok(await page.locator('.feed-card').count()>0);
});
await run('infinite feed reaches all unique catalog products',async()=>{
for(let i=0;i<12;i++){await page.locator('.feed-end').scrollIntoViewIfNeeded();await delay(100);const more=page.getByRole('button',{name:'Keep browsing pieces',exact:true});if(await more.count())await more.click();}
assert.equal(await page.locator('.product-card').count(),catalog.length);
const names=await page.locator('.product-card .product-name').allTextContents();assert.equal(new Set(names).size,catalog.length);await page.locator('#the-edit .section-heading').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/audit-05-final-feed.png',timeout:20000,animations:'disabled'});
});
await reset();
await run('wishlist size color and quantity persist in bag',async()=>{
await page.getByLabel('Search products or styles',{exact:true}).fill('sculpted wool blazer');
await page.getByRole('button',{name:'View The sculpted wool blazer',exact:true}).first().click();
await page.getByRole('button',{name:'L',exact:true}).click();await page.getByRole('button',{name:'Ink',exact:true}).click();
await page.getByLabel('Quantity',{exact:true}).fill('2');
await page.getByRole('button',{name:'Save this piece',exact:true}).click();
await page.getByRole('button',{name:'Add to visit bag',exact:true}).click();await close();
const s=await store();assert.deepEqual(s.wishlist,['ME-001']);assert.equal(s.cart[0].size,'L');assert.equal(s.cart[0].color,'Ink');assert.equal(s.cart[0].quantity,2);
await page.reload({waitUntil:'networkidle'});assert.equal((await store()).cart[0].quantity,2);
});
await run('booking consent required and past dates rejected',async()=>{
await page.getByRole('button',{name:'Visit bag',exact:true}).click();await page.getByRole('button',{name:'Arrange a private visit',exact:true}).click();
await page.getByRole('button',{name:'Confirm demo visit',exact:true}).click();
assert.match(await page.locator('.form-error').innerText(),/acknowledge/);
await page.getByLabel('I understand this is a local demo, not a real store appointment. There is no charge.',{exact:true}).check();
await page.getByLabel('Date (device local time)',{exact:true}).fill('2000-01-01');
await page.getByRole('button',{name:'Confirm demo visit',exact:true}).click();assert.equal((await store()).bookings.length,0);
});
if(await page.getByRole('dialog').count())await close();
await run('booking draft dismissal preserves bag and creates no booking',async()=>{
await page.getByRole('button',{name:'Visit bag',exact:true}).click();await page.getByRole('button',{name:'Arrange a private visit',exact:true}).click();
await page.getByLabel('Booking name',{exact:true}).first().fill('Draft visit');await close();
assert.equal((await store()).bookings.length,0);assert.equal((await store()).cart.length,1);
});
await run('booking confirm creates local snapshot and route',async()=>{
await page.getByRole('button',{name:'Visit bag',exact:true}).click();await page.getByRole('button',{name:'Arrange a private visit',exact:true}).click();
await page.getByLabel('Style preferences (optional)',{exact:true}).check();
await page.getByLabel('I understand this is a local demo, not a real store appointment. There is no charge.',{exact:true}).check();
await page.getByRole('button',{name:'Confirm demo visit',exact:true}).click();
await page.getByRole('heading',{name:'Local demo booking confirmed',exact:true}).waitFor();
await page.screenshot({path:'artifacts/audit-02-booking-confirmed.png',timeout:20000,animations:'disabled'});
const s=await store();assert.equal(s.bookings.length,1);assert.equal(s.cart.length,0);assert.equal(s.bookings[0].demo,true);assert.equal(s.bookings[0].items[0].quantity,2);assert.ok(s.bookings[0].sharedSnapshot.styles.length>0);assert.equal(s.bookings[0].sharedSnapshot.height,null);
await page.getByRole('button',{name:'View itinerary & route',exact:true}).click();
assert.match(await page.locator('.text-route').innerText(),/Floor 2/);
await page.getByRole('button',{name:'Step-free route',exact:true}).click();assert.match(await page.locator('.text-route').innerText(),/step-free concept/);
});
await run('merchant preparation synchronizes to consumer visit',async()=>{
await page.getByRole('button',{name:'Merchant studio',exact:true}).click();
await page.getByLabel('The sculpted wool blazer preparation status',{exact:true}).selectOption('ready');
await page.getByRole('button',{name:'Consumer view',exact:true}).click();await page.getByRole('button',{name:'Your visit',exact:true}).click();
assert.equal(await page.locator('.prep-status').innerText(),'Ready');
});
await run('merchant unavailable substitute can be customer accepted',async()=>{
await page.getByRole('button',{name:'Merchant studio',exact:true}).click();
await page.getByLabel('The sculpted wool blazer preparation status',{exact:true}).selectOption('unavailable');
await page.getByRole('button',{name:'Consumer view',exact:true}).click();await page.getByRole('button',{name:'Your visit',exact:true}).click();
await page.getByRole('button',{name:'Accept alternative',exact:true}).click();
const s=await store();assert.equal(s.bookings[0].items[0].skuId,'ME-015');assert.equal(s.bookings[0].items[0].status,'pending');
});
await run('cancel booking synchronizes disabled merchant editing',async()=>{
await page.getByRole('button',{name:'Cancel demo visit',exact:true}).click();assert.equal((await store()).bookings[0].status,'cancelled');
await page.getByRole('button',{name:'Merchant studio',exact:true}).click();assert.equal(await page.getByLabel('The linen column dress preparation status',{exact:true}).isDisabled(),true);
});
await run('stock edit synchronizes out-of-stock consumer controls',async()=>{
await page.getByRole('button',{name:'Catalog & inventory',exact:true}).click();await page.getByLabel('Search merchant catalog',{exact:true}).fill('ME-001');
await page.getByRole('button',{name:'Edit stock',exact:true}).click();await page.getByLabel('New demo stock',{exact:true}).fill('0');await page.getByRole('button',{name:'Save',exact:true}).click();
await page.getByRole('button',{name:'Consumer view',exact:true}).click();await page.getByLabel('Search products or styles',{exact:true}).fill('sculpted wool blazer');
assert.equal(await page.locator('.stock-tag').innerText(),'DEMO OUT OF STOCK');
await page.getByRole('button',{name:'View The sculpted wool blazer',exact:true}).first().click();assert.equal(await page.getByRole('button',{name:'Add to visit bag',exact:true}).isDisabled(),true);await close();
});
await reset();
await run('English guide womenswear intent resolves correctly',async()=>{
await page.getByRole('button',{name:'Your private guide',exact:true}).click();await page.getByLabel('Tell your guide what you need',{exact:true}).fill('women');await page.getByRole('button',{name:'Send guide message',exact:true}).click();await delay(500);await close();
assert.equal(await page.locator('.category-tabs button.active').innerText(),'Womenswear');
});

await reset();
await run('same SKU multiple variants cannot exceed aggregate stock',async()=>{
await page.getByLabel('Search products or styles',{exact:true}).fill('sculpted wool blazer');
await page.getByRole('button',{name:'View The sculpted wool blazer',exact:true}).first().click();
await page.getByRole('button',{name:'M',exact:true}).click();await page.getByLabel('Quantity',{exact:true}).fill('5');await page.getByRole('button',{name:'Add to visit bag',exact:true}).click();
await page.getByRole('button',{name:'L',exact:true}).click();await page.getByLabel('Quantity',{exact:true}).fill('5');await page.getByRole('button',{name:'Add to visit bag',exact:true}).click();
assert.ok((await store()).cart.reduce((n,x)=>n+x.quantity,0)<=8);await close();
});
await reset();
await run('product quantities must be whole units',async()=>{
await page.getByLabel('Search products or styles',{exact:true}).fill('sculpted wool blazer');await page.getByRole('button',{name:'View The sculpted wool blazer',exact:true}).first().click();
await page.getByLabel('Quantity',{exact:true}).fill('1.5');await page.getByRole('button',{name:'Add to visit bag',exact:true}).click();await close();
assert.ok((await store()).cart.every(x=>Number.isInteger(x.quantity)),'fractional quantity was saved to bag');
});
await reset({...initialState(),language:'en',cart:[{lineId:'qa-pending',skuId:'ME-001',size:'M',color:'Ink',quantity:1}]});
await run('dismissing while booking saves does not create hidden booking',async()=>{
await page.getByRole('button',{name:'Visit bag',exact:true}).click();await page.getByRole('button',{name:'Arrange a private visit',exact:true}).click();await page.getByLabel('I understand this is a local demo, not a real store appointment. There is no charge.',{exact:true}).check();
assert.equal((await store()).cart.length,1);await page.getByRole('button',{name:'Confirm demo visit',exact:true}).click();await page.getByRole('button',{name:'Saving local demo…',exact:true}).waitFor();await close();await delay(2000);
assert.equal((await store()).bookings.length,0,'booking persisted after modal was dismissed during Saving local demo');
});
await reset();
await run('fictional presets replace private photo uploads and remain local',async()=>{
assert.equal(await page.locator('input[type=file]').count(),0);
const outbound=[];const onReq=r=>{if(!r.url().startsWith(`http://127.0.0.1:${port}`))outbound.push(r.url())};page.on('request',onReq);
await page.getByRole('button',{name:'Edit your profile',exact:true}).click();
const profile=page.getByRole('dialog',{name:'A little more you.',exact:true});
await profile.getByRole('button',{name:'Relaxed man · 50 Relaxed build · 172 cm · L',exact:true}).click();
await profile.getByRole('button',{name:'My space',exact:true}).click();
await profile.getByRole('button',{name:/^Compact city apartment/}).click();
assert.equal(await profile.locator('input[type=file]').count(),0);
await profile.getByRole('button',{name:'Save & refine my edit',exact:true}).click();
assert.equal((await store()).profile.personaId,'relaxed-man-50');assert.equal((await store()).profile.homeId,'compact-city');
await page.getByRole('button',{name:'Edit your profile',exact:true}).click();assert.equal(await page.locator('input[type=file]').count(),0);await close();
assert.deepEqual(outbound,[]);page.off('request',onReq);
});


await reset();
await run('dismissed pending local guide does not change hidden filters or profile',async()=>{
await page.getByRole('button',{name:'Your private guide',exact:true}).click();await page.getByLabel('Tell your guide what you need',{exact:true}).fill('artful home budget 2000');await page.getByRole('button',{name:'Send guide message',exact:true}).click();
await page.getByRole('status').filter({hasText:'Considering your edit…'}).waitFor();await page.keyboard.press('Escape');await delay(2000);
assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.locator('.category-tabs button.active').innerText(),'For you');assert.equal(await page.getByLabel('Maximum per-item budget',{exact:true}).inputValue(),'10000');assert.deepEqual((await store()).profile.styles,['quiet','warm']);
});
const staleBooking=makeBooking([{skuId:'ME-001',size:'M',color:'Ink',quantity:1}],{date:'2030-01-01',time:'11:00',name:'QA Stale Alternative',sharedFields:{name:true,items:true,dateTime:true}},12345);
staleBooking.items[0].status='unavailable';staleBooking.items[0].alternativeId='ME-015';
await reset({...initialState(),language:'en',bookings:[staleBooking],inventory:{...initialState().inventory,'ME-015':0}});
await run('out-of-stock suggested alternative cannot be accepted',async()=>{
await page.getByRole('button',{name:'Your visit',exact:true}).click();
const accept=page.getByRole('button',{name:'Accept alternative',exact:true});
if(await accept.count() && !(await accept.isDisabled()))await accept.click();
assert.equal((await store()).bookings[0].items[0].skuId,'ME-001','out-of-stock suggestion was accepted');
});
await reset();
await run('ambient mute volume and language persistence',async()=>{
await page.getByRole('button',{name:'Play original ambient audio',exact:true}).click();
assert.equal(await page.getByRole('button',{name:'Mute ambient audio',exact:true}).getAttribute('aria-pressed'),'true');
await page.getByLabel('Ambient volume',{exact:true}).fill('0.11');assert.equal((await store()).soundVolume,0.11);
await page.getByRole('button',{name:'Mute ambient audio',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Play original ambient audio',exact:true}).getAttribute('aria-pressed'),'false');
await page.getByRole('button',{name:'切换至中文',exact:true}).click();assert.equal((await store()).language,'zh');await page.reload({waitUntil:'networkidle'});assert.equal((await store()).language,'zh');
});
await reset();
await run('mobile viewport key pages and dialogs have no horizontal overflow',async()=>{
await page.setViewportSize({width:390,height:844});await delay(200);
const over=()=>page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.deepEqual(await over(),{width:390,scroll:390});
await page.screenshot({path:'artifacts/audit-03-mobile.png'});
await page.getByRole('button',{name:'Preferences & privacy',exact:true}).click();assert.deepEqual(await over(),{width:390,scroll:390});await close();
await page.getByRole('button',{name:'Merchant studio',exact:true}).click();await page.getByRole('button',{name:'Catalog & inventory',exact:true}).click();assert.deepEqual(await over(),{width:390,scroll:390});
await page.screenshot({path:'artifacts/audit-04-mobile-merchant.png',timeout:20000});await page.setViewportSize({width:320,height:700});assert.deepEqual(await over(),{width:320,scroll:320});await page.getByRole('button',{name:'Consumer view',exact:true}).click();assert.deepEqual(await over(),{width:320,scroll:320});
});
await reset();
await run('delete confirmation cancellation retains all data and confirmed reset works',async()=>{
await page.getByRole('button',{name:'Preferences & privacy',exact:true}).click();await page.getByRole('button',{name:'Preferences & data',exact:true}).click();await page.getByRole('button',{name:'Delete all local demo data',exact:true}).click();await page.getByRole('button',{name:'Keep data',exact:true}).click();assert.equal((await store()).language,'en');
await page.getByRole('button',{name:'Delete all local demo data',exact:true}).click();await page.getByRole('button',{name:'Confirm deletion',exact:true}).click();assert.deepEqual(await store(),initialState());
});
results.push({name:'no unhandled browser page errors',pass:errors.length===0,errors});
await writeFile('artifacts/audit-flow-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
} finally {if(browser)await browser.close();server.kill();}
if(results.some(x=>x.pass===false))process.exitCode=1;
