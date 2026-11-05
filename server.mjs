import "dotenv/config";
import { createPiperTts } from "./narration.mjs";
import { createAnnouncer, announcementFor } from "./announcer.mjs";
import { randomUUID } from "node:crypto";
import { Battle, COMBAT, reinforcementCount } from "./battle.mjs";
import { buildInfo } from "./version.mjs";
import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Server } from "socket.io";
import { TikTokLiveConnection } from "tiktok-live-connector";

const PORT = Math.max(1, Number(process.env.PORT) || 3000);
const USERNAME = String(process.env.TIKTOK_USERNAME || "").trim().replace(/^@/, "");
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const root = path.dirname(fileURLToPath(import.meta.url));
const narration = createPiperTts({ root, enabled: process.env.PIPER_ENABLED === "true" || (Boolean(process.env.RENDER) && process.env.PIPER_ENABLED !== "false"),
  python: process.env.PIPER_PYTHON || (process.env.RENDER ? path.join(root, ".piper/venv/bin/python") : "python3"),
  model: process.env.PIPER_MODEL || (process.env.RENDER ? path.join(root, ".piper/voices/pt_BR-faber-medium.onnx") : "/opt/piper/voices/pt_BR-faber-medium.onnx"),
  comments: process.env.PIPER_COMMENTS !== "false" });
