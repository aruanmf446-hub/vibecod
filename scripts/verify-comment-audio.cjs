const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const base=process.env.GAME_URL||'http://127.0.0.1:3018',proxy=process.env.HTTPS_PROXY||process.env.HTTP_PROXY;
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=document-user-activation-required']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},...(!new URL(base).hostname.startsWith('127.')&&proxy?{proxy:{server:proxy}}:{})});
  await context.addInitScript(()=>{
   window.qa={starts:0};const Audio=window.AudioContext||window.webkitAudioContext,create=Audio.prototype.createBufferSource,play=HTMLMediaElement.prototype.play;
   Audio.prototype.createBufferSource=function(){const source=create.call(this),connect=source.connect.bind(source),start=source.start.bind(source);source.connect=function(gain){qa.gain=gain;return connect(gain)};source.start=function(...args){qa.starts++;qa.context=source.context;qa.source=source;qa.analyser=source.context.createAnalyser();connect(qa.analyser);return start(...args)};return source};
   HTMLMediaElement.prototype.play=function(){qa.voice=this;return play.call(this)};
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const before=await(await page.request.get(base+'/api/health')).json();
  await page.goto(base+'/#teste');await page.locator('#rehearsalPanel').waitFor({state:'visible'});
  await page.locator('#hideRehearsalControls').click();await page.waitForFunction(()=>qa.starts===1);
  await page.waitForFunction(()=>qa.voice?.ended,{},{timeout:60000});
  const comment=async(kind,name)=>{
   if(!await page.locator('#rehearsalPanel').isVisible())await page.locator('#showRehearsalControls').click();
   await page.locator(`[data-rehearsal="${kind}"]`).click();
   await page.waitForFunction(({kind,name})=>document.querySelector('#announcerMessage').textContent.includes(name)&&qa.voice?.currentSrc.includes('rehearsal-'+kind)&&!qa.voice.paused&&qa.voice.currentTime>.08,{kind,name},{timeout:60000});
  };
  await comment('comment','Maria');
  const speech=await page.locator('#announcerMessage').textContent();assert.match(speech,/Vai, Vingadores! Vamos vencer essa batalha!/);assert.doesNotMatch(speech,/avante|A mim/);
  await page.evaluate(()=>qa.context.suspend());
  await page.waitForFunction(()=>qa.voice.ended&&qa.context.state==='running'&&qa.gain.gain.value>.3,{},{timeout:30000});
  assert.equal(await page.evaluate(()=>qa.starts),1,'retoma a mesma trilha sem criar outra camada');
  console.log('PASS: comentário literal; música suspensa durante fala volta após ended');
  await comment('comment-blue','Lucas');
  assert.match(await page.locator('#announcerMessage').textContent(),/comentou: 2.*X-Men/);
  assert.match(await page.locator('#announcerPortrait').getAttribute('src'),/blue/);
  await page.screenshot({path:path.join(__dirname,'../docs/visual-comments-blue.png'),fullPage:true});
  await page.evaluate(()=>{qa.savedEnd=qa.voice.onended;qa.savedPause=qa.voice.onpause;qa.voice.onended=null;qa.voice.onpause=null;return qa.context.suspend()});
  await page.waitForFunction(()=>qa.voice.ended&&qa.context.state==='running'&&qa.gain.gain.value>.3,{},{timeout:35000});
  assert.equal(await page.evaluate(()=>qa.starts),1);
  assert.ok(await page.evaluate(()=>{const samples=new Float32Array(qa.analyser.fftSize);qa.analyser.getFloatTimeDomainData(samples);return samples.some(v=>Math.abs(v)>.01)}));
  console.log('PASS: 2 confirma X-Men e retrato azul; watchdog retoma música mesmo sem ended/pause');
  await page.evaluate(()=>{qa.voice.onended=qa.savedEnd;qa.voice.onpause=qa.savedPause});
  await page.locator('#musicToggle').click();await page.evaluate(()=>qa.voice.dispatchEvent(new Event('ended')));await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>qa.starts),1,'voz não reativa uma trilha silenciada de propósito');
  const after=await(await page.request.get(base+'/api/health')).json();for(const key of ['battleId','hp','units','live'])assert.deepEqual(after[key],before[key]);
  assert.deepEqual(errors,[]);console.log('PASS: silêncio intencional respeitado, batalha pública inalterada e sem exceções');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
