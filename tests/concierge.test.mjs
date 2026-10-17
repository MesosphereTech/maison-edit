import test from 'node:test';
import assert from 'node:assert/strict';
import { byId, catalog, defaultProfile, money } from '../src/data.js';
import { createConciergeSession, acceptConciergeEvent, createConciergeReply, conciergeContextKey, contextKey } from '../src/concierge.js';

const event = (type = 'product_open', productId = 'ME-001', extra = {}) => ({type, productId, contextKey:'discover', ...extra});
const accept = (session, value, now) => acceptConciergeEvent(session, value, now);

test('sessions start empty and isolated, including a valid first message at t=0', () => {
  const session = createConciergeSession();
  assert.deepEqual(session, {seen:[], lastAt:0, count:0, paused:false});
  assert.notEqual(session.seen, createConciergeSession().seen);
  const result = accept(session, event(), 0);
  assert.equal(result.accepted, true);
  assert.equal(result.session.lastAt, 0);
  assert.equal(result.session.count, 1);
  assert.deepEqual(session, createConciergeSession());
});

test('repeated product opens are deduped for their browsing context', () => {
  const first = accept(createConciergeSession(), event(), 0).session;
  assert.equal(accept(first, event(), 100_000).accepted, false);
  assert.equal(accept(first, event('product_open','ME-001',{contextKey:'saved'}), 10_000).accepted, true);
  assert.equal(accept(first, event('product_open','ME-002'), 10_000).accepted, true);
});

test('user actions get a 10s gate while passive dwell requires 45s of quiet', () => {
  const first = accept(createConciergeSession(), event(), 0).session;
  for (const type of ['product_open','variant','save','add','page']) {
    const next = event(type, 'ME-002', {value:{color:'Ink',size:'L'}});
    assert.equal(accept(first, next, 9_999).accepted, false, type);
    assert.equal(accept(first, next, 10_000).accepted, true, type);
  }
  assert.equal(accept(first, event('dwell','ME-002'), 44_999).accepted, false);
  assert.equal(accept(first, event('dwell','ME-002'), 45_000).accepted, true);
  const dwell = accept(createConciergeSession(), event('dwell'), 0).session;
  assert.equal(accept(dwell, event('add'), 10_000).accepted, true);
});

test('dwell can speak once per product/context even if its value changes', () => {
  const first = accept(createConciergeSession(), event('dwell','ME-001',{value:7}), 0).session;
  assert.equal(accept(first, event('dwell','ME-001',{value:40}), 50_000).accepted, false);
  assert.equal(accept(first, event('dwell','ME-002'), 50_000).accepted, true);
  assert.equal(accept(first, event('dwell','ME-001',{contextKey:'saved'}), 50_000).accepted, true);
});

test('variant dedupe is stable, respects selected values, and ignores property order', () => {
  const firstEvent = event('variant', 'ME-001', {variant:{color:'Ink',size:'L'}});
  const first = accept(createConciergeSession(), firstEvent, 0).session;
  assert.equal(accept(first,event('variant','ME-001',{value:{size:'L',color:'Ink'}}), 20_000).accepted,false);
  assert.equal(accept(first,event('variant','ME-001',{color:'Walnut',size:'L'}), 20_000).accepted,true);
  assert.equal(accept(first,event('variant','ME-001',{variant:{color:'Ink',size:'M'}}), 20_000).accepted,true);
});

test('a session speaks at most five times and pausing does not spend its budget', () => {
  let session = createConciergeSession();
  const paused = {...session,paused:true};
  assert.deepEqual(accept(paused,event(),0), {session:paused,accepted:false});
  for(let i=0;i<5;i++) {
    const result = accept(session,event('product_open',catalog[i].id),i*10_000);
    assert.equal(result.accepted,true);
    session=result.session;
  }
  assert.equal(session.count,5);
  assert.equal(accept(session,event('page',null,{page:'visit'}),100_000).accepted,false);
  assert.equal(session.seen.length,5);
});

test('cooldown rejects are dropped without adding a delayed queue or mutating state', () => {
  const session = accept(createConciergeSession(),event(),0).session;
  const snapshot=structuredClone(session);
  const dropped=accept(session,event('add','ME-002'),5_000);
  assert.equal(dropped.accepted,false);
  assert.equal(dropped.session,session);
  assert.deepEqual(session,snapshot);
  assert.equal('pending' in session,false);
  const next=accept(session,event('save','ME-003'),15_000);
  assert.equal(next.accepted,true);
  assert.equal(next.session.seen.some(key=>key.includes('ME-002')),false);
});

test('stale scheduled context and invalid events never consume budget', () => {
  const session=createConciergeSession();
  for(const value of [
    event('dwell','ME-001',{contextKey:'old',currentContextKey:'new'}),
    event('unknown'), event('add','missing'), null,
  ]) assert.deepEqual(accept(session,value,0),{session,accepted:false});
  for(const time of [NaN,Infinity,-1]) assert.equal(accept(session,event(),time).accepted,false);
  assert.equal(accept(session,event('dwell','ME-001',{contextKey:'same',currentContextKey:'same'}),0).accepted,true);
});

test('context keys are stable for equivalent nested filter objects', () => {
  assert.equal(conciergeContextKey({page:'discover',filters:{category:'home',budget:1000}}), contextKey({filters:{budget:1000,category:'home'},page:'discover'}));
  assert.notEqual(contextKey({page:'discover'}),contextKey({page:'visit'}));
  assert.equal(contextKey('discover'),'discover');
});

