#!/usr/bin/env bash
# Prepara uma pasta de trabalho para um vídeo do /full-visual.
# Uso: setup.sh <pasta-de-trabalho> [voz-piper]   (voz padrão: pt_BR-cadu-medium)
# Cria: <pasta>/.venv (piper-tts, faster-whisper, numpy), <pasta>/voices/<voz>.onnx,
#       <pasta>/fonts (Archivo, Source Sans 3, JetBrains Mono + fonts.css) e <pasta>/design.html.
set -euo pipefail
WORK="${1:?informe a pasta de trabalho}"
VOICE="${2:-pt_BR-cadu-medium}"
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$WORK" && cd "$WORK"
# Ambientes com proxy de saída: usa o bundle de CA quando existir.
if [ -f /root/.ccr/ca-bundle.crt ]; then export REQUESTS_CA_BUNDLE=/root/.ccr/ca-bundle.crt SSL_CERT_FILE=/root/.ccr/ca-bundle.crt; fi
CURL=(curl -sSL --fail); [ -n "${SSL_CERT_FILE:-}" ] && CURL+=(--cacert "$SSL_CERT_FILE")

for tool in ffmpeg ffprobe node; do command -v $tool >/dev/null || { echo "falta $tool"; exit 1; }; done
node -e "require('playwright')" 2>/dev/null || echo "AVISO: Playwright não encontrado; rode 'npm i -g playwright && npx playwright install chromium'."

echo "== Python: piper-tts, faster-whisper"
[ -x .venv/bin/python ] || python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip >/dev/null
.venv/bin/pip install -q piper-tts faster-whisper numpy

echo "== Voz $VOICE"
mkdir -p voices
lang="${VOICE%%-*}"; family="${lang%%_*}"; rest="${VOICE#*-}"; name="${rest%-*}"; quality="${rest##*-}"
for ext in onnx onnx.json; do
  [ -s "voices/$VOICE.$ext" ] || "${CURL[@]}" -o "voices/$VOICE.$ext" \
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/$family/$lang/$name/$quality/$VOICE.$ext"
done

echo "== Fontes"
mkdir -p fonts
if [ ! -s fonts/fonts.css ]; then
  UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
  "${CURL[@]}" -A "$UA" "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,500..900&family=Source+Sans+3:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700&display=block" -o fonts/remote.css
  .venv/bin/python - <<'EOF'
import re, subprocess, os
css = open('fonts/remote.css').read()
blocks = re.findall(r'/\* ([\w-]+) \*/\s*(@font-face \{.*?\})', css, re.S)
out, n = [], 0
cmd = ['curl', '-sSL', '--fail'] + (['--cacert', os.environ['SSL_CERT_FILE']] if os.environ.get('SSL_CERT_FILE') else [])
for sub, b in blocks:
    if sub not in ('latin', 'latin-ext'): continue
    url = re.search(r'url\((https://[^)]+)\)', b).group(1)
    fn = f'f{n}.woff2'; n += 1
    subprocess.run(cmd + ['-o', 'fonts/' + fn, url], check=True)
    out.append(b.replace(url, fn))
open('fonts/fonts.css', 'w').write('\n'.join(out))
print(n, 'arquivos de fonte')
EOF
fi
[ -f design.html ] || cp "$SKILL/design-starter.html" design.html
echo "Pronto em $WORK"
