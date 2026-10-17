import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleTargetRatio} from '../src/concierge-visibility.js';
const viewport={width:390,height:844};
const rect=(top,height=400,left=20,width=350)=>({top,bottom:top+height,left,right:left+width,width,height});
test('visible product geometry rejects passed and empty sources',()=>{
  assert.equal(visibleTargetRatio(rect(-500),viewport,80),0);
  assert.equal(visibleTargetRatio(rect(900),viewport,80),0);
  assert.equal(visibleTargetRatio(rect(100,0),viewport,80),0);
  assert.equal(visibleTargetRatio(rect(100,400,500),viewport,80),0);
});
test('visible product geometry respects the sticky header and partial visibility',()=>{
  assert.equal(visibleTargetRatio(rect(0),viewport,80),0.8);
  assert.equal(visibleTargetRatio(rect(100),viewport,80),1);
  assert.equal(visibleTargetRatio(rect(644),viewport,80),0.5);
});
test('a tall source can qualify without waiting for an impossible full intersection',()=>{
  assert.equal(visibleTargetRatio(rect(80,1400),viewport,80),1);
  assert.ok(Number.isFinite(visibleTargetRatio(rect(0),viewport,900)));
});
