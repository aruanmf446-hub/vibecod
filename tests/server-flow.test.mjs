import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Battle, COMBAT, reinforcementCount } from '../battle.mjs';
import { createAnnouncer, announcementFor } from '../announcer.mjs';
import { createPiperTts } from '../narration.mjs';
function harness(env={}) {
  let now=10000, id=0;const timers=[],intervals=[],emissions=[],connections=[],routes={};
  const app={use(){},get(name,fn){routes[name]=fn},post(name,fn){routes[name]=fn}};
  const express=()=>app;express.json=()=>{};express.static=()=>{};
  class Live extends EventEmitter { constructor(username,options){super();this.username=username;this.options=options;connections.push(this)}async connect(){} }
  const sandbox={createPiperTts,createAnnouncer,announcementFor,Battle,COMBAT,reinforcementCount,buildInfo:()=>({commit:'teste',fingerprint:'teste'}),express,createServer:()=>({listen(){}}),
    Server:class{on(){}emit(name,data){emissions.push({name,data})}},fileURLToPath,path,
    randomUUID:()=>String(++id),process:{env},console:{log(){},warn(){}},
    TikTokLiveConnection:Live,RoomIdRouteConfig:{skipFetchRoomIdFromEulerRoute:false},Date:class extends Date{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}},performance:{now:()=>now},
    setTimeout:(fn,delay)=>{const timer={fn,delay,cancelled:false};timers.push(timer);return timer},
    clearTimeout:timer=>{if(timer)timer.cancelled=true},setInterval:fn=>intervals.push(fn)};
  const source=readFileSync(new URL('../server.mjs',import.meta.url),'utf8')
    .replace(/^import .*;\n/gm,'').replaceAll('import.meta.url',JSON.stringify(import.meta.url));
  vm.runInNewContext(source+'\nglobalThis.api={receiveGift,receiveChat,receiveLikes,publicState,resetBattle,connectLive};',sandbox);
  return {...sandbox.api,roomIdRoutes:sandbox.RoomIdRouteConfig,timers,emissions,connections,routes,advance(seconds){for(let i=0;i<seconds*10;i++){now+=100;intervals[0]()}}};
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
test('simulador fica bloqueado em hospedagem e atrás de proxy, mesmo vindo de 127.0.0.1',()=>{
  const call=(h,headers)=>{let code=200;h.routes['/api/demo']({socket:{remoteAddress:'127.0.0.1'},headers,body:{action:'flower'}},
    {json(){},status(c){code=c;return this}});return code;};
  const hosted=harness({RENDER:'true'});
  assert.equal(call(hosted,{}),403);assert.equal(hosted.publicState().units.yellow,0);
  const proxied=harness();
  assert.equal(call(proxied,{'x-forwarded-for':'203.0.113.9'}),403);assert.equal(proxied.publicState().units.yellow,0);
  assert.equal(call(proxied,{}),200);assert.equal(proxied.publicState().units.yellow,1);
});

test('balões de presentes não duplicam combos; comentários não mudam regras',()=>{
 const h=harness();h.receiveGift({...gift(),giftType:1,repeatEnd:false});
 assert.equal(h.emissions.filter(e=>e.name==='announcement').length,0);
 h.receiveGift({...gift('Rose'),giftType:1,repeatEnd:true});
 const notice=h.emissions.find(e=>e.name==='announcement');
 assert.equal(notice.data.team,'blue');assert.match(notice.data.speech,/rosa.*X-Men/);
 const before=JSON.stringify(h.publicState().units);
 h.receiveChat({user:{uniqueId:'donor',nickname:'Lucas'},comment:'Vamos ganhar!'});
 assert.equal(JSON.stringify(h.publicState().units),before);
 assert.ok(h.emissions.some(e=>e.name==='announcement'&&e.data.kind==='comment'));
});

