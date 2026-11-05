/* npm start, then PLAYWRIGHT_MODULE=/path/to/playwright node scripts/verify-characters.cjs.
   Chromium is a QA tool only; no new game runtime dependency. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const base = process.env.GAME_URL || 'http://127.0.0.1:3000';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  const context = await browser.newContext({viewport:{width:390,height:844}});
  const errors = [], failed = [], results = [];
  await context.addInitScript(() => {
    let factory;
    Object.defineProperty(window, 'io', { configurable: true, get: () => factory, set: original => {
      factory = (...args) => {
        const socket = original(...args), on = socket.on.bind(socket);
        window.qaSnapshots = {};
        socket.on = (name, fn) => on(name, data => {
          if(name==='state'||name==='init') {
            window.qaState=data;
            window.qaSnapshots[data.combat.time]=JSON.stringify(data.combat);
            const times=Object.keys(window.qaSnapshots);if(times.length>40)delete window.qaSnapshots[times[0]];
          }
          return fn(data);
        });
        return socket;
      };
    } });
  });
  context.on('page', page => {
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('requestfailed', request => {
      // Leaving/reloading a page may cancel the automatic narration media request.
      // Keep genuine HTTP/network failures; a user/navigation cancellation is expected.
      if (request.url().includes('/api/narration/') && request.failure()?.errorText === 'net::ERR_ABORTED') return;
      failed.push(request.url());
    });
  });
  const page=await context.newPage();
  await page.goto(base);await page.waitForFunction(()=>window.qaState?.combat);await page.evaluate(()=>BattleCharacters.ready);
  const click=async action=>{
    const response=page.waitForResponse(r=>r.url().endsWith('/api/demo')&&r.request().method()==='POST');
    await page.locator(`[data-action="${action}"]`).click();assert.equal((await response).status(),200);
    await page.waitForTimeout(100);
  };
  await click('reset');
  assert.equal(await page.locator('#clock').textContent(),'SEM LIMITE');
  assert.equal(await page.evaluate(()=>qaState.combat.fighters.length),0);
  assert.equal(await page.evaluate(()=>'round' in qaState),false);
  await click('flower');assert.equal(await page.locator('#blueHpText').textContent(),'1.200');
  assert.equal(await page.evaluate(()=>qaState.units.yellow),1);
  await click('rose');assert.equal(await page.evaluate(()=>qaState.units.blue),1);
  await click('megaYellow');await click('megaBlue');await click('likes');
  assert.equal(await page.locator('#energyText').textContent(),'30%');
  assert.equal(await page.locator('#yellowPoints').textContent(),'158 PTS');
  assert.equal(await page.locator('#bluePoints').textContent(),'158 PTS');
  assert.ok(await page.evaluate(()=>qaState.combat.queued.yellow>0&&qaState.combat.queued.blue>0));
  results.push('Doações invocam 1 ou 19 combatentes, sem dano instantâneo; pontos, ranking e energia mantidos');
  const second=await context.newPage();await second.goto(base);await second.waitForFunction(()=>window.qaState?.combat);
  await page.waitForFunction(()=>qaState.combat.fighters.some(u=>u.hp<40&&u.action==='attack'),{},{timeout:15000});
  const a=await page.evaluate(()=>qaSnapshots),b=await second.evaluate(()=>qaSnapshots);
  const common=Object.keys(a).filter(t=>b[t]);assert.ok(common.length>0);
  for(const time of common)assert.equal(a[time],b[time]);
  results.push('Dois espectadores recebem a mesma simulação; duelos causam dano individual e param o avanço');
  await page.screenshot({path:path.join(root,'docs/duels-mobile.png'),fullPage:true});
  await page.locator('#battle').screenshot({path:path.join(root,'docs/duels-arena.png')});
  for(const [width,height] of [[360,640],[390,844],[720,1280],[768,1024],[1440,900]]) {
    await page.setViewportSize({width,height});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.ok(await page.evaluate(()=>qaState.combat.active.yellow<=12&&qaState.combat.active.blue<=12));
    results.push(`${width}x${height}: sem overflow horizontal; limite de 12 ativos por time`);
  }
  await page.screenshot({path:path.join(root,'docs/duels-desktop.png'),fullPage:true});
  await page.reload();await page.waitForFunction(()=>window.qaState?.combat);
  assert.ok(await page.evaluate(()=>qaState.combat.fighters.length>0));
  results.push('Recarregar o navegador recupera os combatentes existentes');
  await click('reset');await click('megaYellow');
  await page.waitForFunction(()=>qaState.hp.blue<1200,{},{timeout:15000});
  results.push('Combatentes sem adversário alcançam e danificam a torre');
  console.log('Duelos, sincronização e torre verificados; aguardando vitória real e reinício automático...');
  await page.locator('#winBanner').waitFor({state:'visible',timeout:60000});
  assert.equal(await page.evaluate(()=>qaState.winner),'yellow');
  assert.equal(await page.locator('#blueHpText').textContent(),'0');
  const finishedId=await page.evaluate(()=>qaState.battleId);
  await click('rose');assert.equal(await page.evaluate(()=>qaState.nextReinforcements),1);
  await page.waitForFunction(id=>qaState.battleId!==id,finishedId,{timeout:15000});
  assert.equal(await page.evaluate(()=>qaState.units.blue),1);
  assert.equal(await page.locator('#yellowHpText').textContent(),'1.200');
  results.push('Vitória real por destruição da torre; reinício automático em 10s, preservando presente enviado durante a comemoração');
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  results.push('Sem erros de console, exceções ou falhas de carregamento; movimento reduzido sem exceções');
  fs.writeFileSync(path.join(root,'docs/duels-browser-results.json'),JSON.stringify({results,errors,failed},null,2)+'\n');
  console.log(results.join('\n'));
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
