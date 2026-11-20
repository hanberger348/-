import { Game, RULES, difficulty, letters, cleanName } from './engine.mjs';
import { scoreApi } from './scores.mjs';
const $ = id => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
const atlas = new Image(); atlas.src = new URL('./assets/campus-original.jpg', import.meta.url).href;
const ui = { screen: 'menu', game: new Game(), name: '', runId: null, saved: false, pendingScore: null, loading: false, particles: [], clock: 0, flash: 0 };
const keys = new Set(), touches = new Map();
const music = new Audio(new URL('./audio/happy-adventure.mp3', import.meta.url).href); music.loop = true; music.volume = 0.16; music.preload = 'none';
let audioContext, muted = false, composing = false, lastFrame = 0, accumulator = 0, latestScore = -1, loadingEffects = false;
const effectBuffers = {};
try { $('nickname').value = localStorage.getItem('campus-nickname') || ''; muted = localStorage.getItem('campus-muted') === 'true'; } catch {}
const frames = [[178,796,110,274],[375,791,115,267],[566,791,115,269],[736,787,118,269],[911,778,115,277],[1070,779,114,267]];
const dots = Array.from({length:90}, (_,i) => ({ x: 10 + ((i*173+67)%398), y: 244 + ((i*97+21)%350), r: i%8===0 ? 1.5 : .7+(i%3)*.25 }));
function tone(freq, duration, gain, end = freq, delay = 0) {
  if (muted || !audioContext) return;
  const t = audioContext.currentTime + delay, o=audioContext.createOscillator(), g=audioContext.createGain();
  o.type='triangle'; o.frequency.setValueAtTime(freq,t); o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);
  g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(audioContext.destination);o.start(t);o.stop(t+duration);
}
function sound(type) {
  if (!muted && audioContext && effectBuffers[type]) {
    const source = audioContext.createBufferSource(), gain = audioContext.createGain();
    source.buffer = effectBuffers[type]; gain.gain.value = type === 'shoot' ? .07 : .27;
    source.connect(gain); gain.connect(audioContext.destination); source.start();
    if(type !== 'dead')return;
  }
  if(type==='shoot') tone(350,.045,.025,190);
  if(type==='score') { tone(700,.08,.07,900);tone(1050,.08,.05,1200,.06); }
  if(type==='dead') { tone(230,.16,.12,100);tone(140,.27,.1,45,.13); }
}
function unlockAudio() {
  try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); audioContext.resume().catch(()=>{}); } catch {}
  if(audioContext && !loadingEffects) {
    loadingEffects = true;
    for(const [kind,file] of [['shoot','click_003.ogg'],['score','confirmation_002.ogg'],['dead','back_001.ogg']])
      fetch(new URL('./audio/'+file, import.meta.url)).then(r=>{if(!r.ok)throw new Error('Audio unavailable');return r.arrayBuffer();}).then(data=>audioContext.decodeAudioData(data)).then(buffer=>{effectBuffers[kind]=buffer;}).catch(()=>{});
  }
  if(!muted && ui.screen==='playing') music.play().catch(()=>{});
}
function updateSound() {
  music.muted = muted;
  $('sound-button').textContent = muted ? '声音关' : '声音开';
  $('sound-button').setAttribute('aria-pressed',String(!muted));
  $('sound-button').setAttribute('aria-label',muted?'打开音乐和音效':'关闭音乐和音效');
}
$('sound-button').addEventListener('click',()=>{muted=!muted;updateSound();unlockAudio();try{localStorage.setItem('campus-muted',String(muted));}catch{}});
function nameInput() {
  if(composing)return;
  const current=$('nickname').value;
  const parts=letters(current);
  if(parts.length>9)$('nickname').value=parts.slice(0,9).join('');
  $('name-count').textContent=`${letters($('nickname').value).length} / 9`;
  $('name-error').textContent='';
}
$('nickname').addEventListener('compositionstart',()=>{composing=true;});
$('nickname').addEventListener('compositionend',()=>{composing=false;nameInput();});
$('nickname').addEventListener('input',nameInput);nameInput();updateSound();
async function api(path, data) {
  return scoreApi(path, data);
}
function overlays() {
  $('welcome').hidden=ui.screen!=='menu';$('pause-overlay').hidden=ui.screen!=='paused';$('result-overlay').hidden=ui.screen!=='over';
  $('pause-button').disabled=ui.screen!=='playing';
}
async function start() {
  if(ui.loading)return;
  const name=cleanName($('nickname').value);
  if(!name||letters(name).length>9){$('name-error').textContent='请填写 1—9 个字的昵称。';$('nickname').focus();return;}
  ui.loading=true;$('start-button').disabled=true;$('start-button').textContent='正在签到…';$('retry-button').disabled=true;
  unlockAudio();
  try {
    if(ui.pendingScore&&!ui.saved)await saveScore();
    const result=await api('/api/start',{nickname:name});
    ui.name=name;ui.runId=result.runId;ui.game=new Game();ui.screen='playing';ui.saved=false;ui.pendingScore=null;ui.particles=[];ui.flash=0;accumulator=0;latestScore=-1;
    $('player-label').textContent=`新生 · ${name}`;overlays();
    try{localStorage.setItem('campus-nickname',name);}catch{}
    music.currentTime=0;unlockAudio();
  } catch(error) {
    if(ui.screen==='over')$('save-status').textContent=error.message;
    else $('name-error').textContent=error.message;
  } finally {ui.loading=false;$('start-button').disabled=false;$('start-button').textContent='开始拒绝推销';$('retry-button').disabled=false;}
}
$('start-form').addEventListener('submit',e=>{e.preventDefault();start();});
$('retry-button').addEventListener('click',start);
function clearInputs(){keys.clear();touches.clear();$('left-button').classList.remove('held');$('right-button').classList.remove('held');}
function pause(){if(ui.screen!=='playing')return;ui.screen='paused';clearInputs();music.pause();overlays();}
function resume(){if(ui.screen!=='paused')return;ui.screen='playing';accumulator=0;lastFrame=performance.now();overlays();unlockAudio();}
$('pause-button').addEventListener('click',pause);$('resume-button').addEventListener('click',resume);
$('pause-home-button').addEventListener('click',()=>{endGame(true);});
$('rename-button').addEventListener('click',()=>{ui.screen='menu';overlays();$('nickname').focus();});
window.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)||document.querySelector('dialog[open]'))return;
  if(e.key==='Escape'||e.key.toLowerCase()==='p'){if(ui.screen==='playing')pause();else if(ui.screen==='paused')resume();return;}
  if(['ArrowLeft','ArrowRight','a','A','d','D'].includes(e.key)){e.preventDefault();keys.add(e.key.toLowerCase());}
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{clearInputs();pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
for(const [id,dir] of [['left-button',-1],['right-button',1]]){
  const button=$(id);button.addEventListener('pointerdown',e=>{e.preventDefault();if(ui.screen!=='playing')return;button.setPointerCapture(e.pointerId);touches.set(e.pointerId,dir);button.classList.add('held');});
  const release=e=>{touches.delete(e.pointerId);if(![...touches.values()].includes(dir))button.classList.remove('held');};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  button.addEventListener('contextmenu',e=>e.preventDefault());
}
function direction(){const left=keys.has('arrowleft')||keys.has('a')||[...touches.values()].includes(-1);const right=keys.has('arrowright')||keys.has('d')||[...touches.values()].includes(1);return Number(right)-Number(left);}
async function saveScore(){
  if(ui.saved||!ui.pendingScore)return;
  $('save-status').textContent='正在记录成绩…';$('retry-save').hidden=true;
  try{const r=await api('/api/finish',ui.pendingScore);ui.saved=true;$('save-status').textContent=r.persistent?`已存入本机排行 · 你的最高分 ${r.best} 分`:`本次页面已记录 · 最高分 ${r.best} 分（关闭页面后不保留）`;}
  catch(e){$('save-status').textContent=`成绩暂未保存：${e.message}`;$('retry-save').hidden=false;throw e;}
}
$('retry-save').addEventListener('click',()=>{saveScore().catch(()=>{});});
function endGame(retired=false){
  if(ui.screen==='over')return;ui.screen='over';clearInputs();music.pause();
  $('final-score').textContent=String(ui.game.score);
  $('result-detail').textContent=`${ui.name} · 拒绝 ${ui.game.hits} 张 · 坚持 ${Math.floor(ui.game.time)} 秒`;
  document.querySelector('.result-card h2').innerHTML=retired?'休息一下，<br><em>下次再战。</em>':'还是被<br><em>塞了一张。</em>';
  ui.pendingScore={runId:ui.runId,score:ui.game.score,duration:ui.game.time};overlays();saveScore().catch(()=>{});
}
async function showBoard(){pause();$('board-dialog').showModal();await loadBoard();}
async function loadBoard(){
  $('board-status').textContent='正在翻开签到册…';$('board-list').replaceChildren();
  try{const r=await api('/api/leaderboard');$('board-status').textContent=r.entries.length?'':'签到册还是空的，来拿第一个高分吧。';
    document.querySelector('.board-caption').textContent=r.persistent?'成绩保存在当前浏览器，不同设备不互通。每个昵称保留最高分，显示前20名。':'当前浏览器无法保存数据，成绩仅在本次页面有效。';
    r.entries.forEach((row,i)=>{const li=document.createElement('li');for(const [cls,value] of [['rank',String(i+1).padStart(2,'0')],['rank-name',row.nickname],['rank-score',String(row.score)]]){const span=document.createElement('span');span.className=cls;span.textContent=value;li.append(span);}$('board-list').append(li);});
  }catch(e){$('board-status').textContent=e.message;}
}
$('leaderboard-button').addEventListener('click',showBoard);$('result-board-button').addEventListener('click',showBoard);$('refresh-board').addEventListener('click',loadBoard);
$('credits-button').addEventListener('click',()=>{pause();$('credits-dialog').showModal();});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
function sprite(rect,x,y,w,h,flip=false){
  if(!atlas.complete||!atlas.naturalWidth)return;
  ctx.save();ctx.globalCompositeOperation='multiply';ctx.translate(x,y);if(flip)ctx.scale(-1,1);
  ctx.drawImage(atlas,...rect,-w/2,-h/2,w,h);ctx.restore();
}
function stroke(points,width=3,color='#242424'){
  ctx.beginPath();ctx.moveTo(...points[0]);for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);ctx.lineWidth=width;ctx.strokeStyle=color;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();
}
function text(value,x,y,size=14,color='#222',align='center',weight=500){ctx.font=`${weight} ${size}px "Microsoft YaHei",sans-serif`;ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(value,x,y);}
function backdrop(){
  ctx.fillStyle='#f7f7f7';ctx.beginPath();ctx.moveTo(15,36);ctx.lineTo(404,39);ctx.lineTo(412,216);ctx.lineTo(9,211);ctx.closePath();ctx.fill();
  stroke([[15,80],[16,37],[158,33],[280,40],[403,37],[410,215],[221,211],[9,214],[12,119]],3.3);
  text('XX 大学',212,65,22,'#333','center',900);text('新 生 报 到',212,86,10,'#888');
  sprite([64,105,433,291],212,126,82,55);
  stroke([[189,158],[236,158]],1.3,'#bbb');text('开学大酬宾',212,178,12,'#777');text('办卡 · 送流量',212,196,11,'#999');
  senior(0,93,ui.game.throwTimers[0]);senior(1,319,ui.game.throwTimers[1]);
  text('学长',81,233,11,'#999');text('学姐',330,233,11,'#999');
}
function senior(side,x,timer){
  // Only the original head regions are sampled; the arms and torso are
  // code-native strokes, so the supplied drawing remains unchanged on disk.
  if(side===0)sprite([432,395,126,142],x,109,76,86);
  else{
    ctx.save();ctx.beginPath();ctx.moveTo(x-52,159);ctx.lineTo(x-52,128);ctx.lineTo(x-13,66);ctx.lineTo(x+52,66);ctx.lineTo(x+52,159);ctx.closePath();ctx.clip();
    sprite([623,375,167,151],x,112,102,92);ctx.restore();
  }
  stroke([[x+1,side===0?151:156],[x+1,195]],5.8);
  const swing=timer>0?Math.sin((.4-timer)*Math.PI*5)*19:Math.sin(ui.clock*1.6+side)*3;
  const shoulderY=165;
  stroke([[x+1,shoulderY],[x-23,183],[x-41,191-swing]],5.8);
  stroke([[x+2,shoulderY],[x+24,181],[x+43,188+swing]],5.8);
  stroke([[x+1,195],[x-22,211]],5.7);stroke([[x+1,195],[x+23,211]],5.7);
  if(timer>.15){ctx.save();ctx.globalAlpha=timer*1.7;stroke([[x+48,177],[x+55,169]],1.6);stroke([[x-49,178],[x-56,173]],1.6);ctx.restore();}
}
function drawBubble(b){
  ctx.save();ctx.translate(b.x,b.y);ctx.fillStyle='#fff';ctx.strokeStyle='#252525';ctx.lineWidth=2;
  ctx.beginPath();ctx.roundRect(-b.w/2,-b.h/2,b.w,b.h,8);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(-10,b.h/2-1);ctx.lineTo(-13,b.h/2+7);ctx.lineTo(-1,b.h/2);ctx.fill();ctx.stroke();text(b.word,0,5,15,'#292929','center',700);ctx.restore();
}
function draw(){
  const bounds=canvas.getBoundingClientRect(),pixelRatio=Math.min(window.devicePixelRatio||1,2),w=Math.round(bounds.width*pixelRatio),h=Math.round(bounds.height*pixelRatio);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  ctx.setTransform(w/RULES.width,0,0,h/RULES.height,0,0);ctx.clearRect(0,0,RULES.width,RULES.height);ctx.fillStyle='#fff';ctx.fillRect(0,0,RULES.width,RULES.height);
  backdrop();
  ctx.fillStyle='#272727';for(const dot of dots){ctx.beginPath();ctx.arc(dot.x,dot.y,dot.r,0,Math.PI*2);ctx.fill();}
  stroke([[11,635],[101,634],[200,637],[303,634],[408,636]],1.5,'#bbb');
  const g=ui.game;
  ctx.fillStyle='#e9e9e9';ctx.beginPath();ctx.ellipse(g.playerX,625,20,4,0,0,Math.PI*2);ctx.fill();
  const index=g.moving?Math.floor(g.time*11)%frames.length:0;const f=frames[index];
  sprite(f,g.playerX,581,86*f[2]/f[3],86,g.facing<0);
  if(ui.screen==='menu')text('你',g.playerX,529,12,'#888');
  for(const d of g.drops){ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.rotation);sprite(d.kind==='card'?[638,45,205,140]:[982,142,159,184],0,0,d.w,d.h);ctx.restore();}
  for(const b of g.bubbles)drawBubble(b);
  for(const p of ui.particles){ctx.save();ctx.globalAlpha=Math.max(0,p.life/.65);if(p.label)text('+10',p.x,p.y,18,'#c85c66','center',800);else{ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,3,3);}ctx.restore();}
  if(ui.flash>0){ctx.fillStyle=`rgba(200,70,80,${ui.flash*.45})`;ctx.fillRect(0,0,420,650);}
}
function frame(now){
  const delta=lastFrame?Math.min((now-lastFrame)/1000,.08):0;lastFrame=now;ui.clock+=delta;
  if(ui.screen==='playing'){
    accumulator+=delta;
    while(accumulator>=1/120&&ui.screen==='playing'){
      ui.game.update(1/120,direction());accumulator-=1/120;
      for(const e of ui.game.events){
        sound(e.type);
        if(e.type==='score'){
          ui.particles.push({x:e.x,y:e.y,life:.65,label:true});
          for(let i=0;i<6;i++)ui.particles.push({x:e.x,y:e.y,life:.4,vx:(Math.random()-.5)*100,vy:(Math.random()-.5)*100,color:i%2?'#333':'#c85c66'});
        }
        if(e.type==='dead'){ui.flash=1;endGame();}
      }ui.game.events=[];
    }
  }
  for(const p of ui.particles){p.life-=delta;p.x+=(p.vx||0)*delta;p.y+=p.label?-35*delta:(p.vy||0)*delta;}
  ui.particles=ui.particles.filter(p=>p.life>0);ui.flash=Math.max(0,ui.flash-delta*2);
  if(latestScore!==ui.game.score){$('score').textContent=String(ui.game.score).padStart(5,'0');latestScore=ui.game.score;}
  const d=difficulty(ui.game.time);$('pace-fill').style.width=`${Math.round(d.progress*100)}%`;$('pace-label').textContent=d.progress>=1?'推销热情 · 已到上限':'推销热情';
  draw();requestAnimationFrame(frame);
}
atlas.onload=()=>{$('start-button').disabled=false;$('start-button').textContent='开始拒绝推销';};
atlas.onerror=()=>{$('name-error').textContent='手绘素材加载失败，请刷新页面。';};
if(atlas.complete&&atlas.naturalWidth)atlas.onload();
overlays();requestAnimationFrame(frame);
