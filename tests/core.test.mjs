import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY, catalog, lookDefinitions, defaultProfile, initialState,
  byId, sumItems, money, score, rankProducts, filteredProducts, buildFeed,
  cheaperAlternative, makeBooking, categories, styles, skuQuantity, cartUnavailable, restoreState,
} from '../src/data.js';

import { curatedScenarioFor } from '../src/personalized-scenes.js';

const profile = () => structuredClone(defaultProfile);

test('the complete catalog has unique, resolvable SKUs and valid demo variants', () => {
  assert.equal(catalog.length, 28);
  assert.equal(new Set(catalog.map(p => p.id)).size, catalog.length);
  for (const p of catalog) {
    assert.equal(byId(p.id), p);
    assert.ok(categories.some(c => c.id === p.category));
    assert.ok(Number.isFinite(p.price) && p.price > 0);
    assert.ok(Number.isInteger(p.stock) && p.stock >= 0);
    assert.ok(p.sizes.length && p.colors.includes(p.color));
    assert.ok(p.tags.every(tag => styles.some(s => s.id === tag)));
    assert.ok(p.floor >= 1 && p.floor <= 4 && p.counter);
    assert.ok(p.image.startsWith('/images/'));
    if (['home', 'accessories'].includes(p.category)) assert.deepEqual(p.sizes, ['ONE SIZE']);
    else assert.deepEqual(p.sizes, ['XS', 'S', 'M', 'L', 'XL']);
  }
  assert.equal(byId('unknown'), undefined);
});

test('editorial sets only reference existing products and retain meaningful groups', () => {
  assert.equal(new Set(lookDefinitions.map(e => e.id)).size, lookDefinitions.length);
  for (const edit of lookDefinitions) {
    assert.ok(edit.ids.length >= 2);
    assert.equal(new Set(edit.ids).size, edit.ids.length);
    assert.ok(edit.ids.every(byId));
    assert.ok(['look', 'room', 'objects'].includes(edit.type));
  }
});

test('initial local state is versioned, empty and stocked', () => {
  const state = initialState();
  assert.equal(STORAGE_KEY, 'maison-edit-v1');
  assert.equal(state.version, 1);
  assert.equal(state.language, 'en');
  assert.deepEqual(state.profile, defaultProfile);
  for (const key of ['wishlist', 'cart', 'bookings']) assert.deepEqual(state[key], []);
  assert.deepEqual(state.feedback, {});
  assert.equal(Object.keys(state.inventory).length, catalog.length);
  for (const p of catalog) assert.equal(state.inventory[p.id], p.stock);
  const second = initialState();
  for (const key of ['profile', 'wishlist', 'cart', 'bookings', 'feedback', 'inventory']) {
    assert.notEqual(state[key], second[key]);
  }
});

test('personalized score combines styles, per-item budget and explicit feedback', () => {
  const p = byId('ME-001');
  const base = profile();
  assert.equal(score(p, base, {}), 24);
  assert.equal(score(p, {...base, budget: 1000}, {}), 19);
  assert.equal(score(p, base, {[p.id]: 'like'}), 32);
  assert.equal(score(p, base, {[p.id]: 'less'}), 4);
});

test('ranking is descending, stable for ties, and never mutates the source list', () => {
  const items = [byId('ME-008'), byId('ME-001'), byId('ME-020')];
  const snapshot = [...items];
  const ranked = rankProducts(items, profile());
  assert.deepEqual(items, snapshot);
  assert.notEqual(ranked, items);
  assert.equal(ranked[0].id, 'ME-001');
  assert.deepEqual(ranked.slice(1).map(p => p.id), ['ME-020', 'ME-008']);
  const tied = [{...byId('ME-001'), id:'tie-a'}, {...byId('ME-001'), id:'tie-b'}];
  assert.deepEqual(rankProducts(tied, profile()).map(p => p.id), ['tie-a', 'tie-b']);
  const liked = rankProducts(items, profile(), {'ME-008': 'like'});
  assert.deepEqual(liked.map(p => p.id), ['ME-001','ME-008','ME-020']);
  assert.ok(liked.findIndex(p => p.id === 'ME-008') < ranked.findIndex(p => p.id === 'ME-008'));
});

