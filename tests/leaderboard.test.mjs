import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHandler } from '../worker/index.mjs';
function setup(){
  const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../drizzle/0000_game_runs.sql',import.meta.url),'utf8'));
  const env={DB:{prepare(sql){let args=[];return{bind(...a){args=a;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return{results:db.prepare(sql).all(...args)};},async run(){return db.prepare(sql).run(...args);}};}}};
  const handle=createHandler({});
  async function call(route,body){const r=await handle(new Request('http://test'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),env);return{status:r.status,body:await r.json()};}
  return {db,call};
}
test('leaderboard saves real runs, keeps the best per nickname, and survives a second read',async()=>{
  const {db,call}=setup();
  assert.deepEqual((await call('/api/leaderboard')).body.entries,[]);
  const one=await call('/api/start',{nickname:'测试新生'});assert.equal(one.status,200);
  const result=await call('/api/finish',{runId:one.body.runId,score:10,duration:.52});assert.equal(result.status,200);
  const two=await call('/api/start',{nickname:'测试新生'});
  await call('/api/finish',{runId:two.body.runId,score:0,duration:0});
  const other=await call('/api/start',{nickname:'另一个新生'});await call('/api/finish',{runId:other.body.runId,score:20,duration:1.04});
  const ranking=(await call('/api/leaderboard')).body.entries;assert.equal(ranking.length,2);assert.equal(ranking[0].nickname,'另一个新生');assert.equal(ranking[1].score,10);
  assert.deepEqual((await call('/api/leaderboard')).body.entries,ranking);db.close();
});
test('server also enforces nine-character names and valid score increments',async()=>{
  const {db,call}=setup();
  for(const nickname of ['', '一二三四五六七八九十'])assert.equal((await call('/api/start',{nickname})).status,400);
  assert.equal((await call('/api/start',{nickname:'一二三四五六七八九'})).status,200);
  const {body}=await call('/api/start',{nickname:'小明'});
  assert.equal((await call('/api/finish',{runId:body.runId,score:11,duration:1})).status,400);
  assert.equal((await call('/api/finish',{runId:body.runId,score:10000,duration:1})).status,400);
  db.close();
});
test('retrying a saved run never duplicates it or changes its score',async()=>{
  const {db,call}=setup();const {body}=await call('/api/start',{nickname:'重试同学'});
  for(let i=0;i<2;i++)assert.equal((await call('/api/finish',{runId:body.runId,score:10,duration:.52})).status,200);
  assert.equal(db.prepare('SELECT count(*) AS total FROM game_runs WHERE finished_at IS NOT NULL').get().total,1);
  assert.equal((await call('/api/finish',{runId:body.runId,score:20,duration:1.04})).status,409);db.close();
});
