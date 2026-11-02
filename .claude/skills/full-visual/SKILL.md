---
name: full-visual
description: Explain any topic as a narrated explainer video (MP4, 1 to 1.5 minutes) with animated diagrams and captions, built with Hypit and a free local voice. Use when the user types /full-visual, or asks to explain something "visually", "com visual", "em vídeo", "de forma visual", or wants an animated, narrated explainer of how something works (hardware, software, systems, processes, science).
argument-hint: <topic to explain>
---

# /full-visual — narrated explainer video

Turn the topic in `$ARGUMENTS` (or the user's request) into a narrated explainer video and send the MP4 to the user.
`$SKILL` below means this skill's base directory (shown when the skill loads).

## Defaults (the user's settled choices)

- **Output:** an MP4 video, 1920×1080, 30 fps, **between 1:00 and 1:30**, with burned-in captions. Not a web page.
  Build a page (Artifact) only when the user explicitly asks for a page.
- **Voice:** Piper, local and free. Portuguese uses **`pt_BR-cadu-medium`** at `length-scale 1.08` (the user picked Cadu).
  For another language, pick a Piper voice for it (e.g. `en_US-ryan-medium`), tell the user, and offer samples.
  Paid voices (HypiHub, ElevenLabs, Fish Audio) only if the user asks, and never spend without their approval.
- **Language:** the language the user is talking to you in. If the topic arrives in another language, keep the
  conversation's language and say so in the reply.
- **Typos:** read an obvious typo through the conversation's context (e.g. "os5" after earlier PS5 talk means PS5) and state the reading.

## Workflow

Work in the scratchpad (or a temp folder): `W=<scratchpad>/<topic-slug>`.

1. **Scope.** One concrete subject, a curious non-expert audience, one question ("how does X work?").
   Ask one short question only if the ambiguity changes the video.
2. **Facts.** Use what you know reliably; verify recent, numeric or niche facts with a web search.
   Never invent figures. Label illustrative numbers as examples on screen.
3. **Setup.** `bash $SKILL/scripts/setup.sh $W [voice]` (≈1 min): Python venv with piper-tts and faster-whisper,
   the voice, fonts, the `hypit` executable and a Hypit project in `$W/project` copied from `$SKILL/template`.
4. **Script.** Write `$W/script.py` with `SCRIPT = [(scene_id, extra_seconds_at_end, [sentences...]), ...]`.
   6 to 9 scenes, one or two sentences each, about 150 to 170 words in total. Scene ids are lowercase (`abertura`, `hardware`, ...).
   Give the last scene about 1.8 s of extra time. Write for the ear (see "Speakable text").
5. **Narration.** `$W/.venv/bin/python $SKILL/scripts/build_audio.py $W/script.py $W/voices/<voice>.onnx $W/audio`
   prints the total length and the timing of every scene. Adjust the script until the total is between 60 and 90 s.
6. **Check the speech.** You cannot listen, so transcribe:
   `$W/.venv/bin/python $SKILL/scripts/asr_check.py $W/audio/frases $W/script.py pt`.
   Rewrite every sentence where a key word comes back wrong or the match is below about 90%, then test candidates with
   `asr_check.py --try $W/voices/<voice>.onnx pt "candidate 1" "candidate 2"`. Rebuild the narration after changes.
7. **Design.** Draw the scenes in `$W/design.html`, starting from the copy setup made of `design-starter.html`, and follow the
   conventions in its header comment (1280×720 stage, one `L-<scene>` layer per scene, `renderAt(t)` computes the full state
   from time alone, timings from `S.<scene>` / `sen()` / `wordT()`). Give each component of the subject one fixed color across
   all scenes. Use real units and terms from the subject. Draw everything (SVG/HTML), with no external images, logos or brand marks.
   Keep anything important above y=570 because the captions live below it. Check with
   `node $SKILL/scripts/stills.js $W/design.html $W/audio/timeline.json $W/sheet.png <times...>` and look at the sheet.
   Fix overlaps, clipped text or empty scenes, and look once more.
8. **Build with Hypit.** From `$W/project`:
   ```bash
   node tools/gen-template.mjs ../design.html ../fonts
   (cd packages/scenes && ../../node_modules/.bin/tsc -p tsconfig.json)
   ../.venv/bin/python tools/gen-svml.py ../script.py ../audio/frases
   npx --no hypit check runs/render.svrun
   npx --no hypit build runs/render.svrun --runtime hypit.runtime.json --follow   # run in background, ~3 min for 75 s
   npx --no hypit get <build-id> --output final.video --to output/<slug>.mp4
   ```
   Everything runs locally (`hypit plan` shows "no Provider charge"). Each sentence's audio length sets its window on the
   Timeline, so captions and scenes follow the voice.
9. **Verify the file.** `ffprobe` for duration (60 to 90 s), resolution and audio. Extract a dozen frames from the MP4 into a
   contact sheet (`ffmpeg -ss <t> ... tile=3x4`) and look at it: fonts, every scene, captions in sync.
10. **Deliver.** Send the MP4 with SendUserFile, then reply briefly in the user's language with what each part of the video
    shows, a 2 to 3 sentence answer to the question, and the caveats: the voice is synthetic and you cannot hear it (the
    transcription check is the evidence), which numbers are illustrative, and which version or model the facts apply to.

## Speakable text

- Write numbers as words ("dezesseis milissegundos"). Use abbreviations only when the voice handles them (SSD, CPU, PS5 are fine
  in Portuguese). Avoid English jargon that the voice reads with Portuguese rules.
- Short sentences. One idea each. Avoid word pairs that blur together. With Cadu, the known trouble spots are "um" before a
  short word ("roda um jogo"), "sem emulação" (it sounds like "simulação"), "ciclo", "desenha", "virabrequim" and "admissão".
  Rephrase instead of hoping, for example "roda seus jogos", "sem precisar de emulador", "repete as mesmas etapas".
- The captions show exactly the narrated text, so it must also read well on screen.

## Do not

- Do not reproduce copyrighted diagrams, logos or brand styling.
- Do not pad with filler stats or decorative numbering. Number steps only when they are a real sequence.
- Do not present illustrative numbers as measurements, and do not claim you listened to the audio.
