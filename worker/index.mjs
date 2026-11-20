const json = (data,status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const splitName = value => [...new Intl.Segmenter('zh',{granularity:'grapheme'}).segment(value)];
export function createHandler(resources) {
  return async function handle(request,env) {
    const url=new URL(request.url),path=url.pathname;
    try {
      if(path.startsWith('/api/')){
        if(!env.DB)return json({error:'排行榜暂不可用，请稍后重试。'},503);
        if(path==='/api/leaderboard'&&request.method==='GET'){
          const rows=await env.DB.prepare('SELECT nickname, MAX(score) AS score FROM game_runs WHERE finished_at IS NOT NULL GROUP BY nickname ORDER BY score DESC, MIN(finished_at) ASC LIMIT 20').all();
          return json({entries:rows.results});
        }
        if(request.method!=='POST')return json({error:'请求方式不支持。'},405);
        const origin=request.headers.get('Origin');
        if(origin&&origin!==url.origin)return json({error:'请从游戏页面提交成绩。'},403);
        const raw=await request.text();if(raw.length>2048)return json({error:'请求内容过长。'},413);
        let body;try{body=JSON.parse(raw);}catch{return json({error:'请求内容无效。'},400);}
        if(path==='/api/start'){
          if(typeof body.nickname!=='string')return json({error:'请填写昵称。'},400);
          const nickname=body.nickname.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f]/g,'').trim();
          if(!nickname||splitName(nickname).length>9)return json({error:'昵称需要 1—9 个字。'},400);
          const runId=crypto.randomUUID();
          await env.DB.prepare('INSERT INTO game_runs (id,nickname,started_at) VALUES (?,?,?)').bind(runId,nickname,Date.now()).run();
          return json({runId});
        }
        if(path==='/api/finish'){
          const {runId,score,duration}=body;
          if(typeof runId!=='string'||runId.length>64||!Number.isSafeInteger(score)||score<0||score%10!==0||typeof duration!=='number'||!Number.isFinite(duration)||duration<0||duration>86400)return json({error:'成绩格式不正确。'},400);
          const row=await env.DB.prepare('SELECT * FROM game_runs WHERE id=?').bind(runId).first();
          if(!row)return json({error:'找不到这次签到，请重新开始。'},404);
          if(duration>(Date.now()-row.started_at)/1000+3||score>(Math.floor(duration/.52)+2)*10)return json({error:'成绩与游戏时长不符。'},400);
          if(row.finished_at!==null&&row.score!==score)return json({error:'本局成绩已经保存。'},409);
          await env.DB.prepare('UPDATE game_runs SET score=?,duration=?,finished_at=? WHERE id=? AND finished_at IS NULL').bind(score,duration,Date.now(),runId).run();
          const best=await env.DB.prepare('SELECT MAX(score) AS best FROM game_runs WHERE nickname=? AND finished_at IS NOT NULL').bind(row.nickname).first();
          return json({saved:true,best:best.best});
        }
        return json({error:'页面不存在。'},404);
      }
      if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
      const resource=resources[path==='/'?'/index.html':path];
      if(!resource)return new Response('Not found',{status:404});
      const headers={'Content-Type':resource.type,'Cache-Control':path.endsWith('.mp3')||path.endsWith('.jpg')?'public, max-age=86400':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'};
      const bytes=Uint8Array.from(atob(resource.body),c=>c.charCodeAt(0));
      return new Response(request.method==='HEAD'?null:bytes,{headers});
    }catch(error){console.error('Game request failed',error);return json({error:'服务暂时忙碌，请稍后重试。'},503);}
  };
}
