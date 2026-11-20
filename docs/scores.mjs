import { cleanName, letters } from './engine.mjs';
const STORAGE_KEY = 'freshman-card-defence:leaderboard:v1';
function browserStorage() { try { return globalThis.localStorage; } catch { return undefined; } }
export function createScoreApi(storage = browserStorage()) {
  const runs = new Map(), best = new Map();
  let persistent = !!storage, sequence = 0;
  function mergeStored() {
    if (!storage) return;
    try {
      const rows = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(rows)) return;
      for (const row of rows) {
        if (!row || typeof row.nickname !== 'string' || !Number.isSafeInteger(row.score) || row.score < 0 || row.score % 10 !== 0) continue;
        const nickname = cleanName(row.nickname);
        if (!nickname || letters(nickname).length > 9) continue;
        const old = best.get(nickname);
        const achievedAt = Number.isFinite(row.achievedAt) ? row.achievedAt : Date.now();
        if (!old || row.score > old.score || (row.score === old.score && achievedAt < old.achievedAt)) best.set(nickname, { nickname, score: row.score, achievedAt });
      }
    } catch { persistent = false; }
  }
  function rows() { return [...best.values()].sort((a,b) => b.score-a.score || a.achievedAt-b.achievedAt); }
  mergeStored();
  return async function scoreApi(path, data = {}) {
    if (path === '/api/start') {
      const nickname = cleanName(data.nickname);
      if (!nickname || letters(nickname).length > 9) throw new Error('昵称需要 1—9 个字。');
      const runId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${++sequence}`;
      runs.set(runId, { nickname });
      return { runId, persistent };
    }
    if (path === '/api/finish') {
      const run = runs.get(data.runId);
      if (!run) throw new Error('找不到本局记录，请重新开始。');
      const { score, duration } = data;
      if (!Number.isSafeInteger(score) || score < 0 || score % 10 !== 0 || !Number.isFinite(duration) || duration < 0 || score > (Math.floor(duration/.52)+2)*10) throw new Error('成绩格式不正确。');
      if (run.score !== undefined && run.score !== score) throw new Error('本局成绩已经保存。');
      mergeStored();
      run.score = score;
      const previous = best.get(run.nickname);
      if (!previous || score > previous.score) best.set(run.nickname, { nickname: run.nickname, score, achievedAt: Date.now() });
      if (storage) {
        try { storage.setItem(STORAGE_KEY, JSON.stringify(rows().slice(0,1000))); }
        catch { persistent = false; }
      }
      return { saved: true, best: best.get(run.nickname).score, persistent };
    }
    if (path === '/api/leaderboard') {
      mergeStored();
      return { entries: rows().slice(0,20).map(({nickname,score}) => ({nickname,score})), persistent };
    }
    throw new Error('找不到这个成绩操作。');
  };
}
export const scoreApi = createScoreApi();