test('catalog filters apply category and an inclusive price ceiling together', () => {
  const products = filteredProducts({category: 'home', budget: 480}, profile());
  assert.deepEqual(new Set(products.map(p => p.id)), new Set(['ME-018', 'ME-020', 'ME-023', 'ME-028']));
  assert.ok(products.every(p => p.category === 'home' && p.price <= 480));
  assert.equal(filteredProducts({budget: 100}, profile()).length, 0);
  assert.equal(filteredProducts({category: 'unknown'}, profile()).length, 0);
});

test('search is trimmed, case-insensitive, and covers SKUs, names, brands, kinds, colors and tags', () => {
  for (const term of ['  SCULPTED WOOL BLAZER ', 'me-001', '羊毛廓形西装', 'ÉDIT ATELIER', 'blazer', 'Walnut', 'tailored']) {
    assert.ok(filteredProducts({query: term}, profile()).some(p => p.id === 'ME-001'), term);
  }
  assert.equal(filteredProducts({query: 'no-such-piece'}, profile()).length, 0);
  assert.equal(filteredProducts({query: '  '}, profile()).length, catalog.length);
});

test('less-like feedback removes products while likes lift eligible products', () => {
  const filtered = filteredProducts({}, profile(), {'ME-001': 'less', 'ME-008': 'like'});
  assert.ok(!filtered.some(p => p.id === 'ME-001'));
  const baseline = filteredProducts({}, profile(), {'ME-001':'less'});
  assert.ok(filtered.findIndex(p => p.id === 'ME-008') < baseline.findIndex(p => p.id === 'ME-008'), 'explicit likes must lift eligible products');
  assert.equal(filteredProducts({budget: 500}, profile(), {'ME-001': 'like'}).some(p => p.id === 'ME-001'), false);
});

test('feed contains each eligible product once and interleaves compatible editorial sets', () => {
  const filters = {category: 'home', budget: 2000};
  const products = filteredProducts(filters, profile());
  const snapshot = structuredClone(lookDefinitions);
  const feed = buildFeed(filters, profile());
  const featured = new Set(curatedScenarioFor(profile())?.products.slice(0, 5).map(scene => scene.skuId) || []);
  const promoted = [...products].sort((a, b) => Number(featured.has(b.id)) - Number(featured.has(a.id)));
  assert.deepEqual(feed.filter(e => e.type === 'product').map(e => e.id), promoted.map(p => p.id));
  const eligible = new Set(products.map(p => p.id));
  for (const edit of feed.filter(e => e.type !== 'product')) {
    assert.ok(edit.ids.length >= 2);
    assert.ok(edit.ids.every(id => eligible.has(id)));
  }
  assert.deepEqual(lookDefinitions, snapshot);
  assert.deepEqual(buildFeed({query: 'no-matches'}, profile()), []);
});

test('less-like feedback removes the SKU from both cards and editorial groups', () => {
  const feed = buildFeed({}, profile(), {'ME-001': 'less'});
  assert.ok(feed.every(e => e.type === 'product' ? e.id !== 'ME-001' : !e.ids.includes('ME-001')));
});

test('alternative is the closest lower-priced, in-stock piece in the same department', () => {
  for (const item of catalog) {
    const candidates = catalog.filter(p => p.category === item.category && p.price < item.price && p.stock > 0);
    const alternative = cheaperAlternative(item.id);
    if (!candidates.length) assert.equal(alternative, null);
    else {
      assert.ok(alternative && alternative.id !== item.id);
      assert.equal(alternative.category, item.category);
      assert.equal(alternative.price, Math.max(...candidates.map(p => p.price)));
    }
  }
  assert.equal(cheaperAlternative('no-such-sku'), null);
});

test('explicit zero stock is respected and absent inventory falls back to demo stock', () => {
  assert.equal(cheaperAlternative('ME-001').id, 'ME-015');
  assert.equal(cheaperAlternative('ME-001', {'ME-015': 0}).id, 'ME-006');
  const allOut = Object.fromEntries(catalog.map(p => [p.id, 0]));
  assert.equal(cheaperAlternative('ME-001', allOut), null);
  assert.equal(cheaperAlternative('ME-001', {'ME-015': 1}).id, 'ME-015');
});

