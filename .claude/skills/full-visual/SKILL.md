---
name: full-visual
description: Explain any topic as a dynamic, Reels-style vertical video (MP4 1080x1920, up to 1 minute) with narration, kinetic captions and animated diagrams, made with a free local voice. Use when the user types /full-visual, or asks to explain something "visually", "em vídeo", "estilo reels", "de forma visual", or wants a short animated, narrated explainer of how something works.
argument-hint: <topic to explain>
---

# /full-visual: explainer video in Reels style

Turn the topic in `$ARGUMENTS` (or the user's request) into a short, dynamic, vertical narrated video and send the MP4.
`$SKILL` below means this skill's base directory (shown when the skill loads).

## Defaults (the user's settled choices)

- **Format:** MP4, vertical 1080×1920, 30 fps, **at most 60 seconds** (aim for 40 to 55 s), Reels/TikTok style:
  a hook in the first 2 seconds, something new on screen every 1.5 to 3 s, kinetic captions with the spoken word
  highlighted, quick cuts with zoom, and a living background. No web page, unless the user explicitly asks for one.
- **Voice:** Piper, local and free. Portuguese uses **`pt_BR-cadu-medium`** at `length-scale 1.0` (the user picked Cadu).
  For another language, pick a Piper voice for it (e.g. `en_US-ryan-medium`) and tell the user.
  Paid voices only if the user asks, and never spend without their approval.
- **Language:** the language the user is talking to you in. If the topic arrives in another language, keep the
  conversation's language and say so in the reply.
- **Typos:** read an obvious typo through the conversation's context (e.g. "os5" after earlier PS5 talk means PS5) and state the reading.

## Workflow

Work in the scratchpad (or a temp folder): `W=<scratchpad>/<topic-slug>`.

1. **Scope.** One concrete subject and one question ("how does X work?"). Pick the single most surprising fact for the hook.
   Ask one short question only if the ambiguity changes the video.
2. **Facts.** Use what you know reliably. Verify recent, numeric or niche facts with a web search.
   Never invent figures. Label illustrative numbers as examples on screen.
3. **Setup.** `bash $SKILL/scripts/setup.sh $W [voice]` (about 1 min). It creates a venv with piper-tts and faster-whisper,
   the voice, the fonts and `$W/design.html` copied from `design-starter.html`. It needs ffmpeg, Node and Playwright,
   which the cloud environment already has.
4. **Script.** Write `$W/script.py` with `SCRIPT = [(scene_id, extra_seconds_at_end, [sentences...]), ...]`.
   - 6 to 9 scenes of 4 to 8 s each, usually one sentence per scene, about 110 to 140 words in total.
   - Scene 1 is the hook: a question or a surprising claim in under 2 s ("Seu PS5 tem só dezesseis milissegundos para...").
   - The last scene closes with a one-line takeaway. Give it about 1.2 s of extra time.
   - Write for the ear (see "Speakable text"). Scene ids are lowercase (`gancho`, `chip`, `ssd`, ...).
5. **Narration.** `$W/.venv/bin/python $SKILL/scripts/build_audio.py $W/script.py $W/voices/<voice>.onnx $W/audio`
   prints the total length and each scene's timing. Cut words until the total is at most 60 s.
6. **Check the speech.** You cannot listen, so transcribe:
   `$W/.venv/bin/python $SKILL/scripts/asr_check.py $W/audio/frases $W/script.py pt`.
   Rewrite every sentence where a key word comes back wrong or the match is below about 90%. Test candidates with
   `asr_check.py --try $W/voices/<voice>.onnx pt "candidate 1" "candidate 2"`, then rebuild the narration.
7. **Design.** Draw each scene in `$W/design.html`, following the rules in its header comment:
   - Stage 720×1280. One `L-<scene>` layer per scene, entered with `cut()`. `renderAt(t)` computes everything from time alone.
   - Content goes between y 150 and 820. The kinetic captions (y 850 to 1010), the stories-style progress bars,
     the camera kick on cuts and the moving background are already built in.
   - Make it dynamic: pop elements in with `pop()` exactly when their word is spoken (`wordT()`), count numbers up,
     draw arrows and bars growing, move a highlight across a diagram. Every scene needs at least two timed beats.
   - Big type, few words on screen, high contrast. One fixed color per component of the subject.
     Real units and terms from the subject. Draw everything (SVG/HTML), with no external images, logos or brand marks.
   - Check with `node $SKILL/scripts/stills.js $W/design.html $W/audio/timeline.json $W/sheet.png <times...>`
     (2 or 3 instants per scene), look at the sheet, fix overlaps, clipped text or static moments, and look once more.
8. **Render.** `node $SKILL/scripts/render.js $W/design.html $W/audio/timeline.json $W/audio/narration.wav $W/<slug>.mp4 3`.
   Run it in the background. It takes about 2.5 min per minute of video on 4 cores. It renders the frames in parallel,
   adds a soft whoosh at each scene cut, mixes in the narration and normalizes to -14 LUFS.
9. **Verify the file.** Use `ffprobe` to confirm the duration (at most 60 s), 1080×1920 and the audio stream. Extract about 10 frames
   from the MP4 into a contact sheet (`ffmpeg -ss <t> ...`, then `tile=5x2`) and look at it.
10. **Deliver.** Send the MP4 with SendUserFile, then reply briefly in the user's language: what each part shows,
    a 2 to 3 sentence answer to the question, and the caveats. The voice is synthetic and you cannot hear it (the
    transcription check is the evidence). Say which numbers are illustrative and which version or model the facts apply to.

## Speakable text

- Write numbers as words ("dezesseis milissegundos"). Use abbreviations only when the voice handles them (SSD, CPU and PS5 work
  in Portuguese). Avoid English jargon that the voice reads with Portuguese rules.
- Short, punchy sentences with one idea each, spoken the way a creator talks to the viewer ("você", questions, contrast).
- With Cadu, these spots are known to blur: "um" before a short word ("roda um jogo"), "sem emulação" (it sounds like
  "simulação"), "ciclo", "desenha", "virabrequim", "admissão". Rephrase them, for example "roda seus jogos",
  "sem precisar de emulador" or "repete as mesmas etapas".
- The captions show exactly the narrated text, so it must also read well on screen.

## Do not

- Do not go over 60 seconds.
- Do not reproduce copyrighted diagrams, logos or brand styling.
- Do not pad with filler stats or emoji decoration.
- Do not present illustrative numbers as measurements, and do not claim you listened to the audio.
