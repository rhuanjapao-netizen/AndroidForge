// Renderiza quadros de teste do design.html (1280x720 @1.5x) e junta numa folha de contato.
// Uso: node stills.js <design.html> <timeline.json> <saída.png> t1 t2 t3 ...
// Precisa de Playwright (já vem no ambiente de nuvem; localmente: npm i playwright && npx playwright install chromium).
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');

(async () => {
  const [page_, timeline, out, ...times] = process.argv.slice(2);
  const TL = JSON.parse(fs.readFileSync(timeline, 'utf8'));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(`window.TL=${JSON.stringify(TL)};`);
  await page.goto('file://' + path.resolve(page_));
  await page.evaluate(() => window.READY);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stills-'));
  for (const [i, t] of times.entries()) {
    await page.evaluate(t => window.renderAt(t), parseFloat(t));
    await page.screenshot({ path: path.join(dir, `s${String(i).padStart(3, '0')}.png`) });
  }
  await browser.close();
  if (errors.length) console.error('erros na página:', errors);
  const cols = Math.min(3, times.length), rows = Math.ceil(times.length / cols);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-pattern_type', 'glob', '-i', path.join(dir, 's*.png'),
    '-vf', `scale=640:360,tile=${cols}x${rows}:padding=6:color=white`, '-frames:v', '1', out]);
  console.log(`folha de contato: ${out} (${times.length} quadros)`);
})();
