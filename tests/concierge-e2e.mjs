import {exitDemoGuide} from "./demo-guide-helpers.mjs";
// Focused side-subtitle browser regressions. Standalone Vite uses port 4187.
// E2E_FILTER selects scenario names; E2E_BASE_URL can target an existing server.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir, rm, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import headless from '@sparticuz/chromium';
import {STORAGE_KEY, initialState, byId, catalog} from '../src/data.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4187';
const results = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let server, browser, context, page, serverLog = '', errors = [], requests = [];
async function eventually(check, message, timeout=6500) {
  const end = Date.now()+timeout; let last;
  while (Date.now()<end) {try {if(await check()) return;} catch(e){last=e;} await sleep(35);}
  throw new Error(`${message}${last ? `: ${last.message}` : ''}`);
}
async function tick(ms) {await page.clock.runFor(ms); await page.evaluate(() => new Promise(r => queueMicrotask(r)));}
async function reset(overrides={}, width=1440) {
  const old = page;
  page = await context.newPage();
  if(old) await old.close();
  errors=[]; requests=[];
  page.setDefaultTimeout(6500);
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', req => {if(req.url().endsWith('/api/guide')) requests.push(req);});
  await page.setViewportSize({width,height:width<600 ? 844 : 1000});
  await page.addInitScript(({key,state}) => {
    localStorage.setItem(key,JSON.stringify(state)); sessionStorage.clear();
    window.__microphoneCalls=0; window.__speechCalls=0;window.__intersectionLog=[];
    const OriginalObserver=window.IntersectionObserver;
    window.IntersectionObserver=class extends OriginalObserver {constructor(cb,options){super((entries,observer)=>{window.__intersectionLog.push(...entries.filter(e=>e.target.dataset.conciergeProduct).map(e=>({id:e.target.dataset.conciergeProduct,ratio:e.intersectionRatio,at:Date.now()})));cb(entries,observer);},options);}};
    try {Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{window.__microphoneCalls++;throw Error('Microphone forbidden in this test');}}});} catch {}
    for(const name of ['SpeechRecognition','webkitSpeechRecognition']) {
      try {Object.defineProperty(window,name,{configurable:true,value:class {constructor(){window.__speechCalls++;} start(){window.__speechCalls++;}}});} catch {}
    }
  },{key:STORAGE_KEY,state:{...initialState(),onboardingStatus:'skipped',language:'en',...overrides}});
  await page.route('**/api/status',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({provider:'gemini',guide:'configured',analysis:'unavailable',scene:'unavailable'})}));
  const clockTime=Date.now();
  await page.clock.install({time:clockTime});
  // Products are visible in the compact first fold. Freeze before navigation so
  // each scenario, rather than network-idle timing, controls its first dwell.
  await page.clock.pauseAt(clockTime+50);
  await page.goto(baseURL,{waitUntil:'networkidle'});
  await page.locator('.demo-setup-compose').click();
  await tick(2500);
  await page.locator(".demo-setup[open]").waitFor({state:"hidden",timeout:10000});
  await exitDemoGuide(page);
  await page.locator('.demo-setup[open]').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'MAISON ÉDIT home',exact:true}).waitFor();
  await page.mouse.move(1,1);
}
const side=()=>page.locator('.subtitle-concierge');
const bubbles=()=>page.locator('.subtitle-bubble:not(.is-retiring)');
const reply=()=>page.getByRole('textbox',{name:'Reply to your guide',exact:true});
async function openProduct(id='ME-001', delay=300) {
  const p=byId(id);
  await page.getByRole('textbox',{name:'Search products or styles',exact:true}).fill(p.en);
  await page.getByRole('button',{name:`View ${p.en}`,exact:true}).first().click();
  const modal=page.getByRole('dialog',{name:p.en,exact:true}); await modal.waitFor();
  await page.mouse.move(1,1); if(delay) await tick(delay); return modal;
}
async function closeModal() {await page.getByRole('dialog').last().getByRole('button',{name:'Close / 关闭',exact:true}).click(); await page.mouse.move(1,1);}
async function conversation() {
  await page.mouse.move(1,1); await tick(900);
  if(await side().getByRole('button',{name:'Conversation',exact:true}).count()) await side().getByRole('button',{name:'Conversation',exact:true}).click();
  else await page.getByRole('button',{name:'Your private guide',exact:true}).click();
  const guide=page.getByRole('dialog',{name:'Your private guide.',exact:true}); await guide.waitFor();return guide;
}
async function send(text) {
  await reply().fill(text); await page.getByRole('button',{name:'Send subtitle reply',exact:true}).click();
  await page.mouse.move(1,1);await tick(400);
}
async function state() {return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),STORAGE_KEY);}
async function checkNoMicrophone() {assert.deepEqual(await page.evaluate(()=>[window.__microphoneCalls,window.__speechCalls]),[0,0]);}
async function assertNoOverflow(width) {
  const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
  assert.ok(size.scroll<=width+1,`document overflows ${width}px: ${JSON.stringify(size)}`);
  const rect=await side().boundingBox();assert.ok(rect.x>=0 && rect.x+rect.width<=width+1,`subtitle bounds overflow: ${JSON.stringify(rect)}`);
  assert.ok(rect.y>=0,`subtitle top offscreen: ${JSON.stringify(rect)}`);
  const input=await reply().boundingBox();assert.ok(input.width>80 && input.x>=0 && input.x+input.width<=width+1,'composer must remain usable');
}
async function assertNormalFootprint(width) {
  assert.equal(await bubbles().count(),1,'normal stream only shows the current line; older turns remain in history');
  assert.ok(await page.locator('.subtitle-bubble.assistant').count()>0,'normal stream includes an actual assistant line');
  const rect=await side().boundingBox();const viewport=page.viewportSize();const ratio=rect.width*rect.height/(viewport.width*viewport.height);
  const detail={viewport:viewport.width,height:viewport.height,width:rect.width,sideHeight:rect.height,percent:Number((ratio*100).toFixed(2))};
  assert.ok(ratio<=0.24,`normal subtitle footprint exceeds 24% of the ${width}px viewport: ${JSON.stringify(detail)}`);
  console.log(`METRIC normal mobile footprint ${width}px: ${JSON.stringify(detail)}`);return detail;
}
async function assertHitCenter(control,label) {
  await control.scrollIntoViewIfNeeded();await tick(100);
  const result=await control.evaluate(el=>{const r=el.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;const hit=document.elementFromPoint(x,y);return {ok:hit===el||el.contains(hit),x,y,hit:hit?.outerHTML.slice(0,200)};});
  assert.equal(result.ok,true,`${label} is obstructed at its physical center: ${JSON.stringify(result)}`);
}
async function assertFeedCenter(control,label,width) {
  await control.scrollIntoViewIfNeeded();
  await control.evaluate(el=>{const r=el.getBoundingClientRect();window.scrollTo({top:window.scrollY+r.top+r.height/2-610,behavior:'instant'});});
  await page.mouse.move(1,1);await sleep(35);await tick(100);
  if (await control.evaluate(el=>Boolean(el.closest('.product-card')))) assert.ok(await bubbles().count()>0,`${label}: current product bubble remains visible during feed scroll`);
  await assertHitCenter(control,`${width}px ${label} while scrolling`);
  await tick(900);await sleep(35);
  if (await control.evaluate(el=>Boolean(el.closest('.product-card')))) assert.ok(await bubbles().count()>0,`${label}: current product bubble remains visible after scrolling stops`);
  await assertHitCenter(control,`${width}px ${label} after scroll stops`);
  const box=await control.boundingBox();assert.ok(Math.abs(box.y+box.height/2-610)<=2,`${label} center must reproduce the y610 obstruction zone`);
}
async function run(name,fn) {
  if(process.env.E2E_FILTER && !new RegExp(process.env.E2E_FILTER,'i').test(name))return;
  const failure=`${root}/artifacts/concierge-fail-${name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.png`;
  try {const details=await fn();assert.deepEqual(errors,[],'uncaught browser errors');await checkNoMicrophone();await rm(failure,{force:true});results.push({name,status:'pass',...(details ? {details} : {})});console.log(`PASS ${name}`);}
  catch(e){results.push({name,status:'fail',error:e.message});console.error(`FAIL ${name}\n${e.stack}`);try{await page.screenshot({path:failure,fullPage:true});}catch{}}
}
try {
  await mkdir(`${root}/artifacts`,{recursive:true});
  if(!process.env.E2E_BASE_URL) {
    server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4187','--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe'],env:{...process.env,VITE_GUIDE_ENDPOINT:'/api/guide'}});
    server.stdout.on('data',c=>serverLog+=c);server.stderr.on('data',c=>serverLog+=c);
    await eventually(async()=>{if(server.exitCode!==null)throw Error(serverLog);return fetch(baseURL).then(r=>r.ok).catch(()=>false);},'Vite 4187 did not start',15000);
  }
  browser=await chromium.launch({executablePath:process.env.E2E_CHROMIUM_PATH||await headless.executablePath(),headless:true,args:headless.args,env:{...process.env,HOME:'/tmp'}});
  context=await browser.newContext({reducedMotion:'reduce'});

  await run('proactive actual product transparent container variant refresh and no autofocus',async()=>{
    await reset();assert.equal(await bubbles().count(),0);
    assert.equal(await reply().evaluate(e=>e===document.activeElement),false);
    const modal=await openProduct();assert.equal(await bubbles().count(),1);assert.match(await bubbles().innerText(),/The sculpted wool blazer/);
    assert.equal(await side().evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
    assert.equal(await side().evaluate(e=>getComputedStyle(e).pointerEvents),'none');
    assert.equal(await reply().evaluate(e=>e===document.activeElement),false);
    const id=await bubbles().getAttribute('data-bubble-id');
    await modal.getByRole('button',{name:'Ink',exact:true}).click();await modal.getByRole('button',{name:'L',exact:true}).click();await tick(300);
    assert.equal(await bubbles().count(),1);assert.equal(await bubbles().getAttribute('data-bubble-id'),id);assert.match(await bubbles().innerText(),/Ink.*L selected/);
    await page.mouse.move(1,1); await tick(900);
    await page.screenshot({path:`${root}/artifacts/subtitle-product-desktop.png`});
    const guide=await conversation();assert.equal(await guide.locator('.chat-message').count(),2);assert.match(await guide.locator('.chat-message').last().innerText(),/Ink.*L selected/);assert.equal(requests.length,0);
  });

  await run('normal desktop browsing retains the latest guide bubble over the product feed',async()=>{
    // Start a general exchange before selecting a product. A product-contextual
    // reply is correctly retired if refinement moves its source out of view.
    await reset();await send('A thought for this edit');await tick(2300);await page.mouse.move(1,1);
    await reply().focus();await page.locator('.product-card').first().scrollIntoViewIfNeeded();await tick(900);
    assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.locator('.subtitle-bubble.assistant').count(),1);assert.ok(await bubbles().count()<=1,'only the latest visual line remains after scrolling');assert.equal(await side().evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
    const cardRect=await page.locator('.product-card').first().boundingBox();assert.ok(cardRect.y<1000&&cardRect.y+cardRect.height>0,'feed card is visible in the desktop capture');
    await page.screenshot({path:`${root}/artifacts/subtitle-side-desktop.png`});
  });

  for(const width of [1440,1024,390,320]) await run(`ordinary feed action centers remain clear at ${width}px while bubbles are visible`,async()=>{
    await reset({},width);await send('A thought for this edit');await tick(2300);await page.evaluate(()=>document.activeElement?.blur());await page.mouse.move(1,1);
    const product=page.locator('.product-card').first();const edit=page.locator('.edit-card').first();
    for(const [label,control] of [
      ['View product image',product.locator('.product-image-button')],
      ['View product title',product.locator('.product-name')],
      ['Save piece',product.getByRole('button',{name:'Save piece',exact:true})],
      ['More like',product.getByRole('button',{name:/^More like /})],
      ['Less',product.getByRole('button',{name:/^Show less of /})],
      ['Save this edit',edit.getByRole('button',{name:'Save this edit',exact:true})],
      ['Try this edit',edit.getByRole('button',{name:'Try this edit',exact:true})],
    ]) await assertFeedCenter(control,label,width);
    await page.screenshot({path:`${root}/artifacts/subtitle-feed-controls-${width}.png`});return {feedControlCenters:7,scrollAndStopped:true,targetCenterY:610};
  });

  await run('rapid variant before first bubble tick refreshes queued actual product',async()=>{
    await reset();const modal=await openProduct('ME-001',0);await modal.getByRole('button',{name:'Ink',exact:true}).click();await modal.getByRole('button',{name:'L',exact:true}).click();assert.equal(await bubbles().count(),0,'the first 200ms interval has not run');await tick(300);assert.equal(await bubbles().count(),1);assert.match(await bubbles().innerText(),/Ink.*L selected/);
  });

  await run('manual search clears current and queued stale conversation visuals',async()=>{
    await reset();await send('A thought for this edit');assert.equal(await page.locator('.subtitle-bubble.user').count(),1);await page.getByRole('textbox',{name:'Search products or styles',exact:true}).fill('vessel');await tick(1800);assert.equal(await bubbles().count(),0,'manual context change must discard old visible and queued bubbles');const guide=await conversation();assert.equal(await guide.locator('.chat-message').count(),3,'manual search keeps the full transcript');
  });

  await run('settled product attention speaks in under half a second',async()=>{
    await reset();const card=page.locator('[data-concierge-product]').first();const id=await card.getAttribute('data-concierge-product');
    await card.scrollIntoViewIfNeeded();await page.mouse.move(1,1);await sleep(100);await tick(120);assert.equal(await bubbles().count(),0,'attention hint fired before the stable threshold');
    await tick(250);await sleep(50);assert.equal(await bubbles().count(),1,JSON.stringify(await page.evaluate(()=>({log:window.__intersectionLog,focus:document.activeElement?.tagName,visibility:document.visibilityState})))) ;assert.ok((await bubbles().innerText()).includes(byId(id).en),'dwell must describe the visible actual piece');assert.equal(requests.length,0);assert.equal(await reply().evaluate(e=>e===document.activeElement),false);
  });

  await run('navigation interrupts unfinished product attention',async()=>{
    await reset();const card=page.locator('[data-concierge-product]').first();const id=await card.getAttribute('data-concierge-product');await card.scrollIntoViewIfNeeded();await sleep(100);await tick(100);
    await page.getByRole('button',{name:'Saved edit',exact:true}).click();await tick(6000);assert.equal(await bubbles().filter({hasText:byId(id).en}).count(),0,'old card dwell leaked into saved view');
    const guide=await conversation();assert.equal(await guide.locator('.chat-message').filter({hasText:byId(id).en}).count(),0);assert.equal(requests.length,0);
  });

  await run('rapid scrolling drops passed products before dwell and after bubble delivery',async()=>{
    await reset();const card=page.locator('[data-concierge-product]').first();const id=await card.getAttribute('data-concierge-product');
    await card.scrollIntoViewIfNeeded();await sleep(80);await tick(100);
    await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));await sleep(60);await tick(1000);
    assert.equal(await card.evaluate(el=>{const r=el.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;}),false,'passed source must actually leave the compact catalog viewport');
    assert.equal(await bubbles().filter({hasText:byId(id).en}).count(),0,'passed product must never be delivered late');
    await reset();const visible=page.locator('[data-concierge-product]').first();await visible.scrollIntoViewIfNeeded();await sleep(80);await tick(1000);assert.equal(await bubbles().count(),1);
    await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));await sleep(60);await tick(250);
    assert.equal(await bubbles().filter({hasText:byId(id).en}).count(),0,'passive bubble must disappear when its source leaves view');assert.equal(await page.locator('.concierge-source-active').count(),0);
    await tick(2500);assert.equal(await bubbles().filter({hasText:byId(id).en}).count(),0,'a dropped line never replays');
  });

  await run('one travelling shell has a deliberate static keyboard source counterpart',async()=>{
    await reset();const card=page.locator('[data-concierge-product]').first();await card.scrollIntoViewIfNeeded();await sleep(80);await tick(1000);
    const bubble=bubbles().last();assert.equal(await page.locator('.concierge-source-active,.concierge-attention-target').count(),0,'there must be no independent source decoration');
    assert.equal(await card.evaluate(el=>getComputedStyle(el).animationName),'none','reduced motion must use a static outline');
    await tick(3300);assert.equal(await page.locator('.concierge-source-active').count(),0,'arrival outline expires');
    await bubble.locator('.bubble-history-trigger').focus();assert.equal(await card.evaluate(el=>el.classList.contains('concierge-source-reading')),true,'keyboard focus on the bubble highlights its source');
    await tick(4000);assert.equal(await card.evaluate(el=>el.classList.contains('concierge-source-reading')),true,'reading keeps the static link');
    await card.locator('.product-name').focus();assert.equal(await bubble.evaluate(el=>el.classList.contains('is-linked')),true,'source keyboard focus links back to the bubble');
    await page.getByRole('button',{name:'Dismiss guide bubble',exact:true}).click();assert.equal(await page.locator('.concierge-source-active').count(),0,'dismiss clears its source outline immediately');
  });

  for(const width of [320,390,1024,1440]) await run(`centered lower composer and linked source at ${width}px`,async()=>{
    await reset({},width);const card=page.locator('[data-concierge-product]').first();await card.scrollIntoViewIfNeeded();await sleep(80);await tick(1000);
    const form=page.locator('.subtitle-composer');const r=await form.boundingBox();const viewport=page.viewportSize();
    assert.ok(Math.abs(r.x+r.width/2-width/2)<=1,'composer remains horizontally centered');assert.ok(r.y>=viewport.height*0.49 && r.y<=viewport.height*0.87,'composer uses the lower-middle rail');
    assert.ok(await bubbles().last().evaluate(el=>parseFloat(getComputedStyle(el).borderTopLeftRadius)>=20),'bubble is rounded');
    const hit=await reply().evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el;});assert.equal(hit,true,'composer itself must remain clickable');
    await assertNoOverflow(width);await page.screenshot({path:`${root}/artifacts/contextual-linked-${width}.png`});
    await reset({language:'zh'},width);await page.locator('[data-concierge-product]').first().scrollIntoViewIfNeeded();await sleep(80);await tick(1000);await bubbles().last().waitFor();
    await page.screenshot({path:`${root}/artifacts/contextual-zh-${width}.png`});
    return {composer:r,sourceOutline:await page.locator('.concierge-source-active').count(),languages:['en','zh']};
  });

  await run('text user and assistant appear one at a time with shared transcript',async()=>{
    await reset();await openProduct();const text='Which colour for this piece?';
    await send(text);assert.equal(await bubbles().filter({hasText:text}).count(),0,'new line must respect one-at-a-time cadence');
    await tick(150);assert.equal(await page.locator('.subtitle-bubble.user').count(),1);assert.equal(await page.locator('.subtitle-bubble.user .bubble-text').innerText(),text);
    await tick(2150);assert.equal(await bubbles().count(),1);assert.match(await bubbles().last().innerText(),/chosen Walnut/);
    await page.getByRole('button',{name:'Dismiss guide bubble',exact:true}).click();assert.equal(await bubbles().count(),0,'dismissing the current turn cannot reveal older visual lines');
    const guide=await conversation();assert.equal(await guide.locator('.chat-message.user p').innerText(),text);assert.equal(await guide.locator('.chat-message').count(),4);assert.match(await guide.locator('.chat-message').last().innerText(),/chosen Walnut/);
  });

  await run('dismiss individual bubble keeps transcript and never replays',async()=>{
    await reset();await openProduct();await page.getByRole('button',{name:'Dismiss guide bubble',exact:true}).click();assert.equal(await bubbles().count(),0);
    const guide=await conversation();assert.equal(await guide.locator('.chat-message').count(),2);await guide.getByRole('button',{name:'Continue in subtitles',exact:true}).click();await tick(1600);assert.equal(await bubbles().count(),0);
  });

  await run('automatic bubbles expire after twenty seconds',async()=>{
    await reset();await openProduct();await page.mouse.move(1,1);await tick(18500);assert.equal(await bubbles().count(),1);await tick(2300);assert.equal(await bubbles().count(),0);
    const guide=await conversation();assert.equal(await guide.locator('.chat-message').count(),2);
  });

  await run('hover pauses bubble expiry then resumes',async()=>{
    await reset();await openProduct();await bubbles().hover();await tick(24000);assert.equal(await bubbles().count(),1);await page.mouse.move(1,1);await tick(21000);assert.equal(await bubbles().count(),0);
  });

  await run('focus pauses bubble expiry then resumes',async()=>{
    await reset();await openProduct();await reply().focus();await tick(24000);assert.equal(await bubbles().count(),1);await page.getByRole('dialog').focus();await page.mouse.move(1,1);await tick(21000);assert.equal(await bubbles().count(),0);
  });

  await run('typing retains input and pauses expiry after blur',async()=>{
    await reset();await openProduct();await reply().fill('Keep this thought');await page.getByRole('dialog').focus();await page.mouse.move(1,1);await tick(24000);assert.equal(await bubbles().count(),1);assert.equal(await reply().inputValue(),'Keep this thought');
    await reply().fill('');await page.getByRole('dialog').focus();await tick(21000);assert.equal(await bubbles().count(),0);
  });

  await run('scroll collapses to one bubble without losing conversation',async()=>{
    await reset();await send('Hello guide');await tick(2200);assert.equal(await bubbles().count(),1);await page.locator('body').focus();await page.mouse.move(1,1);await page.evaluate(()=>window.dispatchEvent(new Event('scroll')));assert.equal(await side().evaluate(e=>e.classList.contains('is-scrolling')),true);await tick(200);assert.equal(await bubbles().count(),1);await tick(900);assert.equal(await bubbles().count(),1,'old visual lines do not reappear after scroll');const guide=await conversation();assert.equal(await guide.locator('.chat-message').count(),3,'the durable conversation retains both lines');
  });

  await run('pause keeps typed input while suppressing proactive events',async()=>{
    await reset();await reply().fill('A retained thought');await page.getByRole('button',{name:'Pause proactive subtitles',exact:true}).click();await openProduct();await tick(1000);assert.equal(await bubbles().count(),0);assert.equal(await reply().inputValue(),'A retained thought');
    await page.getByRole('button',{name:'Resume proactive subtitles',exact:true}).click();await send('Which colour for this piece?');await tick(2200);assert.match(await bubbles().last().innerText(),/Walnut/);
  });

  await run('keyboard escape minimizes without closing product and never auto reappears',async()=>{
    await reset();await openProduct();await reply().focus();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),1);assert.equal(await side().getAttribute('aria-label'),'Subtitle concierge minimized');
    await closeModal();await openProduct('ME-002');await tick(50000);assert.equal(await bubbles().count(),0);assert.equal(await side().getAttribute('aria-label'),'Subtitle concierge minimized');
    assert.equal(await reply().count(),0);
  });

  await run('dismiss concierge survives repeated product events',async()=>{
    await reset();await page.getByRole('button',{name:'Dismiss subtitle concierge',exact:true}).click();await openProduct();await tick(50000);assert.equal(await side().count(),0);assert.equal(await page.evaluate(()=>sessionStorage.getItem('maison-edit-companion')),'dismissed');
  });

  await run('cooldown deduplication and five-message proactive limit',async()=>{
    await reset();await openProduct();await closeModal();await openProduct('ME-002');await tick(200);let guide=await conversation();assert.equal(await guide.locator('.chat-message.assistant').count(),2,'rapid open should be suppressed');await closeModal();await closeModal();
    await tick(11000);await openProduct('ME-001');await tick(400);assert.equal(await bubbles().count(),0,'same product and context must be deduplicated');await closeModal();
    for(const id of ['ME-003','ME-004','ME-005','ME-006','ME-007','ME-008']) {await tick(11000);await openProduct(id);await closeModal();}
    guide=await conversation();assert.equal(await guide.locator('.chat-message.assistant:not([data-attention-hint])').count(),6,'at most five action announcements plus initial explanation; attention hints replace separately');assert.equal(requests.length,0);
  });

  await run('navigation clears stale product bubble and queued reply',async()=>{
    await reset();await openProduct();await send('Which colour for this piece?');await closeModal();await page.getByRole('button',{name:'Saved edit',exact:true}).click();await tick(1800);assert.equal(await bubbles().filter({hasText:/sculpted wool blazer|chosen Walnut/}).count(),0,'stale product bubble or queued line leaked after navigation');
    const guide=await conversation();assert.equal(await guide.locator('.chat-message.user').count(),1,'transcript remains available');
  });

  await run('navigation cancels pending provider request and stale mutations',async()=>{
    await reset();let release;const gate=new Promise(r=>release=r);let requestStarted=false,requestAborted=false;
    page.on('requestfailed',r=>{if(r.url().endsWith('/api/guide'))requestAborted=true;});
    await page.route('**/api/guide',async route=>{requestStarted=true;await gate;await route.fulfill({contentType:'application/json',body:JSON.stringify({mode:'gemini',reply:'STALE SYNTHETIC REPLY',productIds:['ME-018']})}).catch(()=>{});});
    let guide=await conversation();await guide.getByRole('checkbox',{name:/Allow this conversation/}).check();await guide.getByRole('button',{name:'Continue in subtitles',exact:true}).click();await send('home under 1000');await eventually(()=>requestStarted,'synthetic request never started');await page.getByRole('button',{name:'Saved edit',exact:true}).click();release();await eventually(()=>requestAborted,'navigation did not abort pending guide request');await tick(1500);
    assert.equal(await bubbles().filter({hasText:'STALE SYNTHETIC REPLY'}).count(),0);guide=await conversation();assert.equal(await guide.locator('.chat-message').filter({hasText:'STALE SYNTHETIC REPLY'}).count(),0);assert.deepEqual((await state()).profile.styles,initialState().profile.styles);
  });

  await run('consented synthetic provider caps context at eight IDs and keeps selected variant',async()=>{
    const cart=catalog.slice(1,11).map((item,i)=>({lineId:`context-${i}`,skuId:item.id,size:item.sizes.includes('M')?'M':item.sizes[0],color:item.color,quantity:1}));
    await reset({cart});let bodies=[];await page.route('**/api/guide',route=>{bodies.push(route.request().postDataJSON());return route.fulfill({contentType:'application/json',body:JSON.stringify({mode:'gemini',reply:'Synthetic consented context reply.',productIds:['ME-001']})});});
    const modal=await openProduct();await modal.getByRole('button',{name:'Ink',exact:true}).click();await modal.getByRole('button',{name:'L',exact:true}).click();await tick(300);
    await send('Which colour for this piece?');await tick(2200);assert.equal(bodies.length,0,'no provider request or selected variant is transmitted before consent');assert.equal(requests.length,0);
    const guide=await conversation();await guide.getByRole('checkbox',{name:/Allow this conversation/}).check();await guide.getByRole('button',{name:'Continue in subtitles',exact:true}).click();await send('Consider the current piece');await eventually(()=>bodies.length===1,'consented synthetic request did not arrive');
    const body=bodies[0];assert.equal(body.context.selectedProductIds.length,8);assert.equal(body.context.selectedProductIds[0],'ME-001');assert.ok(body.context.selectedProductIds.every(id=>byId(id)),'provider receives known catalogue IDs only');assert.equal(new Set(body.context.selectedProductIds).size,8);assert.match(body.context.occasion,/Selected variant: L, Ink/);assert.deepEqual(body.consent,{googleAI:true});
    await tick(1800);await tick(250);assert.match(await bubbles().last().innerText(),/Synthetic consented context reply/);
  });

  await run('voice is explicit future state and never requests microphone',async()=>{
    await reset();assert.equal(await page.locator('.subtitle-voice-note').count(),0);await page.getByRole('button',{name:'Voice · later',exact:true}).click();assert.match(await page.locator('.subtitle-voice-note').innerText(),/Voice is planned for later.*No voice connection or microphone is active/);await checkNoMicrophone();await page.getByRole('button',{name:'Continue with subtitles',exact:true}).click();assert.equal(await page.locator('.subtitle-voice-note').count(),0);
    const guide=await conversation();await guide.getByRole('button',{name:'Voice mode · coming later',exact:true}).click();assert.match(await page.locator('.subtitle-voice-note').innerText(),/planned for later/);await checkNoMicrophone();
  });

  await run('quick actions use current product and booking opens acknowledgment sharing form',async()=>{
    const cart=[{lineId:'subtitle-bag',skuId:'ME-001',size:'M',color:'Walnut',quantity:1}];await reset({cart});await openProduct();await page.locator('.bubble-replies').getByRole('button',{name:'Compare colours',exact:true}).click();await page.mouse.move(1,1);await tick(2500);assert.match(await bubbles().last().innerText(),/chosen Walnut/);
    await page.locator('.bubble-replies').getByRole('button',{name:'See it in store',exact:true}).click();const booking=page.getByRole('dialog');await booking.getByRole('button',{name:'Confirm demo visit',exact:true}).waitFor();assert.equal(await booking.getByRole('checkbox',{name:'I understand this is a local demo, not a real store appointment. There is no charge.',exact:true}).isChecked(),false);assert.equal(await booking.getByRole('checkbox',{name:'Style preferences (optional)',exact:true}).isChecked(),false);assert.deepEqual((await state()).bookings,[]);assert.deepEqual((await state()).cart,cart);
    await booking.getByRole('button',{name:'Confirm demo visit',exact:true}).click();assert.match(await booking.getByRole('alert').innerText(),/acknowledge/);assert.deepEqual((await state()).bookings,[]);
  });

  for(const width of [390,320]) await run(`responsive ${width}px no overflow composer and product context`,async()=>{
    await reset({},width);await send('A very long colour styling thought that stays inside this phone width');await tick(2300);await assertNoOverflow(width);const footprint=await assertNormalFootprint(width);
    // A second exchange keeps the collapsed view compact while the shared
    // transcript retains both speakers; the first exchange verifies long copy.
    await send('Reset my edit');await tick(2300);await assertNoOverflow(width);await assertNormalFootprint(width);await page.screenshot({path:`${root}/artifacts/subtitle-side-mobile${width}.png`});
    await reset({},width);const modal=await openProduct();await tick(900);await assertNoOverflow(width);const productComposer=await page.locator('.subtitle-composer').boundingBox();assert.ok(Math.abs(productComposer.x+productComposer.width/2-width/2)<=1,'product composer is centered');assert.equal(await reply().evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el;}),true,'product composer is clickable');assert.match(await bubbles().innerText(),/sculpted wool blazer/);
    for(const [label,control] of [
      ['size L',modal.getByRole('button',{name:'L',exact:true})],['colour Ink',modal.getByRole('button',{name:'Ink',exact:true})],
      ['Add to visit bag',modal.getByRole('button',{name:'Add to visit bag',exact:true})],['Save this piece',modal.getByRole('button',{name:'Save this piece',exact:true})],
      ['lighter budget alternative',modal.locator('.alternative-button')],
    ]) await assertHitCenter(control,label);
    await page.mouse.move(1,1);await tick(900);
    await page.screenshot({path:`${root}/artifacts/subtitle-product-mobile${width}.png`});
    await page.getByRole('button',{name:'Minimize subtitles',exact:true}).click();const resume=page.getByRole('button',{name:'ÉDIT · Resume subtitles',exact:true});await assertHitCenter(resume,'minimized product resume chip');await resume.click();assert.equal(await reply().evaluate(e=>e===document.activeElement),false);
    return {normalFootprint:footprint,productControlCenters:'passed',minimizedResumeCenter:'passed'};

  });
} catch(e){console.error(e.stack);results.push({name:'suite setup',status:'fail',error:e.message});}
finally {
  console.log(`\n${results.filter(r=>r.status==='pass').length}/${results.length} scenarios passed`);
  await writeFile(`${root}/artifacts/concierge-e2e${process.env.E2E_FILTER ? '-focused' : ''}-results.json`,JSON.stringify(results,null,2)+'\n').catch(()=>{});
  await browser?.close().catch(()=>{});if(server){server.kill('SIGTERM');await sleep(100);if(server.exitCode===null)server.kill('SIGKILL');}
  if(results.some(r=>r.status==='fail'))process.exitCode=1;
}
