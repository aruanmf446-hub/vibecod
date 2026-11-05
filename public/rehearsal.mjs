// Isolated rehearsal. Uses the exact Battle class from the server, but never writes to it.
export function createRehearsal({ Battle, initial, onState, onEvent, now = Date.now }) {
  let engine, state, wonAt = 0, serial = 0;
  function reset() {
    engine = new Battle(); wonAt = 0;
    state = { ...initial, rehearsal: true, battleId: 'rehearsal-' + (++serial),
      hp: { yellow: 1200, blue: 1200 }, maxHp: 1200, units: { yellow: 0, blue: 0 },
      points: { yellow: 0, blue: 0 }, leaderboard: { yellow: [], blue: [] },
      winner: null, status: 'playing', energy: 0, powerUntil: 0, nextReinforcements: 0,
      news: 'ENSAIO: só este aparelho. Nenhuma doação real é enviada.' };
    onEvent('reset', {}); publish();
  }
  function publish() { onState({ ...state, combat: engine.snapshot() }); }
  function gift(fixture, count = fixture.count) {
    if (state.winner) reset();
    engine.summon(fixture.team, count, { id: fixture.name, name: fixture.name });
    state.units[fixture.team] += count; state.points[fixture.team] += count * 8;
    const previous = state.leaderboard[fixture.team].find(p => p.name === fixture.name);
    if (previous) previous.points += count * 8;
    else state.leaderboard[fixture.team].push({ name: fixture.name, points: count * 8 });
    state.leaderboard[fixture.team].sort((a,b) => b.points - a.points);
    state.news = 'ENSAIO: ' + fixture.name + ' enviou ' + fixture.gift + ' · +' + count + ' combatentes';
    onEvent('attack', { ...fixture, count });
    onEvent('announcement', { ...fixture, count, rehearsal: true }); publish();
  }
  function likes() {
    state.energy += 30; onEvent('likes', {});
    if (state.energy >= 100) { state.energy = 0; state.powerUntil = now() + 20000; onEvent('power', {}); }
    publish();
  }
  function tick() {
    if (state.winner) { if (now() - wonAt >= 10000) reset(); return; }
    const { winner } = engine.step(state.hp, state.powerUntil > now());
    if (winner) { state.winner = winner; state.status = 'finished'; wonAt = now(); onEvent('win', { winner }); }
    publish();
  }
  function victory() {
    reset(); state.hp.blue = 8;
    engine.summon('yellow', 3, { name: 'Ensaio' }); state.units.yellow = 3;
    state.news = 'ENSAIO DE VITÓRIA: torre azul reduzida a 8 HP somente neste aparelho.'; publish();
  }
  reset();
  return { gift, likes, tick, reset, victory, comment(data) { onEvent('announcement', { ...data, rehearsal: true }); } };
}
