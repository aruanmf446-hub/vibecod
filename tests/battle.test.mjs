import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle, COMBAT, reinforcementCount } from '../battle.mjs';
const owner = { id:'donor',name:'Doador' };
const freshHp = () => ({yellow:1200,blue:1200});
function run(battle,hp,steps) { let result; for(let i=0;i<steps;i++){ result=battle.step(hp);if(result.winner)break;}return result; }

test('presentes invocam proporcionalmente e não causam dano instantâneo', () => {
  assert.equal(reinforcementCount(8,'gift'),1);
  assert.equal(reinforcementCount(150,'gift'),19);
  const battle=new Battle(),hp=freshHp();
  battle.summon('yellow',1,owner);
  assert.deepEqual(hp,freshHp());
  assert.equal(battle.units[0].team,'yellow');
  assert.equal(battle.units[0].owner,'Doador');
  run(battle,hp,20);
  assert.deepEqual(hp,freshHp());
});
test('combatentes oponentes param e duelam; dano simultâneo não favorece um time', () => {
  const battle=new Battle(),hp=freshHp();
  battle.summon('yellow',3,owner);battle.summon('blue',3,owner);
  let attacked=false,hurt=false;
  for(let i=0;i<100;i++) {
    battle.step(hp);
    attacked ||= battle.units.some(u=>u.action==='attack');
    hurt ||= battle.units.some(u=>u.hp<COMBAT.hp);
  }
  assert.ok(attacked&&hurt);
  assert.equal(battle.units.length,0);
  assert.deepEqual(hp,freshHp());
});
test('sobreviventes atacam a torre até a vitória sem temporizador', () => {
  for(const team of ['yellow','blue']) {
    const battle=new Battle(),hp=freshHp();
    battle.summon(team,1,owner);
    const result=run(battle,hp,2000);
    assert.equal(result.winner,team);
    assert.equal(hp[team],1200);
    assert.equal(hp[team==='yellow'?'blue':'yellow'],0);
  }
  const battle=new Battle(),hp=freshHp();
  assert.equal(run(battle,hp,10000).winner,null);
  assert.deepEqual(hp,freshHp());
});
test('reforços aguardam espaço sem sumir; limites e aparências por time', () => {
  const battle=new Battle(),hp=freshHp();
  battle.summon('yellow',200,owner);battle.summon('blue',200,owner);
  let previous=400;
  for(let i=0;i<600;i++) {
    battle.step(hp);const state=battle.snapshot();
    assert.ok(state.active.yellow<=COMBAT.maxPerTeam&&state.active.blue<=COMBAT.maxPerTeam);
    const total=state.active.yellow+state.active.blue+state.queued.yellow+state.queued.blue;
    // Only mutual defeat removes units; a cap never discards reinforcements.
    assert.ok(previous-total===0||(previous-total)%2===0);previous=total;
    for(const u of state.fighters) {
      assert.ok(u.x>=COMBAT.yellowStart&&u.x<=COMBAT.blueStart);
      assert.ok(u.appearance>=0&&u.appearance<(u.team==='yellow'?8:6));
    }
  }
  assert.ok(previous<400);
  assert.ok(battle.queued.yellow>0&&battle.queued.blue>0);
});
test('queda simultânea das torres dá empate e snapshots são independentes', () => {
  const battle=new Battle(),hp={yellow:8,blue:8};
  battle.summon('yellow',1,owner);battle.summon('blue',1,owner);
  battle.units[0].x=COMBAT.yellowGoal;
  battle.units[1].lane=1;battle.units[1].y=COMBAT.lanes[1];battle.units[1].x=COMBAT.blueGoal;
  const snapshot=battle.snapshot();snapshot.fighters[0].hp=0;snapshot.queued.yellow=99;
  assert.equal(battle.units[0].hp,COMBAT.hp);assert.equal(battle.queued.yellow,0);
  assert.equal(battle.step(hp).winner,'draw');
});
test('likes em modo poder reforçam ataques sem depender de FPS do cliente', () => {
  const battle=new Battle(),hp=freshHp();battle.summon('yellow',1,owner);
  battle.units[0].x=COMBAT.yellowGoal;
  battle.step(hp,true);
  assert.equal(hp.blue,1200-COMBAT.towerDamage*1.5);
});

test('doações ainda conseguem defender quando as três entradas estão sob ataque', () => {
  const battle=new Battle(),hp=freshHp();battle.summon('blue',3,owner);
  for(const unit of battle.units)unit.x=COMBAT.blueGoal;
  battle.summon('yellow',3,owner);
  assert.equal(battle.snapshot().active.yellow,3);
  battle.step(hp);
  assert.equal(hp.yellow,1200);
  assert.ok(battle.units.every(u=>u.hp<COMBAT.hp));
});
test('guardiões da arena vazia saem no mesmo corredor, caem juntos e não tocam nas torres', () => {
  const b = new Battle(); const hp = { yellow: 1200, blue: 1200 };
  assert.equal(b.skirmish(), true); assert.equal(b.skirmish(), false);
  const [y, z] = b.units; assert.equal(y.lane, z.lane); assert.notEqual(y.team, z.team);
  for (let i = 0; i < 400 && b.units.length; i++) b.step(hp);
  assert.equal(b.units.length, 0); assert.deepEqual(hp, { yellow: 1200, blue: 1200 });
  b.summon('yellow', 1, { name: 'Ana' }); assert.equal(b.skirmish(), false);
});