test('indicative totals include quantities and ignore unresolved SKU prices', () => {
  assert.equal(sumItems([]), 0);
  assert.equal(sumItems([{skuId: 'ME-001', quantity: 2}, {skuId: 'ME-018', quantity: 3}]), 8000);
  assert.equal(sumItems([{skuId: 'ME-023'}]), 320);
  assert.equal(sumItems([{skuId: 'unknown', quantity: 3}]), 0);
  assert.equal(sumItems([{skuId: 'ME-018', quantity: 1}, {skuId: 'ME-018', quantity: 2}]), 1440);
});

test('SKU quantities and stock checks aggregate every size and color line', () => {
  const cart = [
    {skuId: 'ME-001', size: 'S', color: 'Walnut', quantity: 2},
    {skuId: 'ME-001', size: 'L', color: 'Ink', quantity: 3},
    {skuId: 'ME-018', size: 'ONE SIZE', color: 'Chalk', quantity: 1},
  ];
  assert.equal(skuQuantity(cart, 'ME-001'), 5);
  assert.equal(skuQuantity(cart, 'ME-018'), 1);
  assert.equal(skuQuantity(cart, 'unknown'), 0);
  assert.equal(cartUnavailable(cart, {'ME-001': 5, 'ME-018': 1}), false);
  assert.equal(cartUnavailable(cart, {'ME-001': 4, 'ME-018': 1}), true);
  assert.equal(cartUnavailable(cart, {'ME-001': 5, 'ME-018': 0}), true);
  assert.equal(cartUnavailable(cart, {'ME-001': 5}), true);
  assert.equal(cartUnavailable([], {}), false);
});

test('money formatting consistently uses CNY with no fractional amount', () => {
  assert.match(money(3280, 'en'), /3,280/);
  assert.match(money(3280, 'zh'), /3,280/);
  assert.ok(!money(3280, 'en').includes('.00'));
  assert.match(money(0), /0/);
});

test('booking snapshots variants and resets preparation state without mutating the bag', () => {
  const cart = [
    {lineId: 'bag-a', skuId: 'ME-001', size: 'L', color: 'Ink', quantity: 2},
    {lineId: 'bag-b', skuId: 'ME-018', size: 'ONE SIZE', color: 'Chalk', quantity: 1},
  ];
  const original = structuredClone(cart);
  const form = {date: '2030-01-02', time: '11:00', name: 'Avery', sharedFields: {name: true, items: true, dateTime: true, styles: false}};
  const now = Date.UTC(2030, 0, 1);
  const booking = makeBooking(cart, form, now);
  assert.equal(booking.id, `ME-${now.toString(36).toUpperCase()}`);
  assert.equal(booking.createdAt, '2030-01-01T00:00:00.000Z');
  assert.equal(booking.status, 'confirmed');
  assert.equal(booking.demo, true);
  assert.equal(booking.date, form.date);
  assert.equal(booking.time, form.time);
  assert.equal(booking.name, form.name);
  assert.deepEqual(booking.sharedFields, form.sharedFields);
  assert.deepEqual(cart, original);
  assert.notEqual(booking.items, cart);
  booking.items.forEach((item, i) => {
    assert.notEqual(item, cart[i]);
    assert.equal(item.lineId, `booking-${now}-${i}`);
    assert.equal(item.status, 'pending');
    assert.equal(item.alternativeId, null);
    for (const key of ['skuId', 'size', 'color', 'quantity']) assert.equal(item[key], cart[i][key]);
  });
  booking.items[0].status = 'ready';
  assert.deepEqual(cart, original);
});

test('booking IDs and line IDs are deterministic and distinct across timestamps', () => {
  const cart = [{skuId: 'ME-023', size: 'ONE SIZE', color: 'Chalk', quantity: 1}];
  const form = {date: '2030-01-02', time: '10:00', name: 'Alex', sharedFields: {items: true}};
  const a = makeBooking(cart, form, 1_000);
  const b = makeBooking(cart, form, 1_001);
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.items[0].lineId, b.items[0].lineId);
  assert.deepEqual(makeBooking([], form, 1_000).items, []);
});

