import { sealVisualTrack } from "@hypit/composition";
import { htmlVisual } from "@hypit/html-program";
import type { Timeline } from "@hypit/timeline";
import type { SpatialFrame } from "@hypit/spatial";
import { assertTemporalWindowFor } from "@hypit/temporal";
import type { TemporalWindow } from "@hypit/temporal";
import { CSS, FONT_CSS, HTML, SETUP } from "./template.generated.js";

/** A Part is one scene of the explainer; a Line is one narrated sentence inside a Part. */
export type Item = { kind: "part" | "line"; name: string; text?: string; window: TemporalWindow };
export type ExplainerOptions = { id: string };
const DESIGN_WIDTH = 1280;

/** The scene drawings live in the generated template; Source supplies when each scene and sentence happens. */
export function renderExplainer(timeline: Timeline, within: SpatialFrame, window: TemporalWindow,
  items: readonly Item[], options: ExplainerOptions) {
  assertTemporalWindowFor(window, { subjectId: options.id, timeline });
  const fps = timeline.frameRate.numerator / timeline.frameRate.denominator;
  const origin = window.span.startFrame;
  const seconds = (frame: number) => Math.round(((frame - origin) / fps) * 1000) / 1000;
  const inside = (w: TemporalWindow) => w.span.startFrame >= window.span.startFrame && w.span.endFrameExclusive <= window.span.endFrameExclusive;
  const parts = items.filter(item => item.kind === "part").sort((a, b) => a.window.span.startFrame - b.window.span.startFrame);
  if (!parts.length) throw new Error("Explainer needs at least one Part.");
  for (const item of items) {
    if (!inside(item.window)) throw new Error(`Explainer ${item.kind} ${item.name} must fall inside the Explainer window.`);
    if (item.kind === "line" && !parts.some(part => part.name === item.name)) throw new Error(`Line refers to unknown Part ${item.name}.`);
  }
  const scenes = parts.map(part => {
    const sentences = items.filter(item => item.kind === "line" && item.name === part.name)
      .sort((a, b) => a.window.span.startFrame - b.window.span.startFrame)
      .map(line => ({ text: line.text ?? "", start: seconds(line.window.span.startFrame), end: seconds(line.window.span.endFrameExclusive) }));
    if (!sentences.length) throw new Error(`Part ${part.name} needs at least one Line.`);
    return { id: part.name, start: seconds(part.window.span.startFrame), end: seconds(part.window.span.endFrameExclusive), sentences };
  });
  const program = htmlVisual({
    html: `<style>${FONT_CSS}</style>${HTML}`,
    css: CSS,
    setup: SETUP,
    data: { fps, scale: within.widthPx / DESIGN_WIDTH, TL: { total: seconds(window.span.endFrameExclusive), scenes } },
  });
  return sealVisualTrack({ id: options.id, timelineId: timeline.id, visualIr: "hypit.visual-ir@1",
    presents: [{ id: options.id, order: 0, z: 0, span: window.span,
      elements: [{ id: "explainer", kind: "program", order: 0, program,
        style: [{ name: "position", value: "absolute" }, { name: "left", value: `${within.xPx}px` },
          { name: "top", value: `${within.yPx}px` }, { name: "width", value: `${within.widthPx}px` },
          { name: "height", value: `${within.heightPx}px` }, { name: "overflow", value: "hidden" }] }] }] });
}
