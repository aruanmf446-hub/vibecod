import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { createPiperTts } from '../narration.mjs';
const data={kind:'gift',speech:'Obrigado, Lucas, pela rosa!',name:'Lucas',team:'blue'};
function fixture(options={}) {
 let child,received=[];
 const spawnWorker=()=>{
  child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{};
  child.stdin=new Writable({write(chunk,encoding,next){received.push(JSON.parse(chunk));next();}});return child;
 };
 const service=createPiperTts({enabled:true,spawnWorker,...options});
 return {service,get child(){return child},received};
}
function publish(service,value=data){return new Promise(resolve=>service.publish(value,resolve));}
function answer(f,id){const wav=Buffer.alloc(48);wav.write('RIFF');wav.write('WAVE',8);f.child.stdout.write(JSON.stringify({id,audio:wav.toString('base64'),duration:1})+'\n');}
test('desativado não inicia worker nem remove texto',async()=>{
 const f=fixture({enabled:false});assert.equal(await publish(f.service),data);assert.equal(f.child,undefined);f.service.close();
});
test('áudio é produzido uma vez, servido por ID e sem comandos shell',async()=>{
 const f=fixture();const pending=publish(f.service);assert.equal(f.received.length,1);
 assert.equal(f.received[0].text,data.speech);answer(f,f.received[0].id);
 const result=await pending;assert.match(result.audioUrl,/^\/api\/narration\/[a-f0-9-]{36}$/);
 const id=result.audioUrl.split('/').pop();assert.equal(f.service.get(id).toString('ascii',0,4),'RIFF');
 assert.equal(f.received.length,1);assert.equal(f.service.get('unknown'),null);f.service.close();assert.equal(f.service.get(id),null);
});
test('fila cheia retorna legenda sem voz; erro do worker resolve todos os trabalhos',async()=>{
 const f=fixture();const pending=Array.from({length:6},()=>publish(f.service));
 assert.deepEqual(await publish(f.service),data);assert.equal(f.received.length,6);
 f.child.emit('error',Error('unavailable'));
 for(const result of await Promise.all(pending))assert.equal(result.audioUrl,undefined);
 f.service.close();
});
test('timeout usa texto e comentários exigem opt-in no servidor',async()=>{
 const f=fixture({timeoutMs:15});const comment={...data,kind:'comment'};
 assert.equal(await publish(f.service,comment),comment);assert.equal(f.child,undefined);
 assert.equal((await publish(f.service)).audioUrl,undefined);f.service.close();
});
