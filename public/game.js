(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const app = $("app"), canvas = $("battle"), ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const socket = io();
  const characters = window.BattleCharacters;
  let state = null;
  let sprites = new Map(), fallen = [], particles = [], rings = [];
  let sceneId = null, lastFrame = performance.now();
  let tick = 0;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)") || { matches: false };
  const particlePool = [];
  const damageLabels = [];
  const towerHit = { yellow: 0, blue: 0 };
  let giftUntil = 0, victoryAt = 0, confettiAt = 0;
  const announcementQueue = [];
  let nextAnnouncementAt = 0;
  function resizeCanvas() {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    if (!canvas.getBoundingClientRect) return;
    const bounds = canvas.getBoundingClientRect();
    canvas.width = Math.round(bounds.width * ratio);
    canvas.height = Math.round(bounds.height * ratio);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }
  window.addEventListener?.("resize", resizeCanvas);
  resizeCanvas();
  const colors = { yellow: ["#ffb323", "#ffe084", "#c57322"], blue: ["#256cdb", "#90ddff", "#154a9f"] };
  // Small original Web Audio cues. Nothing starts before an explicit tap.
  const sound = (() => {
    let context = null, master = null, enabled = false;
    const voices = new Set(), last = Object.create(null);
    const button = $("soundToggle");
    const cues = {
      gift: [[660, 0, .12], [990, .1, .2]],
      hit: [[140, 0, .055]], tower: [[80, 0, .15]],
      defeat: [[220, 0, .09], [110, .07, .12]],
      likes: [[520, 0, .09]],
      power: [[330, 0, .12], [440, .1, .12], [660, .2, .25]],
      win: [[392, 0, .16], [494, .15, .16], [587, .3, .16], [784, .45, .45]],
      draw: [[440, 0, .2], [330, .2, .3]],
      reset: [[440, 0, .1], [660, .12, .16]]
    };
    function label() {
      const running = enabled && context?.state === "running";
      button.textContent = running ? "Silenciar" : "Ativar som";
      button.setAttribute?.("aria-pressed", String(Boolean(running)));
    }
    function stop() {
      for (const oscillator of voices) { try { oscillator.stop(); } catch {} }
      voices.clear();
    }
    async function toggle() {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) { button.textContent = "Áudio indisponível"; button.disabled = true; return; }
      try {
        if (!context) {
          context = new Audio(); master = context.createGain();
          master.gain.value = .3; master.connect(context.destination);
          context.onstatechange = label;
        }
        if (enabled && context.state === "running") {
          enabled = false; stop(); master.gain.value = 0;
        } else {
          await context.resume(); enabled = context.state === "running";
          master.gain.value = enabled ? .3 : 0;
          if (enabled) play("reset");
        }
        label();
      } catch { enabled = false; label(); }
    }
    function play(kind) {
      if (!enabled || context?.state !== "running" || document.hidden) return;
      const now = performance.now(), cooldown = kind === "likes" ? 1000 : kind === "hit" ? 180 : 300;
      if (last[kind] !== undefined && now - last[kind] < cooldown) return;
      last[kind] = now;
      for (const [frequency, delay, duration] of cues[kind] || []) {
        if (voices.size >= 12) break;
        const oscillator = context.createOscillator(), envelope = context.createGain();
        const start = context.currentTime + delay, end = start + duration;
        oscillator.type = kind === "hit" || kind === "tower" ? "sine" : "triangle";
        oscillator.frequency.setValueAtTime(frequency, start);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * (kind === "hit" || kind === "tower" ? .45 : .98), end);
        envelope.gain.setValueAtTime(0, start);
        envelope.gain.linearRampToValueAtTime(.16, start + .008);
        envelope.gain.exponentialRampToValueAtTime(.001, end);
        oscillator.connect(envelope); envelope.connect(master); voices.add(oscillator);
        oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
        oscillator.start(start); oscillator.stop(end + .015);
      }
    }
    button.addEventListener("click", toggle);
    document.addEventListener?.("visibilitychange", () => {
      if (document.hidden && context) { enabled = false; stop(); master.gain.value = 0; label(); }
    });
    return { play, duck(active) { if (master) master.gain.value = enabled ? (active ? .08 : .3) : 0; } };
  })();
  let voiceEnabled = false, voiceStarting = false, voiceAudio = null;
  const voiceButton = $("voiceToggle");
  function stopVoice() {
    voiceEnabled = false; voiceAudio?.pause(); sound.duck(false);
    voiceButton.textContent = state?.narrationAvailable ? "Ativar voz" : "Voz não configurada";
    voiceButton.setAttribute?.("aria-pressed", "false");
  }
  voiceButton.addEventListener("click", async () => {
    if (voiceStarting) return;
    if (voiceEnabled) { stopVoice(); return; }
    if (!state?.narrationAvailable || !window.Audio) return;
    voiceStarting = true; voiceButton.disabled = true; voiceButton.textContent = "Preparando voz…";
    try {
      if (!voiceAudio) {
        voiceAudio = new window.Audio(); voiceAudio.volume = .85;
        voiceAudio.onplaying = () => sound.duck(true);
        voiceAudio.onended = () => sound.duck(false);
        voiceAudio.onerror = stopVoice;
      }
      // Unlock this exact media element with a real user gesture (required by iOS).
      voiceAudio.src = "/api/narration/sample";
      await voiceAudio.play();
      if (document.hidden) { stopVoice(); return; }
      voiceEnabled = true; voiceButton.textContent = "Silenciar voz";
      voiceButton.setAttribute?.("aria-pressed", "true");
    } catch { stopVoice(); }
    finally { voiceStarting = false; voiceButton.disabled = !state?.narrationAvailable; }
  });
  document.addEventListener?.("visibilitychange", () => { if (document.hidden) stopVoice(); });
  function number(value) { return Math.round(Number(value) || 0).toLocaleString("pt-BR"); }
  function update(stateArg) {
    if (state && state.battleId === stateArg.battleId) {
      for (const team of ["yellow", "blue"]) if (stateArg.hp[team] < state.hp[team]) { towerHit[team] = performance.now(); sound.play("tower"); }
    }
    if (stateArg.winner && !state?.winner) victoryAt = performance.now();
    if (!stateArg.winner) victoryAt = 0;
    state = stateArg;
    voiceButton.disabled = !state.narrationAvailable || voiceStarting;
    if (!voiceEnabled && !voiceStarting) voiceButton.textContent = state.narrationAvailable ? "Ativar voz" : "Voz não configurada";
    syncCombat(stateArg);
    $("yellowHpText").textContent = number(state.hp.yellow);
    $("blueHpText").textContent = number(state.hp.blue);
    $("yellowHp").style.width = (100 * state.hp.yellow / state.maxHp) + "%";
    $("blueHp").style.width = (100 * state.hp.blue / state.maxHp) + "%";
    $("yellowPoints").textContent = number(state.points.yellow) + " PTS";
    $("bluePoints").textContent = number(state.points.blue) + " PTS";
    const active = state.combat?.active || { yellow: 0, blue: 0 };
    const queued = state.combat?.queued || { yellow: 0, blue: 0 };
    $("roundNo").textContent = active.yellow + " × " + active.blue + " EM CAMPO";
    $("clock").textContent = "SEM LIMITE";
    $("combatQueue").textContent = "REFORÇOS NA FILA · AMARELO " + queued.yellow + " · AZUL " + queued.blue +
      (state.nextReinforcements ? " · PRÓXIMA BATALHA +" + state.nextReinforcements : "");
    $("energyFill").style.width = state.energy + "%";
    $("energyText").textContent = Math.floor(state.energy) + "%";
    $("energyFlag").textContent = state.connected ? "🔴 AO VIVO" : "FANMADE";
    $("liveStatus").textContent = state.connected ? "TIKTOK CONECTADO" : (state.configured ? "AGUARDANDO LIVE" : "MODO TESTE");
    document.querySelector(".live-dot").classList.toggle("connected", state.connected);
    $("viewerCount").textContent = state.viewers ? "👥 " + number(state.viewers) : "⚡ BATALHA INTERATIVA";
    const powered = Date.now() < state.powerUntil;
    app.classList.toggle("power-active", powered);
    app.classList.toggle("energy-near", state.energy >= 80);
    $("powerStatus").textContent = state.winner ? "BATALHA ENCERRADA" : powered ? "⚡ PODER ATIVADO" : "⚔️ DUELOS AUTOMÁTICOS";
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
      $("winBanner").textContent = state.winner === "draw" ? "⚔️ EMPATE!" : "🏆 " + (state.winner === "yellow" ? "VINGADORES" : "X-MEN") + " VENCERAM!";
      $("winBanner").classList.toggle("blue-winner", state.winner === "blue");
    } else $("winBanner").hidden = true;
  }
  socket.on("init", data => {
    $("demoPanel").hidden = !data.demo;
    update(data);
  });
  socket.on("state", update);
  socket.on("announcement", data => {
    if (data.team !== "yellow" && data.team !== "blue") return;
    if (data.kind === "comment" && !$("readComments").checked) return;
    if (announcementQueue.length >= 8) {
      const index = announcementQueue.findIndex(item => item.kind === "comment");
      if (index >= 0) announcementQueue.splice(index, 1);
      else if (data.kind === "comment") return;
      else announcementQueue.shift();
    }
    announcementQueue.push(data);
  });
  socket.on("attack", data => {
    if (data.kind === "gift") sound.play("gift");
    if (reducedMotion.matches) return;
    rings.push({ x: data.team === "yellow" ? 151 : 389, y: 398, life: 35,
      color: data.team === "yellow" ? "#fbd871" : "#7fd7ff" });
    if (rings.length > 20) rings.shift();
  });
  socket.on("likes", () => { sound.play("likes"); for (let i = 0; i < 8; i++) spark(270, 220, "#c7d5ff"); });
  socket.on("power", () => { sound.play("power"); for (let i = 0; i < 35; i++) spark(270, 330, "#ffed94"); });
  socket.on("win", data => { sound.play(data.winner === "draw" ? "draw" : "win"); for (let i = 0; i < 90; i++) spark(Math.random() * W, Math.random() * 200 + 50, i % 2 ? "#f9c952" : "#7fbaff"); });
  socket.on("reset", () => { sound.play("reset"); sprites.clear(); fallen = []; particlePool.push(...particles); particles = []; rings = []; damageLabels.length = 0; sceneId = null; $("giftNotice").hidden = true; });
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
  function syncCombat(data) {
    const now = performance.now();
    if (sceneId !== data.battleId) { sprites.clear(); fallen = []; sceneId = data.battleId; }
    const present = new Set();
    for (const unit of data.combat?.fighters || []) {
      present.add(unit.id);
      const appearance = characters.teams[unit.team][unit.appearance % characters.teams[unit.team].length];
      const previous = sprites.get(unit.id);
      if (previous && unit.hp < previous.hp) sound.play("hit");
      if (previous && unit.hp < previous.hp && !reducedMotion.matches) {
        if (damageLabels.length < 24) damageLabels.push({ x: unit.x, y: unit.y - 58, value: previous.hp - unit.hp, until: now + 650 });
        for (let k = 0; k < 2; k++) spark(unit.x, unit.y - 20, appearance.accent);
      }
      sprites.set(unit.id, { ...unit, appearance, idle: false, phase: unit.id * 1.37,
        x: previous ? previous.x : unit.x, targetX: unit.x,
        receivedAt: now, serverTime: data.combat.time });
    }
    for (const [id, unit] of sprites) if (!present.has(id)) {
      sound.play("defeat");
      fallen.push({ ...unit, defeated: true, deathAt: now });
      for (let k = 0; k < 3; k++) spark(unit.x, unit.y - 20, unit.appearance.accent);
      sprites.delete(id);
    }
    if (fallen.length > 24) fallen.splice(0, fallen.length - 24);
  }
  function spark(x, y, color) {
    if (reducedMotion.matches || particles.length >= 120) return;
    const p = particlePool.pop() || {};
    Object.assign(p, { x, y, vx: rnd(-3, 3), vy: rnd(-5, 0), life: rnd(19, 50), max: 50, color });
    particles.push(p);
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
  const arenaArtwork = window.Image ? new window.Image() : null;
  if (arenaArtwork) arenaArtwork.src = "/assets/arena/garden.svg";
  function sky() {
    if (sky.cache) { ctx.drawImage(sky.cache, 0, 0, W, H); return; }
    if (!arenaArtwork?.complete || !arenaArtwork.naturalWidth) {
      ctx.fillStyle = "#356338"; ctx.fillRect(0, 0, W, H); return;
    }
    ctx.drawImage(arenaArtwork, 0, 0, W, H);
    sky.cache = document.createElement("canvas");
    sky.cache.width = W * 2; sky.cache.height = H * 2;
    sky.cache.getContext("2d").drawImage(arenaArtwork, 0, 0, W * 2, H * 2);
  }
  function tower(team) {
    const left = team === "yellow"; const x = left ? 56 : 416;
    const pal = colors[team], hp = state ? state.hp[team] / state.maxHp : 1;
    ctx.save();
    const hitAge = performance.now() - towerHit[team];
    if (towerHit[team] && hitAge < 220 && !reducedMotion.matches) ctx.translate(Math.sin(hitAge * .1) * 2, 0);
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
  function hero(sprite, now, delta) {
    sprite.x += (sprite.targetX - sprite.x) * (1 - Math.exp(-delta / 55));
    sprite.combatTime = sprite.serverTime + Math.min(100, now - sprite.receivedAt);
    if (sprite.deathAt !== undefined) sprite.deathProgress = Math.min(1, (now - sprite.deathAt) / 600);
    characters.draw(ctx, sprite, tick, state?.winner);
  }

  function frame(now) {
    requestAnimationFrame(frame); tick++;
    const delta = Math.min(100, Math.max(0, now - lastFrame)); lastFrame = now;
    if (reducedMotion.matches) { tick = 0; particlePool.push(...particles); particles.length = 0; rings.length = 0; damageLabels.length = 0; }
    if (now >= nextAnnouncementAt && announcementQueue.length) {
      const data = announcementQueue.shift();
      if (data.kind !== "comment" || $("readComments").checked) {
        $("announcerPortrait").src = "/assets/announcers/" + data.team + ".png";
        $("announcerName").textContent = data.name;
        $("announcerMessage").textContent = data.speech;
        $("announcerDetail").textContent = data.kind === "gift" ? "+" + data.count + " reforços · " + data.gift : "COMENTÁRIO DA LIVE";
        $("giftNotice").classList.toggle("blue", data.team === "blue");
        const duration = voiceEnabled && data.audioUrl ? Math.max(5000, Math.min(30000, data.audioDuration * 1000 + 500)) : 5000;
        giftUntil = now + duration; nextAnnouncementAt = now + duration + 500;
        if (voiceEnabled && voiceAudio && /^\/api\/narration\/[a-f0-9-]{36}$/.test(data.audioUrl || "")) {
          voiceAudio.src = data.audioUrl;
          void voiceAudio.play().catch(stopVoice);
        }
      }
    }
    $("giftNotice").hidden = now > giftUntil;
    const countdown = $("victoryCountdown");
    countdown.hidden = !state?.winner;
    if (state?.winner) {
      countdown.textContent = state.autoRestart ? "Próxima batalha em " + Math.max(0, 10 - Math.floor((now - victoryAt) / 1000)) + "s" : "Aguardando reinício";
      if (now - confettiAt > 180 && now - victoryAt < 10000) {
        confettiAt = now;
        for (let i = 0; i < 5; i++) spark(rnd(20, W - 20), rnd(80, 220), state.winner === "yellow" ? "#ffe084" : state.winner === "blue" ? "#90ddff" : i % 2 ? "#ffe084" : "#90ddff");
      }
    }
    sky();
    // Raio central decorativo, separação de campo.
    ctx.save(); ctx.strokeStyle = "#d5edb212"; ctx.setLineDash([8, 15]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(270, 145); ctx.lineTo(270, 470); ctx.stroke(); ctx.restore();
    tower("yellow"); tower("blue");
    for (const sprite of sprites.values()) hero(sprite, now, delta);
    for (let i = fallen.length - 1; i >= 0; i--) if (now - fallen[i].deathAt >= 600) fallen.splice(i, 1);
    for (const sprite of fallen) hero(sprite, now, delta);
    for (const ring of rings) {
      ring.life--;
      ctx.strokeStyle = ring.color; ctx.globalAlpha = ring.life / 35;
      ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ring.x, ring.y, 55 - ring.life, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (let i = rings.length - 1; i >= 0; i--) if (rings[i].life <= 0) rings.splice(i, 1);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.vy += .15; p.life--;
      ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 4, 4);
    }
    ctx.globalAlpha = 1;
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particlePool.push(...particles.splice(i, 1));
    ctx.font = "bold 13px system-ui"; ctx.textAlign = "center";
    for (let i = damageLabels.length - 1; i >= 0; i--) {
      const label = damageLabels[i], remaining = label.until - now;
      if (remaining <= 0 || reducedMotion.matches) { damageLabels.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, remaining / 200);
      ctx.strokeStyle = "#061226"; ctx.lineWidth = 3; ctx.fillStyle = "#fff4d2";
      const y = label.y - (650 - remaining) * .02;
      ctx.strokeText("−" + label.value, label.x, y); ctx.fillText("−" + label.value, label.x, y);
    }
    ctx.globalAlpha = 1;
  }
  requestAnimationFrame(frame);
})();
