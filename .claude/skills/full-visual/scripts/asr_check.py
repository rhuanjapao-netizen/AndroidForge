"""Transcreve cada frase gerada e compara com o roteiro, para achar palavras que a voz embola.

Uso: .venv/bin/python asr_check.py <pasta-frases> <script.py> [idioma=pt]
Também testa frases soltas:  asr_check.py --try <voz.onnx> [idioma] "frase 1" "frase 2" ...
"""
import glob, os, re, runpy, subprocess, sys, tempfile, unicodedata
import numpy as np
from faster_whisper import WhisperModel

model = WhisperModel("small", device="cpu", compute_type="int8")
norm = lambda s: re.sub(r"[^a-z0-9 ]", "", unicodedata.normalize("NFKD", s.lower()).encode("ascii", "ignore").decode()).split()


def hear(path, lang):
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    segs, _ = model.transcribe(np.frombuffer(pcm, np.int16).astype(np.float32) / 32768, language=lang, beam_size=5)
    return " ".join(s.text.strip() for s in segs)


if sys.argv[1] == "--try":
    voice, lang, texts = sys.argv[2], sys.argv[3], sys.argv[4:]
    piper = os.path.join(os.path.dirname(sys.executable), "piper")
    for text in texts:
        wav = tempfile.mktemp(suffix=".wav")
        subprocess.run([piper, "-m", voice, "-f", wav, "--length-scale", "1.08"], input=text.encode(), check=True, capture_output=True)
        print(f"{text}\n   -> {hear(wav, lang)}")
    sys.exit()

folder, script_path = sys.argv[1], sys.argv[2]
lang = sys.argv[3] if len(sys.argv) > 3 else "pt"
texts = [t for _, _, ss in runpy.run_path(script_path)["SCRIPT"] for t in ss]
for i, path in enumerate(sorted(glob.glob(os.path.join(folder, "frase-*.wav")))):
    heard = hear(path, lang)
    a, b = set(norm(texts[i])), set(norm(heard))
    print(f"{i + 1:02d} {len(a & b) / max(1, len(a)):4.0%} | roteiro: {texts[i]}\n            ouvido:  {heard}")
