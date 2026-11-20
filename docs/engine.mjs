export const RULES = Object.freeze({
  width: 420, height: 650, playerY: 622, moveSpeed: 270,
  fireInterval: 0.52, bubbleSpeed: 355,
  initialDropInterval: 1.05, minDropInterval: 0.32,
  initialDropSpeed: 100, maxDropSpeed: 245, rampSeconds: 90,
});
export const WORDS = ['不要', 'no', '用不着', '谢谢'];
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('zh', { granularity: 'grapheme' }) : null;
export function letters(value) {
  return segmenter ? [...segmenter.segment(value)].map(x => x.segment) : Array.from(value);
}
export function cleanName(value) {
  return String(value ?? '').normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim();
}
export function difficulty(seconds) {
  const progress = Math.max(0, Math.min(1, seconds / RULES.rampSeconds));
  return {
    progress,
    interval: RULES.initialDropInterval + (RULES.minDropInterval - RULES.initialDropInterval) * progress,
    speed: RULES.initialDropSpeed + (RULES.maxDropSpeed - RULES.initialDropSpeed) * progress,
  };
}
export function intersects(a, b) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;
}
export class Game {
  constructor(random = Math.random) {
    this.random = random;
    this.time = 0; this.score = 0; this.hits = 0; this.shots = 0;
    this.playerX = RULES.width / 2; this.moving = 0; this.facing = 1;
    this.bubbles = []; this.drops = []; this.events = [];
    this.fireClock = 0; this.dropClock = 0.8; this.dead = false;
    this.throwTimers = [0, 0];
  }
  shoot() {
    const word = WORDS[this.shots % WORDS.length];
    this.bubbles.push({ x: this.playerX, y: RULES.playerY - 91, w: word === '用不着' ? 67 : word === 'no' ? 44 : 53, h: 33, word });
    this.shots++;
    this.events.push({ type: 'shoot' });
  }
  drop() {
    const side = this.random() < 0.5 ? 0 : 1;
    this.throwTimers[side] = 0.4;
    const kind = this.random() < 0.5 ? 'card' : 'flyer';
    const origin = side === 0 ? 128 : 291;
    const spread = (this.random() - 0.5) * 170;
    const aim = (this.random() - 0.5) * 0.8;
    this.drops.push({ x: origin + (this.random() - 0.5) * 14, y: 188,
      vx: spread + (this.playerX - origin) * aim,
      kind, w: kind === 'card' ? 34 : 28, h: kind === 'card' ? 24 : 34,
      rotation: (this.random() - 0.5) * 0.5, spin: (this.random() - 0.5) * 1.5 });
  }
  update(dt, direction = 0) {
    if (this.dead) return;
    this.time += dt;
    this.moving = direction;
    if (direction) this.facing = direction;
    this.playerX = Math.max(24, Math.min(RULES.width - 24, this.playerX + direction * RULES.moveSpeed * dt));
    for (let i = 0; i < 2; i++) this.throwTimers[i] = Math.max(0, this.throwTimers[i] - dt);
    this.fireClock -= dt;
    while (this.fireClock <= 0) { this.shoot(); this.fireClock += RULES.fireInterval; }
    this.dropClock -= dt;
    const diff = difficulty(this.time);
    while (this.dropClock <= 0) { this.drop(); this.dropClock += diff.interval; }
    for (const b of this.bubbles) b.y -= RULES.bubbleSpeed * dt;
    for (const d of this.drops) {
      d.y += diff.speed * dt; d.x += d.vx * dt; d.rotation += d.spin * dt;
      if (d.x < 18) { d.x = 18; d.vx = Math.abs(d.vx); }
      if (d.x > RULES.width - 18) { d.x = RULES.width - 18; d.vx = -Math.abs(d.vx); }
    }
    for (const b of this.bubbles) {
      if (b.used) continue;
      for (const d of this.drops) {
        if (!d.used && intersects(b, d)) {
          b.used = true; d.used = true; this.hits++; this.score += 10;
          this.events.push({ type: 'score', x: d.x, y: d.y });
          break;
        }
      }
    }
    const player = { x: this.playerX, y: RULES.playerY - 42, w: 19, h: 70 };
    const impact = this.drops.find(d => !d.used && intersects(d, player));
    if (impact) {
      this.dead = true;
      this.events.push({ type: 'dead', x: impact.x, y: impact.y });
    }
    this.drops = this.drops.filter(d => !d.used && d.y < RULES.height + 40);
    this.bubbles = this.bubbles.filter(b => !b.used && b.y > 184);
  }
}
