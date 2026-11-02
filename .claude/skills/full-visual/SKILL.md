---
name: full-visual
description: Explain any topic as a complete visual explainer page (published Artifact) with diagrams, step sequences, comparisons and at least one interactive element. Use when the user types /full-visual, or asks to explain something "visually", "com visual", "de forma visual", or wants a diagram-heavy explainer of how something works (hardware, software, systems, processes, science).
argument-hint: <topic to explain>
---

# /full-visual — visual explainer

Turn the topic in `$ARGUMENTS` (or the user's request) into a single, polished, self-contained visual explainer page and publish it as an Artifact.

## Language

Write the page in the language the user used in the request (e.g. Portuguese request → Portuguese page). Keep technical units and proper names as they are.

## Workflow

1. **Scope the topic.** Pin down one concrete subject, the audience (curious non-expert unless stated otherwise) and the single question the page answers ("how does X work?"). If the topic is ambiguous in a way that changes the page, ask one short question; otherwise pick a sensible default and state it in the page footer.
2. **Gather facts.** Use what you know reliably. For recent, numeric or niche facts (specs, prices, dates, versions), verify with a web search. Never invent figures; when a number is illustrative, label it as an example.
3. **Start the artifact.** Call the Artifact tool with `action: "quickstart"` and `intent: "other"`, and follow the page-design guidance it returns (theme tokens for light and dark, side gutter, phone width, CDN rules, title rules).
4. **Build the page** using the structure below, write it to the scratchpad directory, and publish it in the same response.
5. **Reply briefly**: the link, a bulleted list of what each section shows, a 2–3 sentence plain-language summary of the answer, and any caveats (approximate or illustrative figures).

## Page structure

Pick the sections that fit the subject; most explainers use 4–6 of these:

- **Hero**: a plain-language answer to the question in 2–3 sentences. No giant viewport-height banner.
- **Big-picture diagram**: an inline SVG block diagram of the main parts and how data, energy or material flows between them. Label every box with its real name and one key figure (units, sizes, speeds).
- **Step sequence**: a numbered list only when the content is a real sequence (e.g. "what happens when you press start").
- **Interactive element** (at least one): a toggle, slider or set of buttons that changes a diagram or timeline so the reader can explore one variable (e.g. frame rate → time budget, voltage → current).
- **Comparison**: side-by-side cards or bars against a familiar alternative (old vs new, PC vs console, A vs B), drawn to scale.
- **Layers / architecture**: a stacked diagram when the subject has layers (software stacks, protocol stacks, anatomy).
- **Extras**: short cards for secondary facts.
- **Footer**: which version, model or scope the figures apply to, and which numbers are illustrative.

## Visual rules

- Inline SVG for diagrams, with colors taken from CSS tokens (`fill: var(--token)`) so they work in both themes. Wrap wide SVGs in an `overflow-x: auto` container.
- Give each major component one consistent color across every diagram and card on the page (e.g. CPU always orange, GPU always blue).
- Use real units and terms of art from the subject. One detail only this subject would have, shown as content.
- Plain, short sentences. Explain jargon the first time it appears.
- Use no images from external hosts (the artifact CSP blocks them). Draw everything or use data: URIs.
- Use no external JS libraries unless one does substantial work. Small vanilla JS is enough for the interactive part.
- Respect `prefers-reduced-motion`, and give every button a visible keyboard focus state.

## Do not

- Do not reproduce copyrighted diagrams or official logos and branding.
- Do not pad the page with decorative numbering, emoji section markers or filler stats.
- Do not present illustrative numbers as measurements.
