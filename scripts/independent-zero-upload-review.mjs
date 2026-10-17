// Independent browser review. Only local/synthetic requests are permitted.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, access, rm } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import shell from '@sparticuz/chromium';
import { personaPresets, homePresets } from '../src/presets.js';
import { initialState, STORAGE_KEY, catalog, filteredProducts, makeBooking } from '../src/data.js';

const port = Number(process.env.REVIEW_PORT || 4191);
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  stdio: 'pipe', env: { ...process.env, VITE_AI_PROVIDER: 'codex-cli', VITE_GUIDE_ENDPOINT: '/api/guide' },
});
let browser;
const results = [];
const errors = [];
let page;
async function run(name, fn) {
  try { await fn(); results.push({ name, status: 'pass' }); await rm(`artifacts/independent-failure-${results.length}.png`,{force:true}); console.log(`PASS ${name}`); }
  catch (error) {
    results.push({ name, status: 'fail', error: error.message }); console.log(`FAIL ${name}: ${error.message}`);
    await page?.screenshot({path:`artifacts/independent-failure-${results.length}.png`,fullPage:true}).catch(()=>{});
    await page?.keyboard.press('Escape').catch(()=>{});
  }
}
async function eventually(fn, timeout = 6000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) { try { if (await fn()) return; } catch(e) {last=e;} await delay(60); }
  throw last || new Error('Expected condition did not become true');
}
const unavailableStatus = { provider:'codex-cli', configured:true, usable:false, guide:'unavailable', analysis:'unavailable', scene:'unavailable', connection:'blocked', reason:'runtime_read_only', uploads:false };
let guideRequests=[];
let analysisRequests=[];
async function reset(state = {...initialState(),language:'en'}) {
  await page.evaluate(({key,state})=>localStorage.setItem(key,JSON.stringify(state)),{key:STORAGE_KEY,state});
  await page.reload({waitUntil:'networkidle'});
  await page.getByRole('region',{name:'Default test scenario',exact:true}).waitFor();
}
const readState = ()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),STORAGE_KEY);
const close = ()=>page.getByRole('dialog').last().getByRole('button',{name:'Close / 关闭',exact:true}).click();
async function fullFeed() {
  for (let i=0;i<16;i++) {
    if(await page.locator('.product-card').count()>=catalog.length) break;
    await page.locator('.feed-end').scrollIntoViewIfNeeded();
    await delay(120);
    const more=page.getByRole('button',{name:'Turn the next page',exact:true});
    if (await more.count()) await more.click({timeout:800}).catch(()=>{});
    await delay(60);
  }
  const names=await page.locator('.product-card .product-name').allTextContents();
  return names.map(name=>catalog.find(p=>p.en===name)?.id);
}
async function loadedImage(locator, path) {
  await eventually(()=>locator.evaluate((el,path)=>el.complete&&el.naturalWidth>100&&new URL(el.currentSrc).pathname===path,path));
}