test('fixtures remotas são leitura e não alteram batalha/contadores reais',async()=>{
 const h=harness({RENDER:'true',PIPER_ENABLED:'false'});const before=JSON.stringify(h.publicState());
 let body;
 await h.routes['/api/rehearsal/:kind']({params:{kind:'rose'}},{set(){},json:b=>body=b,status(){return this},end(){}});
 assert.equal(body.team,'blue');assert.equal(body.name,'Lucas');assert.match(body.speech,/rosa.*X-Men/);
 assert.equal(JSON.stringify(h.publicState()),before);
 let status;
 await h.routes['/api/rehearsal/:kind']({params:{kind:'__proto__'}},{status:s=>{status=s;return {end(){}}}});
 assert.equal(status,404);
});

test('eventos da conexão TikTok identificam doador, combo, time e agradecimento',async()=>{
 const h=harness({TIKTOK_USERNAME:'canal'});await h.connectLive();const connection=h.connections[0];
 const user={uniqueId:'lucas',nickname:'Lucas'};
 connection.emit('chat',{user,comment:'1'});
 connection.emit('gift',{user,giftName:'Rose',diamondCount:1,repeatCount:3,giftType:1,repeatEnd:false});
 assert.equal(h.publicState().units.blue,0);
 connection.emit('gift',{user,giftName:'Rose',diamondCount:1,repeatCount:3,giftType:1,repeatEnd:true});
 assert.equal(h.publicState().units.blue,3);
 const rose=h.emissions.filter(e=>e.name==='announcement'&&e.data.kind==='gift').at(-1).data;
 assert.equal(rose.name,'Lucas');assert.equal(rose.count,3);assert.match(rose.speech,/Lucas.*rosa.*X-Men/);
 connection.emit('gift',{user,giftName:'Star',diamondCount:1,repeatCount:1});
 const yellowStar=h.emissions.filter(e=>e.name==='announcement'&&e.data.kind==='gift').at(-1).data;assert.equal(yellowStar.team,'yellow');assert.match(yellowStar.speech,/estrela.*Vingadores/);
 connection.emit('chat',{user,comment:'2'});
 connection.emit('gift',{user,giftName:'Star',diamondCount:1,repeatCount:1});
 const star=h.emissions.filter(e=>e.name==='announcement'&&e.data.kind==='gift').at(-1).data;
 assert.equal(star.team,'blue');assert.match(star.speech,/Lucas.*estrela.*X-Men/);
 assert.equal(h.publicState().narrationComments,true);
});

test('ensaio oferece Estrela dos Vingadores e mantém Rosa/Flor nos times corretos',async()=>{
 const h=harness({RENDER:'true',PIPER_ENABLED:'false'});
 for(const [kind,team] of [['star-yellow','yellow'],['star','blue'],['flower','yellow'],['rose','blue']]){
 let body;await h.routes['/api/rehearsal/:kind']({params:{kind}},{set(){},json:b=>body=b});
 assert.equal(body.team,team);assert.match(body.speech,team==='yellow'?/Vingadores/:/X-Men/);
 }
 assert.equal(h.publicState().units.yellow,0);assert.equal(h.publicState().units.blue,0);
});