process.once?.("exit", () => narration.close());
const announce = createAnnouncer({ emit: (event, data) => narration.publish(data, ready => io.emit(event, ready)),
  apiKey: process.env.GROQ_API_KEY || "", model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile" });
const rehearsalFixtures = Object.freeze({
  rose: announcementFor({ team: 'blue', kind: 'gift', name: 'Lucas', gift: 'Rosa', count: 1 }),
  flower: announcementFor({ team: 'yellow', kind: 'gift', name: 'Lucas', gift: 'Flor', count: 1 }),
  star: announcementFor({ team: 'blue', kind: 'gift', name: 'Júnior', gift: 'Estrela', count: 1 }),
  comment: announcementFor({ team: 'yellow', kind: 'comment', name: 'Maria', message: 'Vai, Vingadores! Vamos vencer essa batalha!' })
});
let lastSpokenComment = 0;
let connectionError = '';
const LIMIT = 1200;
const AUTO_RESTART = process.env.AUTO_RESTART !== "false";
const teamOf = new Map();
const chatCooldown = new Map();
const scores = { yellow: new Map(), blue: new Map() };
let currentConnection = null;
let retryTimer = null;
let lastTotalLikes = null;
let battle = new Battle();
let restartTimer = null;
let pendingReinforcements = [];
let match = freshMatch();
let lastNews = "A batalha vai começar!";
const build = buildInfo(root);
// Contadores apenas de eventos vindos da LIVE real (o simulador local não conta aqui).
const live = { gifts: 0, chats: 0, likes: 0, lastEventAt: null, lastGift: null, connectedAt: null };
function fromLive(kind, handler) {
  return raw => {
    live[kind] += 1; live.lastEventAt = new Date().toISOString();
    if (kind === "gifts") live.lastGift = { name: giftName(raw), diamonds: giftValue(raw), at: live.lastEventAt };
    handler(raw);
  };
}

function freshMatch() {
  return {
    battleId: randomUUID(), hp: { yellow: LIMIT, blue: LIMIT }, maxHp: LIMIT,
    points: { yellow: 0, blue: 0 }, units: { yellow: 0, blue: 0 },
    winner: null, status: "playing",
    energy: 0, powerUntil: 0, viewers: 0, connected: false,
    lastGift: "", lastUser: ""
  };
}
function publicState() {
  return {
    ...match, channel: USERNAME, connectionError, narrationComments: process.env.PIPER_COMMENTS !== "false", narrationAvailable: narration.enabled, combat: battle.snapshot(), autoRestart: AUTO_RESTART,
    nextReinforcements: pendingReinforcements.reduce((total, r) => total + reinforcementCount(r.value, r.kind), 0),
    news: lastNews, configured: Boolean(USERNAME),
    leaderboard: Object.fromEntries(["yellow", "blue"].map(team => [
      team, [...scores[team].values()].sort((a, b) => b.points - a.points).slice(0, 3)
    ]))
  };
}
function publish() { io.emit("state", publicState()); }
function cleanName(value) { return String(value || "Visitante").slice(0, 28); }
function actor(raw) {
  const user = raw?.user || raw || {};
  const id = String(user.uniqueId || user.userId || raw?.uniqueId || "anon");
  return { id, name: cleanName(user.nickname || user.uniqueId || raw?.nickname || "Visitante") };
}
function defaultTeam(id) {
  let value = 0;
  for (const c of String(id)) value = ((value * 31) + c.charCodeAt(0)) >>> 0;
  return value % 2 ? "blue" : "yellow";
}
function teamFor(id) { return teamOf.get(id) || defaultTeam(id); }
function teamFromChat(message) {
  const word = String(message || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (["1", "amarelo", "yellow", "vingadores", "avengers"].includes(word)) return "yellow";
  if (["2", "azul", "blue", "xmen", "mutantes", "mutants"].includes(word)) return "blue";
  return null;
}
function teamFromGift(name) {
  const word = String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\brose\b|\brosa\b/.test(word)) return "blue";
  if (/\bflower\b|\bflor\b|\bsunflower\b|\bdaisy\b|\btulip\b|\bgirassol\b/.test(word)) return "yellow";
  return null;
}
function giftName(raw) {
  return String(raw?.giftName || raw?.extendedGiftInfo?.name || raw?.giftDetails?.giftName ||
    raw?.gift?.name || "Presente").slice(0, 80);
}
function giftValue(raw) {
  const per = Number(raw?.diamondCount ?? raw?.extendedGiftInfo?.diamond_count ??
    raw?.extendedGiftInfo?.diamondCount ?? raw?.giftDetails?.diamondCount ?? 1);
  const repeat = Math.max(1, Math.floor(Number(raw?.repeatCount) || 1));
  return Math.max(1, Math.min(5000, Math.round((Number.isFinite(per) && per > 0 ? per : 1) * repeat)));
}
function addPoints(team, person, amount) {
  const table = scores[team];
  const previous = table.get(person.id) || { name: person.name, points: 0 };
  previous.points += amount;
  previous.name = person.name;
  table.set(person.id, previous);
}
function resetBattle() {
  clearTimeout(restartTimer); restartTimer = null;
  const live = { connected: match.connected, viewers: match.viewers };
  const pending = pendingReinforcements; pendingReinforcements = [];
  scores.yellow.clear(); scores.blue.clear();
  battle = new Battle();
  match = { ...freshMatch(), ...live };
  lastNews = "Nova batalha! Envie Flor ou Rosa para invocar combatentes.";
  io.emit("reset", { battleId: match.battleId });
  for (const r of pending) strike(r.team, r.person, r.value, r.kind, r.gift);
  publish();
}
function endRound(winner) {
  if (match.status !== "playing") return;
  match.status = "finished";
  match.winner = winner;
  lastNews = winner === "draw" ? "EMPATE! As duas torres caíram juntas." :
    "VITÓRIA: " + (winner === "yellow" ? "VINGADORES" : "X-MEN") + "!";
  lastNews += AUTO_RESTART ? " Nova batalha em 10 segundos." : " Aguardando reinício.";
  io.emit("win", { winner, battleId: match.battleId });
  publish();
  if (AUTO_RESTART) restartTimer = setTimeout(resetBattle, 10000);
}
function strike(team, person, value, kind, gift = "") {
  if (match.status !== "playing") {
    pendingReinforcements.push({ team, person, value, kind, gift });
    lastNews = person.name + " enviou reforços para a próxima batalha!";
    publish();
    return;
  }
  const powered = Date.now() < match.powerUntil;
  const points = Math.max(1, Math.round(value * (powered ? 1.5 : 1)));
  match.points[team] += points;
  const count = reinforcementCount(value, kind);
  battle.summon(team, count, person);
  match.units[team] += count;
  addPoints(team, person, points);
  match.lastUser = person.name;
  if (gift) match.lastGift = gift;
  lastNews = person.name + " reforçou " + (team === "yellow" ? "VINGADORES" : "X-MEN") +
    (gift ? " com " + gift : " pelo chat") + "!";
  io.emit("attack", { team, count, points, kind, gift, name: person.name });
  publish();
}
function receiveGift(raw) {
  if (raw?.giftType === 1 && raw.repeatEnd === false) return;
  const person = actor(raw);
  const name = giftName(raw);
  const team = teamFromGift(name) || teamFor(person.id);
  const diamonds = giftValue(raw);
  announce({ kind: "gift", team, name: person.name, gift: name,
    count: reinforcementCount(Math.max(8, Math.min(450, diamonds * 8)), "gift") });
  // Uma flor/rosa invoca reforços; presentes maiores adicionam mais combatentes.
  strike(team, person, Math.max(8, Math.min(450, diamonds * 8)), "gift", name);
}
function receiveChat(raw) {
  const person = actor(raw);
  const team = teamFromChat(raw?.comment ?? raw?.text);
  const commentTime = Date.now();
  if (commentTime - lastSpokenComment >= 5000) {
    lastSpokenComment = commentTime;
    announce({ kind: "comment", team: team || teamFor(person.id), name: person.name, message: raw?.comment ?? raw?.text });
  }
  if (!team) return;
  teamOf.set(person.id, team);
  const now = Date.now();
  if (now - (chatCooldown.get(person.id) || 0) < 1800) return;
  chatCooldown.set(person.id, now);
  strike(team, person, 4, "chat");
}
function receiveLikes(raw) {
  const total = Number(raw?.totalLikeCount);
  let delta = Math.max(1, Number(raw?.likeCount) || 1);
  if (Number.isFinite(total) && total >= 0) {
    delta = lastTotalLikes === null ? 1 : Math.max(0, total - lastTotalLikes);
    lastTotalLikes = total;
  }
  if (!delta || match.status !== "playing") return;
  match.energy = Math.min(100, match.energy + Math.min(delta, 200) * 0.6);
  io.emit("likes", { count: delta });
  if (match.energy >= 100) {
    match.energy = 0;
    match.powerUntil = Date.now() + 20000;
    lastNews = "⚡ MODO PODER ATIVADO POR 20 SEGUNDOS!";
    io.emit("power", { until: match.powerUntil });
  }
  publish();
}
app.use(express.json({ limit: "8kb" }));
app.use(express.static(path.join(root, "public")));
// Read-only fixtures: no endpoint here changes the public battle or accepts arbitrary text.
app.get('/testing/battle.mjs', (_req, res) => res.sendFile(path.join(root, 'battle.mjs')));
app.get('/api/rehearsal/:kind', async (req, res) => {
  const fixture = Object.hasOwn(rehearsalFixtures, req.params.kind) ? rehearsalFixtures[req.params.kind] : null;
  if (!fixture) return res.status(404).end();
  const key = 'rehearsal-' + req.params.kind;
  const wav = await narration.sample(key, fixture.speech);
  res.set('Cache-Control', 'no-store');
  res.json({ ...fixture, rehearsal: true, audioUrl: wav ? '/api/narration/' + key : null, audioDuration: narration.sampleDuration(key) });
});
app.get("/api/narration/:id", async (req, res) => {
  const id = req.params.id;
  const kind = id.startsWith('rehearsal-') ? id.slice(10) : '';
  const fixture = Object.hasOwn(rehearsalFixtures, kind) ? rehearsalFixtures[kind] : null;
  const audio = id === 'sample' ? await narration.sample() : fixture ? await narration.sample(id, fixture.speech) : narration.get(id);
  if (!audio) return res.status(404).end();
  res.set("Content-Type", "audio/wav"); res.set("Cache-Control", "private, max-age=60");
  res.set("X-Content-Type-Options", "nosniff"); res.send(audio);
});
app.get("/api/health", (_req, res) => res.json({
  ok: true, configured: !!USERNAME, connected: match.connected, battleId: match.battleId,
  channel: USERNAME, connectionError, narration: { enabled: narration.enabled, comments: process.env.PIPER_COMMENTS !== "false" }, status: match.status, units: match.units, hp: match.hp, build, live
}));
// Simulação apenas para navegador no próprio computador, nunca liberada na internet.
// Em hospedagem (Render etc.) o proxy do host conecta como endereço local, então o
// simulador fica desligado lá e em qualquer requisição que chegue por proxy.
const HOSTED = Boolean(process.env.RENDER || process.env.DISABLE_DEMO === "true");
function localRequest(address, headers = {}) {
  if (HOSTED) return false;
  if (headers["x-forwarded-for"] || headers["x-forwarded-host"] || headers["x-real-ip"] || headers.forwarded) return false;
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address);
}
function isLocal(req) { return localRequest(req.socket.remoteAddress, req.headers); }
app.post("/api/demo", (req, res) => {
  if (!isLocal(req)) return res.status(403).json({ error: "Simulação disponível apenas em localhost." });
  const action = String(req.body?.action || "");
  const person = { id: "demo-" + action, name: "Teste local" };
  if (action === "flower") receiveGift({ user: { uniqueId: person.id, nickname: person.name }, giftName: "Flower", diamondCount: 1, repeatCount: 1 });
  else if (action === "rose") receiveGift({ user: { uniqueId: person.id, nickname: person.name }, giftName: "Rose", diamondCount: 1, repeatCount: 1 });
  else if (action === "megaYellow") strike("yellow", person, 150, "gift", "Super presente");
  else if (action === "megaBlue") strike("blue", person, 150, "gift", "Super presente");
  else if (action === "likes") receiveLikes({ likeCount: 50 });
  else if (action === "reset") resetBattle();
  else return res.status(400).json({ error: "Ação desconhecida" });
  res.json({ ok: true });
});
io.on("connection", socket => {
  socket.emit("init", { ...publicState(), demo: localRequest(socket.handshake.address, socket.handshake.headers) });
});
let previousStep = performance.now();
let accumulated = 0;
setInterval(() => {
  const now = performance.now();
  accumulated += Math.min(1000, now - previousStep); previousStep = now;
  while (accumulated >= COMBAT.stepMs) {
    accumulated -= COMBAT.stepMs;
    if (match.status === "playing") {
      const result = battle.step(match.hp, Date.now() < match.powerUntil);
      if (result.winner) endRound(result.winner);
    }
  }
  publish();
}, COMBAT.stepMs);
async function connectLive() {
  if (!USERNAME) {
    console.log("Modo teste local: adicione TIKTOK_USERNAME no arquivo .env para conectar à LIVE.");
    return;
  }
  try {
    currentConnection = new TikTokLiveConnection(USERNAME, { enableExtendedGiftInfo: true });
    const connection = currentConnection;
    connection.on("gift", fromLive("gifts", receiveGift));
    connection.on("chat", fromLive("chats", receiveChat));
    connection.on("like", fromLive("likes", receiveLikes));
    connection.on("roomUser", data => {
      match.viewers = Math.max(0, Number(data?.viewerCount || data?.totalUser || 0));
      publish();
    });
    connection.on("streamEnd", () => {
      match.connected = false; publish();
      scheduleReconnect();
    });
    connection.on("disconnected", () => {
      match.connected = false; publish();
      scheduleReconnect();
    });
    connection.on("error", err => console.warn("TikTok:", err?.message || err));
    await connection.connect();
    match.connected = true; connectionError = "";
    live.connectedAt = new Date().toISOString();
    lastNews = "TikTok LIVE conectada! @" + USERNAME;
    console.log("TikTok LIVE conectada: @" + USERNAME);
    publish();
  } catch (error) {
    match.connected = false;
    connectionError = "Não foi possível conectar à live. Confira a conta e se a transmissão TikTok está pública e ativa.";
    console.warn("LIVE indisponível: " + String(error?.message || error));
    publish();
    scheduleReconnect();
  }
}
function scheduleReconnect() {
  if (retryTimer) return;
  retryTimer = setTimeout(async () => {
    retryTimer = null;
    try { await currentConnection?.disconnect(); } catch {}
    connectLive();
  }, 20000);
}
httpServer.listen(PORT, () => {
  console.log("Jogo: http://localhost:" + PORT);
  console.log("Versão: commit " + (build.commit ? build.commit.slice(0, 7) : "desconhecido (sem .git)") +
    " | impressão digital " + build.fingerprint + " | conferir em /api/health");
  console.log("Simulação: use os botões na própria tela em localhost.");
  connectLive();
});
