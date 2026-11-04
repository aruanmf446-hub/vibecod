import "dotenv/config";
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
const LIMIT = 1200;
const ROUND_SECONDS = 180;
const teamOf = new Map();
const chatCooldown = new Map();
const scores = { yellow: new Map(), blue: new Map() };
let currentConnection = null;
let retryTimer = null;
let lastTotalLikes = null;
let match = freshMatch(1);
let lastNews = "A batalha vai começar!";

function freshMatch(round) {
  return {
    round, hp: { yellow: LIMIT, blue: LIMIT }, maxHp: LIMIT,
    points: { yellow: 0, blue: 0 }, units: { yellow: 0, blue: 0 },
    seconds: ROUND_SECONDS, winner: null, status: "playing",
    energy: 0, powerUntil: 0, viewers: 0, connected: false,
    lastGift: "", lastUser: ""
  };
}
function publicState() {
  return {
    ...match, news: lastNews, configured: Boolean(USERNAME),
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
function endRound(winner) {
  if (match.status !== "playing") return;
  match.status = "finished";
  match.winner = winner;
  lastNews = "VITÓRIA: " + (winner === "yellow" ? "VINGADORES" : "X-MEN") + "!";
  io.emit("win", { winner, round: match.round });
  publish();
  setTimeout(() => {
    const next = match.round + 1;
    scores.yellow.clear(); scores.blue.clear();
    match = freshMatch(next);
    lastNews = "Nova rodada! Escolha um lado e envie presentes.";
    io.emit("reset", { round: next });
    publish();
  }, 10000);
}
function strike(team, person, value, kind, gift = "") {
  if (match.status !== "playing") return;
  const opponent = team === "yellow" ? "blue" : "yellow";
  const powered = Date.now() < match.powerUntil;
  const points = Math.max(1, Math.round(value * (powered ? 1.5 : 1)));
  match.hp[opponent] = Math.max(0, match.hp[opponent] - points);
  match.points[team] += points;
  const count = kind === "gift" ? Math.min(14, Math.max(1, 1 + Math.floor(Math.log2(value + 1)))) : 1;
  match.units[team] += count;
  addPoints(team, person, points);
  match.lastUser = person.name;
  if (gift) match.lastGift = gift;
  lastNews = person.name + " reforçou " + (team === "yellow" ? "VINGADORES" : "X-MEN") +
    (gift ? " com " + gift : " pelo chat") + "!";
  io.emit("attack", { team, count, points, kind, gift, name: person.name });
  publish();
  if (match.hp[opponent] <= 0) endRound(team);
}
function receiveGift(raw) {
  if (raw?.giftType === 1 && raw.repeatEnd === false) return;
  const person = actor(raw);
  const name = giftName(raw);
  const team = teamFromGift(name) || teamFor(person.id);
  const diamonds = giftValue(raw);
  // Uma flor/rosa invoca reforços; presentes maiores também aumentam o dano.
  strike(team, person, Math.max(8, Math.min(450, diamonds * 8)), "gift", name);
}
function receiveChat(raw) {
  const person = actor(raw);
  const team = teamFromChat(raw?.comment ?? raw?.text);
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
app.get("/api/health", (_req, res) => res.json({ ok: true, configured: !!USERNAME, connected: match.connected, round: match.round }));
// Simulação apenas para navegador no próprio computador, nunca liberada na internet.
function isLocal(req) {
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress);
}
app.post("/api/demo", (req, res) => {
  if (!isLocal(req)) return res.status(403).json({ error: "Simulação disponível apenas em localhost." });
  const action = String(req.body?.action || "");
  const person = { id: "demo-" + action, name: "Teste local" };
  if (action === "flower") receiveGift({ user: { uniqueId: person.id, nickname: person.name }, giftName: "Flower", diamondCount: 1, repeatCount: 1 });
  else if (action === "rose") receiveGift({ user: { uniqueId: person.id, nickname: person.name }, giftName: "Rose", diamondCount: 1, repeatCount: 1 });
  else if (action === "megaYellow") strike("yellow", person, 150, "gift", "Super presente");
  else if (action === "megaBlue") strike("blue", person, 150, "gift", "Super presente");
  else if (action === "likes") receiveLikes({ likeCount: 50 });
  else if (action === "reset") { scores.yellow.clear(); scores.blue.clear(); match = freshMatch(match.round + 1); io.emit("reset", { round: match.round }); publish(); }
  else return res.status(400).json({ error: "Ação desconhecida" });
  res.json({ ok: true });
});
io.on("connection", socket => {
  socket.emit("init", { ...publicState(), demo: ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(socket.handshake.address) });
});
setInterval(() => {
  if (match.status !== "playing") return;
  match.seconds = Math.max(0, match.seconds - 1);
  if (!match.seconds) {
    const winner = match.hp.yellow === match.hp.blue
      ? (match.points.yellow >= match.points.blue ? "yellow" : "blue")
      : (match.hp.yellow > match.hp.blue ? "yellow" : "blue");
    endRound(winner);
  } else publish();
}, 1000);
async function connectLive() {
  if (!USERNAME) {
    console.log("Modo teste local: adicione TIKTOK_USERNAME no arquivo .env para conectar à LIVE.");
    return;
  }
  try {
    currentConnection = new TikTokLiveConnection(USERNAME, { enableExtendedGiftInfo: true });
    const connection = currentConnection;
    connection.on("gift", receiveGift);
    connection.on("chat", receiveChat);
    connection.on("like", receiveLikes);
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
    match.connected = true;
    lastNews = "TikTok LIVE conectada! @" + USERNAME;
    console.log("TikTok LIVE conectada: @" + USERNAME);
    publish();
  } catch (error) {
    match.connected = false;
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
  console.log("Simulação: use os botões na própria tela em localhost.");
  connectLive();
});