const validCartLine = () => ({lineId: 'restored-line', skuId: 'ME-001', size: 'M', color: 'Walnut', quantity: 1});

test('state restoration handles empty storage and incompatible versions explicitly', () => {
  assert.deepEqual(restoreState(null), {state: initialState(), recovered: false});
  assert.deepEqual(restoreState({...initialState(), version: 2}), {state: initialState(), recovered: true});
  assert.deepEqual(restoreState({version: 1}), {state: initialState(), recovered: true});
});

test('valid local state round-trips without changing catalog-backed choices', () => {
  const state = initialState();
  state.language = 'en';
  state.cart = [validCartLine()];
  state.wishlist = ['ME-001', 'ME-018'];
  state.feedback = {'ME-001': 'like'};
  state.profile.height = null;
  assert.deepEqual(restoreState(JSON.parse(JSON.stringify(state))), {state, recovered: false});
});

test('malformed critical arrays and unknown saved SKUs restore safe defaults', () => {
  for (const patch of [
    {cart: null}, {wishlist: null}, {bookings: null}, {profile: null},
    {inventory: null}, {feedback: null}, {wishlist: ['unknown-sku']},
    {cart: [{...validCartLine(), skuId: 'unknown-sku'}]},
  ]) {
    const result = restoreState({...initialState(), ...patch});
    assert.equal(result.recovered, true);
    assert.deepEqual(result.state, initialState());
  }
});

test('restoration rejects invalid cart quantities and size or color variants', () => {
  for (const patch of [
    {quantity: 0}, {quantity: -1}, {quantity: 1.5}, {quantity: 1000},
    {quantity: '1'}, {size: 'XXXL'}, {color: 'not-a-color'}, {lineId: null},
  ]) {
    const restored = restoreState({...initialState(), cart: [{...validCartLine(), ...patch}]});
    assert.equal(restored.recovered, true, JSON.stringify(patch));
    assert.deepEqual(restored.state.cart, []);
  }
});

test('profile restoration bounds fields and ignores unknown style or room values', () => {
  const state = initialState();
  state.profile = {...state.profile, name: '  Avery  ', height: 99, size: 'bad', budget: 999999, styles: ['artful', 'artful', 'unknown'], room: 'unknown', palette: 'unknown'};
  const restored = restoreState(state).state.profile;
  assert.equal(restored.name, 'Avery');
  assert.equal(restored.height, defaultProfile.height);
  assert.equal(restored.size, defaultProfile.size);
  assert.equal(restored.budget, defaultProfile.budget);
  assert.deepEqual(restored.styles, ['artful']);
  assert.equal(restored.room, 'living');
  assert.equal(restored.palette, 'warm');
  assert.deepEqual(restoreState({...state, profile: {...state.profile, styles: null}}).state.profile.styles, defaultProfile.styles);
});

test('restored photos require local data image formats and explicit local consent', () => {
  const state = initialState();
  state.profile = {...state.profile, consent: false, personaImage: 'data:image/jpeg;base64,AAAA', homeImage: 'data:image/png;base64,AAAA'};
  assert.equal(restoreState(state).state.profile.personaImage, null);
  assert.equal(restoreState(state).state.profile.homeImage, null);
  state.profile.consent = true;
  assert.equal(restoreState(state).state.profile.personaImage, state.profile.personaImage);
  state.profile.personaImage = 'https://external.example/photo.jpg';
  state.profile.homeImage = 'data:image/svg+xml;base64,AAAA';
  assert.equal(restoreState(state).state.profile.personaImage, null);
  assert.equal(restoreState(state).state.profile.homeImage, null);
});

