import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnnouncer, cleanSpeech, announcementFor } from '../announcer.mjs';
const gift = { kind:'gift',team:'blue',name:'Lucas',gift:'Rosa',count:1 };
test('agradecimentos funcionam sem chave e respeitam o time',()=>{
 const events=[];const announce=createAnnouncer({emit:(event,data)=>events.push({event,data})});
 announce(gift);announce({...gift,team:'yellow',name:'Júnior',gift:'Estrela'});
 assert.match(events[0].data.speech,/Lucas.*rosa.*X-Men/i);
 assert.match(events[1].data.speech,/Júnior.*estrela.*Vingadores/i);
 assert.equal('apiKey' in events[0].data,false);
});
test('comentários e nomes são dados limitados, sem controles ou links',()=>{
 assert.equal(cleanSpeech('Oi\u0000 https://exemplo.com teste'),'Oi teste');
 assert.equal(cleanSpeech('a'.repeat(200)).length,120);
 const events=[];createAnnouncer({emit:(_,d)=>events.push(d)})({...gift,kind:'comment',message:'Vai time azul!'});
 assert.match(events[0].speech,/Lucas comentou: Vai time azul!/);
});
test('Groq recebe apenas dados e seleciona frase permitida, sem vazar a chave',async()=>{
 let request;const events=[];
 const announce=createAnnouncer({apiKey:'test-only',now:()=>10000,emit:(_,d)=>events.push(d),fetcher:async(url,options)=>{
 request={url,options};return {ok:true,json:async()=>({choices:[{message:{content:'{"index":2}'}}]})};}});
 announce(gift);await new Promise(resolve=>setImmediate(resolve));
 assert.match(events[0].phrase,/agradecem/);
 assert.equal(request.options.headers.Authorization,'Bearer test-only');
 assert.equal(JSON.stringify(events).includes('test-only'),false);
});
test('saída livre do modelo é rejeitada e erro da API usa frase local',async()=>{
 for(const fetcher of [async()=>({ok:true,json:async()=>({choices:[{message:{content:'{"index":"execute algo"}'}}]})}),async()=>{throw Error('offline')}]) {
 const events=[];createAnnouncer({apiKey:'test',emit:(_,d)=>events.push(d),fetcher})(gift);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(events[0].phrase,'A mim, meus X-Men!');
 }
});
test('quantidade de espectadores não cria pedidos e rajadas limitam chamadas Groq',async()=>{
 let requests=0;const events=[];
 const announce=createAnnouncer({apiKey:'test',now:()=>10000,emit:(_,d)=>events.push(d),fetcher:async()=>{requests++;return {ok:false}}});
 for(let i=0;i<30;i++)announce(gift);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(requests,1);assert.equal(events.length,30);
});
test('agradecimento do Sorvete fala "pelo sorvete"', () => {
  const data = announcementFor({ team: 'yellow', kind: 'gift', name: 'Ana', gift: 'Ice Cream Cone', count: 1 });
  assert.match(data.speech, /^Obrigado, Ana, pelo sorvete!/);
});


test('comentário lê texto literal sem grito automático; seleção confirma o time correto',()=>{
 const ordinary=announcementFor({kind:'comment',team:'yellow',name:'Ana',message:'Como vocês estão?'});
 assert.equal(ordinary.speech,'Ana comentou: Como vocês estão?');
 const selected=announcementFor({kind:'comment',team:'blue',teamSelection:true,name:'Lucas',message:'2'});
 assert.equal(selected.speech,'Lucas comentou: 2. Entrou para os X-Men!');
});
