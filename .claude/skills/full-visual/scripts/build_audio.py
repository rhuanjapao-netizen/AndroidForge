"""Gera a narração frase a frase com Piper e calcula a linha do tempo.

Uso: .venv/bin/python build_audio.py <script.py> <voz.onnx> <pasta-de-saída> [length-scale]

<script.py> define SCRIPT = [(cena, segundos-extras-no-fim, [frases...]), ...] e pode definir
LEAD, GAP, SCENE_GAP, PRE (padrões abaixo). Saída: frases/frase-NN.wav, narration.wav, timeline.json.
"""
import hashlib, json, os, runpy, subprocess, sys, wave

script_path, model, out = sys.argv[1], sys.argv[2], sys.argv[3]
length = float(sys.argv[4]) if len(sys.argv) > 4 else 1.08
cfg = runpy.run_path(script_path)
SCRIPT = cfg["SCRIPT"]
LEAD, GAP, SCENE_GAP, PRE = (cfg.get(k, d) for k, d in (("LEAD", 0.8), ("GAP", 0.35), ("SCENE_GAP", 0.55), ("PRE", 0.4)))
piper = os.path.join(os.path.dirname(sys.executable), "piper")
cache = os.path.join(out, ".tts-cache"); frases = os.path.join(out, "frases")
os.makedirs(cache, exist_ok=True); os.makedirs(frases, exist_ok=True)
RATE = 48000


def clip(text):
    key = hashlib.sha1(f"{model}|{text}|{length}".encode()).hexdigest()[:16]
    raw, pcm = os.path.join(cache, key + ".wav"), os.path.join(cache, key + ".s16")
    if not os.path.exists(raw):
        subprocess.run([piper, "-m", model, "-f", raw, "--length-scale", str(length), "--sentence-silence", "0.3"],
                       input=text.encode(), check=True, capture_output=True)
    if not os.path.exists(pcm):
        trim = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.04"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-af", f"{trim},areverse,{trim},areverse",
                        "-ac", "1", "-ar", str(RATE), "-f", "s16le", pcm], check=True)
    return open(pcm, "rb").read()


t, n, scenes, pieces = LEAD, 0, [], []
for i, (sid, hold, sentences) in enumerate(SCRIPT):
    start = 0.0 if i == 0 else t - PRE
    sents = []
    for j, text in enumerate(sentences):
        data = clip(text); dur = len(data) / 2 / RATE; n += 1
        sents.append({"n": n, "text": text, "start": round(t, 3), "end": round(t + dur, 3)})
        pieces.append((t, data, n))
        t += dur + (GAP if j < len(sentences) - 1 else 0)
    t += hold
    scenes.append({"id": sid, "start": round(start, 3), "sentences": sents})
    t += SCENE_GAP
for i, s in enumerate(scenes):
    s["end"] = scenes[i + 1]["start"] if i + 1 < len(scenes) else round(t, 3)
for old in os.listdir(frases):
    os.remove(os.path.join(frases, old))
buf = bytearray(int(t * RATE) * 2 + 4)
for start, data, k in pieces:
    o = int(start * RATE) * 2; buf[o:o + len(data)] = data
    with wave.open(os.path.join(frases, f"frase-{k:02d}.wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(data)
with wave.open(os.path.join(out, "narration.wav"), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(bytes(buf))
json.dump({"total": round(t, 3), "scenes": scenes}, open(os.path.join(out, "timeline.json"), "w"), ensure_ascii=False, indent=1)
print(f"total {t:.1f}s")
for s in scenes:
    print(f"{s['id']:<12}{s['start']:6.1f} → {s['end']:6.1f}  " + "  ".join(f"[{x['start']:.1f}-{x['end']:.1f}]" for x in s["sentences"]))