test('restored inventory and feedback keep valid values and discard malformed ones', () => {
  const state = initialState();
  state.inventory = {'ME-001': 0, 'ME-002': -1, 'ME-003': 1.5, 'ME-004': 1000, 'ME-005': 999};
  state.feedback = {'ME-001': 'like', 'ME-002': 'less', 'ME-003': 'unknown', 'unknown-sku': 'like'};
  state.wishlist = ['ME-001', 'ME-001'];
  state.soundVolume = 10;
  state.language = 'unknown';
  const restored = restoreState(state).state;
  assert.equal(restored.inventory['ME-001'], 0);
  assert.equal(restored.inventory['ME-005'], 999);
  for (const id of ['ME-002', 'ME-003', 'ME-004', 'ME-006']) assert.equal(restored.inventory[id], byId(id).stock);
  assert.deepEqual(restored.feedback, {'ME-001': 'like', 'ME-002': 'less'});
  assert.deepEqual(restored.wishlist, ['ME-001']);
  assert.equal(restored.soundVolume, .5);
  assert.equal(restored.language, 'en');
});

test('restoration rejects corrupt booking status, lines and alternative SKU references', () => {
  const booking = makeBooking([validCartLine()], {date: '2030-01-02', time: '11:00', name: 'Avery', sharedFields: {name: true, items: true, dateTime: true}}, 1000);
  for (const corrupt of [
    {...booking, status: 'invalid'}, {...booking, items: null},
    {...booking, items: [{...booking.items[0], status: 'invalid'}]},
    {...booking, items: [{...booking.items[0], alternativeId: 'unknown-sku'}]},
  ]) {
    assert.equal(restoreState({...initialState(), bookings: [corrupt]}).recovered, true);
  }
  assert.equal(restoreState({...initialState(), bookings: [booking]}).recovered, false);
});

test('legitimate stock changes preserve cart choices but disable booking via stock check', () => {
  const state = initialState();
  state.cart = [validCartLine()];
  state.inventory['ME-001'] = 0;
  const restored = restoreState(state);
  assert.equal(restored.recovered, false);
  assert.deepEqual(restored.state.cart, state.cart);
  assert.equal(cartUnavailable(restored.state.cart, restored.state.inventory), true);
});


test('selectable persona, home and room presets change catalog ranking', () => {
  const base = profile();
  const women = byId('ME-001'), men = byId('ME-012');
  assert.equal(score(women, base) - score(women, {...base, personaId:'tall-man-35'}), 38);
  assert.equal(score(men, {...base, personaId:'tall-man-35'}) - score(men, base), 38);
  const homeRank = id => filteredProducts({category:'home'}, {...base, homeId:id}).map(p => p.id);
  assert.notDeepEqual(homeRank('compact-city'), homeRank('warm-family'));
  const roomRank = room => filteredProducts({category:'home'}, {...base,room}).map(p => p.id);
  assert.notDeepEqual(roomRank('kitchen'), roomRank('bedroom'));
});

test('default selections restore known presets and keep consented legacy photos private', () => {
  const state = initialState();
  state.profile = {...state.profile, personaId:'external-path', homeId:'unknown', room:'kitchen', consent:true, personaImage:'data:image/jpeg;base64,AAAA'};
  const profile = restoreState(state).state.profile;
  assert.equal(profile.personaId, defaultProfile.personaId);
  assert.equal(profile.homeId, defaultProfile.homeId);
  assert.equal(profile.room, 'kitchen');
  assert.equal(profile.personaImage, state.profile.personaImage);
});

test('introduction status persists without resetting legacy shoppers or profile data', () => {
  const fresh = initialState();
  assert.equal(fresh.onboardingStatus, 'pending');
  for (const status of ['pending', 'completed', 'skipped']) {
    const saved = {...initialState(), onboardingStatus:status, language:'en', wishlist:['ME-001']};
    assert.equal(restoreState(saved).state.onboardingStatus,status);
    assert.deepEqual(restoreState(saved).state.wishlist,['ME-001']);
  }
  const legacy = {...initialState(), profile:{...initialState().profile, name:'Returning visitor',styles:['artful']}};
  delete legacy.onboardingStatus;
  const migrated = restoreState(legacy);
  assert.equal(migrated.recovered,false);
  assert.equal(migrated.state.onboardingStatus,'completed');
  assert.deepEqual(migrated.state.profile,legacy.profile);
  assert.equal(restoreState({...legacy,onboardingStatus:'unexpected'}).state.onboardingStatus,'completed');
  assert.equal(restoreState(null).state.onboardingStatus,'pending');
});
