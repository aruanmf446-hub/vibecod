/* Shared visual roster. Authoritative combat is supplied by the server. */
(() => {
  "use strict";
  const entries = [
    ["giant_green", "yellow", "Gigante verde", "impact", "#b2e873", 1.16],
    ["thunder_warrior", "yellow", "Guerreiro do trovão", "lightning", "#98eaff", 1],
    ["tech_armor", "yellow", "Herói tecnológico", "thruster", "#8cecff", 1],
    ["web_hero", "yellow", "Herói aracnídeo", "web", "#e4f7ff", .96],
    ["cosmic_warrior", "yellow", "Guerreira cósmica", "cosmic", "#ffe78b", 1],
    ["shield_soldier", "yellow", "Soldado defensor", "shield", "#d9efff", 1],
    ["electric_spy", "yellow", "Espiã elétrica", "electric", "#8ceaff", .98],
    ["size_scientist", "yellow", "Cientista miniaturizador", "scale", "#98e9ff", .92],
    ["blue_beast", "blue", "Mutante bestial azul", "claw", "#9edbff", 1.16],
    ["optic_soldier", "blue", "Soldado de visor óptico", "optic", "#ff7287", 1],
    ["telekinetic_woman", "blue", "Telecinética", "telekinesis", "#ff94ce", 1],
    ["claw_warrior", "blue", "Guerreiro regenerador", "claw", "#e3f4ff", .96],
    ["storm_woman", "blue", "Controladora das tempestades", "storm", "#b3efff", 1.02],
    ["energy_absorber", "blue", "Guerreira absorvedora", "absorb", "#bcff85", 1]
  ];
  const definitions = Object.freeze(entries.map(([id, team, name, effect, accent, scale]) => Object.freeze({
    id, team, name, asset: `/assets/characters/${id}.svg`,
    animations: Object.freeze(["idle", "move", "attack", "defeat"]),
    effects: Object.freeze([effect]), accent, scale
  })));
  const teams = Object.freeze(Object.fromEntries(["yellow", "blue"].map(team => [
    team, Object.freeze(definitions.filter(character => character.team === team))
  ])));
  const images = new Map();
  const ready = Promise.all(definitions.map(character => new Promise(resolve => {
    const image = new Image();
    image.onload = () => { images.set(character.id, image); resolve(true); };
    image.onerror = () => { console.error(`Não foi possível carregar ${character.asset}`); resolve(false); };
    image.src = character.asset;
  })));
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  function effect(ctx, character, time, attacking) {
    const kind = character.effects[0];
    ctx.strokeStyle = character.accent;
    ctx.fillStyle = character.accent;
    ctx.lineWidth = 1.1;
    ctx.globalAlpha = attacking ? .9 : .5;
    ctx.beginPath();
    if (kind === "lightning" || kind === "electric" || kind === "storm") {
      const x = kind === "lightning" ? 19 : 16;
      ctx.moveTo(x, -33); ctx.lineTo(x + 4, -27); ctx.lineTo(x - 2, -26); ctx.lineTo(x + 3, -20);
      if (kind === "storm") { ctx.ellipse(0, -2, 19, 4, -.16, 0, Math.PI * 1.6); }
    } else if (kind === "cosmic" || kind === "telekinesis" || kind === "absorb") {
      for (const x of [-17, 17]) { ctx.moveTo(x + 4, -17); ctx.arc(x, -17, 3.6 + Math.sin(time) * .7, 0, Math.PI * 2); }
      if (kind === "telekinesis") {
        const x = Math.cos(time) * 21, y = -27 + Math.sin(time) * 9;
        ctx.moveTo(x, y - 2); ctx.lineTo(x + 2, y); ctx.lineTo(x, y + 2); ctx.lineTo(x - 2, y); ctx.closePath();
      }
    } else if (kind === "thruster") {
      for (const x of [-7, 7]) {
        ctx.moveTo(x - 2, -3); ctx.lineTo(x, 4 + Math.sin(time * 2) * 2); ctx.lineTo(x + 2, -3);
      }
    } else if (kind === "scale") {
      ctx.setLineDash([2, 4]); ctx.ellipse(0, -18, 19, 22, 0, time, time + Math.PI); ctx.setLineDash([]);
    } else if (kind === "shield") {
      ctx.moveTo(8, -23); ctx.lineTo(18, -29);
    }
    ctx.stroke();
    if (!attacking) return;
    ctx.globalAlpha = .8;
    ctx.beginPath();
    if (kind === "optic") {
      ctx.moveTo(7, -34); ctx.lineTo(28, -34); ctx.stroke();
      ctx.strokeStyle = "#fff4ec"; ctx.lineWidth = .5;
    } else if (kind === "web") {
      ctx.moveTo(16, -24); ctx.lineTo(28, -31); ctx.lineTo(23, -21); ctx.closePath();
      ctx.moveTo(16, -24); ctx.lineTo(28, -25);
    } else if (kind === "claw") {
      for (let i = 0; i < 3; i++) { ctx.moveTo(12 + i * 3, -23); ctx.quadraticCurveTo(23 + i * 2, -19, 19 + i * 3, -10); }
    } else if (kind === "impact") {
      for (let i = 0; i < 3; i++) { ctx.moveTo(21, -16); ctx.lineTo(25 + i * 2, -23 + i * 6); }
    } else {
      ctx.arc(18, -20, 7, -1.5, 1.5);
    }
    ctx.stroke();
  }

  function draw(ctx, sprite, tick, winner) {
    const character = sprite.appearance, image = images.get(character.id);
    if (!image) return;
    const time = reducedMotion.matches ? 0 : tick * .12 + sprite.phase;
    const attacking = sprite.action === "attack" && sprite.attackUntil > sprite.combatTime;
    const hurt = sprite.hurtUntil > sprite.combatTime;
    const defeated = sprite.defeated || (winner && winner !== sprite.team);
    const scalePulse = !reducedMotion.matches && character.effects[0] === "scale" ? 1 + Math.sin(time * .7) * .045 : 1;
    const bob = reducedMotion.matches ? 0 : Math.sin(time) * (sprite.idle ? .65 : 1.5);
    ctx.save();
    // Idle units have presentation slots beside the towers, avoiding the old pile-up.
    // Only the drawing anchor changes: sprite.x/y and all moving paths stay untouched.
    const slot = (sprite.visualSlot || 0) % 8;
    const drawX = sprite.idle ? (sprite.team === "yellow" ? 173 + (slot % 2) * 55 : 367 - (slot % 2) * 55) : sprite.x;
    const drawY = sprite.idle ? 287 + Math.floor(slot / 2) * 62 : sprite.y;
    ctx.translate(drawX, drawY);
    ctx.fillStyle = "#03091466";
    ctx.beginPath(); ctx.ellipse(0, 1, 12 * character.scale, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(0, bob);
    if (sprite.team === "blue") ctx.scale(-1, 1);
    if (defeated) { ctx.globalAlpha = .45 * (1 - (sprite.deathProgress || 0)); ctx.rotate(.18 + (sprite.deathProgress || 0) * .6); }
    else if (hurt) { ctx.globalAlpha = .6; ctx.translate(-2, 0); }
    else if (!reducedMotion.matches) ctx.rotate(attacking ? Math.sin(time * 2) * .09 : Math.sin(time) * (sprite.idle ? .012 : .035));
    ctx.scale(character.scale * scalePulse, character.scale * scalePulse);
    // Feet are anchored at y=0. Oversized units retain their existing logical position.
    ctx.drawImage(image, -28, -54, 56, 63);
    if (!defeated && !reducedMotion.matches) effect(ctx, character, time, attacking);
    ctx.restore();
    if (!defeated && sprite.maxHp) {
      ctx.save(); ctx.translate(drawX, drawY - 61 * character.scale);
      ctx.fillStyle = "#050d20"; ctx.fillRect(-15, -1, 30, 5);
      ctx.fillStyle = sprite.team === "yellow" ? "#ffe084" : "#90ddff";
      ctx.fillRect(-14, 0, 28 * Math.max(0, sprite.hp / sprite.maxHp), 3);
      ctx.restore();
    }
  }
  window.BattleCharacters = Object.freeze({ definitions, teams, ready, draw });
})();
