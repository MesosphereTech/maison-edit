import {exitDemoGuide} from "./demo-guide-helpers.mjs";
// A self-contained Playwright suite. It starts Vite unless E2E_BASE_URL is set.
// Use E2E_CHROMIUM_PATH for an installed browser; the bundled headless shell
// works in restricted cloud containers without requiring a desktop connection.
// E2E_FILTER can select scenario names with a regular expression.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {personaPresets,homePresets} from '../src/presets.js';
import {curatedScenarios} from '../src/personalized-scenes.js';
import {STORAGE_KEY, initialState, byId, catalog, lookDefinitions, cheaperAlternative, makeBooking} from '../src/data.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4179';
const results = [];
let server;
let browser;
let page;
let serverLog = '';
let errors = [];
let clockPaused = false;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function eventually(check, message = 'condition did not become true', timeout = 6000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try { if (await check()) return; } catch (error) { last = error; }
    await sleep(60);
  }
  throw new Error(`${message}${last ? `: ${last.message}` : ''}`);
}

async function launch() {
  if (process.env.E2E_CHROMIUM_PATH) {
    return chromium.launch({executablePath: process.env.E2E_CHROMIUM_PATH, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage']});
  }
  try {
    const {default: headless} = await import('@sparticuz/chromium');
    return await chromium.launch({executablePath: await headless.executablePath(), headless: true, args: headless.args, env: {...process.env, HOME: '/tmp'}});
  } catch (shellError) {
    try { return await chromium.launch({headless: true}); }
    catch (error) { throw new Error(`Browser launch failed. Headless shell: ${shellError.message}. Playwright browser: ${error.message}`); }
  }
}

async function readState() {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
}

async function enterDemo() {
  await page.locator('.demo-setup-compose').click();
  if (clockPaused) await page.clock.runFor(2500);
  await page.locator(".demo-setup[open]").waitFor({state:"hidden",timeout:10000});
  await exitDemoGuide(page);
  await page.locator('.demo-setup[open]').waitFor({state:'hidden'});
}

async function reset(overrides = {}, width = 1440) {
  await page.unrouteAll({behavior: 'wait'});
  await page.setViewportSize({width, height: width < 600 ? 844 : 1000});
  await page.goto(baseURL, {waitUntil: 'domcontentloaded',timeout:15000});
  const state = {...initialState(), onboardingStatus: 'skipped', language: 'en', ...overrides};
  await page.evaluate(({key, state}) => localStorage.setItem(key, JSON.stringify(state)), {key: STORAGE_KEY, state});
  await page.reload({waitUntil: 'domcontentloaded',timeout:15000});
  await enterDemo();
  await page.getByRole('button', {name: 'MAISON ÉDIT home', exact: true}).waitFor();
  errors = [];
  return state;
}

async function closeModal() {
  await page.getByRole('dialog').last().getByRole('button', {name: 'Close / 关闭', exact: true}).click();
  await eventually(async () => await page.getByRole('dialog').count() === 0, 'dialog did not close');
}

async function editProfile() {
  await page.locator('.shop-preference-entry').click({noWaitAfter:true});
  const modal = page.getByRole('dialog', {name: 'A little more you.', exact: true});
  await modal.waitFor();
  return modal;
}

async function openProduct(id) {
  const product = byId(id);
  await page.getByRole('textbox', {name: 'Search products or styles', exact: true}).fill(product.en);
  await page.getByRole('button', {name: `View ${product.en}`, exact: true}).first().click();
  await page.getByRole('dialog', {name: product.en, exact: true}).waitFor();
  return page.getByRole('dialog', {name: product.en, exact: true});
}

async function addProduct(id, {size, color, quantity = 1} = {}) {
  const modal = await openProduct(id);
  if (size) await modal.getByRole('button', {name: size, exact: true}).click();
  if (color) await modal.getByRole('button', {name: color, exact: true}).click();
  await modal.getByRole('spinbutton', {name: 'Quantity', exact: true}).fill(String(quantity));
  await modal.getByRole('button', {name: 'Add to visit bag', exact: true}).click();
  await closeModal();
}

async function guideSend(text) {
  const guide = page.getByRole('dialog', {name: 'Your private guide.', exact: true});
  const count = await guide.locator('.chat-message.assistant').count();
  await guide.getByRole('textbox', {name: 'Tell your guide what you need', exact: true}).fill(text);
  await guide.getByRole('button', {name: 'Send guide message', exact: true}).click();
  await eventually(async () => await guide.locator('.chat-message.assistant').count() > count, `guide did not answer ${text}`);
  return guide;
}

function futureDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function seededBooking() {
  const cart = [{lineId: 'seed-bag', skuId: 'ME-001', size: 'M', color: 'Walnut', quantity: 1}];
  return {...makeBooking(cart, {date: futureDate(), time: '11:00', name: 'Avery', sharedFields: {name: true, items: true, dateTime: true, styles: false, height: false, room: false}}, Date.now() - 1000), sharedSnapshot: {styles: [], height: null, room: null}};
}

async function run(name, fn) {
  if (process.env.E2E_FILTER && !new RegExp(process.env.E2E_FILTER, 'i').test(name)) return;
  const failureImage = `${root}/artifacts/e2e-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  try {
    await fn();
    assert.deepEqual(errors, [], 'uncaught browser errors');
    await rm(failureImage, {force: true});
    results.push({name, status: 'pass'});
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({name, status: 'fail', error: error.message});
    console.error(`FAIL ${name}\n${error.stack}`);
    try {
      await mkdir(`${root}/artifacts`, {recursive: true});
      await page.screenshot({path: failureImage, fullPage: true});
    } catch {}
  }
}

try {
  if (!process.env.E2E_BASE_URL) {
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4179', '--strictPort'], {
      cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
      // Expose the optional connector UI and intercept its synthetic requests.
      // No provider credentials are needed and no Google service is contacted.
      env: {...process.env, VITE_GUIDE_ENDPOINT: process.env.VITE_GUIDE_ENDPOINT || '/api/guide'},
    });
    server.stdout.on('data', chunk => { serverLog += chunk; });
    server.stderr.on('data', chunk => { serverLog += chunk; });
    await eventually(async () => {
      if (server.exitCode !== null) throw new Error(serverLog);
      return fetch(baseURL).then(response => response.ok).catch(() => false);
    }, `Vite did not start: ${serverLog}`, 15000);
  }
  browser = await launch();
  // Keep this context/page alive for the full suite: single-process headless
  // shells can terminate when their final context closes.
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'});
  page = await context.newPage();
  page.setDefaultTimeout(6000);
  page.on('pageerror', error => errors.push(error.message));

  await run('language navigation filters search and reset', async () => {
    await reset();
    await page.getByRole('button', {name: '切换至中文', exact: true}).click();
    assert.equal((await readState()).language, 'zh');
    await page.getByRole('button', {name: 'Switch to English', exact: true}).click();
    await page.locator('.category-tabs').getByRole('button', {name: 'Home & living', exact: true}).click();
    await page.getByRole('combobox', {name: 'Maximum per-item budget', exact: true}).selectOption('1000');
    await page.getByRole('textbox', {name: 'Search products or styles', exact: true}).fill('vessel');
    assert.ok(await page.locator('.product-card').count() >= 1);
    assert.equal(new Set(await page.locator('.product-card').evaluateAll(cards => cards.map(card => card.dataset.conciergeProduct))).size, 1);
    assert.match(await page.locator('.product-card').first().innerText(), /hand-formed vessel/);
    await page.getByRole('textbox', {name: 'Search products or styles', exact: true}).fill('no-such-product');
    await page.getByRole('heading', {name: 'No discoveries on this page, yet.', exact: true}).waitFor();
    await page.getByRole('button', {name: 'Reset filters', exact: true}).click();
    assert.equal(await page.getByRole('textbox', {name: 'Search products or styles', exact: true}).inputValue(), '');
    assert.equal(await page.getByRole('combobox', {name: 'Maximum per-item budget', exact: true}).inputValue(), '10000');
    await page.locator('.site-header nav').getByRole('button', {name: 'Wardrobe', exact: true}).click();
    assert.match(await page.locator('.category-tabs .active').innerText(), /Womenswear/);
  });

  await run('default store music keyboard volume mute and remembered pause', async () => {
    await reset();
    const play = page.getByRole('button', {name: 'Play store music', exact: true});
    // Browsers may require one interaction; the focused music suite separately
    // verifies allowed and policy-blocked startup without replacing real audio.
    await page.getByRole('button', {name:'MAISON ÉDIT home',exact:true}).click();
    await eventually(async () => await page.locator('[data-music-status]').getAttribute('data-music-status') === 'playing', 'recorded music did not play');
    await page.getByRole('button', {name:'Store music and tracks',exact:true}).click();
    const dialog = page.getByRole('dialog', {name:'The listening room.',exact:true});
    const volume = dialog.getByRole('slider', {name:'Music volume',exact:true});
    await volume.focus(); await page.keyboard.press('End');
    assert.equal((await readState()).soundVolume, .5);
    await page.keyboard.press('ArrowLeft');
    assert.equal((await readState()).soundVolume, .49);
    await dialog.getByRole('button', {name:'Mute store music',exact:true}).click();
    assert.equal((await readState()).soundMuted,true);
    await dialog.getByRole('button', {name:'Pause store music',exact:true}).click();
    await page.reload({waitUntil:'networkidle'});
    await enterDemo();
    assert.equal((await readState()).soundVolume,.49);
    assert.equal((await readState()).soundEnabled,false);
    assert.equal(await play.getAttribute('aria-pressed'),'false');
    assert.equal(await page.locator('audio').getAttribute('src'),null);
  });

  await run('editorial pagination whole edit and wishlist persistence', async () => {
    await reset();
    const firstEdit = page.locator('.edit-card').first();
    const title = await firstEdit.locator('h3').innerText();
    const definition = lookDefinitions.find(e => e.title === title);
    await firstEdit.getByRole('button', {name: 'Save this edit', exact: true}).click();
    assert.deepEqual(new Set((await readState()).wishlist), new Set(definition.ids));
    await firstEdit.getByRole('button', {name: 'Try this edit', exact: true}).click();
    assert.deepEqual(new Set((await readState()).cart.map(line => line.skuId)), new Set(definition.ids));
    let previous = await page.locator('.feed-card').count();
    await page.locator('.feed-end').scrollIntoViewIfNeeded();
    await eventually(async () => await page.locator('.feed-card').count() > previous, 'feed did not load more entries');
    await page.reload({waitUntil: 'networkidle'});
    await enterDemo();
    assert.equal((await readState()).cart.length, definition.ids.length);
    await page.getByRole('button', {name: 'Saved edit', exact: true}).click();
    assert.equal(await page.locator('.saved-grid .product-card').count(), definition.ids.length);
    await page.locator('.saved-grid .product-card').first().getByRole('button', {name: 'Remove saved piece', exact: true}).click();
    assert.equal((await readState()).wishlist.length, definition.ids.length - 1);
  });

  await run('profile validation sizes space palette and feedback reset', async () => {
    await reset();
    await page.getByRole('button', {name: 'Edit your profile', exact: true}).click();
    let modal = page.getByRole('dialog');
    await modal.getByRole('textbox', {name: 'What should we call you?', exact: true}).fill('');
    await modal.getByRole('button', {name: 'Save & refine my edit', exact: true}).click();
    assert.match(await modal.getByRole('alert').innerText(), /Add a name/);
    await modal.getByRole('textbox', {name: 'What should we call you?', exact: true}).fill('  Avery  ');
    await modal.getByRole('spinbutton', {name: 'Height (optional · cm)', exact: true}).fill('99');
    await modal.getByRole('button', {name: 'Save & refine my edit', exact: true}).click();
    assert.match(await modal.getByRole('alert').innerText(), /100 and 220/);
    await modal.getByRole('spinbutton', {name: 'Height (optional · cm)', exact: true}).fill('175');
    await modal.getByRole('combobox', {name: 'Usual size', exact: true}).selectOption('L');
    await modal.getByRole('button', {name: 'Artful', exact: true}).click();
    await modal.getByRole('button', {name: 'My space', exact: true}).click();
    assert.equal(await modal.getByRole('combobox', {name: /^The room on your mind/}).isDisabled(), true);
    assert.equal(await modal.getByRole('combobox', {name: /^The room on your mind/}).inputValue(), 'living');
    await modal.getByRole('button', {name: 'Pale blue', exact: true}).click();
    await modal.getByRole('button', {name: 'Save & refine my edit', exact: true}).click();
    let state = await readState();
    assert.equal(state.profile.name, 'Avery');
    assert.equal(state.profile.height, 175);
    assert.equal(state.profile.size, 'L');
    assert.equal(state.profile.room, 'living');
    assert.equal(state.profile.palette, 'blue');
    assert.ok(state.profile.styles.includes('artful') && state.profile.styles.includes('soft'));
    const product = await openProduct('ME-001');
    assert.equal(await product.getByRole('button', {name: 'L', exact: true}).getAttribute('aria-pressed'), 'true');
    await closeModal();
    await page.getByRole('button', {name: 'Show less of The sculpted wool blazer', exact: true}).first().click();
    assert.equal((await readState()).feedback['ME-001'], 'less');
    await page.getByRole('button', {name: 'Edit your profile', exact: true}).click();
    await page.getByRole('button', {name: 'Preferences & data', exact: true}).click();
    await page.getByRole('button', {name: 'Reset recommendation feedback', exact: true}).click();
    assert.deepEqual((await readState()).feedback, {});
    await closeModal();
    await page.reload({waitUntil: 'networkidle'});
    await enterDemo();
    assert.equal((await readState()).profile.name, 'Avery');
  });

  await run('zero upload curated personas homes rooms and plans are usable', async () => {
    await reset();
    await page.getByRole('button',{name:'Dismiss subtitle concierge',exact:true}).click();
    await page.screenshot({path:`${root}/artifacts/default-first-fold.png`,fullPage:false});
    assert.equal(await page.locator('input[type=file]').count(), 0, 'test users must never be asked to upload a photo');
    assert.equal(await page.getByRole('region', {name:'Default test scenario',exact:true}).count(),0,'scenario choices belong in setup or profile');
    const loaded = async selector => eventually(async () => await selector.evaluate(el => el.complete && el.naturalWidth > 20 && !el.currentSrc.endsWith('.svg')), 'fixture photo did not load');
    const personaRanks=[];
    for (const scenario of curatedScenarios) {
      const preset=personaPresets.find(p=>p.id===scenario.personaId);
      const home=homePresets.find(h=>h.id===scenario.homeId);
      const modal=await editProfile();
      const before=(await readState()).profile;
      for (const unsupported of personaPresets.filter(p=>!curatedScenarios.some(c=>c.personaId===p.id))) {
        assert.equal(await modal.locator('.persona-option').filter({hasText:unsupported.en}).isDisabled(),true,'unsupported person remains unavailable');
      }
      const option=modal.getByRole('button',{name:`${preset.en} ${preset.bodyEn} · ${preset.height} cm · ${preset.size}`,exact:true});
      await option.click();
      assert.equal(await option.getAttribute('aria-pressed'),'true');
      await loaded(modal.locator('.persona-preview .preview-frame img'));
      assert.ok((await modal.locator('.persona-preview .preview-frame img').getAttribute('src')).endsWith(`${preset.id}.jpg`));
      await modal.getByRole('button',{name:'My space',exact:true}).click();
      const homeOption=modal.getByRole('button',{name:`${home.en} ${home.noteEn}`,exact:true});
      assert.equal(await homeOption.getAttribute('aria-pressed'),'true','selecting a supported person pairs its curated home');
      const room=modal.getByRole('combobox',{name:/^The room on your mind/});
      assert.equal(await room.isDisabled(),true);assert.equal(await room.inputValue(),scenario.room);
      const preview=modal.locator('.persona-preview .preview-frame img');
      await modal.getByRole('button',{name:'View illustrative floorplan',exact:true}).click();
      assert.ok((await preview.getAttribute('src')).endsWith(`${home.id}-floorplan.svg`));
      await eventually(()=>preview.evaluate(el=>el.complete&&el.naturalWidth>20),'floorplan did not load');
      await modal.getByRole('button',{name:'Return to room reference',exact:true}).click();
      await loaded(preview);assert.ok((await preview.getAttribute('src')).endsWith(`${home.id}-${scenario.room}.jpg`));
      await modal.getByRole('button',{name:'Save & refine my edit',exact:true}).click();
      const state=await readState();
      assert.equal(state.profile.personaId,preset.id);assert.equal(state.profile.homeId,home.id);assert.equal(state.profile.room,scenario.room);
      assert.equal(state.profile.size,before.size,'curated identity preserves manual size');assert.equal(state.profile.height,before.height,'curated identity preserves manual height');
      personaRanks.push((await page.locator('.product-card .product-name').allTextContents()).join('|'));
    }
    assert.ok(new Set(personaRanks).size>1,'curated persona choices change visible recommendation ranking');
    await page.reload({waitUntil:'networkidle'});await enterDemo();
    const last=curatedScenarios.at(-1),finalState=await readState();
    assert.equal(finalState.profile.personaId,last.personaId);assert.equal(finalState.profile.homeId,last.homeId);assert.equal(finalState.profile.room,last.room);
    assert.equal(finalState.profile.personaImage,null);assert.equal(finalState.profile.homeImage,null);
    assert.ok(!JSON.stringify(finalState).includes('data:image'),'fixtures use static paths');
    const modal=await editProfile();
    assert.equal(await modal.locator('input[type=file]').count(),0);
    await modal.getByRole('button',{name:'Everyday woman · 45 Everyday build · 165 cm · M',exact:true}).click();
    await modal.getByRole('button',{name:'My space',exact:true}).click();
    const home=homePresets.find(h=>h.id==='warm-family');
    await modal.getByRole('button',{name:`${home.en} ${home.noteEn}`,exact:true}).click();
    await modal.getByRole('button',{name:'View illustrative floorplan',exact:true}).click();
    await modal.getByRole('img',{name:`Illustrative floorplan: ${home.en}`,exact:true}).waitFor();
    await page.screenshot({path:`${root}/artifacts/default-home-settings.png`,fullPage:true,animations:'disabled',timeout:20000});
    assert.equal(await modal.getByRole('button',{name:'Analyze selected defaults',exact:true}).isDisabled(),true);
    await modal.getByRole('button',{name:'Save & refine my edit',exact:true}).click();
    const saved=await readState();assert.equal(saved.profile.personaId,'everyday-woman-45');assert.equal(saved.profile.homeId,'warm-family');
  });

  await run('optional height blank defaults and legacy photos remain private', async () => {
    const legacy='data:image/jpeg;base64,AAAA';
    await reset({profile:{...initialState().profile,consent:true,personaImage:legacy,homeImage:legacy}});
    const requests=[];
    page.on('request',request=>{if(request.method()==='POST')requests.push(request.postData()||'');});
    await page.getByRole('button',{name:'Edit your profile',exact:true}).click();
    let modal=page.getByRole('dialog');
    assert.equal(await modal.locator('input[type=file]').count(),0);
    assert.equal(await modal.locator('img[src^="data:"]').count(),0,'previously stored personal photos must not be displayed by test presets');
    await modal.getByRole('spinbutton',{name:'Height (optional · cm)',exact:true}).fill('');
    await modal.getByRole('button',{name:'Save & refine my edit',exact:true}).click();
    assert.equal((await readState()).profile.height,null); assert.equal((await readState()).profile.personaImage,legacy);
    await page.reload({waitUntil:'networkidle'});
    await enterDemo();
    assert.equal((await readState()).profile.personaImage,legacy, 'do not silently delete pre-existing local data');
    await page.getByRole('button',{name:'Edit your profile',exact:true}).click();
    await page.getByRole('button',{name:'Preferences & data',exact:true}).click();
    await page.getByRole('button',{name:'Remove previously stored photos',exact:true}).click();
    assert.equal((await readState()).profile.personaImage,null); assert.equal((await readState()).profile.homeImage,null);
    assert.ok(requests.every(payload=>!payload.includes(legacy)), 'legacy photos must never enter AI requests');
  });

  await run('product variants quantities bag total and removal', async () => {
    await reset();
    await addProduct('ME-001', {size: 'S', color: 'Ink', quantity: 2});
    let state = await readState();
    assert.deepEqual({skuId: state.cart[0].skuId, size: state.cart[0].size, color: state.cart[0].color, quantity: state.cart[0].quantity}, {skuId: 'ME-001', size: 'S', color: 'Ink', quantity: 2});
    await addProduct('ME-001', {size: 'S', color: 'Ink'});
    assert.equal((await readState()).cart.length, 1);
    assert.equal((await readState()).cart[0].quantity, 3);
    await addProduct('ME-018');
    assert.equal((await readState()).cart[1].size, 'ONE SIZE');
    await page.getByRole('button', {name: 'Visit bag', exact: true}).click();
    const bag = page.getByRole('dialog');
    assert.match(await bag.locator('.bag-summary strong').innerText(), /10,320/);
    const first = bag.locator('.bag-item').first();
    await first.getByRole('button', {name: 'Decrease quantity', exact: true}).click();
    assert.equal((await readState()).cart[0].quantity, 2);
    await first.getByRole('button', {name: 'Increase quantity', exact: true}).click();
    assert.equal((await readState()).cart[0].quantity, 3);
    await first.getByRole('button', {name: 'Remove', exact: true}).click();
    assert.equal((await readState()).cart.length, 1);
    assert.match(await bag.locator('.bag-summary strong').innerText(), /480/);
  });

  await run('product quantity is a whole number within stock bounds', async () => {
    await reset();
    let modal = await openProduct('ME-001');
    await modal.getByRole('spinbutton', {name: 'Quantity', exact: true}).fill('1.5');
    await modal.getByRole('button', {name: 'Add to visit bag', exact: true}).click();
    assert.ok((await readState()).cart.every(line => Number.isInteger(line.quantity) && line.quantity >= 1), 'fractional quantities must not enter the visit bag');
    await closeModal();
    await reset();
    modal = await openProduct('ME-001');
    await modal.getByRole('spinbutton', {name: 'Quantity', exact: true}).fill('1000');
    await modal.getByRole('button', {name: 'Add to visit bag', exact: true}).click();
    assert.ok((await readState()).cart.every(line => line.quantity <= 8), 'quantity must not exceed available stock');
  });

  await run('booking acknowledgment optional sharing itinerary and persistence', async () => {
    await reset();
    await addProduct('ME-001');
    await addProduct('ME-018');
    await page.getByRole('button', {name: 'Visit bag', exact: true}).click();
    await page.getByRole('button', {name: 'Arrange a private visit', exact: true}).click();
    const modal = page.getByRole('dialog');
    await modal.getByRole('button', {name: 'Confirm demo visit', exact: true}).click();
    assert.match(await modal.getByRole('alert').innerText(), /acknowledge/);
    await modal.getByLabel('Date (device local time)', {exact: true}).fill(futureDate());
    await modal.getByRole('combobox', {name: 'Time', exact: true}).selectOption('14:00');
    await modal.getByRole('textbox', {name: 'Booking name', exact: true}).fill('Avery');
    await modal.getByRole('checkbox', {name: 'Style preferences (optional)', exact: true}).check();
    await modal.getByRole('checkbox', {name: 'I understand this is a local demo, not a real store appointment. There is no charge.', exact: true}).check();
    await modal.getByRole('button', {name: 'Confirm demo visit', exact: true}).click();
    await modal.getByRole('heading', {name: 'Local demo booking confirmed', exact: true}).waitFor();
    const state = await readState();
    assert.equal(state.cart.length, 0);
    assert.equal(state.bookings.length, 1);
    assert.equal(state.bookings[0].items.length, 2);
    assert.equal(state.bookings[0].time, '14:00');
    assert.equal(state.bookings[0].name, 'Avery');
    assert.deepEqual(state.bookings[0].sharedSnapshot.styles, state.profile.styles);
    assert.equal(state.bookings[0].sharedSnapshot.height, null);
    assert.equal(state.bookings[0].sharedSnapshot.room, null);
    assert.ok(!JSON.stringify(state.bookings[0]).includes('personaImage'));
    await modal.getByRole('button', {name: 'View itinerary & route', exact: true}).click();
    assert.equal(await page.locator('.booking-card').count(), 1);
    assert.match(await page.locator('.text-route').innerText(), /Floor 2.*Floor 4/s);
    await page.getByRole('button', {name: 'Step-free route', exact: true}).click();
    assert.match(await page.locator('.text-route').innerText(), /step-free concept/);
    await page.reload({waitUntil: 'networkidle'});
    await enterDemo();
    await page.locator('.site-header nav').getByRole('button', {name: 'Your visit', exact: true}).click();
    assert.equal(await page.locator('.booking-card').count(), 1);
  });

  await run('closing pending booking and guide prevents deferred changes', async () => {
    // Keep the operation pending regardless of browser/CI click latency.
    await page.clock.install();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    clockPaused = true;
    let releaseResponse;
    try {
      const cart = [{lineId: 'interrupt-line', skuId: 'ME-001', size: 'M', color: 'Walnut', quantity: 1}];
      await reset({cart});
      await page.getByRole('button', {name: 'Visit bag', exact: true}).click();
      await page.getByRole('button', {name: 'Arrange a private visit', exact: true}).click();
      let modal = page.getByRole('dialog');
      await modal.getByRole('checkbox', {name: 'I understand this is a local demo, not a real store appointment. There is no charge.', exact: true}).check();
      await modal.getByRole('button', {name: 'Confirm demo visit', exact: true}).click();
      await modal.getByRole('button', {name: 'Close / 关闭', exact: true}).click();
      await page.clock.runFor(750);
      assert.deepEqual((await readState()).bookings, []);
      assert.deepEqual((await readState()).cart, cart);

      await reset();
      await page.getByRole('button', {name: 'Your private guide', exact: true}).click();
      modal = page.getByRole('dialog');
      await modal.getByRole('textbox', {name: 'Tell your guide what you need', exact: true}).fill('artful home under 1000');
      await modal.getByRole('button', {name: 'Send guide message', exact: true}).click();
      await modal.getByRole('button', {name: 'Close / 关闭', exact: true}).click();
      await page.clock.runFor(600);
      assert.equal(await page.locator('.category-tabs .active').innerText(), 'For you');
      assert.equal(await page.getByRole('combobox', {name: 'Maximum per-item budget', exact: true}).inputValue(), '10000');
      assert.deepEqual((await readState()).profile.styles, initialState().profile.styles);

      await reset();
      let requests = 0;
      let aborted = false;
      const onFailure = request => { if (request.url().endsWith('/api/guide')) aborted = true; };
      page.on('requestfailed', onFailure);
      const responseGate = new Promise(resolve => { releaseResponse = resolve; });
      await page.route('**/api/guide', async route => {
        requests++;
        await responseGate;
        await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({mode: 'gemini', reply: 'Synthetic delayed answer.', productIds: ['ME-018']})}).catch(() => {});
      });
      await page.getByRole('button', {name: 'Your private guide', exact: true}).click();
      modal = page.getByRole('dialog');
      await modal.getByRole('checkbox', {name: /Allow this conversation/}).check();
      await modal.getByRole('textbox', {name: 'Tell your guide what you need', exact: true}).fill('artful home under 1500');
      await modal.getByRole('button', {name: 'Send guide message', exact: true}).click();
      await eventually(() => requests === 1, 'live guide request did not start');
      await modal.getByRole('button', {name: 'Close / 关闭', exact: true}).click();
      releaseResponse();
      await eventually(() => aborted, 'closing the guide must cancel its outstanding request');
      page.off('requestfailed', onFailure);
      assert.equal(aborted, true, 'closing the guide must cancel its outstanding request');
      assert.equal(await page.getByRole('dialog').count(), 0);
      assert.equal(await page.locator('.category-tabs .active').innerText(), 'For you');
      assert.equal(await page.getByRole('combobox', {name: 'Maximum per-item budget', exact: true}).inputValue(), '10000');
      assert.deepEqual((await readState()).profile.styles, initialState().profile.styles);
    } finally {
      releaseResponse?.();
      await page.clock.resume();
      clockPaused = false;
    }
  });

  await run('merchant preparation alternative acceptance cancellation and sync', async () => {
    const booking = seededBooking();
    await reset({bookings: [booking]});
    await page.getByRole('button', {name: 'Merchant studio', exact: true}).click();
    assert.match(await page.locator('.shared-info').innerText(), /No optional profile fields shared/);
    const prep = page.getByRole('combobox', {name: 'The sculpted wool blazer preparation status', exact: true});
    await prep.selectOption('ready');
    assert.equal((await readState()).bookings[0].items[0].status, 'ready');
    await page.getByRole('button', {name: 'Consumer view', exact: true}).click();
    await page.locator('.site-header nav').getByRole('button', {name: 'Your visit', exact: true}).click();
    assert.equal(await page.locator('.prep-status').innerText(), 'Ready');
    await page.getByRole('button', {name: 'Merchant studio', exact: true}).click();
    await page.getByRole('combobox', {name: 'The sculpted wool blazer preparation status', exact: true}).selectOption('unavailable');
    const alternative = cheaperAlternative('ME-001', (await readState()).inventory);
    assert.equal((await readState()).bookings[0].items[0].alternativeId, alternative.id);
    await page.getByRole('button', {name: 'Consumer view', exact: true}).click();
    await page.locator('.site-header nav').getByRole('button', {name: 'Your visit', exact: true}).click();
    await page.getByRole('button', {name: 'Accept alternative', exact: true}).click();
    const line = (await readState()).bookings[0].items[0];
    assert.equal(line.skuId, alternative.id);
    assert.equal(line.status, 'pending');
    assert.equal(line.alternativeId, null);
    assert.equal(line.color, alternative.color);
    await page.getByRole('button', {name: 'Cancel demo visit', exact: true}).click();
    assert.equal((await readState()).bookings[0].status, 'cancelled');
    await page.getByRole('button', {name: 'Merchant studio', exact: true}).click();
    assert.equal(await page.locator('.merchant-prep-line select').isDisabled(), true);
    assert.equal(await page.locator('.merchant-stats > div').first().locator('strong').innerText(), '00');
  });

  await run('merchant stock changes prevent booking and persist', async () => {
    await reset();
    await addProduct('ME-001');
    await page.getByRole('button', {name: 'Merchant studio', exact: true}).click();
    await page.getByRole('button', {name: 'Catalog & inventory', exact: true}).click();
    await page.getByRole('textbox', {name: 'Search merchant catalog', exact: true}).fill('ME-001');
    assert.equal(await page.locator('.catalog-table tbody tr').count(), 1);
    await page.getByRole('button', {name: 'Edit stock', exact: true}).click();
    await page.getByRole('spinbutton', {name: 'New demo stock', exact: true}).fill('0');
    await page.getByRole('button', {name: 'Save', exact: true}).click();
    assert.equal((await readState()).inventory['ME-001'], 0);
    await page.getByRole('button', {name: 'Consumer view', exact: true}).click();
    await page.getByRole('button', {name: 'Visit bag', exact: true}).click();
    assert.equal(await page.getByRole('button', {name: 'Arrange a private visit', exact: true}).isDisabled(), true);
    assert.match(await page.locator('.bag-item').innerText(), /Stock changed/);
    await closeModal();
    const product = await openProduct('ME-001');
    assert.equal(await product.getByRole('button', {name: 'Add to visit bag', exact: true}).isDisabled(), true);
    await product.getByRole('button', {name: /A lighter budget alternative/}).click();
    assert.notEqual(await page.getByRole('dialog').getAttribute('aria-label'), byId('ME-001').en);
    await closeModal();
    await page.reload({waitUntil: 'networkidle'});
    await enterDemo();
    assert.equal((await readState()).inventory['ME-001'], 0);
  });

  await run('local guide applies budget home preferences alternatives and clear', async () => {
    await reset();
    await addProduct('ME-001');
    const beforeCart = (await readState()).cart;
    await page.getByRole('button', {name: 'Your private guide', exact: true}).click();
    await guideSend('Warm home pieces under 2000');
    assert.equal(await page.getByRole('combobox', {name: 'Maximum per-item budget', exact: true}).inputValue(), '2000');
    assert.equal(await page.locator('.category-tabs .active').innerText(), 'Home & living');
    assert.ok((await readState()).profile.styles.includes('warm'));
    await guideSend('A cheaper alternative');
    assert.equal(await page.getByRole('textbox', {name: 'Search products or styles', exact: true}).inputValue(), cheaperAlternative('ME-001').en);
    assert.deepEqual((await readState()).cart, beforeCart);
    await guideSend('Clear filters');
    assert.equal(await page.locator('.category-tabs .active').innerText(), 'For you');
    assert.equal(await page.getByRole('textbox', {name: 'Search products or styles', exact: true}).inputValue(), '');
    await guideSend('artful');
    assert.ok((await readState()).profile.styles.includes('artful'));
    const guide = await guideSend('quiet');
    assert.deepEqual((await readState()).profile.styles, ['quiet', 'tailored']);
    await guide.locator('.chat-message.assistant').last().getByRole('button', {name: /^Add /}).first().click();
    assert.ok((await readState()).cart.reduce((total, line) => total + line.quantity, 0) > beforeCart.reduce((total, line) => total + line.quantity, 0));
  });

  await run('guide network consent minimal context provider response and fallback', async () => {
    await reset({profile: {...initialState().profile, styles: ['quiet']}});
    const payloads = [];
    let fail = false;
    let mode = 'gemini';
    let defer = true;
    let release;
    await page.route('**/api/guide', async route => {
      payloads.push(route.request().postDataJSON());
      if (defer) await new Promise(resolve => {
        const timer = setTimeout(resolve, 5000);
        release = () => { clearTimeout(timer); resolve(); };
      });
      await route.fulfill({status: fail ? 503 : 200, contentType: 'application/json', body: JSON.stringify(fail ? {error: 'unavailable'} : {
        mode,
        reply: mode === 'gemini' ? 'A synthetic, catalog-backed recommendation.' : 'Remote demo boilerplate.',
        warning: mode === 'demo' ? 'not_configured' : undefined,
        productIds: ['ME-005', 'ME-001', 'ME-018', 'not-in-catalog'],
      })});
    });
    await page.getByRole('button', {name: 'Your private guide', exact: true}).click();
    const guide = await guideSend('home under 2000');
    assert.equal(payloads.length, 0, 'without explicit consent, the guide must stay local');
    const consent = guide.getByRole('checkbox', {name: /Allow this conversation/});
    assert.equal(await consent.count(), 1, 'this scenario requires a local configured guide endpoint');
    await consent.check();
    const previousMessages = await guide.locator('.chat-message.assistant').count();
    await guide.getByRole('textbox', {name: 'Tell your guide what you need', exact: true}).fill('Budget under 1500 womenswear artful');
    await guide.getByRole('button', {name: 'Send guide message', exact: true}).click();
    await eventually(() => payloads.length === 1 && release, 'provider request did not start');
    // Request intent is authoritative, while the visible page and stored
    // preferences stay unchanged until a successful response arrives.
    assert.equal(await page.locator('.category-tabs .active').innerText(), 'Home & living');
    assert.equal(await page.getByRole('combobox', {name: 'Maximum per-item budget', exact: true}).inputValue(), '2000');
    assert.deepEqual((await readState()).profile.styles, ['quiet']);
    assert.equal(payloads.length, 1);
    const request = payloads[0];
    assert.deepEqual(Object.keys(request).sort(), ['consent', 'context', 'history', 'language', 'message']);
    assert.deepEqual(Object.keys(request.context).sort(), ['budget', 'category', 'selectedProductIds', 'styleTags']);
    assert.deepEqual(request.consent, {googleAI: true});
    assert.equal(request.language, 'en');
    assert.equal(request.context.category, 'women');
    assert.equal(request.context.budget, 1500);
    assert.deepEqual(request.context.styleTags, ['quiet', 'artful']);
    for (const secret of ['personaImage', 'homeImage', 'height', 'Alex']) assert.ok(!JSON.stringify(request).includes(secret), `unexpected profile field ${secret}`);
    release();
    defer = false;
    await eventually(async () => await guide.locator('.chat-message.assistant').count() > previousMessages, 'provider reply did not finish');
    assert.match(await guide.locator('.chat-message.assistant').last().innerText(), /GEMINI · LIVE AI/);
    assert.equal(await guide.locator('.chat-message.assistant').last().locator('.chat-products > div').count(), 1);
    assert.match(await guide.locator('.chat-message.assistant').last().locator('.chat-products').innerText(), /liquid satin skirt/);
    assert.equal(await page.locator('.category-tabs .active').innerText(), 'Womenswear');
    assert.equal(await page.getByRole('combobox', {name: 'Maximum per-item budget', exact: true}).inputValue(), '1500');
    assert.deepEqual((await readState()).profile.styles, ['quiet', 'artful']);

    mode = 'demo';
    await guideSend('Budget under 1500 warm home pieces');
    const demoText = await guide.locator('.chat-message.assistant').last().innerText();
    assert.match(demoText, /ÉDIT · DEMO GUIDE/);
    assert.ok(!demoText.includes('Remote demo boilerplate.'), 'server demo prose must not replace actionable local guidance');
    assert.equal(await page.locator('.category-tabs .active').innerText(), 'Home & living');
    assert.equal(await page.getByRole('combobox', {name: 'Maximum per-item budget', exact: true}).inputValue(), '1500');
    assert.ok((await readState()).profile.styles.includes('warm'));
    const demoNames = await guide.locator('.chat-message.assistant').last().locator('.chat-products strong').allTextContents();
    assert.ok(demoNames.length > 0);
    assert.ok(demoNames.every(name => catalog.some(product => product.en === name && product.category === 'home' && product.price <= 1500)));
    fail = true;
    await guideSend('womenswear under 1000');
    assert.match(await guide.locator('.chat-message.assistant').last().innerText(), /connection is unavailable.*local demo/s);
    assert.equal(await page.locator('.category-tabs .active').innerText(), 'Womenswear');
    assert.equal(await page.getByRole('combobox', {name: 'Maximum per-item budget', exact: true}).inputValue(), '1000');
  });

  await run('GPT CLI test guide uses preset IDs and distinguishes actual modes', async () => {
    await reset({profile:{...initialState().profile,name:'Private Local Name',height:199,personaId:'relaxed-man-50',homeId:'compact-city',room:'living'}});
    await page.route('**/api/status',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({provider:'codex-cli',guide:'unavailable',analysis:'unavailable',scene:'unavailable',configured:true,usable:false,canAttemptGuide:true,canAttemptAnalysis:true,connection:'unverified'})}));
    await page.reload({waitUntil:'networkidle'});
    await enterDemo();
    const requests=[];let unavailable=false;
    await page.route('**/api/guide',async route=>{
      requests.push(route.request().postDataJSON());
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(unavailable ? {mode:'demo',warning:'runtime_read_only'} : {mode:'codex-cli',reply:'Synthetic provider-contract reply for browser testing.',model:'gpt-6.1-sol',productIds:['ME-010','ME-001'],testOnly:true})});
    });
    await page.getByRole('button',{name:'Your private guide',exact:true}).click();
    const guide=page.getByRole('dialog');
    assert.match(await guide.locator('.guide-preset-context').innerText(),/Relaxed man.*Compact city apartment.*Living room/s);
    await guideSend('men under 2000');assert.equal(requests.length,0,'no AI call without explicit conversation consent');
    await guide.getByRole('checkbox',{name:/Allow this conversation.*OpenAI GPT CLI/}).check();
    await guideSend('men under 2000');
    assert.deepEqual(requests[0].consent,{openAI:true});
    assert.deepEqual(requests[0].presetContext,{personaId:'relaxed-man-50',homeId:'compact-city',room:'living'});
    assert.ok(!JSON.stringify(requests[0]).includes('Private Local Name'));
    assert.ok(!Object.hasOwn(requests[0].context,'height'));
    assert.match(await guide.locator('.chat-message.assistant').last().innerText(),/OPENAI · GPT CLI TEST/);
    assert.equal(await guide.locator('.chat-message.assistant').last().locator('.chat-products > div').count(),1,'wrong department ID filtered');
    unavailable=true;await guideSend('home under 1000');
    assert.match(await guide.locator('.chat-message.assistant').last().innerText(),/ÉDIT · DEMO GUIDE/);
    assert.ok(!(await guide.locator('.chat-message.assistant').last().innerText()).includes('Synthetic provider-contract'));
  });

  await run('preset analysis first attempt consent contract apply and cancellation', async () => {
    await reset({profile:{...initialState().profile,name:'Never transmit this',height:199}});
    await page.route('**/api/status',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({provider:'codex-cli',guide:'unavailable',analysis:'unavailable',scene:'unavailable',configured:true,usable:false,canAttemptGuide:true,canAttemptAnalysis:true,connection:'unverified'})}));
    await page.reload({waitUntil:'networkidle'});
    await enterDemo();
    const requests=[];let slow=false;
    await page.route('**/api/analyze',async route=>{
      requests.push(route.request().postDataJSON());
      if(slow)await sleep(850);
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({mode:'codex-cli',analyzed:true,externalCall:true,summary:'Synthetic analysis response for UI contract verification.',observations:[{reference:'room',text:'Warm materials in the fictional room.'}],styleTags:['soft','warm','invalid-style'],disclosure:'Synthetic provider fixture, not a real CLI result.'})}).catch(()=>{});
    });
    await page.getByRole('button',{name:'Edit your profile',exact:true}).click();
    let modal=page.getByRole('dialog');
    await modal.getByRole('button',{name:'Test AI connection with defaults',exact:true}).click();
    await modal.getByText('Synthetic analysis response for UI contract verification.',{exact:true}).waitFor();
    assert.deepEqual(requests[0],{personaId:'everyday-woman-45',homeId:'warm-family',room:'living',language:'en',consent:{openAI:true}});
    await modal.getByRole('button',{name:'Apply AI style suggestions',exact:true}).click();
    await modal.getByRole('button',{name:'Save & refine my edit',exact:true}).click();
    assert.deepEqual((await readState()).profile.styles,['soft','warm']);
    assert.equal((await readState()).profile.height,199);
    slow=true;await page.getByRole('button',{name:'Edit your profile',exact:true}).click();modal=page.getByRole('dialog');
    await modal.getByRole('button',{name:'Test AI connection with defaults',exact:true}).click();
    await eventually(()=>requests.length===2,'analysis did not start');
    await modal.getByRole('button',{name:'Relaxed man · 50 Relaxed build · 172 cm · L',exact:true}).click();
    await sleep(950);
    assert.equal(await modal.getByText('Synthetic analysis response for UI contract verification.',{exact:true}).count(),0,'old analysis must not appear for a newly selected person');
    await closeModal();
    assert.equal((await readState()).profile.personaId,'everyday-woman-45','cancelled draft does not save');
  });

  await run('guide correctly recognizes women without matching men substring', async () => {
    await reset();
    await page.getByRole('button', {name: 'Your private guide', exact: true}).click();
    await guideSend('women');
    assert.equal(await page.locator('.category-tabs .active').innerText(), 'Womenswear');
  });

  await run('arbitrary guide budget remains visible in filter control', async () => {
    await reset();
    await page.getByRole('button', {name: 'Your private guide', exact: true}).click();
    await guideSend('budget 1500');
    assert.equal(await page.getByRole('combobox', {name: 'Maximum per-item budget', exact: true}).inputValue(), '1500');
  });

  await run('aggregate SKU stock cap across multiple sizes', async () => {
    const state = initialState();
    state.inventory['ME-001'] = 2;
    await reset({inventory: state.inventory});
    await addProduct('ME-001', {size: 'S', quantity: 2});
    await addProduct('ME-001', {size: 'L', quantity: 2});
    const cart = (await readState()).cart;
    assert.ok(cart.filter(line => line.skuId === 'ME-001').reduce((total, line) => total + line.quantity, 0) <= 2, 'combined quantities across variant lines exceed the shared SKU stock');
  });

  await run('alternative acceptance checks current replacement stock and quantity', async () => {
    for (const [quantity, available] of [[1, 0], [3, 1]]) {
      const booking = seededBooking();
      const replacement = cheaperAlternative('ME-001');
      booking.items[0] = {...booking.items[0], quantity, status: 'unavailable', alternativeId: replacement.id};
      const inventory = {...initialState().inventory, [replacement.id]: available};
      await reset({bookings: [booking], inventory});
      await page.locator('.site-header nav').getByRole('button', {name: 'Your visit', exact: true}).click();
      const accept = page.getByRole('button', {name: 'Accept alternative', exact: true});
      if (await accept.count() && await accept.isEnabled()) await accept.click();
      assert.equal((await readState()).bookings[0].items[0].skuId, 'ME-001', `replacement stock ${available} cannot cover quantity ${quantity}`);
    }
  });

  await run('keyboard modal trap escape focus return and skip link', async () => {
    await reset();
    // Setup deliberately focuses the shop introduction. Start this separate
    // whole-document keyboard traversal at the document boundary.
    await page.locator('body').evaluate(el=>{el.tabIndex=-1;el.focus();el.removeAttribute('tabindex');});
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'skip-link');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.location.hash), '#main');
    const trigger = page.getByRole('button', {name: 'Edit your profile', exact: true});
    await trigger.focus();
    await page.keyboard.press('Enter');
    const modal = page.getByRole('dialog');
    assert.equal(await modal.getAttribute('aria-modal'), 'true');
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await modal.evaluate(el => el.contains(document.activeElement)), true, 'initial reverse tab must stay inside the modal');
    const first = modal.getByRole('button', {name: 'Close / 关闭', exact: true});
    const last = modal.getByRole('button', {name: 'Save & refine my edit', exact: true});
    await first.focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await last.evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await first.evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
    assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
  });

  await run('corrupt storage is recoverable and deletion confirmation resets state', async () => {
    await reset();
    await page.evaluate(key => localStorage.setItem(key, '{broken-json'), STORAGE_KEY);
    await page.reload({waitUntil: 'networkidle'});
    await enterDemo();
    assert.equal((await readState()).version, 1);
    assert.equal(await page.locator('dialog.store-onboarding[open]').count(),0,'recovery uses the required confirmed setup');
    await page.getByRole('button', {name: 'Switch to English', exact: true}).click();
    await addProduct('ME-001');
    await page.getByRole('button', {name: 'Edit your profile', exact: true}).click();
    await page.getByRole('button', {name: 'Preferences & data', exact: true}).click();
    await page.getByRole('button', {name: 'Delete all local demo data', exact: true}).click();
    await page.getByRole('button', {name: 'Keep data', exact: true}).click();
    assert.equal((await readState()).cart.length, 1);
    await page.getByRole('button', {name: 'Delete all local demo data', exact: true}).click();
    await page.getByRole('button', {name: 'Confirm deletion', exact: true}).click();
    assert.deepEqual(await readState(), initialState());
  });

  await run('malformed versioned local state recovers without rendering crash', async () => {
    for (const malformed of [
      {...initialState(), onboardingStatus:'skipped', cart: null},
      {...initialState(), onboardingStatus:'skipped', cart: [{lineId: 'bad', skuId: 'unknown-sku', size: 'M', color: 'Ink', quantity: 1}]},
      {...initialState(), onboardingStatus:'skipped', profile: {...initialState().profile, styles: null}},
    ]) {
      await reset();
      await page.evaluate(({key, state}) => localStorage.setItem(key, JSON.stringify(state)), {key: STORAGE_KEY, state: malformed});
      await page.reload({waitUntil: 'networkidle'});
      await enterDemo();
      await page.getByRole('button', {name: 'MAISON ÉDIT home', exact: true}).waitFor();
      const restored = await readState();
      assert.ok(Array.isArray(restored.cart));
      assert.ok(restored.cart.every(line => byId(line.skuId)));
      assert.ok(Array.isArray(restored.profile.styles));
      assert.deepEqual(errors, [], 'schema recovery must prevent uncaught errors');
    }
  });

  await run('mobile navigation consumer merchant and modals avoid page overflow', async () => {
    await reset({}, 390);
    const noOverflow = async label => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${label} has horizontal page overflow`);
    await noOverflow('mobile discover');
    const profile=await editProfile();
    await profile.getByRole('button',{name:'Relaxed man · 50 Relaxed build · 172 cm · L',exact:true}).click();
    await noOverflow('mobile persona editor');
    await profile.getByRole('button',{name:'My space',exact:true}).click();
    await profile.getByRole('button',{name:/^Compact city apartment/}).click();
    assert.equal(await profile.getByRole('combobox',{name:/^The room on your mind/}).isDisabled(),true);
    await profile.getByRole('button',{name:'View illustrative floorplan',exact:true}).click();
    await profile.getByRole('img',{name:'Illustrative floorplan: Compact city apartment',exact:true}).waitFor();
    await noOverflow('mobile home and floorplan editor');
    assert.equal(await page.locator('input[type=file]').count(),0);
    await page.screenshot({path:`${root}/artifacts/default-profile-mobile.png`,fullPage:false});
    await profile.getByRole('button',{name:'Save & refine my edit',exact:true}).click();
    assert.equal((await readState()).profile.personaId,'relaxed-man-50');
    assert.equal((await readState()).profile.homeId,'compact-city');
    assert.equal((await readState()).profile.room,'living');
    await page.getByRole('button', {name: 'Open navigation', exact: true}).click();
    await page.locator('.site-header nav').getByRole('button', {name: 'Home & living', exact: true}).click();
    assert.equal(await page.locator('.category-tabs .active').innerText(), 'Home & living');
    assert.equal(await page.locator('.site-header nav').getAttribute('class'), '');
    await noOverflow('mobile home');
    await page.getByRole('button', {name: 'MAISON ÉDIT home', exact: true}).click();
    await page.locator('.category-tabs').getByRole('button', {name: 'For you', exact: true}).click();
    const modal = await openProduct('ME-001');
    const bounds = await modal.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391);
    await noOverflow('mobile product modal');
    await closeModal();
    await page.getByRole('button', {name: 'Your private guide', exact: true}).click();
    await guideSend('home');
    await noOverflow('mobile guide');
    await closeModal();
    await page.getByRole('button', {name: 'Merchant studio', exact: true}).click();
    await page.getByRole('button', {name: 'Catalog & inventory', exact: true}).click();
    await noOverflow('mobile merchant catalog');
    await page.setViewportSize({width: 320, height: 700});
    await noOverflow('small mobile merchant');
  });

  console.log(`\n${results.filter(result => result.status === 'pass').length}/${results.length} e2e scenarios passed.`);
  if (results.some(result => result.status === 'fail')) process.exitCode = 1;
} catch (error) {
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) {
    server.kill('SIGTERM');
    await sleep(150);
    if (server.exitCode === null) server.kill('SIGKILL');
  }
}
