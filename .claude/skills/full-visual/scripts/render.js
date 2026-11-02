// Renderiza o vídeo final: quadros do design.html em paralelo, efeitos sonoros nas trocas de cena,
// narração, mixagem e MP4 vertical 1080x1920 a 30 fps, pronto para Reels.
// Uso: node render.js <design.html> <timeline.json> <narration.wav> <saída.mp4> [workers=3]
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const FPS = 30;

async function renderRange(design, TL, from, to, out) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1.5 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(`window.TL=${JSON.stringify(TL)};`);
  await page.goto('file://' + path.resolve(design));
  await page.evaluate(() => window.READY);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = from; f < to; f++) {
    await page.evaluate(t => window.renderAt(t), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  if (errors.length) { console.error('erros na página:', errors); process.exitCode = 1; }
}

(async () => {
  const args = process.argv.slice(2);
  if (args[0] === '--range') { // processo filho
    const [, design, timeline, from, to, out] = args;
    return renderRange(design, JSON.parse(fs.readFileSync(timeline, 'utf8')), +from, +to, out);
  }
  const [design, timeline, narration, out, workersArg] = args;
  const TL = JSON.parse(fs.readFileSync(timeline, 'utf8'));
  const total = Math.round(TL.total * FPS), workers = Math.max(1, +(workersArg || 3));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-'));
  const started = Date.now(), parts = [];
  const jobs = [...Array(workers).keys()].map(i => {
    const from = Math.round(total * i / workers), to = Math.round(total * (i + 1) / workers), part = path.join(dir, `part${i}.mp4`);
    parts.push(part);
    return new Promise((resolve, reject) => spawn(process.execPath, [__filename, '--range', design, timeline, from, to, part], { stdio: 'inherit' })
      .on('close', code => code === 0 ? resolve() : reject(new Error(`parte ${i} falhou`))));
  });
  await Promise.all(jobs);
  fs.writeFileSync(path.join(dir, 'parts.txt'), parts.map(p => `file '${p}'`).join('\n'));
  const video = path.join(dir, 'video.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'parts.txt'), '-c', 'copy', video]);

  // Efeito "whoosh" curto em cada troca de cena (ruído filtrado com envelope), bem abaixo da voz.
  const cuts = TL.scenes.slice(1).map(s => s.start);
  const sfx = path.join(dir, 'sfx.wav');
  if (cuts.length) {
    const whoosh = path.join(dir, 'whoosh.wav');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anoisesrc=d=0.45:c=pink:r=48000:a=0.5',
      '-af', 'highpass=f=500,lowpass=f=5000,afade=t=in:d=0.18,afade=t=out:st=0.2:d=0.25,volume=0.5', whoosh]);
    const inputs = cuts.flatMap(() => ['-i', whoosh]);
    const delays = cuts.map((t, i) => `[${i}]adelay=${Math.max(0, Math.round((t - 0.18) * 1000))}:all=1[d${i}]`).join(';');
    const mix = `${delays};${cuts.map((_, i) => `[d${i}]`).join('')}amix=inputs=${cuts.length}:normalize=0,apad=whole_dur=${TL.total}[out]`;
    execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', mix, '-map', '[out]', '-t', String(TL.total), sfx]);
  } else {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `anullsrc=r=48000:cl=mono`, '-t', String(TL.total), sfx]);
  }
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-i', narration, '-i', sfx,
    '-filter_complex', '[1:a]aresample=48000[v];[2:a]volume=0.35[s];[v][s]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=9[a]',
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-shortest', out]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`vídeo: ${out} (${(TL.total).toFixed(1)} s, ${total} quadros, ${((Date.now() - started) / 1000).toFixed(0)} s de render)`);
})().catch(e => { console.error(e); process.exit(1); });
