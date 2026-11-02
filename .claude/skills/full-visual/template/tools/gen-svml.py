"""Gera a produção Hypit a partir do roteiro e das frases gravadas.

Uso: python tools/gen-svml.py <script.py> <pasta-frases> [cor-de-fundo]
Escreve assets/voz/*.wav, authors/main.svml, style.svs, runs/render.svrun e hypit.runtime.json.
Cada frase ocupa a duração do próprio áudio; cada cena começa PRE segundos antes da primeira frase.
"""
import glob, json, os, runpy, shutil, sys

PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
script_path, frases = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
bg = sys.argv[3] if len(sys.argv) > 3 else "#0c1018"
cfg = runpy.run_path(script_path)
SCRIPT = cfg["SCRIPT"]
LEAD, GAP, SCENE_GAP, PRE = (cfg.get(k, d) for k, d in (("LEAD", 0.8), ("GAP", 0.35), ("SCENE_GAP", 0.55), ("PRE", 0.4)))
os.chdir(PROJ)
for d in ("assets/voz", "authors", "runs"):
    os.makedirs(d, exist_ok=True)
for old in glob.glob("assets/voz/*.wav"):
    os.remove(old)
for f in sorted(glob.glob(os.path.join(frases, "frase-*.wav"))):
    shutil.copy(f, "assets/voz/")

fr = lambda sec: f"{round(sec * 30)}f"   # deslocamentos em quadros inteiros (30 fps)
esc = lambda s: s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")
lines, parts, n, prev, prev_hold = [], [], 0, None, None
for sid, hold, sents in SCRIPT:
    for j, text in enumerate(sents):
        n += 1; lid = f"l{n:02d}"
        if n == 1: frm = f"start+{fr(LEAD)}"
        elif j == 0: frm = f"{prev}.end+{fr(prev_hold + SCENE_GAP)}"
        else: frm = f"{prev}.end+{fr(GAP)}"
        lines.append((lid, sid, text, frm)); prev = lid
    parts.append((sid, lines[-len(sents)][0])); prev_hold = hold
if len(glob.glob("assets/voz/*.wav")) != n:
    sys.exit(f"esperava {n} frases em {frases}; rode build_audio.py de novo")

o = ['<?svml using="@hypit/markup@1"?>', "<svml>",
     '  <import as="asset" from="@hypit/media@1"/>', '  <import as="mediaop" from="@hypit/media-operations@1"/>',
     '  <import as="time" from="@hypit/timeline-author@1"/>', '  <import as="spatial" from="@hypit/spatial@1"/>',
     '  <import as="audio" from="@hypit/audio-track@1"/>', '  <import as="film" from="@hypit/film@1"/>',
     '  <import as="html" from="@hypit/html-video@1"/>', '  <import as="ex" from="@explainer/scenes@1"/>',
     '  <import as="look" source="../style.svs"/>', "",
     '  <time:Clock id="clock" frame-rate="30"/>', '  <spatial:Canvas id="canvas" width="1920" height="1080"/>', ""]
for i in range(1, n + 1):
    o.append(f'  <asset:Audio id="f{i:02d}" src="../assets/voz/frase-{i:02d}.wav"/>')
    o.append(f'  <mediaop:Normalize id="v{i:02d}" source={{f{i:02d}}} clock={{clock}} video="none" audio="default" span-authority="audio"/>')
o += ["", f'  <time:Timeline id="program" clock={{clock}} end="l{n:02d}.end+{fr(SCRIPT[-1][1] + SCENE_GAP)}">']
for lid, sid, text, frm in lines:
    o.append(f'    <time:Window id="{lid}" from="{frm}" for={{v{lid[1:]}.extent}}/>')
for k, (sid, first) in enumerate(parts):
    start = "start" if k == 0 else f"{first}.start-{fr(PRE)}"
    until = "end" if k == len(parts) - 1 else f"{parts[k + 1][1]}.start-{fr(PRE)}"
    o.append(f'    <time:Window id="{sid}" from="{start}" until="{until}"/>')
o += ["  </time:Timeline>", "",
      '  <ex:Explainer id="ex" timeline={program.timeline} within={canvas.bounds} during={program.window}>']
for sid, first in parts:
    o.append(f'    <ex:Part name="{sid}" during={{program.{sid}}}/>')
    o += [f'    <ex:Line part="{sid}" text="{esc(text)}" during={{program.{lid}}}/>' for lid, s2, text, frm in lines if s2 == sid]
o += ["  </ex:Explainer>", "", '  <audio:Track id="voz" timeline={program.timeline}>']
o += [f'    <audio:Clip id="c{lid[1:]}" source={{v{lid[1:]}.media}} during={{program.{lid}}}/>' for lid, *_ in lines]
o += ["  </audio:Track>", "",
      '  <film:Film id="main" canvas={canvas.canvas} timeline={program.timeline} appearance={look.film.main}>',
      "    <film:Track source={ex.visual}/>", "    <film:Track source={voz.audio}/>", "  </film:Film>",
      '  <html:Video id="final" composition={main.composition} timeline={program.timeline}/>', "</svml>", ""]
open("authors/main.svml", "w").write("\n".join(o))
open("style.svs", "w").write(f'<?svml using="@hypit/recipe@1"?>\n<sheet version="1">\n  film.main {{ background: {bg}; }}\n</sheet>\n')
open("runs/render.svrun", "w").write('<?svml using="@hypit/markup/run@1"?>\n<svrun version="1">\n'
                                     '  <author source="../authors/main.svml"/>\n  <target output="final.video"/>\n</svrun>\n')
html_cfg = {"workers": max(1, min(4, (os.cpu_count() or 2) - 1)), "defaultConcurrency": 1}
if os.path.exists("/opt/pw-browsers/chromium"):   # Chromium pré-instalado no ambiente de nuvem
    html_cfg["chromePath"] = "/opt/pw-browsers/chromium"
json.dump({"format": "hypit.runtime-local@1", "dataRoot": ".hypit/runtimes/local", "endpoints": {
    "media.local": {"use": "@hypit/media-local", "config": {"defaultConcurrency": 2}},
    "html.local": {"use": "@hypit/provider-html-local", "config": html_cfg}}}, open("hypit.runtime.json", "w"), indent=2)
print(f"{n} frases, {len(parts)} cenas -> authors/main.svml")
