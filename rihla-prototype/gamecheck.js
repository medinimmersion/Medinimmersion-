const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  let errors = 0;
  p.on('pageerror', (e) => { errors++; console.log('PAGE ERROR:', e.message); });
  await p.goto('http://localhost:8090/', { waitUntil: 'networkidle', timeout: 20000 });
  await p.waitForTimeout(1200);
  await p.click('text=Commencer le voyage');
  await p.waitForTimeout(3000);
  await p.keyboard.down('w');
  await p.waitForTimeout(2000);
  await p.keyboard.up('w');
  await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/claude-0/-home-user-Medinimmersion-/d7009fc0-4186-50d8-8f40-d34838038977/scratchpad/game-newchar.png' });
  await p.evaluate(() => window.__rihla.sceneManager.goTo('hall', 'entrance'));
  await p.waitForTimeout(2500);
  await p.screenshot({ path: '/tmp/claude-0/-home-user-Medinimmersion-/d7009fc0-4186-50d8-8f40-d34838038977/scratchpad/game-hall-newchar.png' });
  console.log(errors === 0 ? 'NO ERRORS' : `${errors} ERRORS`);
  await b.close();
})();
