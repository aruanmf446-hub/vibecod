import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Battle, COMBAT, reinforcementCount } from '../battle.mjs';
function harness(env={}) {
  let now=10000, id=0;const timers=[],intervals=[],emissions=[],connections=[],routes={};
  const app={use(){},get(name,fn){routes[name]=fn},post(name,fn){routes[name]=fn}};
  const express=()=>app;express.json=()=>{};express.static=()=>{};
  class Live extends EventEmitter { constructor(){super();connections.push(this)}async connect(){} }
  const sandbox={Battle,COMBAT,reinforcementCount,buildInfo:()=>({commit:'teste',fingerprint:'teste'}),express,createServer:()=>({listen(){}}),
    Server:class{on(){}emit(name,data){emissions.push({name,data})}},fileURLToPath,path,
    randomUUID:()=>String(++id),process:{env},console:{log(){},warn(){}},
    TikTokLiveConnection:Live,Date:class extends Date{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}},performance:{now:()=>now},
    setTimeout:(fn,delay)=>{const timer={fn,delay,cancelled:false};timers.push(timer);return timer},
    clearTimeout:timer=>{if(timer)timer.cancelled=true},setInterval:fn=>intervals.push(fn)};
  const source=readFileSync(new URL('../server.mjs',import.meta.url),'utf8')
    .replace(/^import .*;\n/gm,'').replaceAll('import.meta.url',JSON.stringify(import.meta.url));
  vm.runInNewContext(source+'\nglobalThis.api={receiveGift,receiveChat,receiveLikes,publicState,resetBattle,connectLive};',sandbox);
  return {...sandbox.api,timers,emissions,connections,routes,advance(seconds){for(let i=0;i<seconds*10;i++){now+=100;intervals[0]()}}};
}
const gift=(name='Flower',repeat=1)=>({giftName:name,diamondCount:1,repeatCount:repeat,user:{uniqueId:'donor',nickname:'Doador'}});
test('eventos reais de gift: combo é contado só no final e os times são respeitados',()=>{
  const h=harness();h.receiveGift({...gift(),giftType:1,repeatEnd:false});
  assert.equal(h.publicState().units.yellow,0);
  h.receiveGift({...gift('Flower',5),giftType:1,repeatEnd:true});h.receiveGift(gift('Rose',2));
  const state=h.publicState();
  assert.equal(state.units.yellow,5);assert.equal(state.units.blue,2);
  assert.equal(state.points.yellow,40);assert.equal(state.points.blue,16);
  assert.equal(state.hp.yellow,1200);assert.equal(state.hp.blue,1200);
  assert.equal(state.leaderboard.yellow[0].points,40);
});
test('sem doações não existe fim por tempo, numeração ou vitória inventada',()=>{
  const h=harness();h.advance(3600);
  const state=h.publicState();assert.equal(state.status,'playing');assert.equal(state.winner,null);
  assert.equal('round' in state,false);assert.equal('seconds' in state,false);
});
test('vitória vem do combate; doações no intervalo entram na batalha seguinte',()=>{
  const h=harness();h.receiveGift(gift());h.advance(115);
  const finished=h.publicState();assert.equal(finished.winner,'yellow');assert.equal(finished.hp.blue,0);
  const timer=h.timers.find(t=>t.delay===10000);assert.ok(timer);
  h.receiveGift(gift('Rose',3));assert.equal(h.publicState().nextReinforcements,3);
  timer.fn();const next=h.publicState();
  assert.notEqual(next.battleId,finished.battleId);assert.equal(next.winner,null);
  assert.equal(next.units.blue,3);assert.equal(next.points.blue,24);assert.equal(next.units.yellow,0);
  assert.equal(next.nextReinforcements,0);assert.equal(next.hp.blue,1200);
});
test('reinício manual cancela o automático e não duplica doações pendentes',()=>{
  const h=harness();h.receiveGift(gift());h.advance(115);h.receiveGift(gift('Rose'));
  h.resetBattle();assert.ok(h.timers[0].cancelled);
  assert.equal(h.publicState().units.blue,1);
  h.resetBattle();assert.equal(h.publicState().units.blue,0);
});
test('reinício mantém conexão TikTok e espectadores; opção manual é respeitada',async()=>{
  const h=harness({TIKTOK_USERNAME:'canal',AUTO_RESTART:'false'});await h.connectLive();
  h.connections[0].emit('roomUser',{viewerCount:128});
  h.resetBattle();assert.equal(h.publicState().connected,true);assert.equal(h.publicState().viewers,128);
  h.connections[0].emit('gift',gift());h.advance(115);
  assert.equal(h.publicState().winner,'yellow');assert.equal(h.timers.length,0);
});
test('chat atribui time e presentes genéricos o seguem; likes preservam a energia',()=>{
  const h=harness();h.receiveChat({user:{uniqueId:'donor',nickname:'Doador'},comment:'2'});
  h.receiveGift(gift('Presente especial'));
  assert.equal(h.publicState().units.blue,2);assert.equal(h.publicState().units.yellow,0);
  h.receiveLikes({likeCount:50});assert.equal(h.publicState().energy,30);
  for(let i=0;i<3;i++)h.receiveLikes({likeCount:50});
  assert.ok(h.publicState().powerUntil>0);
});
test('/api/health informa versão e conta só presentes vindos da LIVE real',async()=>{
  const h=harness({TIKTOK_USERNAME:'canal'});await h.connectLive();
  const health=()=>{let body;h.routes['/api/health']({}, {json:b=>{body=b}});return body;};
  h.routes['/api/demo']({socket:{remoteAddress:'127.0.0.1'},body:{action:'flower'}},{json(){},status(){return this}});
  assert.equal(health().live.gifts,0);assert.equal(health().units.yellow,1);
  h.connections[0].emit('gift',gift('Rose',3));
  const body=health();
  assert.equal(body.build.fingerprint,'teste');assert.equal(body.connected,true);
  assert.equal(body.live.gifts,1);assert.equal(body.live.lastGift.name,'Rose');assert.equal(body.live.lastGift.diamonds,3);
  assert.equal(body.units.blue,3);assert.ok(body.live.connectedAt);
});
