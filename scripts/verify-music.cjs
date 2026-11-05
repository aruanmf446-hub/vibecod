const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const base = process.env.GAME_URL || 'http://127.0.0.1:3016';
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  const remote = !['localhost', '127.0.0.1'].includes(new URL(base).hostname);
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--autoplay-policy=document-user-activation-required'] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ...(remote && proxy ? { proxy: { server: proxy } } : {}) });
    await context.addInitScript(() => {
      window.qaMusic = { starts: 0, stops: 0 };
      const Audio = window.AudioContext || window.webkitAudioContext;
      const create = Audio.prototype.createBufferSource;
      Audio.prototype.createBufferSource = function () {
        const source = create.call(this), start = source.start.bind(source), stop = source.stop.bind(source), connect = source.connect.bind(source);
        source.connect = function (gain) { qaMusic.gain = gain; return connect(gain); };
        source.start = function (...args) {
          qaMusic.starts++; qaMusic.source = source; qaMusic.context = this.context;
          const analyser = this.context.createAnalyser(); connect(analyser); qaMusic.analyser = analyser;
          return start(...args);
        };
        source.stop = function (...args) { qaMusic.stops++; return stop(...args); };
        return source;
      };
    });
    const page = await context.newPage(), errors = [], loads = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (r.url().includes('arena-theme.mp3')) loads.push(r.url()); });
    await page.goto(base + (remote ? '/#teste' : '')); await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => qaMusic.starts), 0);
    assert.equal(loads.length, 0, 'a música não baixa antes do primeiro gesto');
    if (await page.locator('#rehearsalPanel').isVisible()) await page.locator('#hideRehearsalControls').click();
    else await page.locator('#musicToggle').click();
    await page.waitForFunction(() => document.querySelector('#musicToggle').getAttribute('aria-pressed') === 'true');
    await page.waitForTimeout(600);
    assert.ok(await page.evaluate(() => {
      const samples = new Float32Array(qaMusic.analyser.fftSize); qaMusic.analyser.getFloatTimeDomainData(samples);
      return qaMusic.source.loop && qaMusic.source.buffer.duration > 30 && qaMusic.context.state === 'running' && samples.some(n => Math.abs(n) > .01);
    }), 'buffer local em loop contém áudio e está rodando');
    await page.locator('#musicToggle').click(); assert.equal(await page.evaluate(() => qaMusic.stops), 1);
    await page.waitForTimeout(400); assert.equal(await page.evaluate(() => qaMusic.starts), 1, 'silêncio respeitado');
    await page.locator('#soundToggle').click(); await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => qaMusic.starts), 1, 'efeitos independentes da música desligada');
    await page.locator('#musicToggle').click(); await page.waitForFunction(() => qaMusic.starts === 2);
    assert.equal(loads.length, 1, 'buffer reutilizado sem novos downloads');
    if (await page.locator('#voiceToggle').isEnabled()) {
      if ((await page.locator('#voiceToggle').textContent()).includes('Silenciar')) await page.locator('#voiceToggle').click();
      await page.locator('#voiceToggle').click();
      await page.waitForFunction(() => qaMusic.gain.gain.value < .15, {}, { timeout: 60000 });
      await page.waitForFunction(() => qaMusic.gain.gain.value > .3, {}, { timeout: 30000 });
    }
    for (const [width, height] of [[390,844],[720,1280],[1080,1920]]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    assert.deepEqual(errors, []);
    console.log('PASS: primeiro toque, MP3 local com áudio, loop, liga/desliga, efeitos independentes, cache, volume durante voz e sem overflow/exceções');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
