// Authoritative, deterministic combat. Rendering and TikTok transport stay separate.
export const COMBAT = Object.freeze({
  maxPerTeam: 12, lanes: [330, 398, 466], hp: 40, attack: 10,
  towerDamage: 8, speed: 42, range: 38, spacing: 42, cooldown: 700,
  stepMs: 100, yellowStart: 151, blueStart: 389, yellowGoal: 370, blueGoal: 170
});
const TEAMS = ['yellow', 'blue'];
const ROSTER_SIZE = { yellow: 8, blue: 6 };
export function reinforcementCount(value, kind) {
  return kind === 'gift' ? Math.max(1, Math.ceil(value / 8)) : 1;
}
export class Battle {
  constructor() {
    this.units = [];
    this.queues = { yellow: [], blue: [] };
    this.queued = { yellow: 0, blue: 0 };
    this.appearances = { yellow: 0, blue: 0 };
    this.nextLane = { yellow: 0, blue: 0 };
    this.nextId = 1;
    this.time = 0;
  }
  summon(team, count, owner) {
    if (!TEAMS.includes(team) || !Number.isSafeInteger(count) || count < 1) throw new Error('Invalid reinforcement');
    this.queues[team].push({ count, owner: { ...owner } });
    this.queued[team] += count;
    this.fill();
  }
  fill() {
    for (const team of TEAMS) {
      let active = this.units.filter(u => u.team === team).length;
      const x = team === 'yellow' ? COMBAT.yellowStart : COMBAT.blueStart;
      while (active < COMBAT.maxPerTeam && this.queued[team] > 0) {
        let lane = -1;
        for (let i = 0; i < COMBAT.lanes.length; i++) {
          const candidate = (this.nextLane[team] + i) % COMBAT.lanes.length;
          if (!this.units.some(u => u.team === team && u.lane === candidate && Math.abs(u.x - x) < COMBAT.spacing)) { lane = candidate; break; }
        }
        if (lane === -1) break;
        const batch = this.queues[team][0];
        this.units.push({ id: this.nextId++, team, lane, x, y: COMBAT.lanes[lane],
          hp: COMBAT.hp, maxHp: COMBAT.hp, appearance: this.appearances[team]++ % ROSTER_SIZE[team],
          owner: batch.owner.name, nextAttack: this.time, attackUntil: 0, hurtUntil: 0, action: 'move' });
        this.nextLane[team] = (lane + 1) % COMBAT.lanes.length;
        batch.count--; this.queued[team]--; active++;
        if (!batch.count) this.queues[team].shift();
      }
    }
  }
  // Server calls fixed steps; neither browser FPS nor spectator count affects outcomes.
  step(hp, powered = false) {
    this.time += COMBAT.stepMs;
    const damage = new Map(), towerDamage = { yellow: 0, blue: 0 };
    const positions = new Map(this.units.map(u => [u.id, u.x]));
    for (const u of this.units) {
      const direction = u.team === 'yellow' ? 1 : -1;
      const opponent = u.team === 'yellow' ? 'blue' : 'yellow';
      const ahead = this.units.filter(v => v.id !== u.id && v.lane === u.lane && (v.x - u.x) * direction >= 0);
      const enemy = ahead.filter(v => v.team !== u.team).sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))[0];
      const goal = u.team === 'yellow' ? COMBAT.yellowGoal : COMBAT.blueGoal;
      const inRange = enemy && Math.abs(enemy.x - u.x) <= COMBAT.range + .01;
      const atTower = !enemy && Math.abs(goal - u.x) <= .01;
      if (inRange || atTower) {
        u.action = 'attack';
        if (this.time >= u.nextAttack) {
          u.nextAttack = this.time + COMBAT.cooldown;
          u.attackUntil = this.time + 300;
          const multiplier = powered ? 1.5 : 1;
          if (inRange) damage.set(enemy.id, (damage.get(enemy.id) || 0) + COMBAT.attack * multiplier);
          else towerDamage[opponent] += COMBAT.towerDamage * multiplier;
        }
      } else {
        let distance = COMBAT.speed * COMBAT.stepMs / 1000;
        for (const v of ahead) distance = Math.min(distance, Math.max(0, (Math.abs(v.x - u.x) - (v.team === u.team ? COMBAT.spacing : COMBAT.range)) / (v.team === u.team ? 1 : 2)));
        distance = Math.min(distance, Math.max(0, (goal - u.x) * direction));
        positions.set(u.id, u.x + direction * distance);
        u.action = distance > 0 ? 'move' : 'idle';
      }
    }
    // Resolve all hits together, including mutual knockouts and simultaneous tower falls.
    for (const u of this.units) {
      u.x = positions.get(u.id);
      if (damage.has(u.id)) { u.hp = Math.max(0, u.hp - damage.get(u.id)); u.hurtUntil = this.time + 200; }
    }
    this.units = this.units.filter(u => u.hp > 0);
    for (const team of TEAMS) hp[team] = Math.max(0, hp[team] - towerDamage[team]);
    const winner = hp.yellow === 0 && hp.blue === 0 ? 'draw' : hp.yellow === 0 ? 'blue' : hp.blue === 0 ? 'yellow' : null;
    if (!winner) this.fill();
    return { winner, towerDamage };
  }
  snapshot() {
    return { time: this.time, fighters: this.units.map(u => ({ ...u })), queued: { ...this.queued },
      active: Object.fromEntries(TEAMS.map(team => [team, this.units.filter(u => u.team === team).length])) };
  }
}