test('English and Chinese product replies use actual catalog names, prices and options', () => {
  for(const item of catalog) for(const language of ['zh','en']) {
    const reply=createConciergeReply({event:event('product_open',item.id),language});
    assert.equal(reply.mode,'demo');
    assert.deepEqual(reply.productIds,[item.id]);
    assert.ok(reply.text.includes(language==='zh'?item.name:item.en));
    assert.ok(reply.text.includes(money(item.price,language)));
    for(const color of item.colors) assert.ok(reply.text.includes(color));
    for(const size of item.sizes) assert.ok(reply.text.includes(size));
    assert.ok(reply.quickReplies.some(q=>q.id===(item.category==='home'?'room':'outfit')));
    assert.ok(reply.quickReplies.some(q=>q.id==='booking'));
    assert.ok(reply.text.length<340);
  }
});

test('selected catalog variants take precedence and invalid choices are never repeated', () => {
  for(const fields of [{variant:{color:'Ink',size:'L'}},{color:'Ink',size:'L'},{value:{color:'Ink',size:'L'}}]) {
    const reply=createConciergeReply({event:event('variant','ME-001',fields),language:'en'});
    assert.match(reply.text,/Ink · L selected/);
    assert.ok(!reply.text.includes('Walnut'));
    assert.match(reply.text,/Check the fit in store/);
  }
  const invalid=createConciergeReply({event:event('variant','ME-001',{variant:{color:'Neon',size:'XXXL'}}),language:'en'});
  assert.ok(!invalid.text.includes('Neon'));
  assert.ok(!invalid.text.includes('XXXL'));
  assert.match(invalid.text,/Catalogue options/);
  const home=createConciergeReply({event:event('variant','ME-017',{color:'Chalk',size:'ONE SIZE'}),language:'en'});
  assert.match(home.text,/Chalk · ONE SIZE selected/);
  assert.ok(!home.text.includes('fit'));
});

test('save/add replies guide booking without claiming inventory or preparation is ready', () => {
  const saved=createConciergeReply({event:event('save'),language:'en'});
  assert.match(saved.text,/saved/);
  assert.ok(saved.quickReplies.some(q=>q.id==='add'));
  assert.ok(saved.quickReplies.some(q=>q.id==='booking'));
  const removed=createConciergeReply({event:event('save','ME-001',{value:false}),language:'en'});
  assert.match(removed.text,/removed/);
  const added=createConciergeReply({event:event('add','ME-001',{variant:{color:'Ink',size:'S'}}),language:'en'});
  assert.match(added.text,/Ink · S/);
  assert.match(added.text,/stock and preparation still need store confirmation/);
  assert.equal(added.quickReplies[0].id,'booking');
});

test('saved and visit pages only reference valid saved/cart catalogue items', () => {
  const saved=createConciergeReply({event:{type:'page',page:'saved'},wishlist:['ME-018','missing','ME-018'],language:'en'});
  assert.match(saved.text,/1 saved piece/);
  assert.ok(saved.text.includes(byId('ME-018').en));
  assert.deepEqual(saved.productIds,['ME-018']);
  assert.ok(saved.quickReplies.some(q=>q.id==='room'));
  const visit=createConciergeReply({event:{type:'page',section:'visit'},cart:[{skuId:'ME-001',quantity:2},{skuId:'ME-018',quantity:1},{skuId:'missing',quantity:99}],language:'en'});
  assert.match(visit.text,/3 pieces/);
  assert.match(visit.text,/preparation is unverified/);
  assert.deepEqual(visit.productIds,['ME-001','ME-018']);
  for(const page of ['saved','visit']) {
    const empty=createConciergeReply({event:{type:'page',page},language:'en'});
    assert.deepEqual(empty.productIds,[]);
    assert.equal(empty.quickReplies[0].id,'view');
  }
});

test('hero/page recommendations respect real filters and declared preferences', () => {
  const reply=createConciergeReply({event:{type:'page',section:'hero'},language:'en',profile:defaultProfile,filters:{category:'home',budget:480}});
  assert.match(reply.text,/4 demo pieces/);
  assert.ok(reply.productIds.every(id=>byId(id).category==='home'&&byId(id).price<=480));
  assert.ok(reply.quickReplies.some(q=>q.id==='room'));
  const empty=createConciergeReply({event:{type:'page'},filters:{query:'no-such-sku'},language:'en'});
  assert.match(empty.text,/No catalogue pieces/);
  assert.deepEqual(empty.productIds,[]);
});

test('reply creation is deterministic, side-effect free, and only returns supported actions', () => {
  const input={event:event('product_open'),language:'en',profile:structuredClone(defaultProfile),filters:{},wishlist:['ME-001'],cart:[]};
  const snapshot=structuredClone(input);
  assert.deepEqual(createConciergeReply(input),createConciergeReply(input));
  assert.deepEqual(input,snapshot);
  for(const type of ['product_open','variant','save','add','page','dwell']) {
    const reply=createConciergeReply({...input,event:event(type)});
    assert.ok(reply.quickReplies.every(q=>['outfit','color','room','booking','add','view'].includes(q.id)&&typeof q.label==='string'));
    assert.equal(new Set(reply.quickReplies.map(q=>q.id)).size,reply.quickReplies.length);
    assert.ok(!/live AI|perfect fit|will fit|stock confirmed|ready for collection/i.test(reply.text));
  }
});
