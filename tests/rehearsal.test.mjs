import test from 'node:test';
import assert from 'node:assert/strict';
import {Battle} from '../battle.mjs';
import {createRehearsal} from '../public/rehearsal.mjs';
const initial={channel:'canal',narrationAvailable:true,connected:true,configured:true,autoRestart:true,hp:{yellow:1200,blue:1200},units:{yellow:0,blue:0}};
test('ensaio usa Battle sem alterar estado real nem enviar doações',()=>{
 const before=JSON.stringify(initial),events=[];let state;
 const demo=createRehearsal({Battle,initial,onState:s=>state=s,onEvent:(name,data)=>events.push({name,data})});
 demo.gift({kind:'gift',team:'blue',name:'Lucas',gift:'Rosa',count:1});
 assert.equal(state.units.blue,1);assert.equal(state.combat.fighters[0].team,'blue');assert.equal(state.points.blue,8);
 assert.equal(JSON.stringify(initial),before);assert.equal(state.rehearsal,true);
 assert.ok(events.some(e=>e.name==='announcement'&&e.data.rehearsal));
});
test('vitória e reinício do ensaio ocorrem no mesmo motor e preservam o principal',()=>{
 let time=0,state;const demo=createRehearsal({Battle,initial,onState:s=>state=s,onEvent(){},now:()=>time});
 demo.victory();for(let i=0;i<100&&!state.winner;i++){time+=100;demo.tick();}
 assert.equal(state.winner,'yellow');assert.equal(state.hp.blue,0);
 time+=10000;demo.tick();assert.equal(state.winner,null);assert.equal(state.hp.blue,1200);assert.equal(initial.hp.blue,1200);
});
test('comentário não invoca unidades e curtidas ativam poder só no ensaio',()=>{
 let state;const demo=createRehearsal({Battle,initial,onState:s=>state=s,onEvent(){},now:()=>10000});
 demo.comment({team:'yellow',kind:'comment',message:'Vamos vencer'});assert.equal(state.units.yellow,0);
 for(let i=0;i<4;i++)demo.likes();assert.equal(state.energy,0);assert.equal(state.powerUntil,30000);
});
