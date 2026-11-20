import test from 'node:test';
import assert from 'node:assert/strict';
import { Game,RULES,difficulty,letters } from '../public/engine.mjs';
test('one destroyed object scores exactly ten; a bubble cannot score twice',()=>{
  const g=new Game();g.fireClock=10;g.dropClock=10;
  g.bubbles=[{x:100,y:300,w:53,h:33}];
  g.drops=[{x:100,y:300,w:34,h:24,vx:0,rotation:0,spin:0},{x:100,y:300,w:34,h:24,vx:0,rotation:0,spin:0}];
  g.update(1/120);assert.equal(g.score,10);assert.equal(g.hits,1);assert.equal(g.drops.length,1);
  g.update(1/120);assert.equal(g.score,10);
});
test('one contact ends the run, and no further score or movement occurs',()=>{
  const g=new Game();g.fireClock=10;g.dropClock=10;
  g.drops=[{x:g.playerX,y:RULES.playerY-42,w:34,h:24,vx:0,rotation:0,spin:0}];
  g.update(1/120);assert.equal(g.dead,true);const x=g.playerX;
  g.update(10,1);assert.equal(g.playerX,x);assert.equal(g.score,0);
});
test('automatic shots stay at the same cadence after difficulty reaches its cap',()=>{
  const g=new Game();
  for(let i=0;i<120*100;i++){g.drops=[];g.update(1/120);g.events=[];}
  assert.ok(Math.abs(g.shots-(Math.floor(100/RULES.fireInterval)+1))<=1);
  assert.equal(difficulty(90).speed,RULES.maxDropSpeed);assert.equal(difficulty(900).speed,RULES.maxDropSpeed);
  assert.ok(Math.abs(difficulty(900).interval-RULES.minDropInterval)<1e-12);
  assert.ok(difficulty(30).speed>difficulty(0).speed);assert.ok(difficulty(30).interval<difficulty(0).interval);
});
test('player movement stays on the bottom line and inside both edges',()=>{
  const g=new Game();g.update(50,-1);assert.equal(g.playerX,24);
  const h=new Game();h.update(50,1);assert.equal(h.playerX,RULES.width-24);
});
test('nine visible nickname characters work with Chinese and emoji',()=>{
  assert.equal(letters('一二三四五六七八九').length,9);assert.equal(letters('小明👨‍👩‍👧‍👦').length,3);
});