try {
  await mkdir('artifacts',{recursive:true});
  await eventually(()=>fetch(base).then(r=>r.ok).catch(()=>false),15000);
  browser=await chromium.launch({executablePath:await shell.executablePath(),headless:true,args:shell.args,env:{...process.env,HOME:'/tmp'}});
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
    const url=route.request().url();
    if(!url.startsWith(base)) { if(!url.startsWith('data:')&&!url.startsWith('blob:')) return route.abort(); }
    return route.continue();
  });
  await page.route('**/api/status',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(unavailableStatus)}));
  await page.route('**/api/guide',route=>{
    guideRequests.push(route.request().postDataJSON());
    return route.fulfill({contentType:'application/json',body:JSON.stringify({mode:'demo',warning:'runtime_read_only',reply:'Local synthetic fallback',productIds:[]})});
  });
  await page.route('**/api/analyze',route=>{
    analysisRequests.push(route.request().postDataJSON());
    return route.fulfill({contentType:'application/json',body:JSON.stringify({mode:'unavailable',analyzed:false,reason:'runtime_read_only',externalCall:false})});
  });
  await page.goto(base,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Switch to English',exact:true}).click();

  await run('fresh defaults have loaded photographs and no upload controls',async()=>{
    const state=await readState(); assert.equal(state.profile.personaId,'everyday-woman-45');assert.equal(state.profile.homeId,'warm-family');
    const s=page.getByRole('region',{name:'Default test scenario',exact:true});
    await loadedImage(s.locator('.scenario-person img'),'/test-fixtures/personas/everyday-woman-45.jpg');
    await loadedImage(s.locator('.scenario-room img'),'/test-fixtures/homes/warm-family-living.jpg');
    assert.equal(await page.locator('input[type=file]').count(),0);
    assert.equal(state.profile.personaImage,null);assert.equal(state.profile.homeImage,null);
    await s.scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/independent-default-desktop.png',fullPage:false,timeout:30000});
  });
  await run('all four personas load exact photographs and alter visible recommendations',async()=>{
    const rankings=[];const s=page.getByRole('region',{name:'Default test scenario',exact:true});
    for(const p of personaPresets) {
      await s.getByRole('combobox',{name:'Default person & body',exact:true}).selectOption(p.id);
      await loadedImage(s.locator('.scenario-person img'),p.image);
      const state=await readState();assert.equal(state.profile.personaId,p.id);assert.equal(state.profile.size,p.size);assert.equal(state.profile.height,p.height);
      const ids=await fullFeed();assert.deepEqual(ids,filteredProducts({},state.profile,state.feedback).map(p=>p.id));rankings.push(ids.join(','));
      assert.equal(catalog.find(item=>item.id===ids[0]).category,p.category,'Selected persona department should lead the product edit');
      const firstEditNames=await page.locator('.edit-card').first().locator('.edit-products button').evaluateAll(buttons=>buttons.map(b=>b.title));
      assert.ok(firstEditNames.some(name=>catalog.find(item=>item.en===name)?.category===p.category),'First editorial should include selected persona department');
    }
    assert.ok(new Set(rankings).size>=3,`Only ${new Set(rankings).size} persona rankings`);
  });
  await run('three homes load exact room photographs and original floorplans',async()=>{
    const s=page.getByRole('region',{name:'Default test scenario',exact:true});
    const rankings=[];
    for(const h of homePresets) {
      await s.getByRole('combobox',{name:'Default home & floorplan',exact:true}).selectOption(h.id);
      await loadedImage(s.locator('.scenario-room img'),h.images.living);
      await eventually(()=>s.locator('.scenario-plan img').evaluate((el,path)=>el.complete&&el.naturalWidth>20&&new URL(el.currentSrc).pathname===path,h.floorplan));
      const state=await readState();assert.equal(state.profile.homeId,h.id);assert.equal(state.profile.palette,h.palette);
      rankings.push((await fullFeed()).join(','));
    }
    assert.equal(new Set(rankings).size,3,'Home selection should change ranking');
  });
  await run('all nine dedicated room photographs load and rooms change actual home ranking',async()=>{
    for(const h of homePresets)for(const room of ['living','kitchen','bedroom'])await access(`public${h.images[room]}`);
    const s=page.getByRole('region',{name:'Default test scenario',exact:true});
    for(const h of homePresets) {
      await s.getByRole('combobox',{name:'Default home & floorplan',exact:true}).selectOption(h.id);
      const ranks=[];
      for(const room of ['living','kitchen','bedroom']) {
        await s.getByRole('combobox',{name:'Default room',exact:true}).selectOption(room);
        await loadedImage(s.locator('.scenario-room img'),h.images[room]);
        const state=await readState();assert.equal(state.profile.room,room);ranks.push((await fullFeed()).filter(id=>catalog.find(p=>p.id===id).category==='home').join(','));
      }
      assert.ok(new Set(ranks).size>=2,'Room selection should alter home ranking');
    }
    await page.getByRole('button',{name:'Edit your profile',exact:true}).click();await page.getByRole('button',{name:'My space',exact:true}).click();
    for(const room of ['dining','study']) {
      await page.getByRole('combobox',{name:'The room on your mind',exact:true}).selectOption(room);
      await loadedImage(page.locator('.home-preview img'),'/test-fixtures/homes/airy-couple-living.jpg');
      assert.ok((await page.getByRole('dialog').innerText()).includes("Dining and study use this home's living-room reference"));
    }
    await page.getByRole('button',{name:'View illustrative floorplan',exact:true}).click();
    await page.screenshot({path:'artifacts/independent-home-floorplan.png',fullPage:false,timeout:30000});await close();
  });
  await run('preset choices persist and a modal draft cancels without saving',async()=>{
    await reset();const s=page.getByRole('region',{name:'Default test scenario',exact:true});
    await s.getByRole('combobox',{name:'Default person & body',exact:true}).selectOption('soft-woman-60');
    await s.getByRole('combobox',{name:'Default home & floorplan',exact:true}).selectOption('compact-city');
    await s.getByRole('combobox',{name:'Default room',exact:true}).selectOption('bedroom');
    await page.reload({waitUntil:'networkidle'});const saved=await readState();
    assert.equal(saved.profile.personaId,'soft-woman-60');assert.equal(saved.profile.homeId,'compact-city');assert.equal(saved.profile.room,'bedroom');
    await page.getByRole('button',{name:'Edit your profile',exact:true}).click();await page.getByRole('button',{name:/^Tall man · 35/}).click();await close();
    assert.deepEqual((await readState()).profile,saved.profile);
  });
  await run('old version-one state adds defaults and preserves photo bag booking wishlist feedback',async()=>{
    const state={...initialState(),language:'en'};delete state.profile.personaId;delete state.profile.homeId;
    const legacy='data:image/jpeg;base64,AAAA';state.profile={...state.profile,name:'Legacy QA',consent:true,personaImage:legacy,homeImage:legacy,size:'XL',height:176};
    state.wishlist=['ME-002'];state.feedback={'ME-003':'like'};state.cart=[{lineId:'qa-legacy-bag',skuId:'ME-001',size:'L',color:'Ink',quantity:2}];
    state.bookings=[makeBooking(state.cart,{date:'2027-01-15',time:'11:00',name:'Synthetic',sharedFields:{name:true,items:true,dateTime:true,styles:false,height:false,room:false}},123456789)];
    await reset(state);const restored=await readState();
    assert.equal(restored.profile.personaId,'everyday-woman-45');assert.equal(restored.profile.homeId,'warm-family');assert.equal(restored.profile.personaImage,legacy);assert.equal(restored.profile.size,'XL');assert.equal(restored.profile.height,176);
    assert.deepEqual(restored.cart,state.cart);assert.deepEqual(restored.wishlist,state.wishlist);assert.deepEqual(restored.feedback,state.feedback);assert.equal(restored.bookings[0].id,state.bookings[0].id);
    assert.equal(await page.locator('img[src^="data:"]').count(),0);
    await page.getByRole('button',{name:'Edit your profile',exact:true}).click();assert.equal(await page.locator('input[type=file]').count(),0);
    await page.getByRole('button',{name:/^Tall man · 35/}).click();await page.getByRole('button',{name:'Save & refine my edit',exact:true}).click();
    await page.reload({waitUntil:'networkidle'});assert.equal((await readState()).profile.personaImage,legacy);assert.equal((await readState()).profile.homeImage,legacy);
  });
  await run('unavailable analysis is disabled and no fake live output is shown',async()=>{
    await page.getByRole('button',{name:'Edit your profile',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Analyze selected defaults',exact:true}).isDisabled(),true);
    assert.match(await page.getByRole('dialog').innerText(),/No live AI analysis has been produced/);assert.equal(analysisRequests.length,0);
    await page.screenshot({path:'artifacts/independent-analysis-unavailable.png',fullPage:false,timeout:30000});await close();
  });
  await run('CLI consent sends selected preset context while legacy photos and profile identity stay local',async()=>{
    await page.getByRole('button',{name:'Your private guide',exact:true}).click();
    const guide=page.getByRole('dialog',{name:'Your private guide.',exact:true});
    const send=async text=>{const before=await guide.locator('.chat-message.assistant').count();await guide.getByRole('textbox',{name:'Tell your guide what you need',exact:true}).fill(text);await guide.getByRole('button',{name:'Send guide message',exact:true}).click();await eventually(async()=>await guide.locator('.chat-message.assistant').count()>before);};
    guideRequests=[];await send('a calm jacket');assert.equal(guideRequests.length,0);
    await guide.getByRole('checkbox').check();await send('a quiet home under 3000');assert.equal(guideRequests.length,1);
    const payload=guideRequests[0];assert.deepEqual(payload.presetContext,{personaId:'tall-man-35',homeId:'warm-family',room:'living'});assert.deepEqual(payload.consent,{openAI:true});
    assert.ok(!JSON.stringify(payload).includes('data:image'));assert.ok(!JSON.stringify(payload).includes('Legacy QA'));assert.equal(payload.height,undefined);assert.equal(payload.context.category,'home');assert.equal(payload.context.budget,3000);
    assert.match(await guide.innerText(),/Local demo guidance is shown/);assert.ok(!await guide.getByText('OPENAI · GPT CLI TEST',{exact:true}).count());
    await page.screenshot({path:'artifacts/independent-guide-cli-unavailable.png',fullPage:false,timeout:30000});await close();
  });
  await run('all twenty-eight products remain browseable, unique and catalog grounded',async()=>{
    await reset();const ids=await fullFeed();assert.equal(ids.length,28);assert.equal(new Set(ids).size,28);assert.deepEqual(new Set(ids),new Set(catalog.map(p=>p.id)));
    for(const p of catalog){await page.getByRole('textbox',{name:'Search products or styles',exact:true}).fill(p.id);await page.getByRole('button',{name:`View ${p.en}`,exact:true}).click();const modal=page.getByRole('dialog',{name:p.en,exact:true});await modal.waitFor();assert.match(await modal.innerText(),new RegExp(p.id));await close();}
  });
  await run('default scenario and profile controls fit mobile widths',async()=>{
    await reset();for(const width of [390,320]){await page.setViewportSize({width,height:844});const s=page.getByRole('region',{name:'Default test scenario',exact:true});await s.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(width===390)await page.screenshot({path:'artifacts/independent-default-mobile.png',fullPage:false,timeout:30000});await s.getByRole('button',{name:'Adjust test defaults',exact:true}).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.getByRole('button',{name:'My space',exact:true}).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await close();}
  });
  await run('browser has no uncaught errors',async()=>assert.deepEqual(errors,[]));
} catch(error) {results.push({name:'review setup',status:'fail',error:error.stack});console.log(error.stack);}
finally {
  await writeFile('artifacts/independent-zero-upload-review.json',JSON.stringify({syntheticOnly:true,liveExternalCalls:0,results,errors},null,2));
  await browser?.close().catch(()=>{});server.kill('SIGTERM');
}
console.log(`${results.filter(r=>r.status==='pass').length}/${results.length} independent browser checks passed`);
if(results.some(r=>r.status==='fail'))process.exitCode=1;
