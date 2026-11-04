/* Run against npm start. No runtime dependency is added to the game.
   PLAYWRIGHT_MODULE=/path/to/playwright node scripts/verify-characters.cjs */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [], failed = [], results = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('requestfailed', request => failed.push(request.url()));
  await page.addInitScript(() => {
    let factory;
    Object.defineProperty(window, 'io', { configurable: true, get: () => factory, set: original => {
      factory = (...args) => {
        const socket = original(...args), on = socket.on.bind(socket);
        window.qaEvents = {};
        socket.on = (name, fn) => { window.qaEvents[name] = fn; return on(name, fn); };
        return socket;
      };
    } });
  });
  for (const [name, width, height] of [['mobile',390,844],['desktop',1440,900]]) {
    await page.setViewportSize({width,height});
    // Real browser rendering of the inspected base commit, at the same viewport.
    const original = execFileSync('git', ['show','38e91b0:public/game.js'], {cwd:root,encoding:'utf8'});
    await page.route('**/game.js', route => route.fulfill({body:original,contentType:'application/javascript'}));
    await page.goto('http://127.0.0.1:3000');
    await page.waitForFunction(() => document.querySelector('#clock').textContent !== '03:00');
    await page.screenshot({path:path.join(root,`docs/before-${name}.png`),fullPage:true});
    await page.unroute('**/game.js');
    await page.reload(); await page.evaluate(() => BattleCharacters.ready);
    await page.waitForTimeout(150);
    await page.screenshot({path:path.join(root,`docs/after-${name}.png`),fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});
  const click = async action => {
    const response = page.waitForResponse(r => r.url().endsWith('/api/demo') && r.request().method() === 'POST');
    await page.locator(`[data-action="${action}"]`).click();
    assert.equal((await response).status(),200);
    await page.waitForTimeout(100);
  };
  await click('reset');
  await click('flower'); assert.equal(await page.locator('#blueHpText').textContent(),'1.192');
  await click('rose'); assert.equal(await page.locator('#yellowHpText').textContent(),'1.192');
  await click('megaYellow'); assert.equal(await page.locator('#blueHpText').textContent(),'1.042');
  await click('megaBlue'); assert.equal(await page.locator('#yellowHpText').textContent(),'1.042');
  await click('likes'); assert.equal(await page.locator('#energyText').textContent(),'30%');
  for (const team of ['yellow', 'blue']) {
    const rows = await page.locator(`#${team}Rank li`).allTextContents();
    assert.deepEqual(rows.map(row => Number(row.split('•')[1].trim())), [150, 8]);
  }
  results.push('6 controles locais: Flor, Rosa, +150 de ambos os times, likes e reinício; HP, pontos, energia e ranking corretos');
  await page.waitForTimeout(650);
  await page.locator('#battle').screenshot({path:path.join(root,'docs/after-battle.png')});
  for (const [width,height] of [[360,640],[390,844],[720,1280],[768,1024],[1440,900]]) {
    await page.setViewportSize({width,height});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    const box = await page.locator('#battle').boundingBox();
    assert.ok(box.width > 0 && box.height > 0);
    const first = await page.locator('#battle').screenshot();
    await page.waitForTimeout(100);
    const second = await page.locator('#battle').screenshot();
    assert.equal(first.equals(second),false);
    results.push(`${width}x${height}: sem overflow horizontal; Canvas animado`);
  }
  for (let i=0;i<7;i++) await click('megaYellow');
  await page.locator('#winBanner').waitFor({state:'visible'});
  assert.equal(await page.locator('#blueHpText').textContent(),'0');
  await click('reset');
  assert.equal(await page.locator('#yellowHpText').textContent(),'1.200');
  assert.equal(await page.locator('#blueHpText').textContent(),'1.200');
  assert.equal(await page.locator('#energyText').textContent(),'0%');
  assert.equal(await page.locator('#winBanner').isVisible(),false);
  results.push('Vitória pelo HP e reinício manual verificados sem conexão com a live');
  // Visual gallery: never changes the number of units in a real match.
  await page.setViewportSize({width:1120,height:660});
  await page.evaluate(() => {
    document.body.replaceChildren();
    document.body.style.cssText='margin:0;background:#101e34;color:#e2ecff;font:12px system-ui;display:grid;grid-template-columns:repeat(7,160px);justify-content:center';
    for (const c of BattleCharacters.definitions) {
      const card=document.createElement('div'); card.style.cssText='text-align:center;padding:14px 0';
      const image=document.createElement('img'); image.src=c.asset; image.width=160; image.height=180;
      const label=document.createElement('p'); label.textContent=c.name;
      const team=document.createElement('small'); team.textContent=c.team==='yellow'?'TIME FLOR · AMARELO':'TIME ROSA · AZUL'; team.style.color=c.team==='yellow'?'#ffe28a':'#8bc8ff';
      card.append(image,label,team); document.body.append(card);
    }
  });
  await page.waitForFunction(() => [...document.images].every(img=>img.complete&&img.naturalWidth>0));
  await page.screenshot({path:path.join(root,'docs/characters-preview.png')});
  await page.goto('http://127.0.0.1:3000'); await page.evaluate(() => BattleCharacters.ready);
  await page.evaluate(() => { for(let i=0;i<8;i++) { qaEvents.attack({team:'yellow',count:16});qaEvents.attack({team:'blue',count:16}); } });
  await page.waitForTimeout(1500);
  const intervals=await page.evaluate(() => new Promise(resolve => {const d=[];let prev=performance.now();function sample(t){d.push(t-prev);prev=t;if(d.length<90)requestAnimationFrame(sample);else resolve(d.slice(1));}requestAnimationFrame(sample);}));
  results.push(`Carga visual até limite existente de 110 unidades: média de ${(intervals.reduce((a,b)=>a+b)/intervals.length).toFixed(1)} ms/frame no Chromium deste ambiente`);
  await page.emulateMedia({reducedMotion:'reduce'}); await page.waitForTimeout(100);
  results.push('prefers-reduced-motion: renderização sem exceções');
  assert.deepEqual(errors,[]); assert.deepEqual(failed,[]);
  results.push('Nenhum erro de console, exceção ou request malsucedido observado');
  fs.writeFileSync(path.join(root,'docs/browser-results.json'),JSON.stringify({results,errors,failed},null,2)+'\n');
  console.log(results.join('\n'));
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
