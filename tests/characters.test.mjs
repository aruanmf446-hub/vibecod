import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const code = readFileSync(new URL('../public/characters.js', import.meta.url), 'utf8');
function setup(reduced = false) {
  const sandbox = { window: {}, console, matchMedia: () => ({ matches: reduced }), Image: class {
    set src(value) { this.url = value; this.onload(); }
  } };
  vm.runInNewContext(code, sandbox);
  return sandbox.window.BattleCharacters;
}
test('14 assets originais, locais e transparentes, separados em 8/6', async () => {
  const roster = setup();
  assert.equal(roster.definitions.length, 14);
  assert.equal(roster.teams.yellow.length, 8);
  assert.equal(roster.teams.blue.length, 6);
  assert.equal(new Set(roster.definitions.map(c => c.id)).size, 14);
  assert.ok((await roster.ready).every(Boolean));
  const illustrations = new Set();
  for (const c of roster.definitions) {
    assert.match(c.asset, /^\/assets\/characters\/[a-z_]+\.svg$/);
    const svg = readFileSync(new URL('../public' + c.asset, import.meta.url), 'utf8');
    assert.match(svg, /viewBox="0 0 160 180"/);
    assert.doesNotMatch(svg, /<image|<script|<foreignObject|href=|<rect/);
    assert.ok(c.animations.includes('move') && c.effects.length);
    illustrations.add(svg.slice(svg.indexOf('</defs>')));
    assert.ok(roster.teams[c.team].includes(c));
  }
  assert.equal(illustrations.size, 14);
});
test('renderização visual não modifica posição, velocidade, time ou duração', async () => {
  for (const reduced of [false, true]) {
    const roster = setup(reduced); await roster.ready;
    const calls = [];
    const ctx = new Proxy({}, { get: (_, name) => (...args) => calls.push([name, ...args]), set: () => true });
    for (const appearance of roster.definitions) {
      for (const idle of [false, true]) {
        const sprite = { appearance, team: appearance.team, idle, x: 150, y: 450, speed: 2, ttl: 250, phase: 1 };
        const original = JSON.stringify(sprite);
        for (const winner of [null, 'yellow', 'blue']) roster.draw(ctx, sprite, 20, winner);
        assert.equal(JSON.stringify(sprite), original);
      }
    }
    assert.equal(calls.filter(c => c[0] === 'drawImage').length, 84);
    assert.equal(calls.filter(c => c[0] === 'save').length, calls.filter(c => c[0] === 'restore').length);
  }
});
test('cliente reconcilia combatentes do servidor sem inventar unidades ou dano', async () => {
  const roster = setup(); await roster.ready;
  const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
  const elements = new Proxy({}, { get: (target, id) => target[id] ||= {
    width: 540, height: 650, getContext: () => ctx, addEventListener() {},
    classList: { toggle() {} }, style: {}, replaceChildren() {}, append() {}
  }});
  const listeners = {};
  const sandbox = {
    window: { BattleCharacters: roster }, document: { getElementById: id => elements[id], querySelectorAll: () => [] },
    io: () => ({ on: (name, fn) => listeners[name] = fn }), performance: { now: () => 0 },
    requestAnimationFrame() {}, setTimeout: fn => fn(), Math, console
  };
  const source = readFileSync(new URL('../public/game.js', import.meta.url), 'utf8');
  vm.runInNewContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.probe = { syncCombat, units: () => sprites, fallen: () => fallen };})();'), sandbox);
  const fighters = roster.definitions.map((c, id) => ({ id, team: c.team,
    appearance: roster.teams[c.team].indexOf(c), hp:40,maxHp:40,action:'move',x:180+id,y:330 }));
  const data = { battleId:'first',combat:{time:0,fighters} };
  const original = JSON.stringify(data);
  sandbox.probe.syncCombat(data);
  assert.equal(sandbox.probe.units().size,14);
  for (const unit of sandbox.probe.units().values()) assert.equal(unit.appearance.team,unit.team);
  listeners.attack({team:'yellow',count:50});
  assert.equal(sandbox.probe.units().size,14);
  sandbox.probe.syncCombat({battleId:'first',combat:{time:100,fighters:fighters.slice(1)}});
  assert.equal(sandbox.probe.units().size,13);
  assert.equal(sandbox.probe.fallen().length,1);
  sandbox.probe.syncCombat({battleId:'second',combat:{time:0,fighters:[]}});
  assert.equal(sandbox.probe.units().size,0);
  assert.equal(sandbox.probe.fallen().length,0);
  assert.equal(JSON.stringify(data),original);
});
