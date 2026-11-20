import test from 'node:test';
import assert from 'node:assert/strict';
import {createScoreApi} from '../public/scores.mjs';
function storage(){const map=new Map();return{getItem(key){return map.get(key)||null;},setItem(key,value){map.set(key,value);}};}
test('local ranking survives a new page session and keeps one best score per nickname',async()=>{
  const disk=storage(),api=createScoreApi(disk);
  for(const score of [10,0,20]){const r=await api('/api/start',{nickname:'新生'});await api('/api/finish',{runId:r.runId,score,duration:1});}
  const reloaded=createScoreApi(disk);
  assert.deepEqual((await reloaded('/api/leaderboard')).entries,[{nickname:'新生',score:20}]);
});
test('unavailable browser storage still allows starting and scoring, with temporary status',async()=>{
  const api=createScoreApi({getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}});
  const r=await api('/api/start',{nickname:'临时新生'});
  const saved=await api('/api/finish',{runId:r.runId,score:10,duration:.52});
  assert.equal(saved.persistent,false);assert.equal((await api('/api/leaderboard')).entries[0].score,10);
});
test('names over nine characters are rejected and duplicate save cannot change a finished run',async()=>{
  const api=createScoreApi(storage());
  await assert.rejects(api('/api/start',{nickname:'一二三四五六七八九十'}));
  const r=await api('/api/start',{nickname:'一二三四五六七八九'});
  await api('/api/finish',{runId:r.runId,score:10,duration:.52});
  await api('/api/finish',{runId:r.runId,score:10,duration:.52});
  await assert.rejects(api('/api/finish',{runId:r.runId,score:20,duration:1.04}));
  assert.equal((await api('/api/leaderboard')).entries.length,1);
});
