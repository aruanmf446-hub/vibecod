const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const base = process.env.GAME_URL || 'http://127.0.0.2:3016';
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  for (const allowed of [true, false]) {
    const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', `--autoplay-policy=${allowed ? 'no-user-gesture-required' : 'document-user-activation-required'}`] });
    try {
      const context = await browser.newContext({ viewport:{width:390,height:844}, ...(!new URL(base).hostname.startsWith('127.') && proxy ? {proxy:{server:proxy}}:{}) });
      await context.addInitScript(() => {
        window.qaNotes=0;const Audio=window.AudioContext||window.webkitAudioContext,create=Audio.prototype.createOscillator;
        Audio.prototype.createOscillator=function(){qaNotes++;return create.call(this)};
        let factory;Object.defineProperty(window,'io',{get:()=>factory,set:original=>{
          factory=(...args)=>{const socket=original(...args),on=socket.on.bind(socket);window.qaEvents={};socket.on=(name,fn)=>{qaEvents[name]=fn;return on(name,fn)};return socket};
        }});
      });
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base);await page.waitForFunction(()=>!!window.qaEvents?.init);
      for(const selector of ['#soundToggle','.comment-controls','#voiceUnlock','#demoPanel','#rehearsalPanel','#showRehearsalControls'])assert.equal(await page.locator(selector).isVisible(),false,selector);
      if(allowed){
        await page.waitForFunction(()=>document.querySelector('#musicToggle').getAttribute('aria-pressed')==='true');
        assert.equal(await page.locator('#soundToggle').getAttribute('aria-pressed'),'true');
        const before=await page.evaluate(()=>qaNotes);
        await page.evaluate(()=>qaEvents.attack({kind:'gift',team:'yellow'}));
        assert.ok(await page.evaluate(()=>qaNotes)>before,'efeitos ativos sem clicar num botão');
        await page.screenshot({path:path.join(__dirname,'../docs/visual-prism-clean.png'),fullPage:true});
      }else{
        // A restrictive browser cannot be bypassed. A gesture must still unlock a pending automatic resume.
        await page.locator('#battle').click();
        await page.waitForFunction(()=>document.querySelector('#musicToggle').getAttribute('aria-pressed')==='true');
      }
      for(const [width,height] of [[390,844],[720,1280],[1080,1920]]){
        await page.setViewportSize({width,height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        assert.equal(await page.locator('.comment-controls').isVisible(),false);
      }
      await page.goto(base+'/#teste');await page.locator('#rehearsalPanel').waitFor({state:'visible'});
      assert.equal(await page.locator('.comment-controls').isVisible(),true);
      assert.equal(await page.locator('#soundToggle').isVisible(),true);
      await page.locator('#exitRehearsal').click();assert.equal(await page.locator('.comment-controls').isVisible(),false);
      assert.deepEqual(errors,[]);
    }finally{await browser.close()}
  }
  console.log('PASS: produção limpa, áudio/efeitos automáticos quando permitidos, desbloqueio de resume pendente, #teste com controles e saída limpa, 3 resoluções sem overflow/exceções');
})().catch(error=>{console.error(error);process.exit(1)});
