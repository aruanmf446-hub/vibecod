(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const app = $("app"), canvas = $("battle"), ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const socket = io();
  const characters = window.BattleCharacters;
  const appearanceIndex = { yellow: 0, blue: 0 };
  let state = null;
  let sprites = [], particles = [], rings = [];
  let tick = 0;
  const colors = { yellow: ["#ffb323", "#ffe084", "#c57322"], blue: ["#256cdb", "#90ddff", "#154a9f"] };
  function number(value) { return Math.round(Number(value) || 0).toLocaleString("pt-BR"); }
  function update(stateArg) {
    state = stateArg;
    $("yellowHpText").textContent = number(state.hp.yellow);
    $("blueHpText").textContent = number(state.hp.blue);
    $("yellowHp").style.width = (100 * state.hp.yellow / state.maxHp) + "%";
    $("blueHp").style.width = (100 * state.hp.blue / state.maxHp) + "%";
    $("yellowPoints").textContent = number(state.points.yellow) + " PTS";
    $("bluePoints").textContent = number(state.points.blue) + " PTS";
    $("roundNo").textContent = "RODADA " + String(state.round).padStart(2, "0");
    const minutes = Math.floor(state.seconds / 60), seconds = state.seconds % 60;
    $("clock").textContent = String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
    $("energyFill").style.width = state.energy + "%";
    $("energyText").textContent = Math.floor(state.energy) + "%";
    $("energyFlag").textContent = state.connected ? "🔴 AO VIVO" : "FANMADE";
    $("liveStatus").textContent = state.connected ? "TIKTOK CONECTADO" : (state.configured ? "AGUARDANDO LIVE" : "MODO TESTE");
    document.querySelector(".live-dot").classList.toggle("connected", state.connected);
    $("viewerCount").textContent = state.viewers ? "👥 " + number(state.viewers) : "⚡ BATALHA INTERATIVA";
    const powered = Date.now() < state.powerUntil;
    app.classList.toggle("power-active", powered);
    $("powerStatus").textContent = powered ? "⚡ PODER ATIVADO" : "⚔️ BATALHA EM ANDAMENTO";
    for (const team of ["yellow", "blue"]) {
      const list = $(team + "Rank");
      list.replaceChildren();
      const entries = state.leaderboard?.[team] || [];
      if (!entries.length) { const li = document.createElement("li"); li.textContent = "Aguardando jogadores..."; list.append(li); }
      for (const user of entries) {
        const li = document.createElement("li");
        li.textContent = user.name + " • " + number(user.points);
        list.append(li);
      }
    }
    if (state.news) $("toast").textContent = state.news;
    if (state.winner) {
      $("winBanner").hidden = false;
      $("winBanner").textContent = "🏆 " + (state.winner === "yellow" ? "VINGADORES" : "X-MEN") + " VENCERAM!";
      $("winBanner").classList.toggle("blue-winner", state.winner === "blue");
    } else $("winBanner").hidden = true;
  }
  socket.on("init", data => {
    $("demoPanel").hidden = !data.demo;
    update(data);
    for (let i = 0; i < 7; i++) { spawn("yellow", true); spawn("blue", true); }
  });
  socket.on("state", update);
  socket.on("attack", data => {
    for (let i = 0; i < Math.min(16, data.count); i++) {
      setTimeout(() => spawn(data.team, false), i * 80);
    }
    rings.push({ x: data.team === "yellow" ? 431 : 109, y: 372, life: 35,
      color: data.team === "yellow" ? "#fbd871" : "#7fd7ff" });
  });
  socket.on("likes", () => { for (let i = 0; i < 8; i++) spark(270, 220, "#c7d5ff"); });
  socket.on("power", () => { for (let i = 0; i < 35; i++) spark(270, 330, "#ffed94"); });
  socket.on("win", () => { for (let i = 0; i < 90; i++) spark(Math.random() * W, Math.random() * 200 + 50, i % 2 ? "#f9c952" : "#7fbaff"); });
  socket.on("reset", () => { sprites = []; particles = []; rings = []; for (let i = 0; i < 6; i++) { spawn("yellow", true); spawn("blue", true); } });
  document.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const res = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: button.dataset.action }) });
        if (!res.ok) throw new Error("Falha na simulação");
      } catch { $("toast").textContent = "Não foi possível executar o teste."; }
      finally { button.disabled = false; }
    });
  });
  function rnd(min, max) { return min + Math.random() * (max - min); }
  function spawn(team, idle) {
    const roster = characters.teams[team];
    const visualSlot = appearanceIndex[team]++;
    const appearance = roster[visualSlot % roster.length];
    sprites.push({ team, appearance, visualSlot,
      x: team === "yellow" ? rnd(64, 135) : rnd(405, 475),
      y: rnd(425, 478), start: performance.now(), idle, phase: rnd(0, Math.PI * 2),
      speed: rnd(1.5, 2.6), ttl: idle ? 999999 : 220 + rnd(0, 80) });
    if (sprites.length > 110) sprites.splice(0, sprites.length - 110);
  }
  function spark(x, y, color) {
    particles.push({ x, y, vx: rnd(-4, 4), vy: rnd(-6, 0), life: rnd(19, 50), max: 50, color });
    if (particles.length > 200) particles.shift();
  }
  function star(x, y, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x + size * .25, y - size * .25);
    ctx.lineTo(x + size, y); ctx.lineTo(x + size * .25, y + size * .25);
    ctx.lineTo(x, y + size); ctx.lineTo(x - size * .25, y + size * .25);
    ctx.lineTo(x - size, y); ctx.lineTo(x - size * .25, y - size * .25); ctx.closePath(); ctx.fill();
  }
  function hill(color, y, rise) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, y + Math.sin(x * .017 + rise) * 22 + Math.cos(x * .031 + rise) * 12);
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
  function sky() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#121d39"); grad.addColorStop(.55, "#213b6b"); grad.addColorStop(1, "#111a34");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    const sun = ctx.createRadialGradient(270, 235, 3, 270, 235, 240);
    sun.addColorStop(0, "#c4d1fa26"); sun.addColorStop(1, "#617cc400");
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, 520);
    for (let i = 0; i < 42; i++) {
      const x = ((i * 1237) % 517) + 10, y = ((i * 139) % 260) + 25;
      ctx.globalAlpha = .3 + .3 * Math.sin(tick * .022 + i * 13);
      star(x, y, 1.8, "#daeaff");
    }
    ctx.globalAlpha = 1;
    hill("#172b4f", 370, 0.4); hill("#132444", 403, 1.2);
    ctx.fillStyle = "#172541"; ctx.fillRect(0, 471, W, 179);
    ctx.fillStyle = "#263b5b"; ctx.fillRect(0, 470, W, 5);
    for (let i = 0; i < 35; i++) {
      const x = i * 17;
      ctx.fillStyle = i % 3 ? "#293c5a" : "#203250";
      ctx.fillRect(x, 505 + (i % 5) * 7, 11, 3);
    }
    ctx.strokeStyle = "#6385b51c"; ctx.lineWidth = 2;
    for (let x = -200; x < 800; x += 80) { ctx.beginPath(); ctx.moveTo(270, 476); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 492; y < H; y += (y - 457) * .19) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }
  function tower(team) {
    const left = team === "yellow"; const x = left ? 56 : 416;
    const pal = colors[team], hp = state ? state.hp[team] / state.maxHp : 1;
    ctx.save();
    ctx.shadowColor = pal[0]; ctx.shadowBlur = 28;
    ctx.fillStyle = pal[2]; ctx.fillRect(x + 8, 274, 59, 195);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#111b34"; ctx.fillRect(x + 18, 311, 39, 161);
    ctx.fillStyle = pal[0]; ctx.fillRect(x + 4, 309, 67, 18);
    ctx.fillStyle = pal[2];
    ctx.fillRect(x, 263, 18, 47); ctx.fillRect(x + 23, 259, 18, 51); ctx.fillRect(x + 48, 263, 23, 47);
    ctx.fillStyle = pal[1]; ctx.fillRect(x + 7, 269, 12, 5); ctx.fillRect(x + 28, 265, 12, 5); ctx.fillRect(x + 53, 268, 12, 5);
    ctx.fillStyle = pal[0]; ctx.fillRect(x - 13, 449, 95, 28);
    ctx.fillStyle = "#07142b"; ctx.beginPath(); ctx.roundRect(x + 20, 385, 35, 67, [19, 19, 0, 0]); ctx.fill();
    ctx.fillStyle = pal[0]; ctx.fillRect(x + 21, 342, 31, 22);
    ctx.fillStyle = "#d5edff"; ctx.fillRect(x + 31, 347, 11, 11);
    ctx.fillStyle = pal[0]; ctx.fillRect(x + 24, 202, 30, 60);
    ctx.fillStyle = pal[1]; ctx.fillRect(x + 34, 208, 10, 28);
    ctx.beginPath(); ctx.moveTo(x + 39, 164); ctx.lineTo(x + 10, 201); ctx.lineTo(x + 68, 201); ctx.closePath(); ctx.fillStyle = pal[0]; ctx.fill();
    ctx.fillStyle = "#eaf4ff"; star(x + 39, 219, 8, "#eaf4ff");
    ctx.fillStyle = "#f2f5ff"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(left ? "VINGADORES" : "X-MEN", x + 39, 494);
    if (hp < .7) {
      ctx.strokeStyle = "#0b1727"; ctx.lineWidth = 3; ctx.beginPath();
      ctx.moveTo(x + 26, 352); ctx.lineTo(x + 43, 375); ctx.lineTo(x + 28, 399);
      if (hp < .35) ctx.lineTo(x + 52, 425); ctx.stroke();
    }
    if (hp < .3) for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = .17 + .13 * Math.sin(tick * .06 + i);
      ctx.fillStyle = "#ddd"; ctx.beginPath(); ctx.arc(x + 12 + i * 11, 250 - ((tick * .7 + i * 23) % 85), 12 + i * 2, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  function hero(sprite) {
    const left = sprite.team === "yellow", p = colors[sprite.team];
    if (!sprite.idle) {
      sprite.x += left ? sprite.speed : -sprite.speed;
      sprite.ttl--;
      if (sprite.ttl <= 0 || (left ? sprite.x > 412 : sprite.x < 129)) {
        for (let k = 0; k < 4; k++) spark(sprite.x, sprite.y - 15, p[1]);
        return false;
      }
    }
    characters.draw(ctx, sprite, tick, state?.winner);
    return true;
  }

  function frame() {
    requestAnimationFrame(frame); tick++;
    sky();
    // Raio central decorativo, separação de campo.
    ctx.save(); ctx.strokeStyle = "#bdd4ff25"; ctx.setLineDash([8, 15]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(270, 145); ctx.lineTo(270, 470); ctx.stroke(); ctx.restore();
    tower("yellow"); tower("blue");
    sprites = sprites.filter(hero);
    for (const ring of rings) {
      ring.life--;
      ctx.strokeStyle = ring.color; ctx.globalAlpha = ring.life / 35;
      ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ring.x, ring.y, 55 - ring.life, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1; rings = rings.filter(r => r.life > 0);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.vy += .15; p.life--;
      ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 4, 4);
    }
    ctx.globalAlpha = 1; particles = particles.filter(p => p.life > 0);
  }
  requestAnimationFrame(frame);
})();