test('exigência de plano pago fica explícita, sem fingir conexão ou receber presentes',async()=>{
 const h=harness({TIKTOK_USERNAME:'canal'});await h.connectLive();
 h.connections[0].constructor.prototype.connect=async()=>{throw Error('This endpoint requires a Business plan.');};
 await h.connectLive();assert.equal(h.publicState().connected,false);assert.match(h.publicState().connectionError,/exige plano Business/);
});
test('Sorvete (Ice Cream Cone) invoca Vingadores e Rosa invoca X-Men',()=>{
  const h=harness();h.receiveGift(gift('Ice Cream Cone',3));h.receiveGift(gift('Rose',2));
  const state=h.publicState();assert.equal(state.units.yellow,3);assert.equal(state.units.blue,2);
});
test('arena vazia solta um de cada lado sem dar pontos; IDLE_SPAWN_SECONDS=0 desliga',()=>{
  const h=harness();h.advance(5);assert.equal(h.publicState().combat.fighters.length,0);
  h.advance(1.5);const f=h.publicState().combat.fighters;
  assert.equal(f.filter(u=>u.team==='yellow').length,1);assert.equal(f.filter(u=>u.team==='blue').length,1);
  assert.equal(JSON.stringify(h.publicState().points),'{"yellow":0,"blue":0}');
  h.advance(600);const s=h.publicState();assert.equal(s.hp.yellow,1200);assert.equal(s.hp.blue,1200);assert.equal(s.status,'playing');
  const off=harness({IDLE_SPAWN_SECONDS:'0'});off.advance(60);assert.equal(off.publicState().combat.fighters.length,0);
});
test('seguir e compartilhar invocam 1 combatente com limite por pessoa',async()=>{
  const h=harness({TIKTOK_USERNAME:'canal',IDLE_SPAWN_SECONDS:'0'});await h.connectLive();
  const fan={user:{uniqueId:'fan',nickname:'Fã'}};const c=h.connections[0];
  c.emit('follow',fan);c.emit('follow',fan);c.emit('share',fan);c.emit('share',fan);
  const s=h.publicState();assert.equal(s.units.yellow+s.units.blue,2);
  const later=harness({TIKTOK_USERNAME:'canal',IDLE_SPAWN_SECONDS:'0'});await later.connectLive();
  later.connections[0].emit('share',fan);later.advance(61);later.connections[0].emit('share',fan);
  assert.equal(later.publicState().units.yellow+later.publicState().units.blue,2);
});
test('tabela de presentes: cada presente vai para o time certo',()=>{
  const y=['Ice Cream Cone','Wave Firework','Courage Potion','Rage Mode','Energy Capsule','Power Chip','Boxing Gloves','Money Gun','Galaxy'];
  const b=['Rose','Finger Heart','Magic Feather','Mushroom','Ghostfire','Danger Door','Butterfly for You','Gem Gun','Magic Potion'];
  for(const n of y){const h=harness({IDLE_SPAWN_SECONDS:'0'});h.receiveGift(gift(n));assert.equal(h.publicState().units.yellow,1,n);}
  for(const n of b){const h=harness({IDLE_SPAWN_SECONDS:'0'});h.receiveGift(gift(n));assert.equal(h.publicState().units.blue,1,n);}
});
test('faixas de moedas definem quantos combatentes saem',()=>{
  for(const [coins,count] of [[1,1],[5,3],[10,5],[20,8],[30,10],[100,20],[299,35],[500,50],[1000,80]]){
    const h=harness({IDLE_SPAWN_SECONDS:'0'});h.receiveGift({...gift('Galaxy'),diamondCount:coins});
    assert.equal(h.publicState().units.yellow,count,String(coins));}
});


test('conexão usa modo comunitário sem catálogo pago nem replay de eventos antigos',async()=>{
 const h=harness({TIKTOK_USERNAME:'canal'});await h.connectLive();
 assert.equal(h.connections[0].options.enableExtendedGiftInfo,false);
 assert.equal(h.connections[0].options.processInitialData,false);
 assert.equal(h.roomIdRoutes.skipFetchRoomIdFromEulerRoute,true);
});
test('presentes nativos 2.5.0 sem catálogo preservam times, moedas e combo só no final',async()=>{
 const h=harness({TIKTOK_USERNAME:'canal',IDLE_SPAWN_SECONDS:'0'});await h.connectLive();
 const c=h.connections[0],user={userId:'123',nickname:'Lucas'};
 const rose={user,giftId:5655,repeatCount:3,repeatEnd:0,giftDetails:{giftName:'Rose',diamondCount:1,giftType:1}};
 c.emit('gift',rose);assert.equal(h.publicState().units.blue,0);
 c.emit('gift',{...rose,repeatEnd:1});assert.equal(h.publicState().units.blue,3);
 assert.equal(h.publicState().points.blue,24);
 c.emit('gift',{user,giftId:1234,repeatCount:2,repeatEnd:0,giftDetails:{giftName:'Ice Cream Cone',diamondCount:5,giftType:0}});
 const s=h.publicState();assert.equal(s.units.yellow,6);assert.equal(s.points.yellow,48);
 const notices=h.emissions.filter(e=>e.name==='announcement').map(e=>e.data);
 assert.equal(notices.length,2);assert.match(notices[0].speech,/Lucas.*rosa.*X-Men/i);
 assert.equal(notices[1].team,'yellow');assert.equal(notices[1].count,6);
});
